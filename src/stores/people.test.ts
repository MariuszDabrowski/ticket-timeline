import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePeopleStore } from './people'

describe('people store: addPerson', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('assigns monotonically increasing ids', () => {
    const people = usePeopleStore()
    const a = people.addPerson('Alice')
    const b = people.addPerson('Bob')
    expect(b).toBe(a + 1)
  })

  it('auto-cycles colors from the default palette when none is given', () => {
    const people = usePeopleStore()
    people.addPerson('A')
    people.addPerson('B')
    const colorA = people.people[0]!.color
    const colorB = people.people[1]!.color
    expect(colorA).toMatch(/^#[0-9a-f]{6}$/i)
    expect(colorB).toMatch(/^#[0-9a-f]{6}$/i)
    expect(colorA).not.toBe(colorB)
  })

  it('honors an explicit color when given', () => {
    const people = usePeopleStore()
    people.addPerson('Alice', '#ff0000')
    expect(people.people[0]!.color).toBe('#ff0000')
  })
})

describe('people store: removePerson', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('removes the matching person', () => {
    const people = usePeopleStore()
    const a = people.addPerson('A')
    const b = people.addPerson('B')
    people.removePerson(a)
    expect(people.people).toHaveLength(1)
    expect(people.people[0]!.id).toBe(b)
  })

  it('does nothing for unknown ids', () => {
    const people = usePeopleStore()
    people.addPerson('A')
    expect(() => people.removePerson(999)).not.toThrow()
    expect(people.people).toHaveLength(1)
  })
})

describe('people store: updatePerson / updatePersonName', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('patches name and color fields', () => {
    const people = usePeopleStore()
    const id = people.addPerson('A', '#ff0000')
    people.updatePerson(id, { name: 'A2', color: '#00ff00' })
    expect(people.people[0]).toMatchObject({ name: 'A2', color: '#00ff00' })
  })

  it('updatePersonName is a shortcut for updating just the name', () => {
    const people = usePeopleStore()
    const id = people.addPerson('A', '#ff0000')
    people.updatePersonName(id, 'B')
    expect(people.people[0]).toMatchObject({ name: 'B', color: '#ff0000' })
  })

  it('is a no-op for unknown ids', () => {
    const people = usePeopleStore()
    people.addPerson('A')
    expect(() => people.updatePerson(999, { name: 'X' })).not.toThrow()
    expect(people.people[0]!.name).toBe('A')
  })
})

describe('people store: loadData', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('replaces the people array', () => {
    const people = usePeopleStore()
    people.addPerson('Old')
    people.loadData([{ id: 50, name: 'New', color: '#123456' }])
    expect(people.people).toHaveLength(1)
    expect(people.people[0]).toMatchObject({ id: 50, name: 'New', color: '#123456' })
  })

  it('seeds nextId past the loaded max so subsequent addPerson ids do not collide', () => {
    const people = usePeopleStore()
    people.loadData([{ id: 50, name: 'A', color: '#000000' }])
    const newId = people.addPerson('B')
    expect(newId).toBeGreaterThan(50)
  })

  it('resets nextId to 0 when given an empty array', () => {
    const people = usePeopleStore()
    people.addPerson('A')
    people.addPerson('B')
    people.loadData([])
    const newId = people.addPerson('C')
    expect(newId).toBe(0)
  })
})
