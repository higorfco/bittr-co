import h2Pack from "@/data/h2/initial_assessment_acute_stroke.json";
import { classifyPanda93, PANDA93_MAX, toPanda93 } from "./panda93";
import { normalize, termMatches } from "./terminologia";
import { blurPersonalData } from "./privacy/blur";
import type { CiqBand } from "./types";

export type H2ChecklistItem = {
  id: string;
  section: string;
  label: string;
  essential: boolean;
  patterns: string[];
};

export type H2Pack = {
  v: string;
  mode: string;
  source: {
    original_filename?: string;
    file_type?: string;
    page_count?: number;
    sha256?: string;
  };
  document: {
    title?: string;
    sections?: Array<{ title: string; start_page: number; end_page: number }>;
  };
  pages: Array<{
    page: number;
    section: string;
    headings: string[];
    text: string;
  }>;
  checklist: H2ChecklistItem[];
  initial_assessment_text: string;
};

export const H2_PACK = h2Pack as H2Pack;

export type H2ItemResult = {
  id: string;
  label: string;
  section: string;
  essential: boolean;
  present: boolean;
};

export type H2Result = {
  panda93: number;
  band: CiqBand;
  bandLabel: string;
  presentCount: number;
  totalEssential: number;
  items: H2ItemResult[];
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

/** Consulta o banco H2: presença dos itens do checklist no texto clínico. */
export function evaluateStrokeH2(content: string): H2Result {
  const { sanitized, changes } = blurPersonalData(content.trim());
  const haystack = normalize(sanitized);
  const checklist = H2_PACK.checklist ?? [];

  const items: H2ItemResult[] = checklist.map((item) => ({
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
      H2_PACK.document?.title ??
      "Initial assessment and management of acute stroke",
  };
}

/** Exposto para UI/debug: metadados do banco consultado. */
export function getH2SourceMeta() {
  return {
    title: H2_PACK.document?.title,
    filename: H2_PACK.source?.original_filename,
    pages: H2_PACK.pages?.length ?? 0,
    checklistItems: H2_PACK.checklist?.length ?? 0,
  };
}
