import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BuchungenDialog } from '@/components/dialogs/BuchungenDialog';
import { KatzenDialog } from '@/components/dialogs/KatzenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPlus,
  IconPencil,
  IconTrash,
  IconCalendar,
  IconCat,
  IconUsers,
  IconBuildingCottage,
  IconClock,
  IconStar,
  IconChevronRight,
  IconDoorEnter,
  IconDoorExit,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a0c45ee9ae172a9afdc3e48';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_ORDER = ['angefragt', 'bestaetigt', 'eingecheckt', 'ausgecheckt'];
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; headerBg: string }> = {
  angefragt: {
    label: 'Angefragt',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    headerBg: 'bg-amber-100',
  },
  bestaetigt: {
    label: 'Bestätigt',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    headerBg: 'bg-blue-100',
  },
  eingecheckt: {
    label: 'Eingecheckt',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    headerBg: 'bg-green-100',
  },
  ausgecheckt: {
    label: 'Ausgecheckt',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    headerBg: 'bg-slate-100',
  },
};

const UNTERKUNFT_LABELS: Record<string, string> = {
  standard: 'Standard',
  komfort: 'Komfort',
  suite: 'Suite',
};

type DialogMode = 'create-buchung' | 'edit-buchung' | 'create-katze' | null;

export default function DashboardOverview() {
  const {
    katzen, zusatzleistungen, kunden, buchungen,
    katzenMap, zusatzleistungenMap, kundenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedBuchungen = enrichBuchungen(buchungen, { katzenMap, kundenMap, zusatzleistungenMap });

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editBuchung, setEditBuchung] = useState<EnrichedBuchungen | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedBuchungen | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const aktiv = buchungen.filter(b => {
      const s = typeof b.fields.status === 'object' && b.fields.status !== null
        ? (b.fields.status as { key: string }).key : b.fields.status;
      return s === 'eingecheckt';
    }).length;
    const heute = buchungen.filter(b => b.fields.anreise === today || b.fields.abreise === today).length;
    const offen = buchungen.filter(b => {
      const s = typeof b.fields.status === 'object' && b.fields.status !== null
        ? (b.fields.status as { key: string }).key : b.fields.status;
      return s === 'angefragt';
    }).length;
    return { aktiv, heute, offen, katzen: katzen.length };
  }, [buchungen, katzen, today]);

  const groupedBuchungen = useMemo(() => {
    const groups: Record<string, EnrichedBuchungen[]> = {
      angefragt: [],
      bestaetigt: [],
      eingecheckt: [],
      ausgecheckt: [],
    };
    for (const b of enrichedBuchungen) {
      const key = typeof b.fields.status === 'object' && b.fields.status !== null
        ? (b.fields.status as { key: string }).key
        : (b.fields.status ?? 'angefragt');
      if (key in groups) groups[key].push(b);
      else groups['angefragt'].push(b);
    }
    return groups;
  }, [enrichedBuchungen]);

  const visibleStatuses = statusFilter ? [statusFilter] : STATUS_ORDER;

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteBuchungenEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  };

  const handleStatusChange = async (buchung: EnrichedBuchungen, newStatusKey: string) => {
    await LivingAppsService.updateBuchungenEntry(buchung.record_id, {
      status: newStatusKey,
    });
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Workflow Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/neue-buchung" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow no-underline">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconDoorEnter size={20} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground text-sm">Neue Buchung anlegen</p>
            <p className="text-xs text-muted-foreground truncate">Kunde, Katze & Aufenthalt in einem Schritt erfassen</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
        <a href="#/intents/abreise" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow no-underline">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconDoorExit size={20} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground text-sm">Abreise abwickeln</p>
            <p className="text-xs text-muted-foreground truncate">Aufenthalt prüfen, Gesamtpreis bestätigen & auschecken</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Übersicht</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Katzenpension — {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setDialogMode('create-katze'); }}>
            <IconCat size={16} className="mr-1.5 shrink-0" />
            <span>Neue Katze</span>
          </Button>
          <Button size="sm" onClick={() => { setEditBuchung(null); setDialogMode('create-buchung'); }}>
            <IconPlus size={16} className="mr-1.5 shrink-0" />
            <span>Neue Buchung</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Aktuelle Gäste"
          value={String(stats.aktiv)}
          description="Eingecheckt"
          icon={<IconBuildingCottage size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Heute"
          value={String(stats.heute)}
          description="An- oder Abreise"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offen"
          value={String(stats.offen)}
          description="Anfragen"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Katzen"
          value={String(stats.katzen)}
          description="Registriert"
          icon={<IconCat size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statusFilter === null
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          Alle ({buchungen.length})
        </button>
        {STATUS_ORDER.map(key => {
          const cfg = STATUS_CONFIG[key];
          const count = groupedBuchungen[key]?.length ?? 0;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? null : key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === key
                  ? `${cfg.bg} ${cfg.color} ring-2 ring-current`
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className={`grid gap-4 ${visibleStatuses.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}`}>
        {visibleStatuses.map(statusKey => {
          const cfg = STATUS_CONFIG[statusKey];
          const cards = groupedBuchungen[statusKey] ?? [];
          const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(statusKey) + 1];
          const prevStatus = STATUS_ORDER[STATUS_ORDER.indexOf(statusKey) - 1];

          return (
            <div key={statusKey} className={`rounded-2xl border ${cfg.border} overflow-hidden flex flex-col`}>
              {/* Column Header */}
              <div className={`${cfg.headerBg} px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                    {cards.length}
                  </span>
                </div>
                <button
                  onClick={() => { setEditBuchung(null); setDialogMode('create-buchung'); }}
                  className={`p-1 rounded-lg hover:bg-white/60 transition-colors ${cfg.color}`}
                  title="Neue Buchung"
                >
                  <IconPlus size={14} />
                </button>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-3 flex-1 min-h-[120px]">
                {cards.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <IconCat size={28} className="text-muted-foreground/30 mb-2" stroke={1.5} />
                    <p className="text-xs text-muted-foreground">Keine Buchungen</p>
                  </div>
                )}
                {cards.map(buchung => {
                  const unterkunftKey = typeof buchung.fields.unterkunftstyp === 'object' && buchung.fields.unterkunftstyp !== null
                    ? (buchung.fields.unterkunftstyp as { key: string }).key
                    : buchung.fields.unterkunftstyp;
                  const unterkunftLabel = unterkunftKey ? (UNTERKUNFT_LABELS[unterkunftKey] ?? unterkunftKey) : null;
                  const isToday = buchung.fields.anreise === today || buchung.fields.abreise === today;

                  return (
                    <div
                      key={buchung.record_id}
                      className={`bg-white rounded-xl border ${cfg.border} p-3 shadow-sm hover:shadow-md transition-shadow`}
                    >
                      {/* Katze + Heute-Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <IconCat size={14} className={`shrink-0 ${cfg.color}`} />
                            <span className="font-semibold text-sm text-foreground truncate">
                              {buchung.katzeName || '—'}
                            </span>
                            {isToday && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold shrink-0">
                                Heute
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <IconUsers size={11} className="text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{buchung.kundeName || '—'}</span>
                          </div>
                        </div>
                        {unterkunftLabel && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cfg.bg} ${cfg.color}`}>
                            {unterkunftLabel}
                          </span>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <IconCalendar size={11} className="shrink-0" />
                        <span>{formatDate(buchung.fields.anreise)} – {formatDate(buchung.fields.abreise)}</span>
                      </div>

                      {/* Price */}
                      {buchung.fields.gesamtpreis != null && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-2">
                          <IconStar size={11} className="shrink-0 text-muted-foreground" />
                          <span>{formatCurrency(buchung.fields.gesamtpreis)}</span>
                        </div>
                      )}

                      {/* Zusatzleistungen */}
                      {buchung.zusatzleistungenName && (
                        <div className="mb-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 truncate max-w-full">
                            {buchung.zusatzleistungenName}
                          </Badge>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/50 flex-wrap">
                        <div className="flex gap-1">
                          {prevStatus && (
                            <button
                              onClick={() => handleStatusChange(buchung, prevStatus)}
                              className="text-[10px] px-2 py-1 rounded-lg bg-muted hover:bg-accent text-muted-foreground transition-colors"
                              title={`Zurück zu: ${STATUS_CONFIG[prevStatus].label}`}
                            >
                              ← {STATUS_CONFIG[prevStatus].label}
                            </button>
                          )}
                          {nextStatus && (
                            <button
                              onClick={() => handleStatusChange(buchung, nextStatus)}
                              className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-colors ${STATUS_CONFIG[nextStatus].bg} ${STATUS_CONFIG[nextStatus].color} hover:opacity-80`}
                              title={`Weiter zu: ${STATUS_CONFIG[nextStatus].label}`}
                            >
                              {STATUS_CONFIG[nextStatus].label} →
                            </button>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditBuchung(buchung); setDialogMode('edit-buchung'); }}
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                            title="Bearbeiten"
                          >
                            <IconPencil size={13} className="shrink-0" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(buchung)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Löschen"
                          >
                            <IconTrash size={13} className="shrink-0" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Heute-Bereich: Anreisen & Abreisen */}
      {(() => {
        const anreisen = enrichedBuchungen.filter(b => b.fields.anreise === today);
        const abreisen = enrichedBuchungen.filter(b => b.fields.abreise === today);
        if (anreisen.length === 0 && abreisen.length === 0) return null;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {anreisen.length > 0 && (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                    <IconCalendar size={16} className="text-green-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-green-700">Heute anreisend</h3>
                    <p className="text-xs text-green-600">{anreisen.length} {anreisen.length === 1 ? 'Katze' : 'Katzen'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {anreisen.map(b => (
                    <div key={b.record_id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-green-100">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{b.katzeName || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.kundeName}</p>
                      </div>
                      <button
                        onClick={() => handleStatusChange(b, 'eingecheckt')}
                        className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-medium shrink-0 ml-2"
                      >
                        Einchecken
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {abreisen.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                    <IconCalendar size={16} className="text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600">Heute abreisend</h3>
                    <p className="text-xs text-slate-500">{abreisen.length} {abreisen.length === 1 ? 'Katze' : 'Katzen'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {abreisen.map(b => (
                    <div key={b.record_id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-slate-100">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{b.katzeName || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.kundeName}</p>
                      </div>
                      <button
                        onClick={() => handleStatusChange(b, 'ausgecheckt')}
                        className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium shrink-0 ml-2"
                      >
                        Auschecken
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Dialogs */}
      <BuchungenDialog
        open={dialogMode === 'create-buchung' || dialogMode === 'edit-buchung'}
        onClose={() => { setDialogMode(null); setEditBuchung(null); }}
        onSubmit={async (fields) => {
          if (editBuchung) {
            await LivingAppsService.updateBuchungenEntry(editBuchung.record_id, fields);
          } else {
            await LivingAppsService.createBuchungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editBuchung?.fields}
        katzenList={katzen}
        kundenList={kunden}
        zusatzleistungenList={zusatzleistungen}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungen']}
      />

      <KatzenDialog
        open={dialogMode === 'create-katze'}
        onClose={() => setDialogMode(null)}
        onSubmit={async (fields) => {
          await LivingAppsService.createKatzenEntry(fields);
          fetchAll();
        }}
        defaultValues={undefined}
        kundenList={kunden}
        enablePhotoScan={AI_PHOTO_SCAN['Katzen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Katzen']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Buchung löschen"
        description={`Buchung für ${deleteTarget?.katzeName ?? '—'} wirklich löschen?`}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// --- Suppressed unused import warnings (types used only in type positions) ---
// APP_IDS, LOOKUP_OPTIONS, extractRecordId, createRecordUrl are available for use
const _suppress = { APP_IDS, LOOKUP_OPTIONS, extractRecordId, createRecordUrl };
void _suppress;

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
      <Skeleton className="h-96 rounded-2xl" />
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
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
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
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
