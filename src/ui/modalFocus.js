const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'a[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function getModalFocusableElements(dialog) {
  return dialog ? [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)] : [];
}

export function containModalTabFocus(event, dialog, { focusFallback = dialog, initialFocus = null } = {}) {
  if (event.key !== 'Tab') return false;

  const focusables = getModalFocusableElements(dialog);
  if (focusables.length === 0) {
    event.preventDefault();
    focusFallback?.focus();
    return true;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const activeElement = document.activeElement;
  const focusIsOutside = !dialog?.contains(activeElement);

  if (event.shiftKey && (focusIsOutside || activeElement === first || activeElement === initialFocus)) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && (focusIsOutside || activeElement === last)) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}
