// Native drag-image suppression. The browser paints a semi-transparent
// clone of the source element under the cursor during HTML5 drag — for our
// pills that's duplicate feedback because the cascade preview already
// shows the would-be landing position live. Replace it with a 1x1
// transparent image so the cursor stays clean.
//
// Cached as a module-level singleton so we're not allocating a fresh Image
// every dragstart frame.
let transparentDragImage: HTMLImageElement | null = null

function getTransparentDragImage(): HTMLImageElement {
  if (!transparentDragImage) {
    transparentDragImage = new Image()
    transparentDragImage.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='
  }
  return transparentDragImage
}

export function suppressNativeDragImage(event: DragEvent): void {
  event.dataTransfer?.setDragImage(getTransparentDragImage(), 0, 0)
}
