const KEYS = {
  apiKey:     'gemini_api_key',
  fontSize:   'sm_font_size',
  lineHeight: 'sm_line_height',
  theme:      'sm_theme',
}

export const DEFAULT_SETTINGS = {
  apiKey:     '',
  fontSize:   18,
  lineHeight: 1.8,
  theme:      'light',
}

export function loadSettings() {
  return {
    apiKey:     localStorage.getItem(KEYS.apiKey)     ?? DEFAULT_SETTINGS.apiKey,
    fontSize:   Number(localStorage.getItem(KEYS.fontSize))   || DEFAULT_SETTINGS.fontSize,
    lineHeight: Number(localStorage.getItem(KEYS.lineHeight)) || DEFAULT_SETTINGS.lineHeight,
    theme:      localStorage.getItem(KEYS.theme)      ?? DEFAULT_SETTINGS.theme,
  }
}

export function saveSettings(settings) {
  Object.entries(settings).forEach(([key, value]) => {
    if (KEYS[key] !== undefined) {
      localStorage.setItem(KEYS[key], value)
    }
  })
}
