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

  function addPerson(name: string): number {
    const id = nextId++
    const color = COLORS[people.value.length % COLORS.length]!
    people.value.push({ id, name, color })
    return id
  }

  function removePerson(id: number) {
    const idx = people.value.findIndex((p) => p.id === id)
    if (idx !== -1) people.value.splice(idx, 1)
  }

  function updatePersonName(id: number, name: string) {
    const person = people.value.find((p) => p.id === id)
    if (person) person.name = name
  }

  return { people, addPerson, removePerson, updatePersonName }
})
