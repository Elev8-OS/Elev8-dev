const DOWNLOAD_TTL_SECONDS = 3600

/**
 * Returns a time-limited URL for one object. The bucket itself stays
 * private — the browser fetches the bytes straight from storage.
 *
 * GET /api/files/download-url?key=invoices/2026-08-22/9f2c1ab7c4d1-august.pdf
 * GET /api/files/download-url?key=...&filename=August%20Statement.pdf
 *
 * -> { key, downloadUrl, expiresIn }
 */
export default defineEventHandler((event) => {
  const { key: rawKey, filename } = getQuery(event)

  const key = assertObjectKey(rawKey)
  const downloadName = typeof filename === 'string' && filename.length > 0
    ? filename
    : undefined

  return {
    key,
    downloadUrl: presignDownload(key, DOWNLOAD_TTL_SECONDS, downloadName),
    expiresIn: DOWNLOAD_TTL_SECONDS,
  }
})
