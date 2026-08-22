const UPLOAD_TTL_SECONDS = 900
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/**
 * Hands the browser a short-lived URL it can PUT a file to directly.
 * The bytes never pass through this server, so a 40 MB PDF costs us
 * no memory and no service egress.
 *
 * POST /api/files/upload-url
 * { "filename": "august-statement.pdf", "prefix": "invoices", "size": 128401 }
 *
 * -> { key, uploadUrl, expiresIn }
 *
 * The client then does: fetch(uploadUrl, { method: 'PUT', body: file })
 * and stores `key` alongside the record it belongs to.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    filename?: string
    prefix?: string
    size?: number
  }>(event)

  if (typeof body?.filename !== 'string' || body.filename.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'filename is required' })
  }

  if (typeof body.size === 'number' && body.size > MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `File exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit`,
    })
  }

  const prefix = assertStoragePrefix(body.prefix ?? 'uploads')
  const key = buildObjectKey(prefix, body.filename)

  return {
    key,
    uploadUrl: presignUpload(key, UPLOAD_TTL_SECONDS),
    expiresIn: UPLOAD_TTL_SECONDS,
  }
})
