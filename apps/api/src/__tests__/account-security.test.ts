import { describe, expect, it } from 'vitest'
import {
  createAuthToken,
  decryptActionUrl,
  encryptActionUrl,
  hashAuthToken,
} from '../services/account-security'

describe('account security primitives', () => {
  it('creates a 256-bit token and stores a deterministic hash instead of the raw value', () => {
    const token = createAuthToken()
    const decoded = Buffer.from(token, 'base64url')

    expect(decoded).toHaveLength(32)
    expect(hashAuthToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashAuthToken(token)).not.toContain(token)
    expect(hashAuthToken(token)).toBe(hashAuthToken(token))
  })

  it('encrypts action URLs with authenticated encryption and rejects tampering', () => {
    const secret = 'test-only-jwt-secret-with-enough-entropy'
    const url = 'https://bolos.mogambo.xyz/verify-email?token=sensitive-token'
    const encrypted = encryptActionUrl(url, secret)

    expect(encrypted).not.toContain('sensitive-token')
    expect(decryptActionUrl(encrypted, secret)).toBe(url)

    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`
    expect(() => decryptActionUrl(tampered, secret)).toThrow()
  })
})
