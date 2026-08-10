import type { Buchungen, Katzen, Kunden, Zusatzleistungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface BuchungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Buchungen;
  /** N:1-Ziel „Katzen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  katzenList: Katzen[];
  /** Klick auf die Katzen-Relation → overlay.push auf dessen Detail. */
  onOpenKatzen?: (record: Katzen) => void;
  /** N:1-Ziel „Kunden": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundenList: Kunden[];
  /** Klick auf die Kunden-Relation → overlay.push auf dessen Detail. */
  onOpenKunden?: (record: Kunden) => void;
  /** N:1-Ziel „Zusatzleistungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  zusatzleistungenList: Zusatzleistungen[];
  /** Reserviert — Zusatzleistungen ist hier nur über ein Mehrfach-Feld verknüpft (Text-Join, keine Einzel-Relation); Übergabe erlaubt, aber ohne Wirkung. */
  onOpenZusatzleistungen?: (record: Zusatzleistungen) => void;
}

export function BuchungenDetails({
  record,
  katzenList,
  onOpenKatzen,
  kundenList,
  onOpenKunden,
  zusatzleistungenList,
}: BuchungenDetailsProps) {
  const katzeTarget = katzenList.find(r => r.record_id === extractRecordId(record.fields.katze));
  const kundeTarget = kundenList.find(r => r.record_id === extractRecordId(record.fields.kunde));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Gesamtpreis (€)" value={record.fields.gesamtpreis} format="text" />
        <RecordField label="Anreisedatum" value={record.fields.anreise} format="date" />
        <RecordField label="Abreisedatum" value={record.fields.abreise} format="date" />
        <RecordField label="Unterkunftstyp" value={record.fields.unterkunftstyp} format="pill" />
        <RecordField label="Zusatzleistungen" value={Array.isArray(record.fields.zusatzleistungen) ? record.fields.zusatzleistungen.map((u: unknown) => zusatzleistungenList.find(t => t.record_id === extractRecordId(u))?.fields.leistungsname ?? '—').join(', ') : null} format="text" />
        <RecordField label="Buchungsstatus" value={record.fields.status} format="pill" />
        <RecordField label="Notizen" value={record.fields.notizen} format="longtext" className="md:col-span-2" />
        <RecordField label="Preis pro Nacht (€)" value={record.fields.preis_pro_nacht} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={2}>
        <RecordRelation
          label="Katze"
          name={katzeTarget?.fields.katzenname ?? '—'}
          meta={[katzeTarget?.fields.rasse, katzeTarget?.fields.farbe].filter(Boolean).join(' · ') || undefined}
          onClick={katzeTarget && onOpenKatzen ? () => onOpenKatzen!(katzeTarget!) : undefined}
        />
        <RecordRelation
          label="Kunde"
          name={kundeTarget?.fields.nachname ?? '—'}
          meta={[kundeTarget?.fields.telefon, kundeTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={kundeTarget && onOpenKunden ? () => onOpenKunden!(kundeTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BUCHUNGEN} recordId={record.record_id} />
    </>
  );
}
