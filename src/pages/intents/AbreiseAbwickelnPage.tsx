import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId, extractRecordIds } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS } from '@/types/app';
import type { Buchungen, Kunden, Katzen, Zusatzleistungen } from '@/types/app';
import { differenceInDays, parseISO, format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconCat,
  IconUser,
  IconCalendar,
  IconCurrencyEuro,
  IconCheck,
  IconArrowLeft,
  IconRefresh,
  IconHome,
  IconNotes,
  IconStar,
} from '@tabler/icons-react';

const FINAL_STATUS_KEYS = new Set(['ausgecheckt', 'storniert']);

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'd. MMM yyyy', { locale: de });
  } catch {
    return dateStr;
  }
}

function calcNights(anreise?: string, abreise?: string): number {
  if (!anreise || !abreise) return 0;
  try {
    return Math.max(0, differenceInDays(parseISO(abreise), parseISO(anreise)));
  } catch {
    return 0;
  }
}

export default function AbreiseAbwickelnPage() {
  const { buchungen, kunden, katzen, zusatzleistungen, loading, error, fetchAll } = useDashboardData();
  const [searchParams, setSearchParams] = useSearchParams();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedBuchungId, setSelectedBuchungId] = useState<string | null>(null);
  const [finalNote, setFinalNote] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [selectedStatusKey, setSelectedStatusKey] = useState<string>('ausgecheckt');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Deep-link: ?buchungId=xxx jumps to step 2
  useEffect(() => {
    const buchungId = searchParams.get('buchungId');
    if (buchungId && !loading) {
      setSelectedBuchungId(buchungId);
      setCurrentStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (selectedBuchungId) {
      params.set('buchungId', selectedBuchungId);
    } else {
      params.delete('buchungId');
    }
    setSearchParams(params, { replace: true });
  }, [selectedBuchungId, searchParams, setSearchParams]);

  // Lookup maps
  const kundenMap = useMemo(() => {
    const m = new Map<string, Kunden>();
    kunden.forEach(k => m.set(k.record_id, k));
    return m;
  }, [kunden]);

  const katzenMap = useMemo(() => {
    const m = new Map<string, Katzen>();
    katzen.forEach(k => m.set(k.record_id, k));
    return m;
  }, [katzen]);

  const zusatzleistungenMap = useMemo(() => {
    const m = new Map<string, Zusatzleistungen>();
    zusatzleistungen.forEach(z => m.set(z.record_id, z));
    return m;
  }, [zusatzleistungen]);

  // Filter buchungen: only non-final statuses
  const activeBuchungen = useMemo(() => {
    return buchungen.filter(b => {
      const key = b.fields.status?.key ?? '';
      return !FINAL_STATUS_KEYS.has(key);
    });
  }, [buchungen]);

  // Selected booking
  const selectedBuchung = useMemo((): Buchungen | null => {
    if (!selectedBuchungId) return null;
    return buchungen.find(b => b.record_id === selectedBuchungId) ?? null;
  }, [selectedBuchungId, buchungen]);

  // Resolved Kunde + Katze for selected booking
  const resolvedKunde = useMemo((): Kunden | null => {
    if (!selectedBuchung) return null;
    const id = extractRecordId(selectedBuchung.fields.kunde ?? '');
    return id ? (kundenMap.get(id) ?? null) : null;
  }, [selectedBuchung, kundenMap]);

  const resolvedKatze = useMemo((): Katzen | null => {
    if (!selectedBuchung) return null;
    const id = extractRecordId(selectedBuchung.fields.katze ?? '');
    return id ? (katzenMap.get(id) ?? null) : null;
  }, [selectedBuchung, katzenMap]);

  // Resolved Zusatzleistungen for selected booking
  const resolvedZusatzleistungen = useMemo((): Zusatzleistungen[] => {
    if (!selectedBuchung) return [];
    const raw = selectedBuchung.fields.zusatzleistungen;
    if (!raw) return [];
    const ids = extractRecordIds(raw);
    return ids.map(id => zusatzleistungenMap.get(id)).filter((z): z is Zusatzleistungen => !!z);
  }, [selectedBuchung, zusatzleistungenMap]);

  // Nights
  const nights = useMemo(() => {
    if (!selectedBuchung) return 0;
    return calcNights(selectedBuchung.fields.anreise, selectedBuchung.fields.abreise);
  }, [selectedBuchung]);

  // Status options from LOOKUP_OPTIONS
  const statusOptions = useMemo(() => LOOKUP_OPTIONS['buchungen']?.['status'] ?? [], []);

  // Initialize finalPrice and note when booking is selected
  useEffect(() => {
    if (selectedBuchung) {
      setFinalPrice(selectedBuchung.fields.gesamtpreis ?? 0);
      setFinalNote(selectedBuchung.fields.notizen ?? '');
    }
  }, [selectedBuchung]);

  // Step 1: Select booking
  const handleSelectBuchung = (id: string) => {
    setSelectedBuchungId(id);
    setSuccess(false);
    setSubmitError(null);
    setCurrentStep(2);
  };

  // Step 2 -> 3
  const handleProceedToConfirm = () => {
    setCurrentStep(3);
  };

  // Step 3: Submit
  const handleAbschliessen = async () => {
    if (!selectedBuchungId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungenEntry(selectedBuchungId, {
        status: selectedStatusKey,
        gesamtpreis: finalPrice,
        notizen: finalNote || undefined,
      });
      await fetchAll();
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset wizard
  const handleReset = () => {
    setSelectedBuchungId(null);
    setFinalNote('');
    setFinalPrice(0);
    setSelectedStatusKey('ausgecheckt');
    setSubmitError(null);
    setSuccess(false);
    setCurrentStep(1);
  };

  const kundeName = resolvedKunde
    ? `${resolvedKunde.fields.vorname ?? ''} ${resolvedKunde.fields.nachname ?? ''}`.trim()
    : '—';
  const katzeName = resolvedKatze?.fields.katzenname ?? '—';

  // Success screen
  if (success && selectedBuchung) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <a href="#/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
            <IconArrowLeft size={14} className="shrink-0" />
            Zurück zum Dashboard
          </a>
          <h1 className="text-2xl font-bold tracking-tight">Abreise abwickeln</h1>
          <p className="text-sm text-muted-foreground mt-1">Buchung erfolgreich abgeschlossen</p>
        </div>

        <div className="rounded-2xl border bg-card overflow-hidden shadow-lg">
          <div className="bg-green-50 border-b border-green-100 p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <IconCheck size={24} stroke={2.5} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-green-900">Buchung erfolgreich abgeschlossen</h2>
              <p className="text-sm text-green-700">
                {katzeName} ({kundeName}) wurde erfolgreich ausgecheckt.
              </p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aufenthalt</p>
              <p className="text-sm">
                <span className="font-medium">Anreise:</span> {formatDate(selectedBuchung.fields.anreise)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Abreise:</span> {formatDate(selectedBuchung.fields.abreise)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Nächte:</span> {nights}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Abrechnung</p>
              <p className="text-sm">
                <span className="font-medium">Gesamtpreis:</span>{' '}
                <span className="text-green-700 font-bold">{finalPrice.toFixed(2)} €</span>
              </p>
              <p className="text-sm">
                <span className="font-medium">Status:</span>{' '}
                <StatusBadge
                  statusKey={selectedStatusKey}
                  label={statusOptions.find(s => s.key === selectedStatusKey)?.label ?? selectedStatusKey}
                />
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} className="flex-1 gap-2">
              <IconRefresh size={16} stroke={2} />
              Weitere Abreise abwickeln
            </Button>
            <a href="#/" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <IconHome size={16} stroke={2} />
                Zurück zum Dashboard
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title="Abreise abwickeln"
      subtitle="Buchung prüfen, Preis bestätigen und Aufenthalt abschließen"
      steps={[
        { label: 'Buchung wählen' },
        { label: 'Aufenthalt prüfen' },
        { label: 'Abschluss' },
      ]}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── STEP 1: Buchung auswählen ─────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 overflow-hidden">
            <p className="text-sm text-muted-foreground mb-4">
              Wähle eine aktive Buchung aus, um den Abreise-Prozess zu starten.
            </p>
            <EntitySelectStep
              searchPlaceholder="Katze oder Kunde suchen..."
              emptyIcon={<IconCat size={32} />}
              emptyText="Keine aktiven Buchungen gefunden."
              items={activeBuchungen.map(b => {
                const katzeId = extractRecordId(b.fields.katze ?? '');
                const kundeId = extractRecordId(b.fields.kunde ?? '');
                const katzeRec = katzeId ? katzenMap.get(katzeId) : undefined;
                const kundeRec = kundeId ? kundenMap.get(kundeId) : undefined;
                const katzeLabel = katzeRec?.fields.katzenname ?? 'Unbekannte Katze';
                const kundeLabel = kundeRec
                  ? `${kundeRec.fields.vorname ?? ''} ${kundeRec.fields.nachname ?? ''}`.trim()
                  : 'Unbekannter Kunde';
                const anreise = formatDate(b.fields.anreise);
                const abreise = formatDate(b.fields.abreise);
                return {
                  id: b.record_id,
                  title: `${katzeLabel} (${kundeLabel})`,
                  subtitle: `Anreise: ${anreise} · Abreise: ${abreise}`,
                  status: b.fields.status
                    ? { key: b.fields.status.key, label: b.fields.status.label }
                    : undefined,
                  stats: [
                    {
                      label: 'Gesamtpreis',
                      value: b.fields.gesamtpreis != null ? `${b.fields.gesamtpreis.toFixed(2)} €` : '—',
                    },
                  ],
                  icon: <IconCat size={20} className="text-primary" />,
                };
              })}
              onSelect={handleSelectBuchung}
            />
          </div>
        </div>
      )}

      {/* ── STEP 2: Aufenthalt überprüfen ────────────────────────────── */}
      {currentStep === 2 && selectedBuchung && (
        <div className="space-y-4">
          {/* Kundendaten */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconUser size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Kundendaten</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium truncate">{kundeName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telefon</p>
                <p className="text-sm font-medium truncate">{resolvedKunde?.fields.telefon ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">E-Mail</p>
                <p className="text-sm font-medium truncate">{resolvedKunde?.fields.email ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* Katzendaten */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconCat size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Katzendaten</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium truncate">{katzeName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rasse</p>
                <p className="text-sm font-medium truncate">{resolvedKatze?.fields.rasse ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Farbe</p>
                <p className="text-sm font-medium truncate">{resolvedKatze?.fields.farbe ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impfstatus</p>
                {resolvedKatze?.fields.impfstatus ? (
                  <StatusBadge
                    statusKey={resolvedKatze.fields.impfstatus.key}
                    label={resolvedKatze.fields.impfstatus.label}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Aufenthalt */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconCalendar size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Aufenthalt</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Anreise</p>
                <p className="text-sm font-medium">{formatDate(selectedBuchung.fields.anreise)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Abreise</p>
                <p className="text-sm font-medium">{formatDate(selectedBuchung.fields.abreise)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Anzahl Nächte</p>
                <p className="text-sm font-medium">{nights}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unterkunftstyp</p>
                <p className="text-sm font-medium truncate">
                  {selectedBuchung.fields.unterkunftstyp?.label ?? '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Zusatzleistungen */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconStar size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Gebuchte Zusatzleistungen</span>
            </div>
            <div className="p-4">
              {resolvedZusatzleistungen.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Zusatzleistungen gebucht.</p>
              ) : (
                <div className="space-y-2">
                  {resolvedZusatzleistungen.map(z => (
                    <div key={z.record_id} className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate min-w-0">{z.fields.leistungsname ?? '—'}</span>
                      <span className="text-sm font-medium shrink-0 text-foreground">
                        {z.fields.preis != null ? `${z.fields.preis.toFixed(2)} €` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Gesamtpreis */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconCurrencyEuro size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Gesamtpreis (lt. Buchung)</span>
            </div>
            <div className="p-4">
              <p className="text-2xl font-bold text-foreground">
                {selectedBuchung.fields.gesamtpreis != null
                  ? `${selectedBuchung.fields.gesamtpreis.toFixed(2)} €`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Abschlussnotiz */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconNotes size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Abschlussnotiz (optional)</span>
            </div>
            <div className="p-4">
              <textarea
                className="w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                placeholder="Hinweise zur Abreise, besondere Vorkommnisse..."
                value={finalNote}
                onChange={e => setFinalNote(e.target.value)}
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="gap-2"
            >
              <IconArrowLeft size={16} stroke={2} />
              Zurück
            </Button>
            <Button
              onClick={handleProceedToConfirm}
              className="flex-1 gap-2"
            >
              Weiter zur Bestätigung
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Abschluss & Bezahlung bestätigen ─────────────────── */}
      {currentStep === 3 && selectedBuchung && (
        <div className="space-y-4">
          {/* Preisübersicht */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconCurrencyEuro size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Preisübersicht</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Grundpreis */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  Grundpreis ({nights} {nights === 1 ? 'Nacht' : 'Nächte'} × {selectedBuchung.fields.preis_pro_nacht?.toFixed(2) ?? '0.00'} €)
                </span>
                <span className="text-sm font-medium shrink-0">
                  {((selectedBuchung.fields.preis_pro_nacht ?? 0) * nights).toFixed(2)} €
                </span>
              </div>

              {/* Zusatzleistungen */}
              {resolvedZusatzleistungen.map(z => (
                <div key={z.record_id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground truncate min-w-0">
                    {z.fields.leistungsname ?? '—'}
                  </span>
                  <span className="text-sm font-medium shrink-0">
                    {z.fields.preis != null ? `${z.fields.preis.toFixed(2)} €` : '—'}
                  </span>
                </div>
              ))}

              <div className="border-t pt-3 mt-1" />

              {/* Total card */}
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Gesamtbetrag</p>
                  <p className="text-xs text-green-600 mt-0.5">Buchungspreis lt. Buchung</p>
                </div>
                <span className="text-3xl font-bold text-green-700 shrink-0">
                  {selectedBuchung.fields.gesamtpreis != null
                    ? `${selectedBuchung.fields.gesamtpreis.toFixed(2)} €`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Preis anpassen */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconCurrencyEuro size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Finalen Preis bestätigen oder anpassen</span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 max-w-xs">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={finalPrice}
                  onChange={e => setFinalPrice(parseFloat(e.target.value) || 0)}
                  className="text-right font-semibold"
                />
                <span className="text-sm font-medium text-muted-foreground shrink-0">€</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Standardmäßig der Buchungspreis. Passe ihn bei Bedarf an.
              </p>
            </div>
          </div>

          {/* Status wählen */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconCheck size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Buchungsstatus setzen</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {statusOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedStatusKey(opt.key)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-colors ${
                      selectedStatusKey === opt.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:bg-accent hover:border-primary/30 text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notizen */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
              <IconNotes size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">Notizen</span>
            </div>
            <div className="p-4">
              <textarea
                className="w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                placeholder="Abschließende Notizen zur Buchung..."
                value={finalNote}
                onChange={e => setFinalNote(e.target.value)}
              />
            </div>
          </div>

          {/* Error */}
          {submitError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              disabled={submitting}
              className="gap-2"
            >
              <IconArrowLeft size={16} stroke={2} />
              Zurück
            </Button>
            <Button
              onClick={handleAbschliessen}
              disabled={submitting}
              className="flex-1 gap-2"
            >
              {submitting ? (
                <>
                  <IconRefresh size={16} stroke={2} className="animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <IconCheck size={16} stroke={2} />
                  Buchung abschließen
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
