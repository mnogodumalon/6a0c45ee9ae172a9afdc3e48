import { useMemo, useState } from 'react';
import { format, parseISO, isToday, isBefore, startOfToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import type { Buchungen, Katzen, Kunden } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconPlus, IconLogin, IconLogout, IconCalendarEvent } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import {
  CalendarWidget,
  CalendarSkeleton,
  CalendarError,
  type CalendarEvent,
  type CalendarTone,
} from '@/components/widgets/CalendarWidget';
import {
  RecordOverlayHost,
  RecordHeader,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { BuchungenDetails } from '@/components/details/BuchungenDetails';
import { KatzenDetails } from '@/components/details/KatzenDetails';
import { KundenDetails } from '@/components/details/KundenDetails';
import { BuchungenDialog } from '@/components/dialogs/BuchungenDialog';
import { KatzenDialog } from '@/components/dialogs/KatzenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';

const APPGROUP_ID = '6a0c45ee9ae172a9afdc3e48';
const REPAIR_ENDPOINT = '/claude/build/repair';

type OverlayItem =
  | { type: 'buchung'; record: Buchungen }
  | { type: 'katze'; record: Katzen }
  | { type: 'kunde'; record: Kunden };

export default function DashboardOverview() {
  const {
    zusatzleistungen, kunden, katzen, buchungen,
    setKunden, setKatzen, setBuchungen,
    zusatzleistungenMap, kundenMap, katzenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();
  const overlay = useRecordOverlayStack<OverlayItem>();

  const [buchungDialogOpen, setBuchungDialogOpen] = useState(false);
  const [katzeDialogOpen, setKatzeDialogOpen] = useState(false);
  const [editingBuchung, setEditingBuchung] = useState<EnrichedBuchungen | null>(null);
  const [editingKatze, setEditingKatze] = useState<Katzen | null>(null);
  const [prefillBuchung, setPrefillBuchung] = useState<Partial<Buchungen['fields']>>({});
  const [prefillKatze, setPrefillKatze] = useState<Partial<Katzen['fields']>>({});

  const enrichedBuchungen = useMemo(
    () => enrichBuchungen(buchungen, { katzenMap, kundenMap, zusatzleistungenMap }),
    [buchungen, katzenMap, kundenMap, zusatzleistungenMap],
  );

  const today = format(clock, 'yyyy-MM-dd');

  const anreisenHeute = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.anreise === today && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, today],
  );
  const abreisenHeute = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.abreise === today && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, today],
  );
  const aktuelleGaeste = useMemo(
    () => enrichedBuchungen.filter(b => {
      const s = lookupKey(b.fields.status);
      return s === 'eingecheckt';
    }),
    [enrichedBuchungen],
  );
  const angefragt = useMemo(
    () => enrichedBuchungen.filter(b => lookupKey(b.fields.status) === 'angefragt'),
    [enrichedBuchungen],
  );

  // Urgency: angefragt that need confirmation
  const urgentAngefragt = angefragt.slice(0, 1)[0];

  // Calendar events
  const events = useMemo<CalendarEvent[]>(
    () =>
      enrichedBuchungen
        .filter(b => !!b.fields.anreise && lookupKey(b.fields.status) !== 'storniert')
        .map(b => {
          const s = lookupKey(b.fields.status);
          let tone: CalendarTone = 'default';
          if (s === 'angefragt') tone = 'warning';
          else if (s === 'eingecheckt') tone = 'success';
          else if (s === 'bestaetigt') tone = 'primary';
          else if (s === 'ausgecheckt') tone = 'default';
          return {
            id: `buchung:${b.record_id}`,
            start: b.fields.anreise!,
            end: b.fields.abreise,
            allDay: true,
            title: b.katzeName || 'Ohne Katze',
            subtitle: b.kundeName || undefined,
            tone,
          };
        }),
    [enrichedBuchungen],
  );

  // Advance status helper (optimistic)
  const advanceStatus = (b: EnrichedBuchungen) => {
    const s = lookupKey(b.fields.status);
    const next: Record<string, string> = {
      angefragt: 'bestaetigt',
      bestaetigt: 'eingecheckt',
      eingecheckt: 'ausgecheckt',
    };
    const newStatus = next[s ?? ''];
    if (!newStatus) return;
    const prevStatus = b.fields.status;
    setBuchungen(prev =>
      prev.map(r => r.record_id === b.record_id ? { ...r, fields: { ...r.fields, status: { key: newStatus, label: newStatus } as any } } : r),
    );
    const labels: Record<string, string> = {
      bestaetigt: 'Bestätigt',
      eingecheckt: 'Eingecheckt',
      ausgecheckt: 'Ausgecheckt',
    };
    undoToast(`${b.katzeName} — ${labels[newStatus]}`, () => {
      setBuchungen(prev =>
        prev.map(r => r.record_id === b.record_id ? { ...r, fields: { ...r.fields, status: prevStatus } } : r),
      );
      LivingAppsService.updateBuchungenEntry(b.record_id, { status: lookupKey(prevStatus) as any }).catch(() => fetchAll());
    });
    LivingAppsService.updateBuchungenEntry(b.record_id, { status: newStatus as any }).catch(() => fetchAll());
  };

  const contextLine = useMemo(() => {
    if (anreisenHeute.length === 0 && abreisenHeute.length === 0 && aktuelleGaeste.length === 0) {
      return 'Heute sind keine Anreisen oder Abreisen geplant.';
    }
    const parts: string[] = [];
    if (anreisenHeute.length > 0) {
      parts.push(`${namen(anreisenHeute.map(b => b.katzeName || '?'))} reist an`);
    }
    if (abreisenHeute.length > 0) {
      parts.push(`${namen(abreisenHeute.map(b => b.katzeName || '?'))} reist ab`);
    }
    if (aktuelleGaeste.length > 0 && parts.length === 0) {
      parts.push(`${aktuelleGaeste.length} Katze${aktuelleGaeste.length > 1 ? 'n' : ''} aktuell zu Gast`);
    }
    return parts.join(' · ') + '.';
  }, [anreisenHeute, abreisenHeute, aktuelleGaeste]);

  // All hooks above — early returns below

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const openBuchungCreate = (prefill?: Partial<Buchungen['fields']>) => {
    setEditingBuchung(null);
    setPrefillBuchung(prefill ?? {});
    setBuchungDialogOpen(true);
  };
  const openBuchungEdit = (b: EnrichedBuchungen) => {
    setEditingBuchung(b);
    setPrefillBuchung({});
    setBuchungDialogOpen(true);
  };
  const openKatzeCreate = (prefill?: Partial<Katzen['fields']>) => {
    setEditingKatze(null);
    setPrefillKatze(prefill ?? {});
    setKatzeDialogOpen(true);
  };

  // Overlay helpers
  const openBuchungOverlay = (b: Buchungen) => overlay.push({ type: 'buchung', record: b });
  const openKatzeOverlay = (k: Katzen) => overlay.push({ type: 'katze', record: k });
  const openKundeOverlay = (k: Kunden) => overlay.push({ type: 'kunde', record: k });

  const nextStatusLabel = (b: Buchungen) => {
    const s = lookupKey(b.fields.status);
    if (s === 'angefragt') return 'Bestätigen';
    if (s === 'bestaetigt') return 'Einchecken';
    if (s === 'eingecheckt') return 'Auschecken';
    return null;
  };

  return (
    <>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{gruss(clock)} Katzenpension</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
          </div>
          <Button onClick={() => openBuchungCreate()} size="sm" className="shrink-0">
            <IconPlus size={14} className="mr-1 shrink-0" />
            Neue Buchung
          </Button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          urgentAngefragt ? (
            <HeroBanner
              tone="warning"
              icon={<IconCalendarEvent size={18} />}
              action={{
                label: 'Bestätigen',
                onClick: () => {
                  const enriched = enrichedBuchungen.find(b => b.record_id === urgentAngefragt.record_id);
                  if (enriched) advanceStatus(enriched);
                },
              }}
            >
              <b>{urgentAngefragt.katzeName || 'Eine Buchung'}</b> von <b>{urgentAngefragt.kundeName}</b> wartet auf Bestätigung
              {angefragt.length > 1 ? ` (+ ${angefragt.length - 1} weitere)` : ''}.
            </HeroBanner>
          ) : null
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Heute anreisend"
              value={String(anreisenHeute.length)}
              icon={<IconLogin size={16} />}
              tone={anreisenHeute.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Aktuell zu Gast"
              value={String(aktuelleGaeste.length)}
              icon={<IconCalendarEvent size={16} />}
              tone={aktuelleGaeste.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title="Heute abreisend"
              value={String(abreisenHeute.length)}
              icon={<IconLogout size={16} />}
              tone={abreisenHeute.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Anfragen"
              value={String(angefragt.length)}
              icon={<IconAlertCircle size={16} />}
              tone={angefragt.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={events}
            locale={de}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1];
              const b = buchungen.find(r => r.record_id === rid);
              if (b) openBuchungOverlay(b);
            }}
            onEventDrop={(eventId, newStart, newEnd) => {
              const rid = eventId.split(':')[1];
              if (!rid) return;
              const prev = buchungen.find(b => b.record_id === rid);
              if (!prev) return;
              const prevAnreise = prev.fields.anreise;
              const prevAbreise = prev.fields.abreise;
              setBuchungen(ps =>
                ps.map(b =>
                  b.record_id === rid
                    ? { ...b, fields: { ...b.fields, anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}) } }
                    : b,
                ),
              );
              undoToast('Buchung verschoben', () => {
                setBuchungen(ps =>
                  ps.map(b =>
                    b.record_id === rid
                      ? { ...b, fields: { ...b.fields, anreise: prevAnreise, abreise: prevAbreise } }
                      : b,
                  ),
                );
                LivingAppsService.updateBuchungenEntry(rid, { anreise: prevAnreise, abreise: prevAbreise }).catch(() => fetchAll());
              });
              LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}) }).catch(() => fetchAll());
            }}
            onRangeCreate={(start, end) => {
              openBuchungCreate({
                anreise: format(start, 'yyyy-MM-dd'),
                abreise: format(end, 'yyyy-MM-dd'),
              });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Heute anreisend"
              icon={<IconLogin size={14} className="shrink-0" />}
              items={anreisenHeute.map(b => ({
                id: b.record_id,
                title: b.katzeName || 'Unbekannte Katze',
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{b.kundeName}</span>
                    {b.fields.unterkunftstyp && (
                      <span className="text-muted-foreground"> · {b.fields.unterkunftstyp.label}</span>
                    )}
                  </>
                ),
                action: lookupKey(b.fields.status) === 'bestaetigt'
                  ? { label: 'Einchecken', onClick: () => advanceStatus(b) }
                  : lookupKey(b.fields.status) === 'angefragt'
                  ? { label: 'Bestätigen', onClick: () => advanceStatus(b) }
                  : undefined,
              }))}
              onItemClick={id => {
                const b = buchungen.find(r => r.record_id === id);
                if (b) openBuchungOverlay(b);
              }}
              empty={{
                text: 'Keine Anreisen heute — nächste Buchung im Kalender.',
                action: { label: 'Neue Buchung', onClick: () => openBuchungCreate() },
              }}
            />
            <WorkList
              title="Heute abreisend"
              icon={<IconLogout size={14} className="shrink-0" />}
              items={abreisenHeute.map(b => ({
                id: b.record_id,
                title: b.katzeName || 'Unbekannte Katze',
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{b.kundeName}</span>
                    {b.fields.gesamtpreis != null && (
                      <span className="text-muted-foreground"> · {formatCurrency(b.fields.gesamtpreis)}</span>
                    )}
                  </>
                ),
                action: lookupKey(b.fields.status) === 'eingecheckt'
                  ? { label: 'Auschecken', onClick: () => advanceStatus(b) }
                  : undefined,
              }))}
              onItemClick={id => {
                const b = buchungen.find(r => r.record_id === id);
                if (b) openBuchungOverlay(b);
              }}
              empty={{
                text: 'Keine Abreisen heute — alles ruhig.',
              }}
            />
          </>
        }
      />

      {/* Record Overlay — single shell via RecordOverlayHost */}
      <RecordOverlayHost
        overlay={overlay}
        onEdit={top => {
          if (top.type === 'buchung') {
            const enriched = enrichedBuchungen.find(e => e.record_id === top.record.record_id);
            if (enriched) openBuchungEdit(enriched);
          }
        }}
        footer={top => {
          if (top.type === 'buchung') {
            const b = top.record;
            const enriched = enrichedBuchungen.find(e => e.record_id === b.record_id);
            const nsl = nextStatusLabel(b);
            if (nsl && enriched) {
              return (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-primary text-primary-foreground px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
                  onClick={() => { advanceStatus(enriched); overlay.close(); }}
                >
                  {nsl}
                </button>
              );
            }
          }
          return undefined;
        }}
        render={top => {
          if (top.type === 'buchung') {
            const b = top.record;
            const enriched = enrichedBuchungen.find(e => e.record_id === b.record_id);
            return (
              <>
                <RecordHeader
                  title={enriched?.katzeName || b.fields.anreise || 'Buchung'}
                  subtitle={[
                    enriched?.kundeName,
                    b.fields.anreise && b.fields.abreise
                      ? `${formatDate(b.fields.anreise)} – ${formatDate(b.fields.abreise)}`
                      : b.fields.anreise
                      ? `ab ${formatDate(b.fields.anreise)}`
                      : undefined,
                  ].filter(Boolean).join(' · ')}
                />
                <BuchungenDetails
                  record={b}
                  katzenList={katzen}
                  onOpenKatzen={k => overlay.push({ type: 'katze', record: k })}
                  kundenList={kunden}
                  onOpenKunden={k => overlay.push({ type: 'kunde', record: k })}
                  zusatzleistungenList={zusatzleistungen}
                />
              </>
            );
          }
          if (top.type === 'katze') {
            const k = top.record;
            return (
              <>
                <RecordHeader
                  title={k.fields.katzenname || 'Katze'}
                  subtitle={[k.fields.rasse, k.fields.farbe].filter(Boolean).join(' · ')}
                />
                <KatzenDetails
                  record={k}
                  kundenList={kunden}
                  onOpenKunden={openKundeOverlay}
                  buchungenList={buchungen}
                  onOpenBuchungen={openBuchungOverlay}
                  onAddBuchungen={() => {
                    openBuchungCreate({ katze: k.record_id });
                    overlay.close();
                  }}
                />
              </>
            );
          }
          if (top.type === 'kunde') {
            const k = top.record;
            return (
              <>
                <RecordHeader
                  title={[k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ') || 'Kunde'}
                  subtitle={[k.fields.telefon, k.fields.email].filter(Boolean).join(' · ')}
                />
                <KundenDetails
                  record={k}
                  katzenList={katzen}
                  onOpenKatzen={openKatzeOverlay}
                  onAddKatzen={() => {
                    openKatzeCreate({ besitzer: k.record_id });
                    overlay.close();
                  }}
                  buchungenList={buchungen}
                  onOpenBuchungen={openBuchungOverlay}
                  onAddBuchungen={() => {
                    openBuchungCreate({ kunde: k.record_id });
                    overlay.close();
                  }}
                />
              </>
            );
          }
          return null;
        }}
      />

      {/* Dialogs */}
      <BuchungenDialog
        open={buchungDialogOpen}
        onClose={() => { setBuchungDialogOpen(false); setEditingBuchung(null); }}
        onSubmit={async (fields) => {
          if (editingBuchung) {
            await LivingAppsService.updateBuchungenEntry(editingBuchung.record_id, fields);
          } else {
            await LivingAppsService.createBuchungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingBuchung ? editingBuchung.fields : prefillBuchung}
        recordId={editingBuchung?.record_id}
        katzenList={katzen}
        kundenList={kunden}
        zusatzleistungenList={zusatzleistungen}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungen']}
      />
      <KatzenDialog
        open={katzeDialogOpen}
        onClose={() => { setKatzeDialogOpen(false); setEditingKatze(null); }}
        onSubmit={async (fields) => {
          if (editingKatze) {
            await LivingAppsService.updateKatzenEntry(editingKatze.record_id, fields);
          } else {
            await LivingAppsService.createKatzenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingKatze ? editingKatze.fields : prefillKatze}
        recordId={editingKatze?.record_id}
        kundenList={kunden}
        enablePhotoScan={AI_PHOTO_SCAN['Katzen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Katzen']}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
