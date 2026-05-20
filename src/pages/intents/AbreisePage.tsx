import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId, extractRecordIds } from '@/services/livingAppsService';
import type { Buchungen, Kunden, Katzen, Zusatzleistungen } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  IconCat,
  IconCheck,
  IconArrowRight,
  IconCurrencyEuro,
  IconCalendar,
  IconUser,
  IconStar,
  IconRefresh,
  IconExternalLink,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Buchung wählen' },
  { label: 'Prüfen & Abschließen' },
  { label: 'Abschluss' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '–';
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy', { locale: de });
  } catch {
    return dateStr;
  }
}

function calcNights(anreise: string | undefined, abreise: string | undefined): number {
  if (!anreise || !abreise) return 0;
  try {
    return Math.max(0, differenceInCalendarDays(parseISO(abreise), parseISO(anreise)));
  } catch {
    return 0;
  }
}

function formatCurrencyLocal(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function AbreisePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { buchungen, kunden, katzen, zusatzleistungen, loading, error, fetchAll } = useDashboardData();

  // Read initial values from URL
  const urlStep = parseInt(searchParams.get('step') ?? '1', 10);
  const urlBuchungId = searchParams.get('buchungId') ?? null;

  const [currentStep, setCurrentStep] = useState<number>(
    urlStep >= 1 && urlStep <= 3 ? urlStep : 1
  );
  const [selectedBuchungId, setSelectedBuchungId] = useState<string | null>(urlBuchungId);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [finalNote, setFinalNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync step and buchungId to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedBuchungId) {
      params.set('buchungId', selectedBuchungId);
    } else {
      params.delete('buchungId');
    }
    setSearchParams(params, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, selectedBuchungId]);

  // Build lookup maps
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

  // Filter eingecheckte Buchungen
  const eingecheckteBuchungen = useMemo(() => {
    return buchungen.filter(b => b.fields.status?.key === 'eingecheckt');
  }, [buchungen]);

  // Selected booking
  const selectedBuchung: Buchungen | null = useMemo(() => {
    if (!selectedBuchungId) return null;
    return buchungen.find(b => b.record_id === selectedBuchungId) ?? null;
  }, [selectedBuchungId, buchungen]);

  // Resolved Kunde + Katze for selected booking
  const selectedKunde: Kunden | null = useMemo(() => {
    if (!selectedBuchung?.fields.kunde) return null;
    const id = extractRecordId(selectedBuchung.fields.kunde);
    return id ? (kundenMap.get(id) ?? null) : null;
  }, [selectedBuchung, kundenMap]);

  const selectedKatze: Katzen | null = useMemo(() => {
    if (!selectedBuchung?.fields.katze) return null;
    const id = extractRecordId(selectedBuchung.fields.katze);
    return id ? (katzenMap.get(id) ?? null) : null;
  }, [selectedBuchung, katzenMap]);

  // Resolved Zusatzleistungen for selected booking
  const selectedZusatzleistungen: Zusatzleistungen[] = useMemo(() => {
    if (!selectedBuchung?.fields.zusatzleistungen) return [];
    const ids = extractRecordIds(selectedBuchung.fields.zusatzleistungen);
    return ids.map(id => zusatzleistungenMap.get(id)).filter((z): z is Zusatzleistungen => !!z);
  }, [selectedBuchung, zusatzleistungenMap]);

  const extrasTotalPrice = useMemo(() => {
    return selectedZusatzleistungen.reduce((sum, z) => sum + (z.fields.preis ?? 0), 0);
  }, [selectedZusatzleistungen]);

  // Initialize finalPrice when booking is selected
  useEffect(() => {
    if (selectedBuchung) {
      setFinalPrice(selectedBuchung.fields.gesamtpreis ?? 0);
      setFinalNote(selectedBuchung.fields.notizen ?? '');
    }
  }, [selectedBuchung]);

  // Step 1: Select booking
  function handleSelectBuchung(id: string) {
    setSelectedBuchungId(id);
    setSubmitError(null);
    setCurrentStep(2);
  }

  // Step 2: Confirm checkout
  async function handleConfirmAbreise() {
    if (!selectedBuchung) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungenEntry(selectedBuchung.record_id, {
        status: 'ausgecheckt',
        gesamtpreis: finalPrice,
        notizen: finalNote || undefined,
      });
      await fetchAll();
      setCurrentStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Abschließen der Abreise.');
    } finally {
      setSubmitting(false);
    }
  }

  // Step 3: Reset wizard
  function handleReset() {
    setSelectedBuchungId(null);
    setFinalPrice(0);
    setFinalNote('');
    setSubmitError(null);
    setCurrentStep(1);
  }

  // Build items for EntitySelectStep
  const selectItems = useMemo(() => {
    return eingecheckteBuchungen.map(b => {
      const katzeId = extractRecordId(b.fields.katze);
      const kundeId = extractRecordId(b.fields.kunde);
      const katze = katzeId ? katzenMap.get(katzeId) : null;
      const kunde = kundeId ? kundenMap.get(kundeId) : null;
      const katzeName = katze?.fields.katzenname ?? 'Unbekannte Katze';
      const kundeName = kunde
        ? `${kunde.fields.vorname ?? ''} ${kunde.fields.nachname ?? ''}`.trim()
        : 'Unbekannter Kunde';
      const anreise = formatDate(b.fields.anreise);
      const abreise = formatDate(b.fields.abreise);
      const unterkunft = b.fields.unterkunftstyp?.label ?? '';
      return {
        id: b.record_id,
        title: katzeName,
        subtitle: `${kundeName} · ${anreise} – ${abreise}${unterkunft ? ` · ${unterkunft}` : ''}`,
        status: b.fields.status ?? { key: 'eingecheckt', label: 'Eingecheckt' },
        icon: <IconCat size={20} className="text-primary" />,
        stats: b.fields.gesamtpreis != null
          ? [{ label: 'Gesamtpreis', value: formatCurrencyLocal(b.fields.gesamtpreis) }]
          : undefined,
      };
    });
  }, [eingecheckteBuchungen, katzenMap, kundenMap]);

  const nights = calcNights(selectedBuchung?.fields.anreise, selectedBuchung?.fields.abreise);
  const basePrice = (selectedBuchung?.fields.preis_pro_nacht ?? 0) * nights;
  const kundeName = selectedKunde
    ? `${selectedKunde.fields.vorname ?? ''} ${selectedKunde.fields.nachname ?? ''}`.trim()
    : '–';

  return (
    <IntentWizardShell
      title="Abreise abwickeln"
      subtitle="Katze auschecken und Aufenthalt abschließen"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1 — Buchung auswählen */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold">Eingecheckte Buchungen</h2>
              <p className="text-sm text-muted-foreground">
                Wähle die Buchung, für die du die Abreise abwickeln möchtest.
              </p>
            </div>
            <a
              href="#/buchungen"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <IconExternalLink size={14} />
              Alle Buchungen anzeigen
            </a>
          </div>

          {eingecheckteBuchungen.length === 0 ? (
            <Card className="overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                  <IconCat size={28} className="text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Keine eingecheckten Buchungen</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Es gibt aktuell keine Buchungen mit Status "Eingecheckt".
                  </p>
                </div>
                <a href="#/buchungen" className="text-sm text-primary hover:underline">
                  Buchungen verwalten
                </a>
              </CardContent>
            </Card>
          ) : (
            <EntitySelectStep
              items={selectItems}
              onSelect={handleSelectBuchung}
              searchPlaceholder="Katze oder Kunde suchen..."
              emptyIcon={<IconCat size={32} />}
              emptyText="Keine Buchungen gefunden."
            />
          )}
        </div>
      )}

      {/* Step 2 — Prüfen & Abschließen */}
      {currentStep === 2 && selectedBuchung && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Buchung prüfen & abschließen</h2>
            <p className="text-sm text-muted-foreground">
              Überprüfe alle Details und bestätige die Abreise.
            </p>
          </div>

          {/* Summary card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <IconCat size={18} className="text-primary" />
                Aufenthaltszusammenfassung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Katze + Kunde */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <IconCat size={12} /> Katze
                  </p>
                  <p className="font-medium text-sm truncate">
                    {selectedKatze?.fields.katzenname ?? '–'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[selectedKatze?.fields.rasse, selectedKatze?.fields.farbe]
                      .filter(Boolean)
                      .join(' · ') || '–'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <IconUser size={12} /> Kunde
                  </p>
                  <p className="font-medium text-sm truncate">{kundeName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedKunde?.fields.email ?? '–'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedKunde?.fields.telefon ?? '–'}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <IconCalendar size={12} /> Aufenthalt
                  </p>
                  <p className="text-sm font-medium">
                    {formatDate(selectedBuchung.fields.anreise)} – {formatDate(selectedBuchung.fields.abreise)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nights} {nights === 1 ? 'Nacht' : 'Nächte'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <IconStar size={12} /> Unterkunft
                  </p>
                  <p className="text-sm font-medium">
                    {selectedBuchung.fields.unterkunftstyp?.label ?? '–'}
                  </p>
                </div>
              </div>

              {/* Preise */}
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <IconCurrencyEuro size={12} /> Preisübersicht
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Preis pro Nacht × {nights} {nights === 1 ? 'Nacht' : 'Nächte'}
                    </span>
                    <span className="font-medium">{formatCurrencyLocal(basePrice)}</span>
                  </div>
                  {selectedZusatzleistungen.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">
                        Zusatzleistungen:
                      </div>
                      {selectedZusatzleistungen.map(z => (
                        <div key={z.record_id} className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate max-w-[200px]">
                            {z.fields.leistungsname ?? '–'}
                          </span>
                          <span className="font-medium shrink-0 ml-2">
                            {formatCurrencyLocal(z.fields.preis ?? 0)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <span>Gesamtpreis</span>
                    <span>{formatCurrencyLocal(selectedBuchung.fields.gesamtpreis ?? 0)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Tracker */}
          <BudgetTracker
            budget={finalPrice}
            booked={extrasTotalPrice}
            label="Extras vs. Gesamtpreis"
          />

          {/* Editable final price + note */}
          <Card className="overflow-hidden">
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="finalPrice" className="text-sm font-medium">
                  Abschließender Gesamtpreis (€)
                </Label>
                <div className="relative">
                  <IconCurrencyEuro
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="finalPrice"
                    type="number"
                    min={0}
                    step={0.01}
                    value={finalPrice}
                    onChange={e => setFinalPrice(parseFloat(e.target.value) || 0)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Passe den Gesamtpreis bei Bedarf an (z. B. Rabatte, Sonderleistungen).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="finalNote" className="text-sm font-medium">
                  Abschlussnotiz (optional)
                </Label>
                <Textarea
                  id="finalNote"
                  placeholder="Hinweise zur Abreise, besondere Vorkommnisse..."
                  value={finalNote}
                  onChange={e => setFinalNote(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {submitError && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              disabled={submitting}
              className="gap-2"
            >
              Zurück
            </Button>
            <Button
              onClick={handleConfirmAbreise}
              disabled={submitting}
              className="gap-2 flex-1 sm:flex-none"
            >
              {submitting ? (
                <>
                  <IconRefresh size={16} className="animate-spin" />
                  Wird verarbeitet...
                </>
              ) : (
                <>
                  <IconCheck size={16} />
                  Abreise bestätigen
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Abschluss */}
      {currentStep === 3 && (
        <div className="flex flex-col items-center justify-center py-8 gap-6">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <IconCheck size={36} className="text-green-600" stroke={2.5} />
          </div>

          <div className="text-center space-y-1 max-w-sm">
            <h2 className="text-xl font-bold">Abreise erfolgreich abgeschlossen</h2>
            <p className="text-sm text-muted-foreground">
              Der Aufenthalt wurde abgerechnet und die Buchung als ausgecheckt markiert.
            </p>
          </div>

          <Card className="overflow-hidden w-full max-w-sm">
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCat size={24} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {selectedKatze?.fields.katzenname ?? '–'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{kundeName}</p>
                </div>
              </div>

              <div className="border-t pt-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                  Gesamtbetrag
                </p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrencyLocal(finalPrice)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 flex-wrap justify-center">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <IconArrowRight size={16} />
              Neue Abreise
            </Button>
            <a href="#/buchungen">
              <Button variant="default" className="gap-2">
                <IconExternalLink size={16} />
                Buchung anzeigen
              </Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
