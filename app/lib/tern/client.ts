import type {
  TernBooking,
  TernBookingNote,
  TernBookingQuery,
  TernClaim,
  TernClaimNote,
  TernClaimQuery,
  TernClaimUpdateRequest,
  TernDocument,
  TernDocumentMetadata,
  TernDocumentQuery,
  TernListResponse,
  TernNoteQuery,
  TernUploadParams,
} from './types'

/**
 * The seam between Elev8 and Tern: one method per endpoint in Tern's spec, the
 * same names as its operationIds. The demo runs `createTernMockClient()`; the
 * real integration runs `createTernHttpClient()` ON THE SERVER (a Nitro route
 * or job), because the API key must never reach a browser. Nothing above this
 * interface knows which one it is talking to.
 */
export interface TernApiClient {
  listBooking: (query?: TernBookingQuery) => Promise<TernListResponse<TernBooking>>
  createBooking: (booking: TernBooking) => Promise<TernBooking>
  getBooking: (id: number) => Promise<TernBooking>
  updateBooking: (id: number, booking: TernBooking) => Promise<TernBooking>
  deleteBooking: (id: number) => Promise<void>

  listBookingNote: (query: TernNoteQuery) => Promise<TernListResponse<TernBookingNote>>
  createBookingNote: (note: TernBookingNote) => Promise<TernBookingNote>

  listClaim: (query?: TernClaimQuery) => Promise<TernListResponse<TernClaim>>
  createClaim: (claim: TernClaim) => Promise<TernClaim>
  getClaim: (id: number) => Promise<TernClaim>
  updateClaim: (id: number, request: TernClaimUpdateRequest) => Promise<TernClaim>
  deleteClaim: (id: number) => Promise<void>
  exportClaimZip: (id: number) => Promise<Blob>

  listClaimNote: (query: TernNoteQuery) => Promise<TernListResponse<TernClaimNote>>
  createClaimNote: (note: TernClaimNote) => Promise<TernClaimNote>

  listDocument: (query?: TernDocumentQuery) => Promise<TernListResponse<TernDocument>>
  /** Multipart upload. Send the ORIGINAL file: Tern reads its EXIF and GPS to judge it. */
  uploadDocument: (params: TernUploadParams, file: Blob, fileName: string) => Promise<TernDocument>
  getDocument: (id: number) => Promise<TernDocument>
  downloadDocument: (id: number) => Promise<Blob>
  getDocumentMetadata: (id: number) => Promise<TernDocumentMetadata>
}

/** A non-2xx answer from Tern, with the status and the body text for the log. */
export class TernApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: string,
  ) {
    super(message)
    this.name = 'TernApiError'
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined>

/** Arrays repeat the key (`visibilities=Public&visibilities=Internal`), the Spring default. */
export function ternQueryString(query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined)
      continue
    if (Array.isArray(value))
      value.forEach(v => params.append(key, v))
    else
      params.append(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

export interface TernHttpClientOptions {
  /** e.g. `https://dev-app.terngrp.com/api` (the production URL is still to come from Tern). */
  baseUrl: string
  /** Server-side secret. Never ship it to the browser. */
  apiKey: string
  fetch?: typeof fetch
}

/**
 * The real client, a thin `fetch` wrapper. ⚠️ Server only: call it from a Nitro
 * route or a scheduled job with `runtimeConfig.ternApiKey`, never from a page.
 */
export function createTernHttpClient({ baseUrl, apiKey, fetch: doFetch = fetch }: TernHttpClientOptions): TernApiClient {
  const root = baseUrl.replace(/\/$/, '')

  async function send(method: string, path: string, init: { query?: Query, json?: unknown, form?: FormData } = {}): Promise<Response> {
    const headers: Record<string, string> = { 'X-API-Key': apiKey, 'Accept': 'application/json' }
    let body: BodyInit | undefined
    if (init.json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(init.json)
    }
    else if (init.form) {
      body = init.form
    }
    const response = await doFetch(`${root}${path}${ternQueryString(init.query)}`, { method, headers, body })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new TernApiError(response.status, `Tern ${method} ${path} answered ${response.status}`, text)
    }
    return response
  }
  const json = async <T>(method: string, path: string, init?: Parameters<typeof send>[2]): Promise<T> =>
    (await send(method, path, init)).json() as Promise<T>
  const blob = async (path: string): Promise<Blob> => (await send('GET', path)).blob()
  const empty = async (method: string, path: string): Promise<void> => { await send(method, path) }

  return {
    listBooking: query => json('GET', '/v1/booking', { query: query as Query }),
    createBooking: booking => json('POST', '/v1/booking', { json: booking }),
    getBooking: id => json('GET', `/v1/booking/${id}`),
    updateBooking: (id, booking) => json('PUT', `/v1/booking/${id}`, { json: booking }),
    deleteBooking: id => empty('DELETE', `/v1/booking/${id}`),

    listBookingNote: query => json('GET', '/v1/booking-note', { query: query as unknown as Query }),
    createBookingNote: note => json('POST', '/v1/booking-note', { json: note }),

    listClaim: query => json('GET', '/v1/claim', { query: query as Query }),
    createClaim: claim => json('POST', '/v1/claim', { json: claim }),
    getClaim: id => json('GET', `/v1/claim/${id}`),
    updateClaim: (id, request) => json('PUT', `/v1/claim/${id}`, { json: request }),
    deleteClaim: id => empty('DELETE', `/v1/claim/${id}`),
    exportClaimZip: id => blob(`/v1/claim/${id}/export-zip`),

    listClaimNote: query => json('GET', '/v1/claim-note', { query: query as unknown as Query }),
    createClaimNote: note => json('POST', '/v1/claim-note', { json: note }),

    listDocument: query => json('GET', '/v1/document', { query: query as Query }),
    uploadDocument: (params, file, fileName) => {
      const form = new FormData()
      form.append('file', file, fileName)
      return json('POST', '/v1/document/upload', { query: params as unknown as Query, form })
    },
    getDocument: id => json('GET', `/v1/document/${id}`),
    downloadDocument: id => blob(`/v1/document/${id}/download`),
    getDocumentMetadata: id => json('GET', `/v1/document/${id}/metadata`),
  }
}
