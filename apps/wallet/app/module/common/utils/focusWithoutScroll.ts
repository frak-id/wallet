// Ref callback standing in for `autoFocus`: iOS pans to reveal a plainly focused
// field and pans back once the shell resizes above the keyboard.
export function focusWithoutScroll(element: HTMLElement | null) {
    element?.focus({ preventScroll: true });
}
