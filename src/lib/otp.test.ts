import { describe, expect, it } from 'vitest'
import { retryAfterSec } from './otp'

describe('retryAfterSec', () => {
  it('lukee odotusajan Supabasen virheviestistä', () => {
    const err = {
      code: 'over_email_send_rate_limit',
      message: 'For security purposes, you can only request this after 37 seconds.',
    }
    expect(retryAfterSec(err)).toBe(37)
  })

  it('palauttaa null tunnin lähetysrajalle, jossa sekunteja ei ole', () => {
    expect(retryAfterSec({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' })).toBeNull()
  })

  it('palauttaa null muille virheille', () => {
    expect(retryAfterSec({ code: 'otp_expired', message: 'Token has expired' })).toBeNull()
    expect(retryAfterSec(undefined)).toBeNull()
  })
})
