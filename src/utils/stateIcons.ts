const KNOWN: Record<string, string> = {
  'backlog': 'article',
  'unstarted': 'article',
  'not started': 'article',
  'ready for development': 'play_arrow',
  'ready for dev': 'play_arrow',
  'ready to start': 'play_arrow',
  'speccing': 'article',
  'scoping': 'article',
  'planning': 'article',
  'design': 'article',
  'in development': 'construction',
  'started': 'construction',
  'in progress': 'construction',
  'development': 'construction',
  'ready for review': 'back_hand',
  'in review': 'back_hand',
  'code review': 'back_hand',
  'review': 'back_hand',
  'awaiting signoff': 'back_hand',
  'awaiting review': 'back_hand',
  'needs approval': 'back_hand',
  'signoff': 'back_hand',
  'blocked': 'back_hand',
  'on hold': 'hourglass_empty',
  'completed': 'check',
  'done': 'check',
  'finished': 'check',
  'released': 'check',
  'cancelled': 'cancel',
  'canceled': 'cancel',
}

const FALLBACKS = ['article', 'play_arrow', 'construction', 'check', 'back_hand', 'hourglass_empty', 'label', 'flag']

export function stateIcon(state: string): string {
  const known = KNOWN[state.toLowerCase()]
  if (known) return known
  const hash = [...state].reduce((a, c) => a + c.charCodeAt(0), 0)
  return FALLBACKS[hash % FALLBACKS.length]!
}
