import type { ThemeMode } from '../lib/types';

const KEY = 'sp-theme';

export function getTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* privater Modus */
  }
  return 'system';
}

/** Wendet das Farbthema an; 'system' folgt der Einstellung des Geräts */
export function applyTheme(mode: ThemeMode = getTheme()) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  const dark = mode === 'dark' || (mode === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f0d16' : '#f6f4fb');
}

export function setTheme(mode: ThemeMode) {
  try {
    if (mode === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    /* privater Modus */
  }
  applyTheme(mode);
}

export function watchSystemTheme() {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme());
}
