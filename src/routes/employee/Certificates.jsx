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
const courseName = c.course?.name || c.course_name || c.name || 'Course Completion'

            return (
              <div key={c.id || c.cert_number} className="card p-5 flex flex-col justify-between bg-[#14181d]/85 border border-white/10 rounded-2xl backdrop-blur-xl text-white">
                <div className="space-y-2">
                  {/* عرض اسم الكورس الحقيقي الديناميكي */}
                  <h3 className="font-semibold text-lg text-rose-300">{courseName}</h3>
                  <p className="text-xs text-gray-400">Cert ID: {c.cert_number || 'N/A'}</p>
                  <p className="text-xs text-gray-400">Issued: {c.issued_date || '—'} · Score: {c.final_score || 100}%</p>
                </div>
                <button
                  className="mt-4 px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-medium transition-colors shadow-lg text-sm"
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
