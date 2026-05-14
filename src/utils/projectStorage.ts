import type { Ticket, Placement } from '../stores/tickets'
import type { Person } from '../stores/people'
import type { VacationEntry } from '../stores/vacations'

export interface ProjectData {
  name: string
  tickets: Ticket[]
  placements: Placement[]
  people: Person[]
  vacations: VacationEntry[]
  selectedMonths: number[]
}

export interface SavedProject {
  id: string
  name: string
  savedAt: string
  data: Omit<ProjectData, 'name'>
}

export const STORAGE_KEY = 'ticket-timeline-projects'

export function getSavedProjects(): SavedProject[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function setSavedProjects(projects: SavedProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}
