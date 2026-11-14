import { describe, expect, it } from 'vitest'
import { base64UrlToBytes } from './push'

describe('VAPID-avain', () => {
  it('base64url tavuiksi ilman täytemerkkejä', () => {
    expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })

  it('julkinen avain on 65 tavua', () => {
    expect(base64UrlToBytes('B'.repeat(87)).length).toBe(65)
  })
})
