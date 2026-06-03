import { normalizePestType } from './transformLogbookToEvent';

/** Human-readable label for a normalised pest_type slug. */
export function formatPestTypeLabel(slug: string): string {
  const s = slug.trim().toLowerCase();
  if (!s || s === 'unspecified') return 'Unspecified';
  return s
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Options for filter dropdown: slug value + display label. */
export function pestTypeFilterOptions(slugs: string[]): { value: string; label: string }[] {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const raw of slugs) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: formatPestTypeLabel(value) });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Map technician UI treatment label to the slug stored in intelligence. */
export function treatmentLabelToPestSlug(label: string): string {
  return normalizePestType(label);
}
