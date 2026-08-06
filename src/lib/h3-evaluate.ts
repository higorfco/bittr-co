import h3Pack from "@/data/h3/chest_pain_and_chest_wall_trauma.json";
import { classifyPanda93, PANDA93_MAX, toPanda93 } from "./panda93";
import { normalize, termMatches } from "./terminologia";
import { blurPersonalData } from "./privacy/blur";
import type { CiqBand } from "./types";

export type H3ChecklistItem = {
  id: string;
  section: string;
  label: string;
  essential: boolean;
  patterns: string[];
};

export type H3Pack = {
  v: string;
  mode: string;
  collection: {
    name?: string;
    document_count?: number;
  };
  documents: Array<{
    source?: { original_filename?: string };
    title?: string;
    pages?: Array<{ page: number; section: string; text: string }>;
  }>;
  checklist: H3ChecklistItem[];
};

export const H3_PACK = h3Pack as H3Pack;

export type H3ItemResult = {
  id: string;
  label: string;
  section: string;
  essential: boolean;
  present: boolean;
};

export type H3Result = {
  panda93: number;
  band: CiqBand;
  bandLabel: string;
  presentCount: number;
  totalEssential: number;
  items: H3ItemResult[];
  missing: string[];
  privacyRedactions: number;
  sourceTitle: string;
};

function toBand(band: string): CiqBand {
  switch (band) {
    case "excelente":
      return "excelente";
    case "adequado":
      return "adequado";
    case "parcial":
      return "parcialmente_adequado";
    case "insuficiente":
      return "insuficiente";
    default:
      return "criticamente_incompleto";
  }
}

/** H3 — análise exclusiva com base em chest pain / chest wall trauma. */
export function evaluateChestPainH3(content: string): H3Result {
  const { sanitized, changes } = blurPersonalData(content.trim());
  const haystack = normalize(sanitized);
  const checklist = H3_PACK.checklist ?? [];

  const items: H3ItemResult[] = checklist.map((item) => ({
    id: item.id,
    label: item.label,
    section: item.section,
    essential: item.essential,
    present: (item.patterns ?? []).some((p) => termMatches(haystack, p)),
  }));

  const essentials = items.filter((i) => i.essential);
  const presentEssential = essentials.filter((i) => i.present).length;
  const ratio =
    essentials.length === 0 ? 0 : presentEssential / essentials.length;
  const panda93 = Math.max(
    0,
    Math.min(PANDA93_MAX, toPanda93(ratio * 100)),
  );
  const classified = classifyPanda93(panda93);

  const missingEssential = items
    .filter((i) => !i.present && i.essential)
    .map((i) => `${i.label} (${i.section})`);
  const missingOptional = items
    .filter((i) => !i.present && !i.essential)
    .map((i) => `${i.label} (${i.section})`);

  return {
    panda93,
    band: toBand(classified.band),
    bandLabel: classified.label,
    presentCount: presentEssential,
    totalEssential: essentials.length,
    items,
    missing: [...missingEssential, ...missingOptional].slice(0, 28),
    privacyRedactions: changes,
    sourceTitle:
      H3_PACK.collection?.name ?? "Chest pain and chest wall trauma",
  };
}
