import React, { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getMyCertificates } from '../../lib/api'
import { downloadCertificatePdf } from '../../lib/certificate'
import { Spinner, EmptyState } from '../../components/Ui'

export default function Certificates() {
  const { profile } = useAuth()
  const [certs, setCerts] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    getMyCertificates(profile.id)
      .then((data) => {
        // تأكد من جلب البيانات بشكل سليم ومعالجة أي صيغة غير متوقعة
        setCerts(data || [])
      })
      .catch((err) => {
        console.error('Failed to load certificates:', err)
        setCerts([])
      })
  }, [profile?.id])

  if (!certs) return <Spinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Certificates</h1>
        <p className="text-muted mt-1">Everything you've earned so far.</p>
      </div>

      {certs.length === 0 ? (
        <EmptyState title="No certificates yet" body="Complete a certificate-eligible course and pass its quiz to earn one." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {certs.map((c) => {
            // معالجة آمنة لاسم الكورس وبيانات الشهادة لضمان عدم ظهور قيم فارغة
            const courseName = c.course?.name || c.course_name || 'Course Completion'
            const employeeName = profile?.full_name || c.employee_name || 'Employee'

            return (
              <div key={c.id || c.cert_number} className="card p-5 flex flex-col">
                <p className="font-medium text-ink-800">{courseName}</p>
                <p className="text-xs text-muted mt-1">{c.cert_number || 'N/A'}</p>
                <p className="text-xs text-muted">Issued {c.issued_date || '—'} · Score {c.final_score || 100}%</p>
                <button
                  className="btn-secondary mt-4"
                  onClick={() => downloadCertificatePdf({
                    cert_number: c.cert_number,
                    employee_name: employeeName,
                    course_name: courseName,
                    issued_date: c.issued_date,
                    trainer_name: c.trainer_name,
                    final_score: c.final_score,
                  })}
                >
                  Download PDF
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
