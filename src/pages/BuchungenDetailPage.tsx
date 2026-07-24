import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Buchungen, Katzen, Kunden, Zusatzleistungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { BuchungenDialog } from '@/components/dialogs/BuchungenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Buchungen';
import { evalComputed } from '@/config/form-enhancements/types';

export default function BuchungenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Buchungen | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [katzenList, setKatzenList] = useState<Katzen[]>([]);
  const [kundenList, setKundenList] = useState<Kunden[]>([]);
  const [zusatzleistungenList, setZusatzleistungenList] = useState<Zusatzleistungen[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, katzenData, kundenData, zusatzleistungenData] = await Promise.all([
        LivingAppsService.getBuchungen(),
        LivingAppsService.getKatzen(),
        LivingAppsService.getKunden(),
        LivingAppsService.getZusatzleistungen(),
      ]);
      setKatzenList(katzenData);
      setKundenList(kundenData);
      setZusatzleistungenList(zusatzleistungenData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Buchungen['fields']) {
    if (!record) return;
    await LivingAppsService.updateBuchungenEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteBuchungenEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/buchungen');
  }

  function getKatzenDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return katzenList.find(r => r.record_id === refId)?.fields.katzenname ?? '—';
  }

  function getKundenDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return kundenList.find(r => r.record_id === refId)?.fields.nachname ?? '—';
  }

  function getZusatzleistungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return zusatzleistungenList.find(r => r.record_id === refId)?.fields.leistungsname ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/buchungen')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/buchungen')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={'Buchungen'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          katze: katzenList,
          kunde: kundenList,
          zusatzleistungen: zusatzleistungenList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Gesamtpreis (€)" value={record.fields.gesamtpreis} format="text" />
        <RecordField label="Katze" value={getKatzenDisplayName(record.fields.katze)} format="text" />
        <RecordField label="Anreisedatum" value={record.fields.anreise} format="date" />
        <RecordField label="Abreisedatum" value={record.fields.abreise} format="date" />
        <RecordField label="Unterkunftstyp" value={record.fields.unterkunftstyp} format="pill" />
        <RecordField label="Kunde" value={getKundenDisplayName(record.fields.kunde)} format="text" />
        <RecordField label="Zusatzleistungen" value={Array.isArray(record.fields.zusatzleistungen) ? record.fields.zusatzleistungen.map((u: unknown) => getZusatzleistungenDisplayName(u)).join(', ') : null} format="text" />
        <RecordField label="Buchungsstatus" value={record.fields.status} format="pill" />
        <RecordField label="Notizen" value={record.fields.notizen} format="longtext" className="md:col-span-2" />
        <RecordField label="Preis pro Nacht (€)" value={record.fields.preis_pro_nacht} format="text" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BUCHUNGEN} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <BuchungenDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        katzenList={katzenList}
        kundenList={kundenList}
        zusatzleistungenList={zusatzleistungenList}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungen']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Buchungen löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
