import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Katzen, Zusatzleistungen, Kunden, Buchungen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [katzen, setKatzen] = useState<Katzen[]>([]);
  const [zusatzleistungen, setZusatzleistungen] = useState<Zusatzleistungen[]>([]);
  const [kunden, setKunden] = useState<Kunden[]>([]);
  const [buchungen, setBuchungen] = useState<Buchungen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [katzenData, zusatzleistungenData, kundenData, buchungenData] = await Promise.all([
        LivingAppsService.getKatzen(),
        LivingAppsService.getZusatzleistungen(),
        LivingAppsService.getKunden(),
        LivingAppsService.getBuchungen(),
      ]);
      setKatzen(katzenData);
      setZusatzleistungen(zusatzleistungenData);
      setKunden(kundenData);
      setBuchungen(buchungenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [katzenData, zusatzleistungenData, kundenData, buchungenData] = await Promise.all([
          LivingAppsService.getKatzen(),
          LivingAppsService.getZusatzleistungen(),
          LivingAppsService.getKunden(),
          LivingAppsService.getBuchungen(),
        ]);
        setKatzen(katzenData);
        setZusatzleistungen(zusatzleistungenData);
        setKunden(kundenData);
        setBuchungen(buchungenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const katzenMap = useMemo(() => {
    const m = new Map<string, Katzen>();
    katzen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [katzen]);

  const zusatzleistungenMap = useMemo(() => {
    const m = new Map<string, Zusatzleistungen>();
    zusatzleistungen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [zusatzleistungen]);

  const kundenMap = useMemo(() => {
    const m = new Map<string, Kunden>();
    kunden.forEach(r => m.set(r.record_id, r));
    return m;
  }, [kunden]);

  return { katzen, setKatzen, zusatzleistungen, setZusatzleistungen, kunden, setKunden, buchungen, setBuchungen, loading, error, fetchAll, katzenMap, zusatzleistungenMap, kundenMap };
}