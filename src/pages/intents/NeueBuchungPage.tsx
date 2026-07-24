import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Kunden, Katzen, Zusatzleistungen } from '@/types/app';
import {
  IconUser,
  IconCat,
  IconCheck,
  IconPlus,
  IconArrowLeft,
  IconArrowRight,
  IconBuildingCottage,
  IconSparkles,
} from '@tabler/icons-react';

// ----------- helpers -----------

function formatEuro(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const diff = differenceInDays(new Date(to), new Date(from));
  return diff > 0 ? diff : 0;
}

// ----------- inline mini-forms -----------

interface NewKundeFormProps {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

function NewKundeForm({ onCreated, onCancel }: NewKundeFormProps) {
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [telefon, setTelefon] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!vorname.trim() || !nachname.trim()) {
      setErr('Vor- und Nachname sind Pflichtfelder.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res: { record_id?: string; fields?: Record<string, unknown> } = await LivingAppsService.createKundenEntry({
        vorname: vorname.trim(),
        nachname: nachname.trim(),
        telefon: telefon.trim() || undefined,
        email: email.trim() || undefined,
      });
      const newId = res?.record_id ?? extractRecordId(JSON.stringify(res));
      if (newId) onCreated(newId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler beim Erstellen des Kunden.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-secondary/40 space-y-3 mt-2">
      <p className="text-sm font-semibold text-foreground">Neuen Kunden anlegen</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Vorname *</label>
          <Input value={vorname} onChange={e => setVorname(e.target.value)} placeholder="Max" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nachname *</label>
          <Input value={nachname} onChange={e => setNachname(e.target.value)} placeholder="Mustermann" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Telefon</label>
          <Input value={telefon} onChange={e => setTelefon(e.target.value)} placeholder="+49 170 123456" type="tel" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">E-Mail</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="max@beispiel.de" type="email" />
        </div>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Wird gespeichert…' : 'Kunden anlegen'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>Abbrechen</Button>
      </div>
    </div>
  );
}

interface NewKatzeFormProps {
  kundeId: string;
  onCreated: (id: string) => void;
  onCancel: () => void;
}

function NewKatzeForm({ kundeId, onCreated, onCancel }: NewKatzeFormProps) {
  const [katzenname, setKatzenname] = useState('');
  const [rasse, setRasse] = useState('');
  const [farbe, setFarbe] = useState('');
  const [impfstatus, setImpfstatus] = useState(
    LOOKUP_OPTIONS['katzen']?.['impfstatus']?.[0]?.key ?? ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const impfOptions = LOOKUP_OPTIONS['katzen']?.['impfstatus'] ?? [];

  const handleSubmit = async () => {
    if (!katzenname.trim()) {
      setErr('Name der Katze ist ein Pflichtfeld.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const besitzerUrl = createRecordUrl(APP_IDS.KUNDEN, kundeId);
      const res: { record_id?: string } = await LivingAppsService.createKatzenEntry({
        katzenname: katzenname.trim(),
        rasse: rasse.trim() || undefined,
        farbe: farbe.trim() || undefined,
        impfstatus: impfstatus || undefined,
        besitzer: besitzerUrl,
      });
      const newId = res?.record_id ?? extractRecordId(JSON.stringify(res));
      if (newId) onCreated(newId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler beim Erstellen der Katze.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-secondary/40 space-y-3 mt-2">
      <p className="text-sm font-semibold text-foreground">Neue Katze anlegen</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Name *</label>
          <Input value={katzenname} onChange={e => setKatzenname(e.target.value)} placeholder="Minka" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Rasse</label>
          <Input value={rasse} onChange={e => setRasse(e.target.value)} placeholder="Hauskatze" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Farbe</label>
          <Input value={farbe} onChange={e => setFarbe(e.target.value)} placeholder="Schwarz-weiß" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Impfstatus</label>
          <select
            value={impfstatus}
            onChange={e => setImpfstatus(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            {impfOptions.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Wird gespeichert…' : 'Katze anlegen'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>Abbrechen</Button>
      </div>
    </div>
  );
}

// ----------- main page component -----------

export default function NeueBuchungPage() {
  const [searchParams] = useSearchParams();
  const { kunden, katzen, zusatzleistungen, loading, error, fetchAll } = useDashboardData();

  // Wizard state
  const initialStep = Math.min(
    Math.max(parseInt(searchParams.get('step') ?? '1', 10), 1),
    4
  );
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Pre-select from URL params
  const urlKundeId = searchParams.get('kundeId') ?? null;
  const [selectedKundeId, setSelectedKundeId] = useState<string | null>(urlKundeId);
  const [selectedKatzeId, setSelectedKatzeId] = useState<string | null>(null);

  // Booking details form
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [unterkunftstyp, setUnterkunftstyp] = useState(
    LOOKUP_OPTIONS['buchungen']?.['unterkunftstyp']?.[0]?.key ?? ''
  );
  const [preisProNacht, setPreisProNacht] = useState<string>('');
  const [notizen, setNotizen] = useState('');

  // Add-ons
  const [selectedZusatz, setSelectedZusatz] = useState<Set<string>>(new Set());

  // Inline create form toggles
  const [showNewKunde, setShowNewKunde] = useState(false);
  const [showNewKatze, setShowNewKatze] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);

  // Auto-advance if kundeId is in URL
  useEffect(() => {
    if (urlKundeId && currentStep === 1) {
      setCurrentStep(2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived data
  const unterkunftOptions = LOOKUP_OPTIONS['buchungen']?.['unterkunftstyp'] ?? [];
  const statusOptions = LOOKUP_OPTIONS['buchungen']?.['status'] ?? [];

  const katzenfuerKunde: Katzen[] = useMemo(() => {
    if (!selectedKundeId) return [];
    return katzen.filter(k => {
      const ownerId = extractRecordId(k.fields.besitzer ?? '');
      return ownerId === selectedKundeId;
    });
  }, [katzen, selectedKundeId]);

  const selectedKunde: Kunden | undefined = useMemo(
    () => kunden.find(k => k.record_id === selectedKundeId),
    [kunden, selectedKundeId]
  );

  const selectedKatze: Katzen | undefined = useMemo(
    () => katzen.find(k => k.record_id === selectedKatzeId),
    [katzen, selectedKatzeId]
  );

  const nights = useMemo(() => nightsBetween(anreise, abreise), [anreise, abreise]);
  const preis = parseFloat(preisProNacht) || 0;
  const grundpreis = nights * preis;

  const selectedZusatzItems: Zusatzleistungen[] = useMemo(
    () => zusatzleistungen.filter(z => selectedZusatz.has(z.record_id)),
    [zusatzleistungen, selectedZusatz]
  );
  const zusatzTotal = selectedZusatzItems.reduce((sum, z) => sum + (z.fields.preis ?? 0), 0);
  const gesamtpreis = grundpreis + zusatzTotal;

  // Step 3 validation
  const step3Valid = anreise && abreise && nights > 0 && unterkunftstyp && preis > 0;

  // ----------- handlers -----------

  const handleKundeSelect = (id: string) => {
    setSelectedKundeId(id);
    setSelectedKatzeId(null);
    setCurrentStep(2);
  };

  const handleKundeCreated = async (id: string) => {
    await fetchAll();
    setSelectedKundeId(id);
    setShowNewKunde(false);
    setCurrentStep(2);
  };

  const handleKatzeSelect = (id: string) => {
    setSelectedKatzeId(id);
    setCurrentStep(3);
  };

  const handleKatzeCreated = async (id: string) => {
    await fetchAll();
    setSelectedKatzeId(id);
    setShowNewKatze(false);
    setCurrentStep(3);
  };

  const toggleZusatz = (id: string) => {
    setSelectedZusatz(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedKundeId || !selectedKatzeId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const zusatzUrls = Array.from(selectedZusatz).map(id =>
        createRecordUrl(APP_IDS.ZUSATZLEISTUNGEN, id)
      );
      const firstStatus = statusOptions[0]?.key ?? 'angefragt';
      const buchungFields = {
        kunde: createRecordUrl(APP_IDS.KUNDEN, selectedKundeId),
        katze: createRecordUrl(APP_IDS.KATZEN, selectedKatzeId),
        anreise,
        abreise,
        unterkunftstyp,
        preis_pro_nacht: preis,
        gesamtpreis,
        // multipleapplookup expects string[] of full record URLs
        ...(zusatzUrls.length > 0 && { zusatzleistungen: zusatzUrls as unknown as string }),
        status: firstStatus,
        ...(notizen.trim() && { notizen: notizen.trim() }),
      };
      const res: { record_id?: string } = await LivingAppsService.createBuchungenEntry(buchungFields);
      const newId = res?.record_id ?? null;
      setSuccessBookingId(newId);
      await fetchAll();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Erstellen der Buchung.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedKundeId(null);
    setSelectedKatzeId(null);
    setAnreise('');
    setAbreise('');
    setUnterkunftstyp(unterkunftOptions[0]?.key ?? '');
    setPreisProNacht('');
    setNotizen('');
    setSelectedZusatz(new Set());
    setShowNewKunde(false);
    setShowNewKatze(false);
    setSubmitError(null);
    setSuccessBookingId(null);
    setCurrentStep(1);
  };

  // ----------- success state -----------

  if (successBookingId !== null) {
    const kundeLabel = selectedKunde
      ? `${selectedKunde.fields.vorname ?? ''} ${selectedKunde.fields.nachname ?? ''}`.trim()
      : '—';
    const katzeLabel = selectedKatze?.fields.katzenname ?? '—';
    const unterkunftLabel = unterkunftOptions.find(o => o.key === unterkunftstyp)?.label ?? unterkunftstyp;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <a href="#/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
            <IconArrowLeft size={14} className="shrink-0" />
            Zurück zum Dashboard
          </a>
          <h1 className="text-2xl font-bold tracking-tight">Neue Buchung</h1>
        </div>

        <div className="rounded-2xl border bg-card shadow-lg overflow-hidden p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <IconCheck size={28} className="text-green-700" stroke={2.5} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Buchung erfolgreich angelegt!</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Die Buchung für <strong>{kundeLabel}</strong> und Katze <strong>{katzeLabel}</strong> wurde erstellt.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left mt-4">
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Unterkunft</p>
              <p className="text-sm font-semibold truncate">{unterkunftLabel}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Anreise</p>
              <p className="text-sm font-semibold">{anreise}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Abreise</p>
              <p className="text-sm font-semibold">{abreise}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Gesamtpreis</p>
              <p className="text-sm font-semibold text-primary">{formatEuro(gesamtpreis)}</p>
            </div>
          </div>

          {selectedZusatzItems.length > 0 && (
            <div className="text-left rounded-xl bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Zusatzleistungen</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedZusatzItems.map(z => (
                  <span key={z.record_id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {z.fields.leistungsname}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button onClick={handleReset} variant="outline">
              <IconPlus size={16} className="mr-2" />
              Neue Buchung anlegen
            </Button>
            <a href="#/">
              <Button>Zurück zum Dashboard</Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ----------- wizard -----------

  return (
    <IntentWizardShell
      title="Neue Buchung"
      subtitle="Führe dich Schritt für Schritt durch die Buchungserfassung"
      steps={[
        { label: 'Kunde' },
        { label: 'Katze' },
        { label: 'Details' },
        { label: 'Abschluss' },
      ]}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ---- Step 1: Kunde auswählen ---- */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <EntitySelectStep
            items={kunden.map(k => ({
              id: k.record_id,
              title: `${k.fields.vorname ?? ''} ${k.fields.nachname ?? ''}`.trim() || '—',
              subtitle: [k.fields.ort, k.fields.telefon].filter(Boolean).join(' · '),
              icon: <IconUser size={20} className="text-primary" />,
            }))}
            onSelect={handleKundeSelect}
            searchPlaceholder="Kunde suchen…"
            emptyIcon={<IconUser size={32} />}
            emptyText="Kein Kunde gefunden. Lege einen neuen Kunden an."
            createLabel="Neuen Kunden anlegen"
            onCreateNew={() => setShowNewKunde(v => !v)}
          />
          {showNewKunde && (
            <NewKundeForm
              onCreated={handleKundeCreated}
              onCancel={() => setShowNewKunde(false)}
            />
          )}
        </div>
      )}

      {/* ---- Step 2: Katze auswählen ---- */}
      {currentStep === 2 && (
        <div className="space-y-4">
          {selectedKunde && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconUser size={14} className="shrink-0" />
                <span>Kunde: <strong className="text-foreground">
                  {selectedKunde.fields.vorname} {selectedKunde.fields.nachname}
                </strong></span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setCurrentStep(1); setSelectedKundeId(null); }}>
                <IconArrowLeft size={14} className="mr-1" /> Ändern
              </Button>
            </div>
          )}

          {katzenfuerKunde.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto opacity-50">
                <IconCat size={28} />
              </div>
              <p className="text-sm text-muted-foreground">
                Keine Katzen für diesen Kunden gefunden.
              </p>
              <Button variant="outline" onClick={() => setShowNewKatze(v => !v)}>
                <IconPlus size={16} className="mr-2" />
                Neue Katze anlegen
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {katzenfuerKunde.map(katze => (
                  <button
                    key={katze.record_id}
                    onClick={() => handleKatzeSelect(katze.record_id)}
                    className="text-left p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/30 transition-colors overflow-hidden group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <IconCat size={20} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {katze.fields.katzenname ?? '—'}
                          </span>
                          {katze.fields.impfstatus && (
                            <StatusBadge
                              statusKey={katze.fields.impfstatus.key}
                              label={katze.fields.impfstatus.label}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {[katze.fields.rasse, katze.fields.farbe].filter(Boolean).join(' · ') || 'Keine weiteren Angaben'}
                        </p>
                      </div>
                      <IconArrowRight size={16} className="text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setShowNewKatze(v => !v)}>
                <IconPlus size={16} className="mr-2" />
                Neue Katze für diesen Kunden anlegen
              </Button>
            </>
          )}

          {showNewKatze && selectedKundeId && (
            <NewKatzeForm
              kundeId={selectedKundeId}
              onCreated={handleKatzeCreated}
              onCancel={() => setShowNewKatze(false)}
            />
          )}
        </div>
      )}

      {/* ---- Step 3: Buchungsdetails ---- */}
      {currentStep === 3 && (
        <div className="space-y-5">
          {/* Context bar */}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <IconUser size={14} className="shrink-0" />
              <strong className="text-foreground">
                {selectedKunde?.fields.vorname} {selectedKunde?.fields.nachname}
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <IconCat size={14} className="shrink-0" />
              <strong className="text-foreground">{selectedKatze?.fields.katzenname ?? '—'}</strong>
            </span>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Anreise</label>
              <Input
                type="date"
                value={anreise}
                onChange={e => setAnreise(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Abreise</label>
              <Input
                type="date"
                value={abreise}
                min={anreise || undefined}
                onChange={e => setAbreise(e.target.value)}
              />
            </div>
          </div>

          {/* Live duration card */}
          {nights > 0 && preis > 0 && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-center gap-3">
              <div className="text-primary font-bold text-lg tabular-nums">{nights}</div>
              <div className="text-sm text-muted-foreground">
                {nights === 1 ? 'Nacht' : 'Nächte'} &nbsp;·&nbsp; Grundpreis: <span className="font-semibold text-foreground">{formatEuro(grundpreis)}</span>
              </div>
            </div>
          )}

          {/* Unterkunftstyp */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Unterkunftstyp</label>
            <div className="flex flex-wrap gap-2">
              {unterkunftOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setUnterkunftstyp(opt.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    unterkunftstyp === opt.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-input hover:border-primary/40 hover:bg-accent'
                  }`}
                >
                  <IconBuildingCottage size={16} stroke={2} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preis pro Nacht */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Preis pro Nacht (€)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={preisProNacht}
              onChange={e => setPreisProNacht(e.target.value)}
              placeholder="z.B. 35.00"
              className="max-w-xs"
            />
          </div>

          {/* Notizen */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Notizen (optional)</label>
            <textarea
              value={notizen}
              onChange={e => setNotizen(e.target.value)}
              placeholder="Besondere Hinweise, Wünsche oder Anmerkungen…"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Navigation */}
          <div className="flex gap-3 pt-2 flex-wrap">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              <IconArrowLeft size={16} className="mr-2" />
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(4)}
              disabled={!step3Valid}
            >
              Weiter zu Zusatzleistungen
              <IconArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ---- Step 4: Zusatzleistungen & Bestätigung ---- */}
      {currentStep === 4 && (
        <div className="space-y-5">
          {/* Context summary */}
          <div className="rounded-xl bg-secondary/50 border p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm overflow-hidden">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Kunde</p>
              <p className="font-medium truncate">
                {selectedKunde?.fields.vorname} {selectedKunde?.fields.nachname}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Katze</p>
              <p className="font-medium truncate">{selectedKatze?.fields.katzenname ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Zeitraum</p>
              <p className="font-medium">{anreise} – {abreise}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Grundpreis</p>
              <p className="font-medium">{formatEuro(grundpreis)}</p>
            </div>
          </div>

          {/* Zusatzleistungen tiles */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <IconSparkles size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Zusatzleistungen auswählen</h3>
            </div>
            {zusatzleistungen.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Keine Zusatzleistungen verfügbar.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {zusatzleistungen.map(z => {
                  const selected = selectedZusatz.has(z.record_id);
                  return (
                    <button
                      key={z.record_id}
                      onClick={() => toggleZusatz(z.record_id)}
                      className={`text-left p-4 rounded-xl border transition-colors overflow-hidden ${
                        selected
                          ? 'bg-primary/10 border-primary text-foreground'
                          : 'bg-card border-input hover:bg-accent hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          selected ? 'bg-primary border-primary' : 'border-input bg-background'
                        }`}>
                          {selected && <IconCheck size={12} className="text-primary-foreground" stroke={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{z.fields.leistungsname ?? '—'}</span>
                            <span className="text-sm font-semibold text-primary shrink-0">{formatEuro(z.fields.preis ?? 0)}</span>
                          </div>
                          {z.fields.beschreibung && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{z.fields.beschreibung}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Total card */}
          <div className="rounded-xl border bg-card p-4 space-y-2 overflow-hidden">
            <h3 className="text-sm font-semibold">Gesamtkosten</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{nights} {nights === 1 ? 'Nacht' : 'Nächte'} × {formatEuro(preis)}</span>
                <span>{formatEuro(grundpreis)}</span>
              </div>
              {selectedZusatzItems.map(z => (
                <div key={z.record_id} className="flex justify-between text-muted-foreground">
                  <span className="truncate mr-2">{z.fields.leistungsname}</span>
                  <span className="shrink-0">{formatEuro(z.fields.preis ?? 0)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold text-foreground text-base">
                <span>Gesamt</span>
                <span className="text-primary">{formatEuro(gesamtpreis)}</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {submitError && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2 flex-wrap">
            <Button variant="outline" onClick={() => setCurrentStep(3)} disabled={submitting}>
              <IconArrowLeft size={16} className="mr-2" />
              Zurück
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Buchung wird angelegt…' : 'Buchung anlegen'}
              {!submitting && <IconCheck size={16} className="ml-2" />}
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
