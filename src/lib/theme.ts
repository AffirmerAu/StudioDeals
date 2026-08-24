export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'studiodeals-theme'

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
  localStorage.setItem(STORAGE_KEY, theme)
}
