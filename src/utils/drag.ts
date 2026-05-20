// Native drag-image suppression. The browser paints a semi-transparent
// clone of the source element under the cursor during HTML5 drag — for our
// pills that's duplicate feedback because the cascade preview already
// shows the would-be landing position live. Replace it with a 1x1
// transparent GIF so the cursor stays clean.
//
// Three things matter here, all about the very first drag:
//
//   1. Eager construction at module load. If we lazily new Image() inside
//      dragstart, the bitmap hasn't decoded yet when setDragImage runs and
//      macOS falls back to its default drag image — a globe icon, used for
//      drags it treats as URL/link. Constructing at import time gives the
//      decoder a head start before any user interaction.
//   2. GIF, not PNG. Tiny GIFs decode synchronously off the data URL on
//      Chrome/Safari; PNGs don't always. (Credit: sam.today/blog/html5-dnd-globe-icon.)
//   3. Skip setDragImage if .complete is still false on the very first
//      dragstart. Passing an undecoded image triggers the globe fallback;
//      passing nothing falls back to the source-element clone, which is a
//      far better degradation for one frame than the globe.
const EMPTY_DRAG_IMAGE = typeof Image !== 'undefined' ? new Image(1, 1) : null
if (EMPTY_DRAG_IMAGE) {
  EMPTY_DRAG_IMAGE.src =
    'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='
}

// Lock the drag's effectAllowed to 'move' at dragstart. Without this Chrome
// guesses from heuristics and can land on "link" — which paints a globe icon
// next to the cursor until the first dragover sets dropEffect. Called from
// suppressNativeDragImage; every dragstart in the app goes through that.
function lockMoveEffectAllowed(event: DragEvent): void {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
}

export function suppressNativeDragImage(event: DragEvent): void {
  if (!event.dataTransfer) return
  if (EMPTY_DRAG_IMAGE?.complete) {
    event.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0)
  }
  lockMoveEffectAllowed(event)
}

// Pair with suppressNativeDragImage on every drop target's dragover so the
// cursor stays on the "move" indicator throughout the drag.
export function setMoveDropEffect(event: DragEvent): void {
  if (!event.dataTransfer) return
  event.dataTransfer.dropEffect = 'move'
}

// Background descriptor for attachFollowPill. Each kind maps to a CSS
// background string built by buildPillBackground.
export type PillBackground =
  | { kind: 'color'; hex: string }           // tickets: solid color, left→darker gradient
  | { kind: 'striped-color'; hex: string }   // events: same gradient + 45° stripe overlay
  | { kind: 'striped-grey' }                 // vacations: striped grey

// Suppress the native drag ghost and attach a CSS-styled pill that follows
// the cursor for the lifetime of the drag. We tried setDragImage with both
// DOM nodes and canvases first — both were unreliable across browsers (the
// snapshot is often skipped or empty), and the user saw either nothing or
// a macOS URL/link "globe" fallback. Driving the position ourselves via
// the source element's `drag` events bypasses the snapshot mechanism
// entirely, which is the only way we've found to make this work
// consistently.
//
// Needed because multi-segment calendar pills only render the title on the
// start segment; grabbing a middle segment with the native ghost would put
// a label-less chunk under the cursor.
export function attachFollowPill(
  event: DragEvent,
  opts: { text: string; background: PillBackground },
): void {
  suppressNativeDragImage(event)

  const ghost = document.createElement('div')
  ghost.textContent = opts.text
  ghost.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    z-index: 99999;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    background: ${buildPillBackground(opts.background)};
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.3), 0 1px 0 rgba(255, 255, 255, 0.07);
    white-space: nowrap;
    pointer-events: none;
    will-change: transform;
    transform: translate(${event.clientX + 10}px, ${event.clientY + 10}px);
  `
  document.body.appendChild(ghost)

  const source = event.target as HTMLElement | null
  if (!source) {
    ghost.remove()
    return
  }

  // Position tracking across browsers is messy: the `drag` event on the
  // source is unreliable (Firefox sometimes reports (0, 0); Safari can stop
  // firing mid-drag). `dragover` on the document is the most consistent
  // signal because drop targets fire it reliably — and our whole app
  // surface (calendar cells, sidebar sections) is a drop target. Listen to
  // both and let whichever fires last update the ghost position; together
  // they cover each browser's gaps.
  //
  // Skip events at (0, 0): some browsers fire one right before drop with
  // those coords, which would yank the ghost to the corner before
  // dragend cleans up.
  const updatePos = (e: DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return
    ghost.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 10}px)`
  }

  const cleanup = () => {
    ghost.remove()
    source.removeEventListener('drag', updatePos)
    source.removeEventListener('dragend', cleanup)
    document.removeEventListener('dragover', updatePos, true)
  }

  source.addEventListener('drag', updatePos)
  source.addEventListener('dragend', cleanup)
  document.addEventListener('dragover', updatePos, true)
}

function buildPillBackground(bg: PillBackground): string {
  if (bg.kind === 'striped-grey') {
    return 'repeating-linear-gradient(45deg, #2a2a2a 0px, #2a2a2a 3px, #323232 3px, #323232 9px)'
  }
  const grad = colorPillGradient(bg.hex)
  if (bg.kind === 'striped-color') {
    return `repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0, rgba(0,0,0,0.12) 3px, transparent 3px, transparent 9px), ${grad}`
  }
  return grad
}

function colorPillGradient(hex: string): string {
  let h = hex.startsWith('#') ? hex.slice(1) : hex
  if (h.length === 3) h = h[0]! + h[0] + h[1]! + h[1] + h[2]! + h[2]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const left = `rgba(${r}, ${g}, ${b}, 0.75)`
  const right = `rgba(${Math.round(r * 0.6)}, ${Math.round(g * 0.6)}, ${Math.round(b * 0.6)}, 0.75)`
  return `linear-gradient(to right, ${left}, ${right})`
}
