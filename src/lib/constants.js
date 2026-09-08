// Shared constants used across pages.

// The fixed single-tenant org id (matches schema.sql default). Kept in one place
// so a future multi-tenant version can swap this for a real per-user org id.
export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

// Fuel types must match the Postgres enum public.fuel_type.
export const FUEL_TYPES = [
  { key: 'cement', label_en: 'Cement', label_hi: 'सीमेंट' },
  { key: 'diesel', label_en: 'Diesel', label_hi: 'डीजल' },
]

// Pipe-size categories (badge colours in CSS: .tag / .tag.pillar / .tag.fj).
export const CATEGORIES = ['S&S', 'PILLAR', 'F.J.']

export function categoryTagClass(category) {
  if (category === 'PILLAR') return 'tag pillar'
  if (category === 'F.J.') return 'tag fj'
  return 'tag'
}
