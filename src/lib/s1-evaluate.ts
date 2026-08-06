import s1Db from "@/data/s1/s1pain_history_qp_hpma_database.json";
import { classifyPanda93, PANDA93_MAX, toPanda93 } from "./panda93";
import { normalize, termMatches } from "./terminologia";
import { blurPersonalData } from "./privacy/blur";
import type { CiqBand } from "./types";

/** Banco exclusivo do modelo S1 (QP + HPMA · dor). */
export type S1Database = {
  module: string;
  version: number;
  fields: {
    pain: { positive: string[]; negative: string[] };
    onset: { sudden: string[]; insidious: string[] };
    location: Record<string, string[]>;
    duration_units: string[];
    pattern: { continuous: string[]; intermittent: string[] };
    radiation: string[];
    associated_symptoms: string[];
    relief: string[];
    aggravation: string[];
    previous_episodes: string[];
    analgesic_response: {
      improved: string[];
      partial: string[];
      none: string[];
    };
  };
};

export const S1_DB = s1Db as S1Database;

/** Marcadores de escopo (lei do prompt — não fazem parte do léxico de dor). */
const SECTION_MARKERS = {
  qp_start: [
    "queixa principal",
    "queixa-principal",
    "qp:",
    "qp ",
    "qd:",
    "qd ",
    "motivo da consulta",
    "motivo do atendimento",
    "motivo da procura",
  ],
  hpma_start: [
    "história da moléstia atual",
    "historia da molestia atual",
    "história da doença atual",
    "historia da doenca atual",
    "hpma",
    "hma:",
    "hma ",
    "hda:",
    "hda ",
  ],
  stop: [
    "antecedentes pessoais",
    "antecedentes patológicos",
    "antecedentes patologicos",
    "antecedentes familiares",
    "antecedentes cirúrgicos",
    "antecedentes cirurgicos",
    "medicações em uso",
    "medicacoes em uso",
    "medicamentos em uso",
    "medicamentos de uso contínuo",
    "medicamentos de uso continuo",
    "alergias",
    "alergia:",
    "exame físico",
    "exame fisico",
    "ef:",
    "interrogatório sintomatológico",
    "interrogatorio sintomatologico",
    "revisão de sistemas",
    "revisao de sistemas",
    "exames complementares",
    "resultado de exames",
    "hipótese diagnóstica",
    "hipotese diagnostica",
    "conduta",
    "ap:",
    "af:",
    "muc:",
    "app:",
  ],
};

const MISSING_EXAMPLES: Record<string, string> = {
  Início: "Dor iniciou de forma súbita há 30 minutos.",
  Localização: "Dor localizada em epigástrio.",
  Tempo: "Dor com evolução de 3 horas.",
  Padrão: "Dor contínua desde o início.",
  Irradiação: "Dor irradiando para mandíbula.",
  "Sintomas associados": "Associada a náusea e sudorese.",
  "Fatores de melhora": "Melhora parcialmente após dipirona.",
  "Fatores de piora": "Piora à inspiração profunda.",
  "Episódios prévios": "Nega episódios prévios semelhantes.",
  "Resposta aos analgésicos": "Sem melhora após dipirona.",
};

const LAW = "Interpretação Lógica da Dor na Queixa Principal (QP + HPMA)";

export type PainPresence = "SIM" | "NÃO" | "INDETERMINADO";

export type S1Attribute = {
  key: string;
  found: boolean;
  value: string | null;
};

export type S1Result = {
  panda93: number;
  band: CiqBand;
  bandLabel: string;
  privacyRedactions: number;
  law: string;
  sourcePack: string;
  painPresence: PainPresence;
  scopeNote: string;
  attributes: S1Attribute[];
  completeness: Array<{ key: string; found: boolean }>;
  missingBlocks: string[];
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

function findEarliestIndex(haystack: string, markers: string[]): number {
  let best = -1;
  for (const marker of markers) {
    const n = normalize(marker);
    if (!n) continue;
    const idx = haystack.indexOf(n);
    if (idx >= 0 && (best < 0 || idx < best)) best = idx;
  }
  return best;
}

function findNextStop(haystack: string, from: number, stops: string[]): number {
  let best = haystack.length;
  for (const stop of stops) {
    const n = normalize(stop);
    if (!n) continue;
    const idx = haystack.indexOf(n, from + 1);
    if (idx >= 0 && idx < best) best = idx;
  }
  return best;
}

export function extractQpHpma(text: string): { scope: string; note: string } {
  const haystack = normalize(text.trim());
  if (!haystack) return { scope: "", note: "Texto vazio." };

  const { qp_start, hpma_start, stop } = SECTION_MARKERS;
  const qpIdx = findEarliestIndex(haystack, qp_start);
  const hpmaIdx = findEarliestIndex(haystack, hpma_start);

  if (qpIdx < 0 && hpmaIdx < 0) {
    return {
      scope: haystack,
      note: "Sem marcadores explícitos de QP/HPMA — analisado o texto integral (escopo presumido).",
    };
  }

  const chunks: string[] = [];
  if (qpIdx >= 0) {
    const end = findNextStop(haystack, qpIdx, [...hpma_start, ...stop]);
    chunks.push(haystack.slice(qpIdx, end).trim());
  }
  if (hpmaIdx >= 0) {
    const end = findNextStop(haystack, hpmaIdx, stop);
    chunks.push(haystack.slice(hpmaIdx, end).trim());
  }

  return {
    scope: chunks.filter(Boolean).join(" ").trim() || haystack,
    note: "Análise restrita a Queixa Principal (QP) e História da Moléstia Atual (HPMA).",
  };
}

function firstMatchLabel(
  haystack: string,
  groups: Record<string, string[]>,
): string | null {
  for (const [label, terms] of Object.entries(groups)) {
    if (terms.some((t) => termMatches(haystack, t))) return label;
  }
  return null;
}

function collectMatches(haystack: string, terms: string[]): string[] {
  const found: string[] = [];
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    if (!termMatches(haystack, term)) continue;
    const n = normalize(term);
    const already = found.some(
      (f) => normalize(f).includes(n) || n.includes(normalize(f)),
    );
    if (!already) found.push(term);
  }
  return found;
}

function flattenLocations(): string[] {
  return Object.values(S1_DB.fields.location).flat();
}

function extractTempo(haystack: string): string | null {
  const units = S1_DB.fields.duration_units;
  const unitPattern = units.map(escapeRe).join("|");
  const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${unitPattern})\\b`, "iu");
  const m = haystack.match(re);
  if (!m) return null;
  const num = m[1]!.replace(",", ".");
  const unit = m[2]!.toLowerCase();
  return `${num.replace(/\.0$/, "")} ${unit}`;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectPain(haystack: string): PainPresence {
  const { positive, negative } = S1_DB.fields.pain;
  const denied = negative.some((t) => termMatches(haystack, t));
  const hasPain = positive.some((t) => termMatches(haystack, t));

  if (denied && !hasPain) return "NÃO";
  if (denied && hasPain) {
    const posCount = positive.filter((t) => termMatches(haystack, t)).length;
    return posCount >= 2 ? "SIM" : "NÃO";
  }
  if (hasPain) return "SIM";
  return "INDETERMINADO";
}

function attr(key: string, found: boolean, value: string | null): S1Attribute {
  return { key, found, value: found ? value : null };
}

/** S1 — Interpretação lógica da dor (somente QP + HPMA), banco exclusivo. */
export function evaluatePainS1(content: string): S1Result {
  const { sanitized, changes } = blurPersonalData(content.trim());
  const { scope, note } = extractQpHpma(sanitized);
  const haystack = normalize(scope);
  const f = S1_DB.fields;

  const painPresence = detectPain(haystack);

  const onsetMap = {
    súbito: f.onset.sudden,
    insidioso: f.onset.insidious,
  };
  const inicioRaw =
    painPresence === "SIM" ? firstMatchLabel(haystack, onsetMap) : null;
  const inicio = inicioRaw ?? (painPresence === "SIM" ? "desconhecido" : null);

  const locs =
    painPresence === "SIM" ? collectMatches(haystack, flattenLocations()) : [];
  const localizacao = locs.length ? locs.slice(0, 4).join(", ") : null;

  const tempo = painPresence === "SIM" ? extractTempo(haystack) : null;

  const patternMap = {
    contínua: f.pattern.continuous,
    intermitente: f.pattern.intermittent,
  };
  const padraoRaw =
    painPresence === "SIM" ? firstMatchLabel(haystack, patternMap) : null;
  const padrao = padraoRaw ?? (painPresence === "SIM" ? "desconhecido" : null);

  let irradiacao: string | null = null;
  let irradiacaoFound = false;
  if (painPresence === "SIM") {
    if (f.radiation.some((t) => termMatches(haystack, t))) {
      const dest = collectMatches(haystack, flattenLocations()).filter(
        (loc) => !locs.includes(loc),
      );
      irradiacao = dest.length
        ? `presente → ${dest.slice(0, 3).join(", ")}`
        : "presente";
      irradiacaoFound = true;
    } else {
      irradiacao = "desconhecida";
    }
  }

  const sintomas =
    painPresence === "SIM"
      ? collectMatches(haystack, f.associated_symptoms)
      : [];
  const melhoraList =
    painPresence === "SIM" ? collectMatches(haystack, f.relief) : [];
  const pioraList =
    painPresence === "SIM" ? collectMatches(haystack, f.aggravation) : [];

  let episodios: string | null = null;
  let episodiosFound = false;
  if (painPresence === "SIM") {
    if (f.previous_episodes.some((t) => termMatches(haystack, t))) {
      episodios = "sim";
      episodiosFound = true;
    } else {
      episodios = "desconhecido";
    }
  }

  const responseMap = {
    melhora: f.analgesic_response.improved,
    parcial: f.analgesic_response.partial,
    "sem melhora": f.analgesic_response.none,
  };
  const respostaRaw =
    painPresence === "SIM" ? firstMatchLabel(haystack, responseMap) : null;
  const resposta =
    respostaRaw ?? (painPresence === "SIM" ? "desconhecido" : null);

  const attributes: S1Attribute[] = [
    attr("Dor", true, painPresence),
    attr("Início", Boolean(inicioRaw), inicio),
    attr("Localização", Boolean(localizacao), localizacao),
    attr("Tempo", Boolean(tempo), tempo),
    attr("Padrão", Boolean(padraoRaw), padrao),
    attr("Irradiação", irradiacaoFound, irradiacao),
    attr(
      "Sintomas associados",
      sintomas.length > 0,
      sintomas.length ? sintomas.join(", ") : null,
    ),
    attr(
      "Fatores de melhora",
      melhoraList.length > 0,
      melhoraList.length ? melhoraList.join(", ") : null,
    ),
    attr(
      "Fatores de piora",
      pioraList.length > 0,
      pioraList.length ? pioraList.join(", ") : null,
    ),
    attr("Episódios prévios", episodiosFound, episodios),
    attr("Resposta aos analgésicos", Boolean(respostaRaw), resposta),
  ];

  const completeness = attributes.map((a) => ({
    key: a.key,
    found:
      a.key === "Dor"
        ? painPresence !== "INDETERMINADO"
        : painPresence === "NÃO"
          ? true
          : a.found &&
            a.value !== "desconhecido" &&
            a.value !== "desconhecida",
  }));

  const missingBlocks: string[] = [];
  if (painPresence === "SIM") {
    for (const item of completeness) {
      if (item.key === "Dor" || item.found) continue;
      const example = MISSING_EXAMPLES[item.key];
      if (!example) continue;
      missingBlocks.push(`• ${item.key}\nEx.: "${example}"`);
    }
  } else if (painPresence === "INDETERMINADO") {
    missingBlocks.push(
      `• Dor\nEx.: "Paciente refere dor torácica há 2 horas."`,
    );
  }

  const applicable = completeness.filter((c) =>
    painPresence === "NÃO" ? c.key === "Dor" : true,
  );
  const foundCount = applicable.filter((c) => c.found).length;
  const ratio = applicable.length === 0 ? 0 : foundCount / applicable.length;
  const panda93 = Math.max(
    0,
    Math.min(PANDA93_MAX, toPanda93(ratio * 100)),
  );
  const classified = classifyPanda93(panda93);

  return {
    panda93,
    band: toBand(classified.band),
    bandLabel: classified.label,
    privacyRedactions: changes,
    law: LAW,
    sourcePack: `${S1_DB.module} v${S1_DB.version}`,
    painPresence,
    scopeNote: note,
    attributes,
    completeness,
    missingBlocks,
  };
}
