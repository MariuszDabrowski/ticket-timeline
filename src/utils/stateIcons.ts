const KNOWN: Record<string, string> = {
  'backlog': 'article',
  'unstarted': 'article',
  'not started': 'article',
  'intake': 'arrow_insert',
  'ready for development': 'campaign',
  'ready for dev': 'campaign',
  'ready to start': 'campaign',
  'speccing': 'discover_tune',
  'scoping': 'discover_tune',
  'tech speccing': 'discover_tune',
  'tech spec': 'discover_tune',
  'planning': 'article',
  'design': 'article',
  'in development': 'play_arrow',
  'started': 'play_arrow',
  'in progress': 'play_arrow',
  'development': 'play_arrow',
  'ready for review': 'back_hand',
  'in review': 'back_hand',
  'code review': 'back_hand',
  'review': 'back_hand',
  'awaiting signoff': 'back_hand',
  'awaiting review': 'back_hand',
  'needs approval': 'back_hand',
  'signoff': 'back_hand',
  'blocked': 'pause',
  'on hold': 'hourglass_empty',
  'completed': 'check',
  'done': 'check',
  'finished': 'check',
  'released': 'check',
  'cancelled': 'cancel',
  'canceled': 'cancel',
}

const FALLBACKS = ['article', 'campaign', 'play_arrow', 'check', 'back_hand', 'hourglass_empty', 'label', 'flag']

export function stateIcon(state: string): string {
  const known = KNOWN[state.toLowerCase()]
  if (known) return known
  const hash = [...state].reduce((a, c) => a + c.charCodeAt(0), 0)
  return FALLBACKS[hash % FALLBACKS.length]!
}
