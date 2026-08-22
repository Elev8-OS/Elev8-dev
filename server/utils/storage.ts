import { createHash, createHmac, randomBytes } from 'node:crypto'

/**
 * Presigned-URL access to the Railway Storage Bucket (S3-compatible).
 *
 * Signing is done here with node:crypto rather than @aws-sdk/client-s3 —
 * SigV4 query signing is ~60 lines and the SDK would add roughly 10 MB to a
 * build that already sits close to its memory ceiling. The output is
 * byte-identical to @aws-sdk/s3-request-presigner for the same inputs.
 *
 * The five variables below are injected by Railway as references to the
 * `elev8-files` bucket. When they are absent (local dev), every storage
 * endpoint answers 503 rather than the server failing at boot.
 */

const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD'

const REQUIRED_VARS = [
  'BUCKET',
  'REGION',
  'ENDPOINT',
  'ACCESS_KEY_ID',
  'SECRET_ACCESS_KEY',
] as const

/** Object-key prefixes the API is allowed to hand out URLs for. */
export const STORAGE_PREFIXES = [
  'owner-statements',
  'guest-guides',
  'damage-reports',
  'invoices',
  'uploads',
] as const

export type StoragePrefix = typeof STORAGE_PREFIXES[number]

interface BucketConfig {
  bucket: string
  region: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
}

function readBucketConfig(): BucketConfig {
  const missing = REQUIRED_VARS.filter(name => !process.env[name])

  if (missing.length > 0) {
    throw createError({
      statusCode: 503,
      statusMessage: `Object storage is not configured (missing: ${missing.join(', ')})`,
    })
  }

  return {
    bucket: process.env.BUCKET!,
    region: process.env.REGION!,
    endpoint: process.env.ENDPOINT!,
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

/**
 * RFC 3986 percent-encoding. encodeURIComponent leaves !'()* alone,
 * which S3 does not accept inside a canonical request.
 */
function uriEncode(value: string, encodeSlash: boolean): string {
  let out = ''

  for (const byte of Buffer.from(value, 'utf8')) {
    const char = String.fromCharCode(byte)

    if (/[a-z0-9\-._~]/i.test(char)) out += char
    else if (char === '/') out += encodeSlash ? '%2F' : '/'
    else out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
  }

  return out
}

interface PresignOptions {
  method: 'GET' | 'PUT'
  key: string
  expiresIn: number
  /** Extra query parameters to sign, e.g. response-content-disposition. */
  query?: Record<string, string>
}

function presign({ method, key, expiresIn, query = {} }: PresignOptions): string {
  const config = readBucketConfig()

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`

  const base = new URL(config.endpoint)
  // Virtual-hosted style: the bucket is a subdomain of the endpoint.
  const host = `${config.bucket}.${base.host}`
  const canonicalUri = `/${uriEncode(key, false)}`

  const params: Record<string, string> = {
    ...query,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': UNSIGNED_PAYLOAD,
    'X-Amz-Credential': `${config.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  }

  const canonicalQuery = Object.keys(params)
    .sort()
    .map(name => `${uriEncode(name, true)}=${uriEncode(params[name]!, true)}`)
    .join('&')

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    UNSIGNED_PAYLOAD,
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  let signingKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp)
  for (const part of [config.region, 's3', 'aws4_request']) {
    signingKey = hmac(signingKey, part)
  }

  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  return `${base.protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

/** Strips directories and anything that has no business in an object key. */
export function slugifyFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? ''

  const slug = base
    .normalize('NFKD')
    // Drop combining marks so "März" becomes "Marz", not "Ma-rz".
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/-+(\.[^.]*)$/, '$1')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120)

  return slug || 'file'
}

/** URL the browser can PUT the file bytes to directly. */
export function presignUpload(key: string, expiresIn: number): string {
  return presign({ method: 'PUT', key, expiresIn })
}

/** URL the browser can GET the file from directly. */
export function presignDownload(key: string, expiresIn: number, filename?: string): string {
  return presign({
    method: 'GET',
    key,
    expiresIn,
    query: filename
      ? { 'response-content-disposition': `attachment; filename="${slugifyFilename(filename)}"` }
      : {},
  })
}

/**
 * Builds a collision-free key of the shape
 * `invoices/2026-08-22/9f2c1ab7c4d1-august-statement.pdf`.
 */
export function buildObjectKey(prefix: StoragePrefix, filename: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return `${prefix}/${day}/${randomBytes(6).toString('hex')}-${slugifyFilename(filename)}`
}

export function assertStoragePrefix(value: unknown): StoragePrefix {
  if (typeof value === 'string' && (STORAGE_PREFIXES as readonly string[]).includes(value)) {
    return value as StoragePrefix
  }

  throw createError({
    statusCode: 400,
    statusMessage: `prefix must be one of: ${STORAGE_PREFIXES.join(', ')}`,
  })
}

/** Guards against traversal and keys we never handed out ourselves. */
export function assertObjectKey(value: unknown): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 512
    || value.startsWith('/')
    || value.includes('..')
    || !/^[\w/.-]+$/.test(value)
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid object key' })
  }

  return value
}
