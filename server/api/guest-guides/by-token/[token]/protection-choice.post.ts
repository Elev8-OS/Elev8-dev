import type { ProtectionChoiceBody } from '../../../../utils/protection-choice'
import type { GuideSubmission } from '~/components/guest-guides/data/types'
import { generateId } from '~/utils/guest-guide-token'
import { findLinkByToken, saveSubmission } from '../../../../utils/guest-guide-store'
import { validateProtectionChoice } from '../../../../utils/protection-choice'

/**
 * The token identifies the reservation. The body NEVER names one, so a public
 * endpoint cannot be talked into writing another booking's record. Same access
 * model as `saveForCurrentOwner` in useOwnerPayoutDetails.
 *
 * A deposit arrives as a card the guest already saved with Stripe (a
 * PaymentMethod id plus the last four digits) and the guest's consent to a
 * charge after check-out. Raw card data is refused outright.
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token)
    throw createError({ statusCode: 400, statusMessage: 'Token required' })

  const link = findLinkByToken(token)
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Guide not found' })

  const verdict = validateProtectionChoice(await readBody<ProtectionChoiceBody>(event))
  if (!verdict.ok)
    throw createError({ statusCode: 400, statusMessage: verdict.message })

  const submission: GuideSubmission = {
    id: generateId('gsub'),
    linkId: link.id,
    submittedAt: new Date().toISOString(),
    protectionChoice: verdict.choice,
  }

  saveSubmission(submission)

  // The reservation id comes from the link, never from the request.
  return { ok: true, submissionId: submission.id, reservationId: link.reservationId }
})
