import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublishedCourses, getMyAssignments } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Badge, Spinner } from '../../components/Ui'

const TYPE_LABEL = {
  classroom: 'Classroom', online: 'Online', video: 'Video', e_learning: 'E-Learning',
  workshop: 'Workshop', external: 'External', webinar: 'Webinar', blended: 'Blended',
}

export default function Courses() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState(null)
  const [assignedIds, setAssignedIds] = useState(new Set())
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    Promise.all([getPublishedCourses(), getMyAssignments(profile.id)]).then(([c, a]) => {
      setCourses(c)
      setAssignedIds(new Set(a.map((x) => x.course.id)))
    })
  }, [profile?.id])

  const categories = useMemo(() => {
    if (!courses) return []
    return [...new Set(courses.map((c) => c.category?.name).filter(Boolean))]
  }, [courses])

  const filtered = useMemo(() => {
    if (!courses) return []
    return courses.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = !category || c.category?.name === category
      return matchesSearch && matchesCategory
    })
  }, [courses, search, category])

  if (!courses) return <Spinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Course catalog</h1>
        <p className="text-muted mt-1">Browse every published training course.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input className="input sm:max-w-xs" placeholder="Search courses…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input sm:max-w-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <Link to={`/courses/${c.id}`} key={c.id} className="card p-4 flex flex-col hover:border-teal transition-colors">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-ink-800">{c.name}</p>
              {assignedIds.has(c.id) && <Badge tone="success">Assigned</Badge>}
            </div>
            <p className="text-sm text-muted mt-1.5 line-clamp-2 flex-1">{c.description}</p>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted">
              <Badge>{TYPE_LABEL[c.training_type]}</Badge>
              <span>{c.duration_minutes} min</span>
              {c.trainer?.profile?.full_name && <span>· {c.trainer.profile.full_name}</span>}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <p className="text-muted col-span-full">No courses match your filters.</p>}
      </div>
    </div>
  )
}
