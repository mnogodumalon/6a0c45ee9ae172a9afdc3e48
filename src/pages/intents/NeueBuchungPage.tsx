import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { KundenDialog } from '@/components/dialogs/KundenDialog';
import { KatzenDialog } from '@/components/dialogs/KatzenDialog';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Kunden, Katzen, Zusatzleistungen } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconUser,
  IconCat,
  IconCalendar,
  IconCheck,
  IconPlus,
  IconArrowRight,
  IconArrowLeft,
  IconCircleCheck,
  IconRefresh,
  IconHome,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Kunde' },
  { label: 'Katze' },
  { label: 'Details' },
  { label: 'Extras & Bestätigung' },
];

function formatDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function calcNights(anreise: string, abreise: string): number {
  if (!anreise || !abreise) return 0;
  const a = new Date(anreise);
  const b = new Date(abreise);
  const diff = (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(diff));
}

const UNTERKUNFT_OPTIONS = [
  { key: 'standard', label: 'Standardzimmer' },
  { key: 'komfort', label: 'Komfortzimmer' },
  { key: 'suite', label: 'Suite' },
];

export default function NeueBuchungPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { kunden, katzen, zusatzleistungen, loading, error, fetchAll } = useDashboardData();

  // Wizard step state (1-based)
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 4 ? s : 1;
  });

  // Selections
  const [selectedKundeId, setSelectedKundeId] = useState<string | null>(() => searchParams.get('kundeId'));
  const [selectedKatzeId, setSelectedKatzeId] = useState<string | null>(() => searchParams.get('katzeId'));

  // Step 3 form fields
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [unterkunftstyp, setUnterkunftstyp] = useState('standard');
  const [preis_pro_nacht, setPreisProNacht] = useState<number>(25);
  const [notizen, setNotizen] = useState('');

  // Step 4 extras
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  // Dialog state
  const [kundenDialogOpen, setKundenDialogOpen] = useState(false);
  const [katzenDialogOpen, setKatzenDialogOpen] = useState(false);

  // Booking submission state
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [successSummary, setSuccessSummary] = useState<{
    kundeName: string;
    katzeName: string;
    anreise: string;
    abreise: string;
    unterkunft: string;
    gesamtpreis: number;
  } | null>(null);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedKundeId) params.set('kundeId', selectedKundeId);
    else params.delete('kundeId');
    if (selectedKatzeId) params.set('katzeId', selectedKatzeId);
    else params.delete('katzeId');
    setSearchParams(params, { replace: true });
  }, [currentStep, selectedKundeId, selectedKatzeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived data
  const selectedKunde = useMemo(
    () => kunden.find(k => k.record_id === selectedKundeId) ?? null,
    [kunden, selectedKundeId]
  );

  const selectedKatze = useMemo(
    () => katzen.find(k => k.record_id === selectedKatzeId) ?? null,
    [katzen, selectedKatzeId]
  );

  // Cats filtered by owner
  const katzenForKunde = useMemo(() => {
    if (!selectedKundeId) return [];
    const ownerUrl = createRecordUrl(APP_IDS.KUNDEN, selectedKundeId);
    return katzen.filter(k => k.fields.besitzer === ownerUrl);
  }, [katzen, selectedKundeId]);

  // Price calculations
  const nights = calcNights(anreise, abreise);
  const basePrice = nights * preis_pro_nacht;

  const extrasTotal = useMemo(() => {
    return Array.from(selectedExtras).reduce((sum, id) => {
      const extra = zusatzleistungen.find(z => z.record_id === id);
      return sum + (extra?.fields.preis ?? 0);
    }, 0);
  }, [selectedExtras, zusatzleistungen]);

  const gesamtpreis = basePrice + extrasTotal;

  // Handlers
  function handleKundeSelect(id: string) {
    setSelectedKundeId(id);
    setSelectedKatzeId(null);
    setCurrentStep(2);
  }

  function handleKatzeSelect(id: string) {
    setSelectedKatzeId(id);
    setCurrentStep(3);
  }

  function handleStep3Continue() {
    if (!anreise || !abreise || nights <= 0) return;
    setCurrentStep(4);
  }

  function toggleExtra(id: string) {
    setSelectedExtras(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateBuchung() {
    if (!selectedKundeId || !selectedKatzeId || !anreise || !abreise) return;
    setSubmitting(true);
    try {
      const extraUrls = Array.from(selectedExtras).map(id =>
        createRecordUrl(APP_IDS.ZUSATZLEISTUNGEN, id)
      );

      await LivingAppsService.createBuchungenEntry({
        kunde: createRecordUrl(APP_IDS.KUNDEN, selectedKundeId),
        katze: createRecordUrl(APP_IDS.KATZEN, selectedKatzeId),
        anreise,
        abreise,
        unterkunftstyp,
        preis_pro_nacht,
        gesamtpreis,
        zusatzleistungen: extraUrls.length > 0 ? extraUrls.join(',') : undefined,
        status: 'bestaetigt',
        notizen: notizen || undefined,
      });

      await fetchAll();

      const unterkunftLabel = UNTERKUNFT_OPTIONS.find(o => o.key === unterkunftstyp)?.label ?? unterkunftstyp;
      setSuccessSummary({
        kundeName: [selectedKunde?.fields.vorname, selectedKunde?.fields.nachname].filter(Boolean).join(' '),
        katzeName: selectedKatze?.fields.katzenname ?? '—',
        anreise,
        abreise,
        unterkunft: unterkunftLabel,
        gesamtpreis,
      });
      setBookingSuccess(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Erstellen der Buchung');
    } finally {
      setSubmitting(false);
    }
  }

  function resetWizard() {
    setCurrentStep(1);
    setSelectedKundeId(null);
    setSelectedKatzeId(null);
    setAnreise('');
    setAbreise('');
    setUnterkunftstyp('standard');
    setPreisProNacht(25);
    setNotizen('');
    setSelectedExtras(new Set());
    setBookingSuccess(false);
    setSuccessSummary(null);
  }

  // Success screen (no early return — all hooks already declared above)
  if (bookingSuccess && successSummary) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div className="flex flex-col items-center justify-center py-12 gap-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <IconCircleCheck size={32} className="text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-1">Buchung erstellt!</h2>
            <p className="text-muted-foreground text-sm">Die Buchung wurde erfolgreich angelegt und bestätigt.</p>
          </div>

          <Card className="w-full max-w-md overflow-hidden">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <IconHome size={16} className="text-muted-foreground shrink-0" />
                <span className="font-semibold text-sm">{successSummary.unterkunft}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Kunde</p>
                  <p className="font-medium truncate">{successSummary.kundeName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Katze</p>
                  <p className="font-medium truncate">{successSummary.katzeName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Anreise</p>
                  <p className="font-medium">{formatDate(successSummary.anreise)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Abreise</p>
                  <p className="font-medium">{formatDate(successSummary.abreise)}</p>
                </div>
              </div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Gesamtpreis</span>
                <span className="text-lg font-bold">
                  {successSummary.gesamtpreis.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 flex-wrap justify-center">
            <Button variant="outline" onClick={resetWizard} className="gap-2">
              <IconRefresh size={16} />
              Weitere Buchung
            </Button>
            <Button asChild>
              <a href="#/" className="gap-2 inline-flex items-center">
                <IconHome size={16} />
                Zum Dashboard
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <IntentWizardShell
        title="Neue Buchung"
        subtitle="Erstelle eine Katzenpension-Buchung in wenigen Schritten"
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        {/* Step 1: Kunde auswählen */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Kunde auswählen</h2>
              <p className="text-sm text-muted-foreground">Wähle den Kunden für die Buchung oder lege einen neuen an.</p>
            </div>
            <EntitySelectStep
              items={kunden.map((k: Kunden) => ({
                id: k.record_id,
                title: [k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ') || k.record_id,
                subtitle: k.fields.email || k.fields.telefon || undefined,
                stats: k.fields.ort ? [{ label: 'Ort', value: k.fields.ort }] : undefined,
                icon: <IconUser size={18} className="text-primary" />,
              }))}
              onSelect={handleKundeSelect}
              searchPlaceholder="Kunde suchen..."
              emptyIcon={<IconUser size={32} />}
              emptyText="Noch keine Kunden vorhanden. Lege jetzt den ersten an!"
              createLabel="Neuen Kunden anlegen"
              onCreateNew={() => setKundenDialogOpen(true)}
              createDialog={
                <KundenDialog
                  open={kundenDialogOpen}
                  onClose={() => setKundenDialogOpen(false)}
                  onSubmit={async (fields) => {
                    const result = await LivingAppsService.createKundenEntry(fields) as { id?: string };
                    await fetchAll();
                    if (result?.id) {
                      setKundenDialogOpen(false);
                      handleKundeSelect(result.id);
                    }
                  }}
                />
              }
            />
          </div>
        )}

        {/* Step 2: Katze auswählen */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold mb-1">Katze auswählen</h2>
                {selectedKunde && (
                  <p className="text-sm text-muted-foreground">
                    Katzen von{' '}
                    <span className="font-medium text-foreground">
                      {[selectedKunde.fields.vorname, selectedKunde.fields.nachname].filter(Boolean).join(' ')}
                    </span>
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)} className="gap-1.5 text-muted-foreground">
                <IconArrowLeft size={14} />
                Zurück
              </Button>
            </div>

            <EntitySelectStep
              items={katzenForKunde.map((k: Katzen) => ({
                id: k.record_id,
                title: k.fields.katzenname || k.record_id,
                subtitle: [k.fields.rasse, k.fields.farbe].filter(Boolean).join(' · ') || undefined,
                status: k.fields.impfstatus
                  ? { key: k.fields.impfstatus.key, label: k.fields.impfstatus.label }
                  : undefined,
                icon: <IconCat size={18} className="text-primary" />,
              }))}
              onSelect={handleKatzeSelect}
              searchPlaceholder="Katze suchen..."
              emptyIcon={<IconCat size={32} />}
              emptyText="Keine Katzen für diesen Kunden gefunden. Lege jetzt eine an!"
              createLabel="Neue Katze anlegen"
              onCreateNew={() => setKatzenDialogOpen(true)}
              createDialog={
                <KatzenDialog
                  open={katzenDialogOpen}
                  onClose={() => setKatzenDialogOpen(false)}
                  kundenList={kunden}
                  defaultValues={
                    selectedKundeId
                      ? { besitzer: createRecordUrl(APP_IDS.KUNDEN, selectedKundeId) }
                      : undefined
                  }
                  onSubmit={async (fields) => {
                    const result = await LivingAppsService.createKatzenEntry(fields) as { id?: string };
                    await fetchAll();
                    if (result?.id) {
                      setKatzenDialogOpen(false);
                      handleKatzeSelect(result.id);
                    }
                  }}
                />
              }
            />
          </div>
        )}

        {/* Step 3: Buchungsdetails */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold mb-1">Buchungsdetails</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedKunde && selectedKatze && (
                    <>
                      <span className="font-medium text-foreground">
                        {selectedKatze.fields.katzenname}
                      </span>
                      {' von '}
                      <span className="font-medium text-foreground">
                        {[selectedKunde.fields.vorname, selectedKunde.fields.nachname].filter(Boolean).join(' ')}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)} className="gap-1.5 text-muted-foreground">
                <IconArrowLeft size={14} />
                Zurück
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="anreise">
                  <span className="flex items-center gap-1.5">
                    <IconCalendar size={14} />
                    Anreise
                  </span>
                </Label>
                <Input
                  id="anreise"
                  type="date"
                  value={anreise}
                  onChange={e => setAnreise(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="abreise">
                  <span className="flex items-center gap-1.5">
                    <IconCalendar size={14} />
                    Abreise
                  </span>
                </Label>
                <Input
                  id="abreise"
                  type="date"
                  value={abreise}
                  min={anreise || undefined}
                  onChange={e => setAbreise(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="unterkunftstyp">Unterkunftstyp</Label>
                <Select value={unterkunftstyp} onValueChange={setUnterkunftstyp}>
                  <SelectTrigger id="unterkunftstyp">
                    <SelectValue placeholder="Unterkunftstyp wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNTERKUNFT_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preis_pro_nacht">Preis pro Nacht (€)</Label>
                <Input
                  id="preis_pro_nacht"
                  type="number"
                  min={0}
                  step={0.01}
                  value={preis_pro_nacht}
                  onChange={e => setPreisProNacht(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notizen">Notizen (optional)</Label>
              <Textarea
                id="notizen"
                placeholder="Besondere Hinweise, Wünsche oder Anmerkungen..."
                value={notizen}
                onChange={e => setNotizen(e.target.value)}
                rows={3}
              />
            </div>

            {/* Live Calculation Preview */}
            {nights > 0 && (
              <Card className="overflow-hidden bg-muted/30">
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold">Preisvorschau</h3>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center p-2 rounded-lg bg-background border">
                      <p className="text-xs text-muted-foreground mb-1">Nächte</p>
                      <p className="text-lg font-bold">{nights}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-background border">
                      <p className="text-xs text-muted-foreground mb-1">Pro Nacht</p>
                      <p className="text-base font-bold">
                        {preis_pro_nacht.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">Gesamt</p>
                      <p className="text-base font-bold text-primary">
                        {basePrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Zzgl. möglicher Zusatzleistungen im nächsten Schritt</p>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleStep3Continue}
              disabled={!anreise || !abreise || nights <= 0}
              className="w-full gap-2"
            >
              Weiter zu Extras
              <IconArrowRight size={16} />
            </Button>

            {anreise && abreise && nights <= 0 && (
              <p className="text-xs text-destructive text-center">
                Das Abreisedatum muss nach dem Anreisedatum liegen.
              </p>
            )}
          </div>
        )}

        {/* Step 4: Zusatzleistungen & Bestätigung */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold mb-1">Extras & Bestätigung</h2>
                <p className="text-sm text-muted-foreground">
                  Wähle optionale Zusatzleistungen und bestätige die Buchung.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep(3)} className="gap-1.5 text-muted-foreground">
                <IconArrowLeft size={14} />
                Zurück
              </Button>
            </div>

            {/* Booking summary banner */}
            <Card className="overflow-hidden bg-muted/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Kunde</p>
                    <p className="font-medium truncate">
                      {selectedKunde
                        ? [selectedKunde.fields.vorname, selectedKunde.fields.nachname].filter(Boolean).join(' ')
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Katze</p>
                    <p className="font-medium truncate">{selectedKatze?.fields.katzenname ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Anreise</p>
                    <p className="font-medium">{formatDate(anreise)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Abreise</p>
                    <p className="font-medium">{formatDate(abreise)}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {nights} Nacht{nights !== 1 ? 'e' : ''} · {UNTERKUNFT_OPTIONS.find(o => o.key === unterkunftstyp)?.label}
                  </span>
                  <span className="text-sm font-semibold">
                    Basis: {basePrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Zusatzleistungen */}
            {zusatzleistungen.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Verfügbare Zusatzleistungen
                </h3>
                <div className="space-y-2">
                  {zusatzleistungen.map((z: Zusatzleistungen) => {
                    const selected = selectedExtras.has(z.record_id);
                    return (
                      <button
                        key={z.record_id}
                        type="button"
                        onClick={() => toggleExtra(z.record_id)}
                        className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border transition-colors overflow-hidden ${
                          selected
                            ? 'bg-primary/5 border-primary/40'
                            : 'bg-card border-border hover:bg-accent hover:border-primary/20'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        }`}>
                          {selected && <IconCheck size={11} className="text-primary-foreground" stroke={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{z.fields.leistungsname ?? '—'}</p>
                          {z.fields.beschreibung && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{z.fields.beschreibung}</p>
                          )}
                        </div>
                        {z.fields.preis != null && (
                          <span className={`shrink-0 text-sm font-semibold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                            +{z.fields.preis.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <IconPlus size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Keine Zusatzleistungen verfügbar</p>
              </div>
            )}

            {/* Budget Tracker */}
            <BudgetTracker
              budget={gesamtpreis > 0 ? gesamtpreis : basePrice}
              booked={extrasTotal}
              label="Zusatzleistungen"
              showRemaining={false}
            />

            {/* Total Price Summary */}
            <Card className="overflow-hidden border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Basispreis ({nights} Nächte)</span>
                  <span className="font-medium">{basePrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                {extrasTotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Zusatzleistungen ({selectedExtras.size})</span>
                    <span className="font-medium">+{extrasTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-primary/20">
                  <span className="font-semibold">Gesamtpreis</span>
                  <span className="text-xl font-bold text-primary">
                    {gesamtpreis.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleCreateBuchung}
              disabled={submitting}
              size="lg"
              className="w-full gap-2"
            >
              {submitting ? (
                'Buchung wird erstellt...'
              ) : (
                <>
                  <IconCheck size={18} />
                  Buchung erstellen
                </>
              )}
            </Button>
          </div>
        )}
      </IntentWizardShell>
    </div>
  );
}
