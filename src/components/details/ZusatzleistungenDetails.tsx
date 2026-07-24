import type { Zusatzleistungen, Buchungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface ZusatzleistungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Zusatzleistungen;
  /** 1:N „Buchungen": VOLLE Liste — der Block filtert auf diesen Record. */
  buchungenList: Buchungen[];
  /** Zeilen-Klick → overlay.push auf das Buchungen-Detail (nie der Edit-Dialog). */
  onOpenBuchungen: (record: Buchungen) => void;
  /** Kontextuelles „+": öffnet den Buchungen-Dialog mit diesem Record vorgesetzt. */
  onAddBuchungen: () => void;
}

export function ZusatzleistungenDetails({
  record,
  buchungenList,
  onOpenBuchungen,
  onAddBuchungen,
}: ZusatzleistungenDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Name der Leistung" value={record.fields.leistungsname} format="text" />
        <RecordField label="Beschreibung" value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Preis (€)" value={record.fields.preis} format="text" />
      </RecordSection>

      <SatelliteSection
        title="Buchungen"
        items={buchungenList.filter(r => Array.isArray(r.fields.zusatzleistungen) && r.fields.zusatzleistungen.some((u: unknown) => extractRecordId(u) === record.record_id))}
        map={r => ({ name: 'Buchungen', meta: r.fields.anreise })}
        onOpen={onOpenBuchungen}
        onAdd={onAddBuchungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.ZUSATZLEISTUNGEN} recordId={record.record_id} />
    </>
  );
}
