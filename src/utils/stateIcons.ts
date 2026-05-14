const KNOWN: Record<string, string> = {
  'backlog': '○',
  'unstarted': '○',
  'ready for development': '◇',
  'ready for dev': '◇',
  'ready to start': '◇',
  'speccing': '△',
  'scoping': '△',
  'planning': '△',
  'in development': '◆',
  'started': '◆',
  'in progress': '◆',
  'ready for review': '◎',
  'in review': '◎',
  'code review': '◎',
  'awaiting signoff': '◈',
  'awaiting review': '◈',
  'needs approval': '◈',
  'blocked': '✖',
  'completed': '✓',
  'done': '✓',
  'finished': '✓',
  'cancelled': '–',
  'canceled': '–',
}

const FALLBACKS = ['■', '●', '▲', '★', '◉', '▼', '◌', '⬡']

export function stateIcon(state: string): string {
  const known = KNOWN[state.toLowerCase()]
  if (known) return known
  const hash = [...state].reduce((a, c) => a + c.charCodeAt(0), 0)
  return FALLBACKS[hash % FALLBACKS.length]!
}
