export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const plat = navigator.platform ?? '';
  if (/Mac/i.test(plat)) return true;
  const ua = navigator.userAgent ?? '';
  return /Macintosh|Mac OS X/i.test(ua);
}

export function modifierLabel(): '⌘' | 'Ctrl' {
  return isMac() ? '⌘' : 'Ctrl';
}
