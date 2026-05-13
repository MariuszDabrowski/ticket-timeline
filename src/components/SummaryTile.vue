<script setup lang="ts">
import { computed } from 'vue'

import { useTicketsStore, compareCalendarDates } from '../stores/tickets'
import { usePeopleStore } from '../stores/people'
import type { CalendarDate } from '../stores/tickets'


const ticketsStore = useTicketsStore()
const peopleStore = usePeopleStore()

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function fmt(d: CalendarDate): string {
  return `${MONTH_NAMES[d.month]} ${d.day}, ${d.year}`
}

function fmtShort(d: CalendarDate): string {
  return `${MONTH_NAMES[d.month]} ${d.day}`
}

const nonLabelTickets = computed(() => ticketsStore.tickets.filter((t) => !t.isLabel))
const nonLabelPlacedIds = computed(() => new Set(
  ticketsStore.placements
    .filter((p) => nonLabelTickets.value.some((t) => t.id === p.ticketId))
    .map((p) => p.ticketId)
))
const placedIds = nonLabelPlacedIds
const totalCount = computed(() => nonLabelTickets.value.length)
const scheduledCount = computed(() => nonLabelPlacedIds.value.size)
const backlogCount = computed(() => totalCount.value - scheduledCount.value)

const projectStart = computed<CalendarDate | null>(() => {
  if (ticketsStore.placements.length === 0) return null
  return ticketsStore.placements
    .map((p) => p.startDate)
    .reduce((earliest, d) => compareCalendarDates(d, earliest) < 0 ? d : earliest)
})

const projectEnd = computed<CalendarDate | null>(() => {
  if (ticketsStore.placements.length === 0) return null
  return ticketsStore.placements
    .map((p) => p.endDate)
    .reduce((latest, d) => compareCalendarDates(d, latest) > 0 ? d : latest)
})

const durationWeeks = computed(() => {
  if (!projectStart.value || !projectEnd.value) return null
  const ms =
    new Date(projectEnd.value.year, projectEnd.value.month, projectEnd.value.day).getTime() -
    new Date(projectStart.value.year, projectStart.value.month, projectStart.value.day).getTime()
  return Math.ceil(ms / (7 * 86_400_000))
})

interface PersonStat {
  id: number | null
  name: string
  color: string
  count: number
}

const teamStats = computed<PersonStat[]>(() => {
  const counts = new Map<number | null, number>()
  for (const placement of ticketsStore.placements) {
    const ticket = nonLabelTickets.value.find((t) => t.id === placement.ticketId)
    if (!ticket) continue
    const key = ticket.assignedTo
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  // Also count unplaced tickets
  for (const ticket of nonLabelTickets.value) {
    if (!placedIds.value.has(ticket.id)) {
      const key = ticket.assignedTo
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  const stats: PersonStat[] = []
  for (const person of peopleStore.people) {
    const count = counts.get(person.id) ?? 0
    if (count > 0) stats.push({ id: person.id, name: person.name, color: person.color, count })
  }
  stats.sort((a, b) => b.count - a.count)

  const unassigned = counts.get(null) ?? 0
  if (unassigned > 0) stats.push({ id: null, name: 'Unassigned', color: '#aaa', count: unassigned })
  return stats
})

const activePersonCount = computed(() => teamStats.value.filter((s) => s.id !== null).length)

const headline = computed(() => {
  if (totalCount.value === 0) return 'No tickets yet — add some to get started.'
  if (scheduledCount.value === 0)
    return `${totalCount.value} ticket${totalCount.value !== 1 ? 's' : ''} waiting to be scheduled.`

  const who = activePersonCount.value === 0
    ? 'no one assigned'
    : activePersonCount.value === 1
      ? teamStats.value[0]?.name ?? '1 person'
      : `${activePersonCount.value} people`

  const weeks = durationWeeks.value
  const span = weeks != null
    ? weeks === 1 ? '1 week' : `${weeks} weeks`
    : null

  const start = projectStart.value ? fmtShort(projectStart.value) : null
  const end = projectEnd.value ? fmtShort(projectEnd.value) : null

  const parts: string[] = []
  if (span && start && end) parts.push(`Runs ${span} — ${start} to ${end}.`)
  parts.push(
    scheduledCount.value === totalCount.value
      ? `All ${totalCount.value} tickets scheduled across ${who}.`
      : `${scheduledCount.value} of ${totalCount.value} tickets scheduled across ${who}${backlogCount.value > 0 ? `, with ${backlogCount.value} in the backlog` : ''}.`
  )
  return parts.join('\n')
})
</script>

<template>
  <div class="summary-tile">
    <div class="tile-header">
      <span class="tile-label">Project Brief</span>
    </div>

    <p class="headline">{{ headline }}</p>

    <template v-if="totalCount > 0">
      <div class="divider" />

      <div class="section">
        <div class="section-label">Tickets</div>
        <div class="stat-row">
          <span class="stat-value">{{ totalCount }}</span>
          <span class="stat-desc">total</span>
        </div>
        <div class="sub-stats">
          <span class="sub-stat scheduled">{{ scheduledCount }} scheduled</span>
          <span class="sep">·</span>
          <span class="sub-stat backlog">{{ backlogCount }} backlog</span>
        </div>
      </div>

      <template v-if="projectStart && projectEnd">
        <div class="divider" />
        <div class="section">
          <div class="section-label">Timeline</div>
          <div class="timeline-row">
            <div class="timeline-point">
              <span class="timeline-marker start-marker" />
              <div class="timeline-date">{{ fmt(projectStart) }}</div>
            </div>
            <div class="timeline-line" />
            <div class="timeline-point">
              <span class="timeline-marker end-marker" />
              <div class="timeline-date">{{ fmt(projectEnd) }}</div>
            </div>
          </div>
          <div v-if="durationWeeks !== null" class="duration-chip">
            {{ durationWeeks }} week{{ durationWeeks !== 1 ? 's' : '' }}
          </div>
        </div>
      </template>

      <template v-if="teamStats.length > 0">
        <div class="divider" />
        <div class="section">
          <div class="section-label">
            Team
            <span class="section-count">{{ activePersonCount }} {{ activePersonCount === 1 ? 'person' : 'people' }}</span>
          </div>
          <ul class="team-list">
            <li v-for="stat in teamStats" :key="stat.id ?? -1" class="team-row">
              <span class="team-dot" :style="{ background: stat.color }" />
              <span class="team-name">{{ stat.name }}</span>
              <span class="team-count">{{ stat.count }} ticket{{ stat.count !== 1 ? 's' : '' }}</span>
            </li>
          </ul>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.summary-tile {
  padding: 1rem;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.85rem;
}

@media (max-width: 1220px) {
  .summary-tile {
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-top: none;
  }
}


.tile-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tile-label {
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  color: #fff;
}

.headline {
  font-size: 14px;
  line-height: 1.55;
  opacity: 0.95;
  white-space: pre-line;
}

.divider {
  height: 1px;
  background: rgba(128, 128, 128, 0.2);
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.section-label {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
}

.section-count {
  font-weight: normal;
  text-transform: none;
  letter-spacing: 0;
  text-decoration: none;
}

.stat-row {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: bold;
  line-height: 1;
}

.stat-desc {
  opacity: 0.75;
  font-size: 14px;
}

.sub-stats {
  display: flex;
  gap: 0.4rem;
  font-size: 14px;
  opacity: 0.9;
}

.sep {
  opacity: 0.4;
}

.scheduled {
  color: #27ae60;
}

.timeline-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.timeline-point {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.timeline-marker {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.start-marker {
  background: #27ae60;
}

.end-marker {
  background: #e74c3c;
}

.timeline-line {
  flex: 1;
  height: 1px;
  background: rgba(128, 128, 128, 0.3);
  min-width: 12px;
}

.timeline-tag {
  font-size: 11px;
  opacity: 0.45;
  line-height: 1;
}

.timeline-date {
  font-size: 14px;
  font-weight: 500;
}

.duration-chip {
  display: inline-flex;
  align-self: flex-start;
  background: rgba(128, 128, 128, 0.12);
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
  font-size: 13px;
  opacity: 1;
}

.team-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.team-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
}

.team-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.team-name {
  flex: 1;
  transition: opacity 0.15s;
}

.team-count {
  opacity: 0.8;
  font-size: 13px;
}
</style>
