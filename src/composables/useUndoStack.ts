import { ref, computed } from 'vue'

// Module-level state — shared across every component that calls useUndoStack().
// Each entry is a closure that reverses one user action.
const stack: Array<() => void> = []
const MAX_HISTORY = 50

// A counter ref so the canUndo computed stays reactive (mutating an array
// directly doesn't trigger watchers in vanilla refs).
const stackSize = ref(0)

export function useUndoStack() {
  const canUndo = computed(() => stackSize.value > 0)

  function push(inverse: () => void) {
    stack.push(inverse)
    if (stack.length > MAX_HISTORY) stack.shift()
    stackSize.value = stack.length
  }

  function undo() {
    const action = stack.pop()
    stackSize.value = stack.length
    if (action) action()
  }

  // Called when a project is reset or loaded — the inverse actions in the stack
  // reference IDs that may no longer exist in the new project state.
  function clear() {
    stack.length = 0
    stackSize.value = 0
  }

  return { canUndo, push, undo, clear }
}
