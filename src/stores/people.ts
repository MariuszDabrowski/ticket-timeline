import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Person {
  id: number
  name: string
  color: string
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

  function addPerson(name: string, color?: string): number {
    const id = nextId++
    const assignedColor = color ?? COLORS[people.value.length % COLORS.length]!
    people.value.push({ id, name, color: assignedColor })
    return id
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

  function loadData(loaded: Person[]) {
    people.value = loaded
    nextId = loaded.length > 0 ? Math.max(...loaded.map((p) => p.id)) + 1 : 0
  }

  return { people, addPerson, removePerson, updatePerson, updatePersonName, loadData }
})
