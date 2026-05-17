// Native drag-image suppression. The browser paints a semi-transparent
// clone of the source element under the cursor during HTML5 drag — for our
// pills that's duplicate feedback because the cascade preview already
// shows the would-be landing position live. Replace it with a 1x1
// transparent canvas so the cursor stays clean.
//
// Why a canvas and not an Image: an Image from a data URL still decodes
// asynchronously, and on the very first drag setDragImage() fires before
// the bitmap is ready — the browser then falls back to its default drag
// image (Chrome renders a globe icon for payloads it can't classify). A
// canvas is pixel-ready synchronously, so the first drag works too.
let transparentDragImage: HTMLCanvasElement | null = null

function getTransparentDragImage(): HTMLCanvasElement {
  if (!transparentDragImage) {
    transparentDragImage = document.createElement('canvas')
    transparentDragImage.width = 1
    transparentDragImage.height = 1
  }
  return transparentDragImage
}

export function suppressNativeDragImage(event: DragEvent): void {
  event.dataTransfer?.setDragImage(getTransparentDragImage(), 0, 0)
}
