import type { Kunden, Katzen, Buchungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface KundenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Kunden;
  /** 1:N „Katzen": VOLLE Liste — der Block filtert auf diesen Record. */
  katzenList: Katzen[];
  /** Zeilen-Klick → overlay.push auf das Katzen-Detail (nie der Edit-Dialog). */
  onOpenKatzen: (record: Katzen) => void;
  /** Kontextuelles „+": öffnet den Katzen-Dialog mit diesem Record vorgesetzt. */
  onAddKatzen: () => void;
  /** 1:N „Buchungen": VOLLE Liste — der Block filtert auf diesen Record. */
  buchungenList: Buchungen[];
  /** Zeilen-Klick → overlay.push auf das Buchungen-Detail (nie der Edit-Dialog). */
  onOpenBuchungen: (record: Buchungen) => void;
  /** Kontextuelles „+": öffnet den Buchungen-Dialog mit diesem Record vorgesetzt. */
  onAddBuchungen: () => void;
}

export function KundenDetails({
  record,
  katzenList,
  onOpenKatzen,
  onAddKatzen,
  buchungenList,
  onOpenBuchungen,
  onAddBuchungen,
}: KundenDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Nachname" value={record.fields.nachname} format="text" />
        <RecordField label="Telefon" value={record.fields.telefon} format="text" />
        <RecordField label="E-Mail-Adresse" value={record.fields.email} format="email" />
        <RecordField label="Straße" value={record.fields.strasse} format="text" />
        <RecordField label="Hausnummer" value={record.fields.hausnummer} format="text" />
        <RecordField label="Postleitzahl" value={record.fields.plz} format="text" />
        <RecordField label="Ort" value={record.fields.ort} format="text" />
        <RecordField label="Vorname" value={record.fields.vorname} format="text" />
      </RecordSection>

      <SatelliteSection
        title="Katzen"
        items={katzenList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: r.fields.katzenname ?? 'Katzen', meta: r.fields.geburtsdatum })}
        onOpen={onOpenKatzen}
        onAdd={onAddKatzen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title="Buchungen"
        items={buchungenList.filter(r => extractRecordId(r.fields.kunde) === record.record_id)}
        map={r => ({ name: 'Buchungen', meta: r.fields.anreise })}
        onOpen={onOpenBuchungen}
        onAdd={onAddBuchungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.KUNDEN} recordId={record.record_id} />
    </>
  );
}
