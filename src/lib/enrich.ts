import type { EnrichedBuchungen, EnrichedKatzen } from '@/types/enriched';
import type { Buchungen, Katzen, Kunden, Zusatzleistungen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface KatzenMaps {
  kundenMap: Map<string, Kunden>;
}

export function enrichKatzen(
  katzen: Katzen[],
  maps: KatzenMaps
): EnrichedKatzen[] {
  return katzen.map(r => ({
    ...r,
    besitzerName: resolveDisplay(r.fields.besitzer, maps.kundenMap, 'vorname', 'nachname'),
  }));
}

interface BuchungenMaps {
  katzenMap: Map<string, Katzen>;
  kundenMap: Map<string, Kunden>;
  zusatzleistungenMap: Map<string, Zusatzleistungen>;
}

export function enrichBuchungen(
  buchungen: Buchungen[],
  maps: BuchungenMaps
): EnrichedBuchungen[] {
  return buchungen.map(r => ({
    ...r,
    katzeName: resolveDisplay(r.fields.katze, maps.katzenMap, 'katzenname'),
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenMap, 'vorname', 'nachname'),
    zusatzleistungenName: resolveDisplay(r.fields.zusatzleistungen, maps.zusatzleistungenMap, 'leistungsname'),
  }));
}
