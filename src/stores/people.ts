import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Person {
  id: number
  name: string
  color: string
  // Every email ever associated with this person via import. Used by the
  // people-matching tier (PEOPLE_MATCH_SPEC: Email-known auto-merges with no
  // prompt) so re-imports of the same email stay silent.
  emails: string[]
}

const COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#e91e63',
  '#00bcd4',
  '#8bc34a',
]

export const usePeopleStore = defineStore('people', () => {
  const people = ref<Person[]>([])
  let nextId = 0

  function addPerson(name: string, color?: string, emails: string[] = []): number {
    const id = nextId++
    const assignedColor = color ?? COLORS[people.value.length % COLORS.length]!
    people.value.push({ id, name, color: assignedColor, emails })
    return id
  }

  function addEmail(id: number, email: string) {
    const person = people.value.find((p) => p.id === id)
    if (!person) return
    const normalized = email.toLowerCase().trim()
    if (!normalized) return
    if (person.emails.some((e) => e.toLowerCase() === normalized)) return
    person.emails.push(email)
  }

  function removePerson(id: number) {
    const idx = people.value.findIndex((p) => p.id === id)
    if (idx !== -1) people.value.splice(idx, 1)
  }

  function updatePerson(id: number, data: { name?: string; color?: string }) {
    const person = people.value.find((p) => p.id === id)
    if (person) Object.assign(person, data)
  }

  function updatePersonName(id: number, name: string) {
    updatePerson(id, { name })
  }

  function loadData(loaded: Array<Person | Omit<Person, 'emails'>>) {
    // Older saves predate the emails field; default to [] so they keep working.
    people.value = loaded.map((p) => ({ ...p, emails: 'emails' in p ? p.emails : [] }))
    nextId = people.value.length > 0 ? Math.max(...people.value.map((p) => p.id)) + 1 : 0
  }

  return { people, addPerson, addEmail, removePerson, updatePerson, updatePersonName, loadData }
})
