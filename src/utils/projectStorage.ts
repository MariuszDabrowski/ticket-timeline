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

// Bump when the on-disk schema for SavedProject (or its inner data shape) changes,
// then add a migration branch in `migrate` below.
const SCHEMA_VERSION = 1

interface StorageEnvelope {
  version: number
  projects: SavedProject[]
}

function migrate(raw: unknown): SavedProject[] {
  // Pre-versioning: data was stored as a raw SavedProject[] array.
  if (Array.isArray(raw)) return raw as SavedProject[]

  if (raw && typeof raw === 'object' && 'version' in raw && 'projects' in raw) {
    const envelope = raw as StorageEnvelope
    // Future migrations would chain here, e.g.:
    //   if (envelope.version < 2) projects = migrateV1toV2(projects)
    return Array.isArray(envelope.projects) ? envelope.projects : []
  }

  return []
}

export function getSavedProjects(): SavedProject[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return migrate(raw)
  } catch {
    return []
  }
}

export function setSavedProjects(projects: SavedProject[]): void {
  const envelope: StorageEnvelope = { version: SCHEMA_VERSION, projects }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
}
