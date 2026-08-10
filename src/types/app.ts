// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Zusatzleistungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    leistungsname?: string;
    beschreibung?: string;
    preis?: number;
  };
}

export interface Kunden {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    nachname?: string;
    telefon?: string;
    email?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    vorname?: string;
  };
}

export interface Katzen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    katzenname?: string;
    rasse?: string;
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    geschlecht?: LookupValue;
    farbe?: string;
    impfstatus?: LookupValue;
    besonderheiten?: string;
    besitzer?: string; // applookup -> URL zu 'Kunden' Record
  };
}

export interface Buchungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    gesamtpreis?: number;
    katze?: string; // applookup -> URL zu 'Katzen' Record
    anreise?: string; // Format: YYYY-MM-DD oder ISO String
    abreise?: string; // Format: YYYY-MM-DD oder ISO String
    unterkunftstyp?: LookupValue;
    kunde?: string; // applookup -> URL zu 'Kunden' Record
    zusatzleistungen?: string[];
    status?: LookupValue;
    notizen?: string;
    preis_pro_nacht?: number;
  };
}

export const APP_IDS = {
  ZUSATZLEISTUNGEN: '6a0c45cd1be9f04e188b08dd',
  KUNDEN: '6a0c45c8906835b1ad00f90a',
  KATZEN: '6a0c45cdd4b461a56b9d6cb4',
  BUCHUNGEN: '6a0c45ce17d0f305b7c53697',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'katzen': {
    geschlecht: [{ key: "weiblich", label: "Weiblich" }, { key: "maennlich", label: "Männlich" }, { key: "unbekannt", label: "Unbekannt" }],
    impfstatus: [{ key: "vollstaendig_geimpft", label: "Vollständig geimpft" }, { key: "teilweise_geimpft", label: "Teilweise geimpft" }, { key: "nicht_geimpft", label: "Nicht geimpft" }, { key: "unbekannt_impf", label: "Unbekannt" }],
  },
  'buchungen': {
    unterkunftstyp: [{ key: "standard", label: "Standardzimmer" }, { key: "komfort", label: "Komfortzimmer" }, { key: "suite", label: "Suite" }],
    status: [{ key: "angefragt", label: "Angefragt" }, { key: "bestaetigt", label: "Bestätigt" }, { key: "eingecheckt", label: "Eingecheckt" }, { key: "ausgecheckt", label: "Ausgecheckt" }, { key: "storniert", label: "Storniert" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'zusatzleistungen': {
    'leistungsname': 'string/text',
    'beschreibung': 'string/textarea',
    'preis': 'number',
  },
  'kunden': {
    'nachname': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'vorname': 'string/text',
  },
  'katzen': {
    'katzenname': 'string/text',
    'rasse': 'string/text',
    'geburtsdatum': 'date/date',
    'geschlecht': 'lookup/radio',
    'farbe': 'string/text',
    'impfstatus': 'lookup/select',
    'besonderheiten': 'string/textarea',
    'besitzer': 'applookup/select',
  },
  'buchungen': {
    'gesamtpreis': 'number',
    'katze': 'applookup/select',
    'anreise': 'date/date',
    'abreise': 'date/date',
    'unterkunftstyp': 'lookup/select',
    'kunde': 'applookup/select',
    'zusatzleistungen': 'multipleapplookup/select',
    'status': 'lookup/select',
    'notizen': 'string/textarea',
    'preis_pro_nacht': 'number',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateZusatzleistungen = StripLookup<Zusatzleistungen['fields']>;
export type CreateKunden = StripLookup<Kunden['fields']>;
export type CreateKatzen = StripLookup<Katzen['fields']>;
export type CreateBuchungen = StripLookup<Buchungen['fields']>;