// Owner contracts — lifecycle + e-signature gate (PRD 5.3).
//
// A contract is auto-generated from the owner's commission/service terms
// when the owner record is created. Staff send the owner a magic link; the
// owner reviews and e-signs the contract; only then does portal login
// unlock (`acceptDemoLink` checks `hasSignedContract`).

import type { AlertType } from '~/components/notifications/data/alerts'
import type { GenerateContractInput, OwnerContract } from '~/components/owners/data/owner-contracts'
import { mockOwnerContracts } from '~/components/owners/data/owner-contracts'
import { useNotifications } from '~/composables/useNotifications'
import { useOwnerDocuments } from '~/composables/useOwnerDocuments'

export type GenerateContractResult
  = | { ok: true, contract: OwnerContract }
    | { ok: false, error: string }

export type ContractActionResult
  = | { ok: true, contract: OwnerContract }
    | { ok: false, reason: 'not_found' | 'invalid_status' }

function nowIso(): string {
  return new Date().toISOString()
}

function deriveUniqueId(prefix: string, isTaken: (id: string) => boolean): string {
  let id = ''
  do {
    id = `${prefix}-${globalThis.crypto.randomUUID()}`
  } while (isTaken(id))
  return id
}

function emitContractAlert(
  type: 'OWNER_CONTRACT_SENT' | 'OWNER_CONTRACT_SIGNED',
  severity: 'INFO',
  context: Record<string, unknown>,
): void {
  useNotifications().createAlert(type as AlertType, severity, context)
}

export function useOwnerContracts() {
  const contracts = useState<OwnerContract[]>(
    'elev8-owner-contracts',
    () => structuredClone(mockOwnerContracts),
  )
  const { uploadDocument } = useOwnerDocuments()

  function contractIdTaken(id: string): boolean {
    return contracts.value.some(c => c.id === id)
  }

  /**
   * Generate a contract draft from commission/service terms. Creates a
   * contract-category document in the owner's Document Center (owner-level,
   * never duplicated onto listings) and links it via `documentId`.
   */
  function generateContract(input: GenerateContractInput): GenerateContractResult {
    if (input.listingIds.length === 0)
      return { ok: false, error: 'Pick at least one listing the contract covers.' }
    if (input.terms.rate < 0 || (input.terms.fixedAmount ?? 0) < 0)
      return { ok: false, error: 'Commission terms cannot be negative.' }

    // One contract per owner — regenerate replaces the existing one.
    const existing = contracts.value.find(c => c.ownerId === input.ownerId)
    const timestamp = nowIso()

    // Owner-level Document Center entry (visibility specific to this owner).
    const docResult = uploadDocument({
      title: `Management Agreement — ${input.ownerId}`,
      category: 'contract',
      visibility: 'specific_owner',
      ownerIds: [input.ownerId],
      listingIds: input.listingIds,
      content: `MANAGEMENT AGREEMENT\n\nOwner: ${input.ownerId}\nListings: ${input.listingIds.join(', ')}\n\nCommission model: ${input.terms.basis === 'net' ? `fixed ${input.terms.fixedAmount ?? 0} + ${input.terms.rate}% of Net` : `${input.terms.rate}% of Gross`}\nIncluded services: ${input.terms.includedServices.join(', ') || 'None'}\nOperational costs covered by owner: ${input.terms.operationalFee}%\n\nThis contract is generated automatically and must be e-signed before portal access is granted.`,
    }, 'system')

    const contract: OwnerContract = {
      id: existing?.id ?? deriveUniqueId('ocn', contractIdTaken),
      ownerId: input.ownerId,
      listingIds: input.listingIds,
      status: existing?.status === 'signed' ? 'signed' : 'draft',
      terms: { ...input.terms, includedServices: [...input.terms.includedServices] },
      generatedAt: timestamp,
      documentId: docResult.ok ? docResult.document.id : existing?.documentId,
    }

    contracts.value = existing
      ? contracts.value.map(c => c.id === existing.id ? contract : c)
      : [...contracts.value, contract]

    return { ok: true, contract }
  }

  /** Staff sends the contract magic link to the owner (status → 'sent'). */
  function sendContract(contractId: string): ContractActionResult {
    const current = contracts.value.find(c => c.id === contractId)
    if (!current)
      return { ok: false, reason: 'not_found' }
    if (current.status === 'signed')
      return { ok: false, reason: 'invalid_status' }

    const sentAt = nowIso()
    const updated: OwnerContract = { ...current, status: 'sent', sentAt }
    contracts.value = contracts.value.map(c => c.id === contractId ? updated : c)

    emitContractAlert('OWNER_CONTRACT_SENT', 'INFO', {
      contractId,
      ownerId: current.ownerId,
      listingIds: current.listingIds,
    })
    return { ok: true, contract: updated }
  }

  /** Owner e-signs the contract via the magic link → portal access unlocks. */
  function signContract(contractId: string, ownerName: string, imageDataUrl?: string): ContractActionResult {
    const current = contracts.value.find(c => c.id === contractId)
    if (!current)
      return { ok: false, reason: 'not_found' }
    if (current.status === 'signed')
      return { ok: false, reason: 'invalid_status' }

    const signedAt = nowIso()
    const updated: OwnerContract = {
      ...current,
      status: 'signed',
      signedAt,
      signature: { name: ownerName, signedAt, imageDataUrl },
      // Ensure the owner-level Document Center entry exists (seeded contracts
      // may not have one yet) so the signed contract is always downloadable
      // from the owner's Documents page.
      documentId: current.documentId ?? ensureContractDocument(current, ownerName, imageDataUrl, signedAt),
    }
    contracts.value = contracts.value.map(c => c.id === contractId ? updated : c)

    emitContractAlert('OWNER_CONTRACT_SIGNED', 'INFO', {
      contractId,
      ownerId: current.ownerId,
      listingIds: current.listingIds,
      signedBy: ownerName,
    })
    return { ok: true, contract: updated }
  }

  /**
   * Create the owner-level Document Center entry for a contract that was
   * seeded without one (or signed before the doc existed). The document
   * body includes the signature metadata so the downloadable copy shows
   * the signing info.
   */
  function ensureContractDocument(
    contract: OwnerContract,
    ownerName: string,
    imageDataUrl: string | undefined,
    signedAt: string,
  ): string | undefined {
    const docResult = uploadDocument({
      title: `Management Agreement — ${contract.ownerId}`,
      category: 'contract',
      visibility: 'specific_owner',
      ownerIds: [contract.ownerId],
      listingIds: contract.listingIds,
      content: `MANAGEMENT AGREEMENT\n\nOwner: ${ownerName}\nListings: ${contract.listingIds.join(', ')}\n\nCommission model: ${contract.terms.basis === 'net' ? `fixed ${contract.terms.fixedAmount ?? 0} + ${contract.terms.rate}% of Net` : `${contract.terms.rate}% of Gross`}\nIncluded services: ${contract.terms.includedServices.join(', ') || 'None'}\nOperational costs covered by owner: ${contract.terms.operationalFee}%\n\nSigned by ${ownerName} on ${signedAt}${imageDataUrl ? '\nSignature image attached.' : ''}`,
    }, 'system')
    return docResult.ok ? docResult.document.id : undefined
  }

  function getContractForOwner(ownerId: string): OwnerContract | undefined {
    return contracts.value.find(c => c.ownerId === ownerId)
  }

  function hasSignedContract(ownerId: string): boolean {
    return contracts.value.some(c => c.ownerId === ownerId && c.status === 'signed')
  }

  return {
    contracts,
    generateContract,
    sendContract,
    signContract,
    getContractForOwner,
    hasSignedContract,
  }
}
