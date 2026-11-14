/** Samat merkit kuin tietokannassa: ei I, O, 0 eikä 1, jotta koodin voi lukea ääneen. */
const CODE = /^[A-HJ-NP-Z2-9]{6}$/

/**
 * Lukee kaverikoodin käyttäjän liittämästä tekstistä. Kelpaa pelkkä koodi
 * ("K7P2-QX", "k7p2qx") tai koko linkki (".../kaveri/K7P2QX").
 */
export function parseFriendCode(input: string): string | null {
  const fromLink = input.match(/\/kaveri\/([^/?#\s]+)/)
  const raw = (fromLink ? fromLink[1] : input).replace(/[\s-]/g, '').toUpperCase()
  return CODE.test(raw) ? raw : null
}

/** "K7P2QX" → "K7P2-QX": väliviiva helpottaa lukemista ja kirjoittamista. */
export function formatFriendCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

export interface FriendshipRow {
  id: string
  requester: string
  addressee: string
  status: 'pending' | 'accepted'
  created_at: string
}

export interface Person {
  friendshipId: string
  userId: string
  name: string
}

export interface FriendLists {
  friends: Person[]
  /** Pyynnöt, jotka odottavat sinun vastaustasi. */
  incoming: Person[]
  /** Lähettämäsi pyynnöt, joihin kaveri ei ole vielä vastannut. */
  outgoing: Person[]
}

/** Jakaa kaverisuhteet listoiksi oman käyttäjän näkökulmasta. Nimet aakkosjärjestyksessä. */
export function friendLists(rows: FriendshipRow[], names: Map<string, string>, me: string): FriendLists {
  const lists: FriendLists = { friends: [], incoming: [], outgoing: [] }
  for (const row of rows) {
    const userId = row.requester === me ? row.addressee : row.requester
    const person = { friendshipId: row.id, userId, name: names.get(userId) || 'Nimetön' }
    if (row.status === 'accepted') lists.friends.push(person)
    else if (row.addressee === me) lists.incoming.push(person)
    else lists.outgoing.push(person)
  }
  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'fi')
  lists.friends.sort(byName)
  lists.incoming.sort(byName)
  lists.outgoing.sort(byName)
  return lists
}
