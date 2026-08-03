const DEFAULT_PUBLIC_APP_URL = 'https://bolos.mogambo.xyz'

export function getPublicAppUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_PUBLIC_APP_URL).trim()
  const url = new URL(configured)

  if (
    !['http:', 'https:'].includes(url.protocol)
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL must be an HTTP(S) URL without credentials, query, or fragment',
    )
  }

  return configured.replace(/\/+$/, '')
}
