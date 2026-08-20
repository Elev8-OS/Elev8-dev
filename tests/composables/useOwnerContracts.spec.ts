import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockOwnerContracts } from '~/components/owners/data/owner-contracts'
import { mockOwnerDocuments } from '~/components/owners/data/owner-documents'
import { useOwnerContracts } from '~/composables/useOwnerContracts'

interface AlertCall {
  type: string
  severity: string
  context: Record<string, unknown>
}

const notificationsMock = vi.hoisted(() => {
  const callLog: AlertCall[] = []
  return {
    callLog,
    spy: {
      createAlert: (type: string, severity: string, context: Record<string, unknown>) => {
        callLog.push({ type, severity, context })
      },
    },
  }
})

vi.mock('~/composables/useNotifications', () => ({
  useNotifications: () => notificationsMock.spy,
}))

function resetState() {
  const contracts = useState('elev8-owner-contracts')
  contracts.value = structuredClone(mockOwnerContracts)
  const docs = useState('elev8-owner-documents')
  docs.value = structuredClone(mockOwnerDocuments)
  notificationsMock.callLog.length = 0
}

describe('useOwnerContracts', () => {
  beforeEach(() => {
    resetState()
  })

  it('generates a draft contract and an owner-level document', () => {
    const { generateContract, getContractForOwner } = useOwnerContracts()
    const result = generateContract({
      ownerId: 'own-3',
      listingIds: ['lst-3'],
      terms: {
        commissionType: 'gross',
        rate: 18,
        basis: 'gross',
        includedServices: ['Channel management'],
        operationalFee: 100,
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.contract.status).toBe('draft')
      expect(result.contract.documentId).toBeTruthy()
    }
    const contract = getContractForOwner('own-3')
    expect(contract?.listingIds).toContain('lst-3')
  })

  it('sends a contract → status sent + notification', () => {
    const { sendContract, getContractForOwner } = useOwnerContracts()
    const contract = getContractForOwner('own-3')!
    const result = sendContract(contract.id)
    expect(result.ok).toBe(true)
    expect(getContractForOwner('own-3')?.status).toBe('sent')
    expect(notificationsMock.callLog.some(call => call.type === 'OWNER_CONTRACT_SENT')).toBe(true)
  })

  it('signs a contract and notifies', () => {
    const { signContract, getContractForOwner, hasSignedContract } = useOwnerContracts()
    const contract = getContractForOwner('own-3')!
    const result = signContract(contract.id, 'Ni Kadek Deviani')
    expect(result.ok).toBe(true)
    const signed = getContractForOwner('own-3')
    expect(signed?.status).toBe('signed')
    expect(signed?.signature?.name).toBe('Ni Kadek Deviani')
    expect(hasSignedContract('own-3')).toBe(true)
    expect(notificationsMock.callLog.some(call => call.type === 'OWNER_CONTRACT_SIGNED')).toBe(true)
  })

  it('cannot sign a contract twice', () => {
    const { signContract, getContractForOwner } = useOwnerContracts()
    const contract = getContractForOwner('own-1')! // already signed
    const result = signContract(contract.id, 'Wayan Sari')
    expect(result).toEqual({ ok: false, reason: 'invalid_status' })
  })

  it('hasSignedContract is false for unsigned owners', () => {
    const { hasSignedContract } = useOwnerContracts()
    expect(hasSignedContract('own-1')).toBe(true)
    expect(hasSignedContract('own-3')).toBe(false)
  })
})
