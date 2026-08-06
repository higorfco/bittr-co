import { classifyPanda93, PANDA93_MAX, toPanda93 } from "./panda93";
import { H2_SECTIONS } from "./h2-topics";
import { normalize, termMatches } from "./terminologia";
import { blurPersonalData } from "./privacy/blur";
import type { CiqBand } from "./types";

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

export function evaluateStrokeH2(content: string): H2Result {
  const { sanitized, changes } = blurPersonalData(content.trim());
  const haystack = normalize(sanitized);

  const items: H2ItemResult[] = [];

  for (const section of H2_SECTIONS) {
    for (const item of section.items) {
      const present = item.patterns.some((p) => termMatches(haystack, p));
      items.push({
        id: item.id,
        label: item.label,
        section: section.label,
        essential: item.essential,
        present,
      });
    }
  }

  const essentials = items.filter((i) => i.essential);
  const presentEssential = essentials.filter((i) => i.present).length;
  const ratio =
    essentials.length === 0 ? 0 : presentEssential / essentials.length;
  const panda93 = Math.max(
    0,
    Math.min(PANDA93_MAX, toPanda93(ratio * 100)),
  );
  const classified = classifyPanda93(panda93);

  const missing = items
    .filter((i) => !i.present && i.essential)
    .map((i) => `${i.label} (${i.section})`);

  // Também listar não essenciais ausentes no fim, limitando
  const optionalMissing = items
    .filter((i) => !i.present && !i.essential)
    .map((i) => `${i.label} (${i.section})`);

  return {
    panda93,
    band: toBand(classified.band),
    bandLabel: classified.label,
    presentCount: presentEssential,
    totalEssential: essentials.length,
    items,
    missing: [...missing, ...optionalMissing].slice(0, 24),
    privacyRedactions: changes,
  };
}
