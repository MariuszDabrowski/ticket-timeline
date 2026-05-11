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
  const people = ref<Person[]>([
    { id: 0, name: 'Mariusz', color: COLORS[0]! },
    { id: 1, name: 'Jonathon', color: COLORS[1]! },
  ])
  let nextId = 2

  function addPerson(name: string) {
    const color = COLORS[people.value.length % COLORS.length]
    people.value.push({ id: nextId++, name, color })
  }

  return { people, addPerson }
})
