import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

/**
 * Renders a certificate PDF in-browser and triggers a download.
 * cert = { cert_number, employee_name, course_name, issued_date, trainer_name, final_score }
 */
export async function downloadCertificatePdf(cert) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([842, 595]) // A4 landscape
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica)

  const navy = rgb(0x1b / 255, 0x2a / 255, 0x4a / 255)
  const teal = rgb(0x0f / 255, 0x7a / 255, 0x6b / 255)
  const gray = rgb(0x66 / 255, 0x70 / 255, 0x85 / 255)

  // Border
  page.drawRectangle({ x: 20, y: 20, width: 802, height: 555, borderColor: navy, borderWidth: 3 })
  page.drawRectangle({ x: 30, y: 30, width: 782, height: 535, borderColor: teal, borderWidth: 1 })

  page.drawText('MERIDIAN', { x: 60, y: 500, size: 22, font, color: navy })
  page.drawText('Learning & Development', { x: 60, y: 480, size: 10, font: bodyFont, color: gray })

  page.drawText('Certificate of Completion', {
    x: 421 - font.widthOfTextAtSize('Certificate of Completion', 30) / 2,
    y: 420,
    size: 30,
    font,
    color: navy,
  })

  page.drawText('This certifies that', {
    x: 421 - bodyFont.widthOfTextAtSize('This certifies that', 12) / 2,
    y: 380,
    size: 12,
    font: bodyFont,
    color: gray,
  })

  page.drawText(cert.employee_name, {
    x: 421 - font.widthOfTextAtSize(cert.employee_name, 26) / 2,
    y: 345,
    size: 26,
    font,
    color: teal,
  })

  const line2 = `has successfully completed the course`
  page.drawText(line2, {
    x: 421 - bodyFont.widthOfTextAtSize(line2, 12) / 2,
    y: 315,
    size: 12,
    font: bodyFont,
    color: gray,
  })

  page.drawText(cert.course_name, {
    x: 421 - font.widthOfTextAtSize(cert.course_name, 20) / 2,
    y: 285,
    size: 20,
    font,
    color: navy,
  })

  page.drawText(`Final score: ${cert.final_score}%`, {
    x: 421 - bodyFont.widthOfTextAtSize(`Final score: ${cert.final_score}%`, 12) / 2,
    y: 255,
    size: 12,
    font: bodyFont,
    color: gray,
  })

  page.drawLine({ start: { x: 100, y: 130 }, end: { x: 300, y: 130 }, thickness: 1, color: gray })
  page.drawText(cert.trainer_name || 'Program Trainer', { x: 100, y: 112, size: 10, font: bodyFont, color: gray })
  page.drawText('Trainer signature', { x: 100, y: 98, size: 8, font: bodyFont, color: gray })

  page.drawLine({ start: { x: 542, y: 130 }, end: { x: 742, y: 130 }, thickness: 1, color: gray })
  page.drawText(cert.issued_date, { x: 542, y: 112, size: 10, font: bodyFont, color: gray })
  page.drawText('Date issued', { x: 542, y: 98, size: 8, font: bodyFont, color: gray })

  page.drawText(`Certificate ID: ${cert.cert_number}`, { x: 60, y: 50, size: 9, font: bodyFont, color: gray })

  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${cert.cert_number}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
