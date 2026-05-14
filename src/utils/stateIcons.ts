const KNOWN: Record<string, string> = {
  'backlog': 'radio_button_unchecked',
  'unstarted': 'radio_button_unchecked',
  'not started': 'radio_button_unchecked',
  'ready for development': 'play_circle',
  'ready for dev': 'play_circle',
  'ready to start': 'play_circle',
  'speccing': 'edit_note',
  'scoping': 'edit_note',
  'planning': 'edit_note',
  'design': 'edit_note',
  'in development': 'code',
  'started': 'code',
  'in progress': 'code',
  'development': 'code',
  'ready for review': 'rate_review',
  'in review': 'rate_review',
  'code review': 'rate_review',
  'review': 'rate_review',
  'awaiting signoff': 'approval',
  'awaiting review': 'approval',
  'needs approval': 'approval',
  'signoff': 'approval',
  'blocked': 'block',
  'on hold': 'pause_circle',
  'completed': 'task_alt',
  'done': 'task_alt',
  'finished': 'task_alt',
  'released': 'task_alt',
  'cancelled': 'cancel',
  'canceled': 'cancel',
}

const FALLBACKS = ['label', 'bookmark', 'flag', 'star', 'hexagon', 'pentagon', 'diamond', 'circle']

export function stateIcon(state: string): string {
  const known = KNOWN[state.toLowerCase()]
  if (known) return known
  const hash = [...state].reduce((a, c) => a + c.charCodeAt(0), 0)
  return FALLBACKS[hash % FALLBACKS.length]!
}
