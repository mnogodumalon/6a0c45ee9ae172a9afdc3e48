import type { Buchungen, Katzen } from './app';

export type EnrichedKatzen = Katzen & {
  besitzerName: string;
};

export type EnrichedBuchungen = Buchungen & {
  katzeName: string;
  kundeName: string;
  zusatzleistungenName: string;
};
