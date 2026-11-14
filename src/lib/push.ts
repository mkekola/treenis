/**
 * Julkinen VAPID-avain on base64url-tekstiä, mutta selain haluaa sen tavuina
 * (PushManager.subscribe, applicationServerKey).
 */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** iPhonessa ilmoitukset toimivat vain kotivalikkoon lisätyssä Treeniksessä, eivät Safarissa. */
export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}
