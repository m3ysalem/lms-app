-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- Run after 02_rls.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth.users row is created.
-- Role defaults to 'employee'; promote via the admin UI (updates profiles.role,
-- which only an admin's RLS policy allows).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, employee_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee'),
    'EMP-' || lpad(nextval('employee_code_seq')::text, 5, '0')
  );
  return new;
end;
$$;

create sequence if not exists employee_code_seq start 1;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Quiz delivery WITHOUT leaking is_correct: the client calls this instead of
-- querying quiz_questions/quiz_answers directly.
-- ----------------------------------------------------------------------------
create or replace function public.get_quiz_for_attempt(p_quiz_id uuid)
returns table (
  question_id uuid,
  question_text text,
  question_type question_type,
  points integer,
  sort_order integer,
  answer_id uuid,
  answer_text text,
  answer_sort_order integer
)
language sql security definer stable
set search_path = public
as $$
  select q.id, q.question_text, q.question_type, q.points, q.sort_order,
         a.id, a.answer_text, a.sort_order
  from quiz_questions q
  join quiz_answers a on a.question_id = q.id
  where q.quiz_id = p_quiz_id
    and exists (
      select 1 from quizzes qz
      join course_assignments ca on ca.course_id = qz.course_id
      where qz.id = p_quiz_id and ca.employee_id = auth.uid()
    )
  order by q.sort_order, a.sort_order;
$$;

-- ----------------------------------------------------------------------------
-- Server-validated quiz submission: the client posts its selections, this
-- function computes the score from the *real* is_correct flags (so a client
-- can never fabricate a passing score), inserts quiz_results + finalizes the
-- quiz_attempts row, and returns the outcome.
-- p_answers: jsonb array like [{"question_id":"...","selected_answer_ids":["..."]}]
-- ----------------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb)
returns table (score_points integer, total_points integer, percentage numeric, passed boolean)
language plpgsql security definer
set search_path = public
as $$
declare
  v_quiz_id uuid;
  v_employee_id uuid;
  v_passing_score integer;
  v_total_points integer := 0;
  v_score_points integer := 0;
  v_item jsonb;
  v_question record;
  v_selected uuid[];
  v_correct_ids uuid[];
  v_is_correct boolean;
begin
  select quiz_id, employee_id into v_quiz_id, v_employee_id
  from quiz_attempts where id = p_attempt_id;

  if v_employee_id is distinct from auth.uid() then
    raise exception 'Not authorized to submit this attempt';
  end if;

  select passing_score into v_passing_score from quizzes where id = v_quiz_id;

  for v_item in select * from jsonb_array_elements(p_answers) loop
    select id, points into v_question
    from quiz_questions where id = (v_item->>'question_id')::uuid;

    v_total_points := v_total_points + v_question.points;

    select array_agg(id) into v_correct_ids
    from quiz_answers where question_id = v_question.id and is_correct = true;

    select array_agg((x)::uuid) into v_selected
    from jsonb_array_elements_text(v_item->'selected_answer_ids') as x;

    v_is_correct := (
      v_selected is not null and v_correct_ids is not null
      and v_selected @> v_correct_ids and v_correct_ids @> v_selected
    );

    if v_is_correct then
      v_score_points := v_score_points + v_question.points;
    end if;

    insert into quiz_results (attempt_id, question_id, selected_answer_ids, is_correct)
    values (p_attempt_id, v_question.id, coalesce(v_selected, '{}'), coalesce(v_is_correct, false));
  end loop;

  update quiz_attempts
  set submitted_at = now(),
      score_points = v_score_points,
      total_points = v_total_points,
      percentage = case when v_total_points > 0
                        then round((v_score_points::numeric / v_total_points) * 100, 2)
                        else 0 end,
      passed = case when v_total_points > 0
                     then (round((v_score_points::numeric / v_total_points) * 100, 2) >= v_passing_score)
                     else false end
  where id = p_attempt_id;

  return query
    select qa.score_points, qa.total_points, qa.percentage, qa.passed
    from quiz_attempts qa where qa.id = p_attempt_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Certificate issuance: only callable server-side logic path (SECURITY
-- DEFINER), generates a unique CERT-YYYY-NNNNNN number and inserts the row.
-- The frontend calls this after confirming a passing quiz_attempts row
-- exists for a certificate_eligible course; the function re-checks that
-- itself rather than trusting the client.
-- ----------------------------------------------------------------------------
create sequence if not exists certificate_seq start 1;

create or replace function public.issue_certificate(p_course_id uuid)
returns certificates
language plpgsql security definer
set search_path = public
as $$
declare
  v_employee uuid := auth.uid();
  v_eligible boolean;
  v_passing_score integer;
  v_best_pct numeric;
  v_cert certificates;
  v_trainer_name text;
  v_year text := to_char(now(), 'YYYY');
begin
  select certificate_eligible, passing_score into v_eligible, v_passing_score
  from courses where id = p_course_id;

  if not v_eligible then
    raise exception 'This course is not certificate-eligible';
  end if;

  select max(qa.percentage) into v_best_pct
  from quiz_attempts qa
  join quizzes qz on qz.id = qa.quiz_id
  where qz.course_id = p_course_id and qa.employee_id = v_employee and qa.passed = true;

  if v_best_pct is null then
    raise exception 'No passing quiz attempt found for this course';
  end if;

  select p.full_name into v_trainer_name
  from courses c join trainers t on t.id = c.trainer_id join profiles p on p.id = t.profile_id
  where c.id = p_course_id;

  insert into certificates (cert_number, course_id, employee_id, final_score, trainer_name)
  values (
    'CERT-' || v_year || '-' || lpad(nextval('certificate_seq')::text, 6, '0'),
    p_course_id, v_employee, v_best_pct, v_trainer_name
  )
  on conflict do nothing
  returning * into v_cert;

  if v_cert.id is null then
    select * into v_cert from certificates where course_id = p_course_id and employee_id = v_employee;
  end if;

  return v_cert;
end;
$$;

-- ----------------------------------------------------------------------------
-- Audit logging trigger, attached to the tables the spec calls out.
-- ----------------------------------------------------------------------------
create or replace function public.log_audit_event()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into audit_logs (user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    tg_op || '_' || tg_table_name,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_courses on courses;
create trigger audit_courses after insert or update or delete on courses
  for each row execute function log_audit_event();

drop trigger if exists audit_profiles on profiles;
create trigger audit_profiles after insert or update or delete on profiles
  for each row execute function log_audit_event();

drop trigger if exists audit_assignments on course_assignments;
create trigger audit_assignments after insert or update or delete on course_assignments
  for each row execute function log_audit_event();

drop trigger if exists audit_certificates on certificates;
create trigger audit_certificates after insert on certificates
  for each row execute function log_audit_event();

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists touch_profiles on profiles;
create trigger touch_profiles before update on profiles
  for each row execute function touch_updated_at();

drop trigger if exists touch_courses on courses;
create trigger touch_courses before update on courses
  for each row execute function touch_updated_at();
