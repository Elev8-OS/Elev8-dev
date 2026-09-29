import { describe, expect, it, vi } from 'vitest'
import { createTernHttpClient, TernApiError, ternQueryString } from '~/lib/tern/client'
import { createTernMockClient } from '~/lib/tern/mock-client'

const booking = { active: true, bookingNumber: 'res-1', clientFirstName: 'Anna', startDate: '2026-10-01', endDate: '2026-10-06', organizationId: 10421 }

describe('createTernHttpClient', () => {
  function stubFetch(body: unknown = {}, status = 200) {
    return vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  }

  it('sends the API key and JSON to the spec\'s paths', async () => {
    const fetch = stubFetch({ ...booking, bookingId: 1 })
    const client = createTernHttpClient({ baseUrl: 'https://dev-app.terngrp.com/api/', apiKey: 'secret', fetch })
    await client.createBooking(booking)
    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe('https://dev-app.terngrp.com/api/v1/booking')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('secret')
    expect(JSON.parse(init.body as string)).toMatchObject({ bookingNumber: 'res-1' })
  })

  it('repeats array query keys and drops undefined ones', async () => {
    expect(ternQueryString({ parentEntityId: 7, visibilities: ['Public', 'Internal'], limit: undefined })).toBe('?parentEntityId=7&visibilities=Public&visibilities=Internal')
    const fetch = stubFetch({ items: [] })
    await createTernHttpClient({ baseUrl: 'https://x/api', apiKey: 'k', fetch }).listBooking({ modStampFrom: '2026-10-01T00:00:00Z', organizationId: 10421 })
    expect(fetch.mock.calls[0]![0]).toBe('https://x/api/v1/booking?modStampFrom=2026-10-01T00%3A00%3A00Z&organizationId=10421')
  })

  it('uploads a document as multipart with its target in the query', async () => {
    const fetch = stubFetch({ documentId: 3 })
    await createTernHttpClient({ baseUrl: 'https://x/api', apiKey: 'k', fetch }).uploadDocument({ entityType: 'Claim', entityId: 7, visibility: 'Public' }, new Blob(['a']), 'photo.jpg')
    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe('https://x/api/v1/document/upload?entityType=Claim&entityId=7&visibility=Public')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBeTruthy()
  })

  it('throws a TernApiError carrying the status on a non-2xx answer', async () => {
    const client = createTernHttpClient({ baseUrl: 'https://x/api', apiKey: 'k', fetch: stubFetch('bad', 400) })
    await expect(client.getClaim(1)).rejects.toMatchObject({ name: 'TernApiError', status: 400 })
    await expect(client.getClaim(1)).rejects.toBeInstanceOf(TernApiError)
  })
})

describe('createTernMockClient', () => {
  it('refuses what the real API would: missing required fields, unknown ids', async () => {
    const { client } = createTernMockClient()
    await expect(client.createBooking({ ...booking, clientFirstName: '' })).rejects.toMatchObject({ status: 400 })
    await expect(client.getClaim(999)).rejects.toMatchObject({ status: 404 })
    await expect(client.createClaim({ active: true, bookingId: 999, claimDate: '2026-10-07', claimantName: 'A', description: 'B', status: 'Submitted' })).rejects.toMatchObject({ status: 404 })
  })

  it('stamps every write later than the last, so a changed record always compares newer', async () => {
    const { client, controls } = createTernMockClient()
    const b = await client.createBooking(booking)
    const c = await client.createClaim({ active: true, bookingId: b.bookingId, claimDate: '2026-10-07', claimantName: 'A', description: 'B', status: 'Submitted', claimAmount: 320, externalClaimSystem: 'Elev8' })
    const reviewed = controls.review(c.claimId!)
    expect(reviewed.modStamp! > c.modStamp!).toBe(true)
    // Bookings can be polled by modStamp; claims cannot (no such filter in Tern's spec).
    const updated = await client.updateBooking(b.bookingId!, { ...b, endDate: '2026-10-09' })
    expect((await client.listBooking({ modStampFrom: updated.modStamp })).items.map(x => x.endDate)).toEqual(['2026-10-09'])
  })

  it('applies its own deductible and pays the net', async () => {
    const { client, controls } = createTernMockClient({ deductible: 100 })
    const c = await client.createClaim({ active: true, claimDate: '2026-10-07', claimantName: 'A', description: 'B', status: 'Submitted', claimAmount: 320 })
    expect(c.deductibleApplied).toBe(100)
    expect(controls.approve(c.claimId!)).toMatchObject({ status: 'Approved', ternApprovedAmount: 320, totalNetApprovedAmount: 220 })
  })

  it('lets our side only withdraw or answer a follow-up', async () => {
    const { client } = createTernMockClient()
    const c = await client.createClaim({ active: true, claimDate: '2026-10-07', claimantName: 'A', description: 'B', status: 'Submitted' })
    expect((await client.updateClaim(c.claimId!, { claim: { ...c, status: 'Approved' } })).status).toBe('Submitted')
    expect((await client.updateClaim(c.claimId!, { claim: { ...c, status: 'Withdrawn' }, publicNote: 'Paid directly' })).status).toBe('Withdrawn')
    expect((await client.listClaimNote({ parentEntityId: c.claimId!, visibilities: ['Public'] })).items.map(n => n.content)).toEqual(['Paid directly'])
  })
})
