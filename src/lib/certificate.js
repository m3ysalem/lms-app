import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function downloadCertificatePdf(cert) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([842, 595]) // A4 Landscape

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

  // استخدام فونت فاخر ومودرن (TimesRomanBold) للاسم والكورس
  const font = await doc.embedFont(StandardFonts.TimesRomanBold)
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica)

  // الألوان (الأحمر المتناسق مع اللوجو ودرجات الألوان الرسمية)
  const brandRed = rgb(0x8b / 255, 0x1e / 255, 0x24 / 255)
  const navy = rgb(0x1b / 255, 0x2a / 255, 0x4a / 255)
  const gray = rgb(0x66 / 255, 0x70 / 255, 0x85 / 255)

  const safeDrawText = (text, options) => {
    try {
      if (!text) return
      page.drawText(String(text), options)
    } catch (e) {
      console.warn('Skipped text due to encoding error:', text, e)
    }
  }

  // 1. اسم الموظف
  if (cert.employee_name) {
    const nameSize = 28
    const textWidth = font.widthOfTextAtSize(cert.employee_name, nameSize)
    safeDrawText(cert.employee_name, {
      x: 421 - textWidth / 2,
      y: 320, 
      size: nameSize,
      font,
      color: brandRed,
    })
  }

  // 2. اسم الكورس (تم رفعه لفوق لتجنب التداخل عن طريق زيادة قيمة الـ y إلى 265)
  if (cert.course_name) {
    const courseSize = 22
    let courseRaw = cert.course_name
    
    const courseText = courseRaw.toLowerCase().includes('course') ? courseRaw : `${courseRaw} Course`
    const textWidth = font.widthOfTextAtSize(courseText, courseSize)
    
    safeDrawText(courseText, {
      x: 421 - textWidth / 2,
      y: 265,
      size: courseSize,
      font,
      color: navy,
    })
  }

  // اسم المدرب (إن وجد)
  if (cert.trainer_name && !/[\u0600-\u06FF]/.test(cert.trainer_name)) {
    safeDrawText(cert.trainer_name, { x: 100, y: 112, size: 10, font: bodyFont, color: gray })
  }

  // تاريخ الإصدار
  if (cert.issued_date) {
    safeDrawText(cert.issued_date, { x: 542, y: 112, size: 10, font: bodyFont, color: gray })
  }

  // رقم الشهادة
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
