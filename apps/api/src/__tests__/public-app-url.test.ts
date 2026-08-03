import { afterEach, describe, expect, it } from 'vitest'
import { getPublicAppUrl } from '../services/public-app-url'

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe('getPublicAppUrl', () => {
  it('uses the production fallback and removes trailing slashes', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(getPublicAppUrl()).toBe('https://bolos.mogambo.xyz')

    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.example.test/base///'
    expect(getPublicAppUrl()).toBe('https://staging.example.test/base')
  })

  it.each([
    'javascript:alert(1)',
    'https://user:password@example.test',
    'https://example.test?redirect=https://evil.test',
    'https://example.test#unexpected',
  ])('rejects unsafe application URL %s', (value) => {
    process.env.NEXT_PUBLIC_APP_URL = value
    expect(() => getPublicAppUrl()).toThrow('NEXT_PUBLIC_APP_URL')
  })
})
