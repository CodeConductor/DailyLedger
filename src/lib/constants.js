// Shared constants used across pages.

// The fixed single-tenant org id (matches schema.sql default). Kept in one place
// so a future multi-tenant version can swap this for a real per-user org id.
export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

// Fuel types must match the Postgres enum public.fuel_type.
export const FUEL_TYPES = [
  { key: 'cement', label_en: 'Cement', label_hi: 'सीमेंट' },
  { key: 'diesel', label_en: 'Diesel', label_hi: 'डीजल' },
]

// Fallback Type/Class lists — only used if app_settings has none. The live
// lists are stored in app_settings (pipe_types / pipe_classes) and edited in
// Settings, so these are just safe defaults.
export const DEFAULT_PIPE_TYPES = ['S&S', 'Plain', 'FlushJoint']
export const DEFAULT_PIPE_CLASSES = ['NP3', 'NP4']

// Human label for a pipe row, e.g. "150mm S&S NP3".
export function pipeLabel(p) {
  if (!p) return '—'
  return `${p.size_mm}mm ${p.type} ${p.class}`
}

// Colour badge class for a pipe Type (reuses existing CSS: .tag / .pillar / .fj).
export function typeTagClass(type) {
  if (type === 'FlushJoint') return 'tag fj'
  if (type === 'Plain') return 'tag pillar'
  return 'tag'
}
