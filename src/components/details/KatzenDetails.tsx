import type { Katzen, Kunden, Buchungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface KatzenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Katzen;
  /** N:1-Ziel „Kunden": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundenList: Kunden[];
  /** Klick auf die Kunden-Relation → overlay.push auf dessen Detail. */
  onOpenKunden?: (record: Kunden) => void;
  /** 1:N „Buchungen": VOLLE Liste — der Block filtert auf diesen Record. */
  buchungenList: Buchungen[];
  /** Zeilen-Klick → overlay.push auf das Buchungen-Detail (nie der Edit-Dialog). */
  onOpenBuchungen: (record: Buchungen) => void;
  /** Kontextuelles „+": öffnet den Buchungen-Dialog mit diesem Record vorgesetzt. */
  onAddBuchungen: () => void;
}

export function KatzenDetails({
  record,
  kundenList,
  onOpenKunden,
  buchungenList,
  onOpenBuchungen,
  onAddBuchungen,
}: KatzenDetailsProps) {
  const besitzerTarget = kundenList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Name der Katze" value={record.fields.katzenname} format="text" />
        <RecordField label="Rasse" value={record.fields.rasse} format="text" />
        <RecordField label="Geburtsdatum" value={record.fields.geburtsdatum} format="date" />
        <RecordField label="Geschlecht" value={record.fields.geschlecht} format="pill" />
        <RecordField label="Fellfarbe" value={record.fields.farbe} format="text" />
        <RecordField label="Impfstatus" value={record.fields.impfstatus} format="pill" />
        <RecordField label="Besonderheiten / Gesundheitshinweise" value={record.fields.besonderheiten} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Besitzer"
          name={besitzerTarget?.fields.nachname ?? '—'}
          meta={[besitzerTarget?.fields.telefon, besitzerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenKunden ? () => onOpenKunden!(besitzerTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title="Buchungen"
        items={buchungenList.filter(r => extractRecordId(r.fields.katze) === record.record_id)}
        map={r => ({ name: 'Buchungen', meta: r.fields.anreise })}
        onOpen={onOpenBuchungen}
        onAdd={onAddBuchungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.KATZEN} recordId={record.record_id} />
    </>
  );
}
