/**
 * Elev8's billing emails to the tenant (monthly damage waiver invoice, payment
 * failed, payment received). Built by `buildWaiverBillingEmail`.
 *
 * Mock: logs the payload. A real provider sends it from Elev8 Software AG's
 * billing address (still to come) and attaches the invoice PDF, rendered
 * server-side from `attachment.invoiceId`.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    kind: string
    invoiceId: string
    to: string
    from: { name: string }
    subject: string
    text: string
    attachment: { filename: string, invoiceId: string }
  }>(event)

  if (!body?.to || !body.subject || !body.text)
    throw createError({ statusCode: 400, statusMessage: 'to, subject and text are required' })

  // eslint-disable-next-line no-console
  console.log('[mock billing email]', {
    kind: body.kind,
    to: body.to,
    from: body.from?.name,
    subject: body.subject,
    attachment: body.attachment?.filename,
  })

  return { ok: true, messageId: `mock-billing-${Date.now()}` }
})
