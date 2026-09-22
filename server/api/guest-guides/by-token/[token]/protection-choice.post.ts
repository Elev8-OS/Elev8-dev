import type { GuideSubmission } from '~/components/guest-guides/data/types'
import { generateId } from '~/utils/guest-guide-token'
import { findLinkByToken, saveSubmission } from '../../../../utils/guest-guide-store'

/**
 * The token identifies the reservation. The body NEVER names one, so a public
 * endpoint cannot be talked into writing another booking's record. Same access
 * model as `saveForCurrentOwner` in useOwnerPayoutDetails.
 */
interface ProtectionChoiceBody {
  option?: 'waiver' | 'deposit'
  termsVersion?: string
  refundDestination?: {
    accountName?: string
    accountNumber?: string
    bankName?: string
  }
}

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token)
    throw createError({ statusCode: 400, statusMessage: 'Token required' })

  const link = findLinkByToken(token)
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Guide not found' })

  const body = await readBody<ProtectionChoiceBody>(event)
  if (body?.option !== 'waiver' && body?.option !== 'deposit')
    throw createError({ statusCode: 400, statusMessage: 'Pick a waiver or a deposit' })

  // A deposit on a rail that cannot reverse to source needs bank details, and
  // the guest is asked for them here rather than after they have flown home.
  if (body.option === 'deposit' && body.refundDestination) {
    const { accountName, accountNumber, bankName } = body.refundDestination
    const partial = [accountName, accountNumber, bankName].some(v => v?.trim())
    const complete = [accountName, accountNumber, bankName].every(v => v?.trim())
    if (partial && !complete)
      throw createError({ statusCode: 400, statusMessage: 'Give the account name, number and bank' })
  }

  const submission: GuideSubmission = {
    id: generateId('gsub'),
    linkId: link.id,
    submittedAt: new Date().toISOString(),
    protectionChoice: {
      option: body.option,
      acceptedAt: new Date().toISOString(),
      termsVersion: body.termsVersion ?? 'v1',
    },
  }

  saveSubmission(submission)

  // The reservation id comes from the link, never from the request.
  return { ok: true, submissionId: submission.id, reservationId: link.reservationId }
})
