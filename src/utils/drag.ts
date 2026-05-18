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
// next to the cursor until the first dragover sets dropEffect. Used on every
// dragstart in the app, whether or not we also suppress the native drag image.
export function lockMoveEffectAllowed(event: DragEvent): void {
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
