import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

/**
 * Renders a certificate PDF in-browser using a background image template and triggers a download.
 * cert = { cert_number, employee_name, course_name, issued_date, trainer_name, final_score }
 */
export async function downloadCertificatePdf(cert) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([842, 595]) // A4 landscape dimensions

  try {
    // 1. تحميل صورة الشهادة الفاضية من مجلد public
    const imageBytes = await fetch('/certificate-template.png').then((res) => {
      if (!res.ok) throw new Error('Failed to load certificate template image')
      return res.arrayBuffer()
    })

    // 2. تضمين الصورة في الـ PDF (لو PNG أو JPG حسب امتداد صورتك)
    let embeddedImage
    try {
      embeddedImage = await doc.embedPng(imageBytes)
    } catch {
      embeddedImage = await doc.embedJpg(imageBytes)
    }

    // 3. رسم الصورة كخلفية تغطي الصفحة بالكامل
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: 842,
      height: 595,
    })
  } catch (err) {
    console.warn('Could not load certificate template image, falling back to clean layout:', err)
  }

  // تحميل الخطوط
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica)

  // الألوان (تأكد إنها متناسقة مع تصميمك أو عدلها حسب الألوان)
  const navy = rgb(0x1b / 255, 0x2a / 255, 0x4a / 255)
  const teal = rgb(0x0f / 255, 0x7a / 255, 0x6b / 255)
  const gray = rgb(0x66 / 255, 0x70 / 255, 0x85 / 255)

  // 4. كتابة البيانات المتغيرة فوق التصميم (الإحداثيات Y و X ممكن تعدلها لو محتاج تضبط مكانها بدقة على صورتك)
  
  // اسم الموظف
  if (cert.employee_name) {
    const nameSize = 26
    const textWidth = font.widthOfTextAtSize(cert.employee_name, nameSize)
    page.drawText(cert.employee_name, {
      x: 421 - textWidth / 2,
      y: 345,
      size: nameSize,
      font,
      color: teal,
    })
  }

  // اسم الكورس
  if (cert.course_name) {
    const courseSize = 20
    const textWidth = font.widthOfTextAtSize(cert.course_name, courseSize)
    page.drawText(cert.course_name, {
      x: 421 - textWidth / 2,
      y: 285,
      size: courseSize,
      font,
      color: navy,
    })
  }

  // اسم المدرب
  if (cert.trainer_name) {
    page.drawText(cert.trainer_name, { x: 100, y: 112, size: 10, font: bodyFont, color: gray })
  }

  // تاريخ الإصدار
  if (cert.issued_date) {
    page.drawText(cert.issued_date, { x: 542, y: 112, size: 10, font: bodyFont, color: gray })
  }

  // رقم الشهادة (ID)
  if (cert.cert_number) {
    page.drawText(`Certificate ID: ${cert.cert_number}`, { x: 60, y: 50, size: 9, font: bodyFont, color: gray })
  }

  // حفظ الملف وتوليد رابط التحميل
  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${cert.cert_number || 'certificate'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
