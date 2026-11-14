/** Supabase sallii uuden koodin samaan osoitteeseen vasta minuutin päästä edellisestä. */
export const CODE_COOLDOWN_SEC = 60

/**
 * Lukee Supabasen virheestä, montako sekuntia uutta koodia pitää odottaa.
 * Virheviesti on muotoa "For security purposes, you can only request this
 * after 37 seconds." Tunnin lähetysraja käyttää samaa koodia ilman sekunteja,
 * jolloin palautetaan null.
 */
export function retryAfterSec(err: unknown): number | null {
  const { code, message } = (err ?? {}) as { code?: string; message?: string }
  if (code !== 'over_email_send_rate_limit') return null
  const match = message?.match(/(\d+)\s*seconds?/)
  return match ? Number(match[1]) : null
}
