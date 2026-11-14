import { describe, expect, it } from 'vitest'
import { formatFriendCode, friendLists, parseFriendCode, type FriendshipRow } from './friends'

describe('kaverikoodi', () => {
  it('hyväksyy koodin väliviivalla tai ilman, pienillä tai isoilla kirjaimilla', () => {
    expect(parseFriendCode('K7P2-QX')).toBe('K7P2QX')
    expect(parseFriendCode(' k7p2qx ')).toBe('K7P2QX')
  })

  it('lukee koodin koko linkistä', () => {
    expect(parseFriendCode('https://treenis.kekola.fi/kaveri/K7P2QX')).toBe('K7P2QX')
    expect(parseFriendCode('Lisää minut! https://treenis.kekola.fi/kaveri/K7P2QX')).toBe('K7P2QX')
  })

  it('hylkää väärän pituiset ja sekaantuvia merkkejä sisältävät', () => {
    expect(parseFriendCode('K7P2Q')).toBeNull()
    expect(parseFriendCode('K7P2-QO')).toBeNull()
    expect(parseFriendCode('')).toBeNull()
  })

  it('näyttää koodin väliviivalla', () => {
    expect(formatFriendCode('K7P2QX')).toBe('K7P2-QX')
  })
})

describe('kaverilistat', () => {
  const me = 'me'
  const row = (id: string, requester: string, addressee: string, status: FriendshipRow['status']): FriendshipRow => ({
    id,
    requester,
    addressee,
    status,
    created_at: '2026-11-14T10:00:00Z',
  })
  const names = new Map([
    ['anna', 'Anna'],
    ['mikko', 'Mikko'],
    ['liisa', 'Liisa'],
  ])

  it('jakaa suhteet kavereihin, saapuneisiin ja lähetettyihin', () => {
    const lists = friendLists(
      [
        row('1', me, 'mikko', 'accepted'),
        row('2', 'anna', me, 'accepted'),
        row('3', 'liisa', me, 'pending'),
        row('4', me, 'pekka', 'pending'),
      ],
      names,
      me,
    )
    expect(lists.friends.map((p) => p.name)).toEqual(['Anna', 'Mikko'])
    expect(lists.incoming).toEqual([{ friendshipId: '3', userId: 'liisa', name: 'Liisa' }])
    expect(lists.outgoing).toEqual([{ friendshipId: '4', userId: 'pekka', name: 'Nimetön' }])
  })
})
