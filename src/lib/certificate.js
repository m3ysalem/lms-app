import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function downloadCertificatePdf(cert) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([842, 595])

  try {
    const imageBytes = await fetch('/certificate-template.png').then((res) => {
      if (!res.ok) throw new Error('Failed to load template')
      return res.arrayBuffer()
    })
    let embeddedImage
    try {
      embeddedImage = await doc.embedPng(imageBytes)
    } catch {
      embeddedImage = await doc.embedJpg(imageBytes)
    }
    page.drawImage(embeddedImage, { x: 0, y: 0, width: 842, height: 595 })
  } catch (err) {
    console.warn('Template load failed:', err)
  }

  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica)

  const navy = rgb(0x1b / 255, 0x2a / 255, 0x4a / 255)
  const teal = rgb(0x0f / 255, 0x7a / 255, 0x6b / 255)
  const gray = rgb(0x66 / 255, 0x70 / 255, 0x85 / 255)

  // دالة أمان لمنع أي خطأ لو النص فيه عربي
  const safeDrawText = (text, options) => {
    try {
      if (!text) return
      // لو حابب تتأكد، لو النص فيه عربي ممكن تطبع نص بديل أو تتخطاه
      page.drawText(String(text), options)
    } catch (e) {
      console.warn('Skipped text due to encoding error:', text, e)
    }
  }

  if (cert.employee_name) {
    const nameSize = 26
    const textWidth = font.widthOfTextAtSize(cert.employee_name, nameSize)
    safeDrawText(cert.employee_name, {
      x: 421 - textWidth / 2,
      y: 345,
      size: nameSize,
      font,
      color: teal,
    })
  }

  if (cert.course_name) {
    const courseSize = 20
    // لو اسم الكورس عربي، هنحوله لإنجليزي مؤقتاً أو نتخطاه عشان الـ PDF ما يضربش
    const courseText = /[\u0600-\u06FF]/.test(cert.course_name) ? "Course Completion Certificate" : cert.course_name
    const textWidth = font.widthOfTextAtSize(courseText, courseSize)
    safeDrawText(courseText, {
      x: 421 - textWidth / 2,
      y: 285,
      size: courseSize,
      font,
      color: navy,
    })
  }

  if (cert.trainer_name && !/[\u0600-\u06FF]/.test(cert.trainer_name)) {
    safeDrawText(cert.trainer_name, { x: 100, y: 112, size: 10, font: bodyFont, color: gray })
  }

  if (cert.issued_date) {
    safeDrawText(cert.issued_date, { x: 542, y: 112, size: 10, font: bodyFont, color: gray })
  }

  if (cert.cert_number) {
    safeDrawText(`ID: ${cert.cert_number}`, { x: 60, y: 50, size: 9, font: bodyFont, color: gray })
  }

  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${cert.cert_number || 'certificate'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
