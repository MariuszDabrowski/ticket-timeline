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

// Render a compact pill DOM node and use it as the drag image. The pill
// follows the cursor instead of the native clone of the source — needed for
// multi-segment calendar items where grabbing a middle segment would
// otherwise produce a label-less chunk under the cursor. The ghost always
// shows the title.
//
// The browser snapshots the element synchronously when setDragImage is
// called, so we append off-screen, set the image, then remove on the next
// task (the snapshot has already been taken by then).
export function setPillDragImage(
  event: DragEvent,
  opts: { text: string; background: string },
): void {
  if (!event.dataTransfer) return
  lockMoveEffectAllowed(event)

  const el = document.createElement('div')
  el.textContent = opts.text
  el.style.cssText = `
    position: absolute;
    top: -1000px;
    left: -1000px;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    background: ${opts.background};
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.3), 0 1px 0 rgba(255, 255, 255, 0.07);
    white-space: nowrap;
    pointer-events: none;
  `
  document.body.appendChild(el)
  event.dataTransfer.setDragImage(el, 10, 10)
  setTimeout(() => el.remove(), 0)
}
