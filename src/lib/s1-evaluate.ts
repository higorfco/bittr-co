import s1Pack from "@/data/s1/s1_bc_pack.json";
import { classifyPanda93, PANDA93_MAX, toPanda93 } from "./panda93";
import { normalize, termMatches } from "./terminologia";
import { blurPersonalData } from "./privacy/blur";
import type { CiqBand } from "./types";

type CriterionTier = "CORE" | "EXPECTED" | "CONDITIONAL" | "OPTIONAL" | "NOT_APPLICABLE";

type BankCriterion = {
  id: string;
  label: string;
  tier: CriterionTier | string;
  terms: string[];
};

type Bank = {
  id: string;
  file: string;
  label: string;
  fallback: boolean;
  generic: boolean;
  routing_terms: string[];
  routing_norm: string[];
  criteria: BankCriterion[];
  negation_markers: string[];
  vague_markers: string[];
  safety_terms: string[];
};

type S1Pack = {
  v: string;
  mode: string;
  law: string;
  bank_count: number;
  banks: Bank[];
};

const PACK = s1Pack as S1Pack;

/** Lei de funcionamento: atração semântica contextual + análise crítica. */
PACK.law =
  "Seleção de BC por atração semântica e coerência clínica (QD/QP/HMA) → análise crítica contextual";

/** Sinônimos de roteamento complementares por id de BC (sem inventar diagnóstico). */
const ROUTING_ALIASES: Record<string, string[]> = {
  dor_toracica: [
    "dor torácica",
    "dor toracica",
    "dor no peito",
    "dor no tórax",
    "dor no torax",
    "precordialgia",
    "aperto no peito",
  ],
  dor_abdominal: [
    "dor abdominal",
    "dor na barriga",
    "dor no abdômen",
    "dor no abdomen",
    "dor no abdome",
    "dor epigástrica",
    "dor epigastrica",
    "dor pélvica",
    "dor pelvica",
    "hipogástrio",
    "hipogastrio",
  ],
  cefaleia: ["cefaleia", "dor de cabeça", "dor de cabeca", "dor na cabeça", "dor na cabeca"],
  dispneia_dificuldade_respiratoria: [
    "dispneia",
    "falta de ar",
    "dificuldade respiratória",
    "dificuldade respiratoria",
    "cansaço para respirar",
    "cansaco para respirar",
  ],
  "síncope": ["síncope", "sincope", "desmaio", "apagou", "perdeu a consciência", "perdeu a consciencia"],
  nauseas_vomitos: ["náusea", "nausea", "vômito", "vomito", "vômitos", "vomitos", "enjoo"],
  febre_sindrome_febril: ["febre", "febril", "hipertermia", "estado febril"],
  sintomas_urinarios: ["disúria", "disuria", "ardência para urinar", "ardencia para urinar", "polaciúria", "polaciuria", "hematúria", "hematuria"],
  sintomas_genitais_pelvicos: ["sangramento vaginal", "corrimento", "dor pélvica", "dor pelvica"],
  tosse_sintomas_respiratorios: ["tosse", "expectoração", "expectoracao", "chiado"],
  vertigem_tontura_desequilibrio: ["vertigem", "tontura", "desequilíbrio", "desequilibrio", "labirintite"],
  palpitacoes_ritmo_cardiaco: ["palpitação", "palpitacao", "palpitações", "palpitacoes", "coração disparado", "coracao disparado"],
  convulsao: ["convulsão", "convulsao", "crise convulsiva", "abalo", "tonico-clonico"],
  reacao_alergica_anafilaxia: ["alergia", "anafilaxia", "urticária", "urticaria", "angioedema", "inchaço de língua", "inchaco de lingua"],
  edema_analise_clinica: ["edema", "inchaço", "inchaco", "inchado"],
  manifestacoes_cutaneas: ["rash", "erupção", "erupcao", "lesão de pele", "lesao de pele", "manchas na pele", "prurido"],
  manifestacoes_hemorragicas: ["sangramento", "hemorragia", "hematêmese", "hematemese", "melena", "epistaxe"],
  dor_lombar_flanco: ["dor lombar", "lombalgia", "dor no flanco", "dor nas costas"],
  dor_alteracao_musculoesqueletica: ["dor muscular", "dor articular", "dor no joelho", "dor no ombro", "mialgia"],
  diarreia_alteracao_habito_intestinal: ["diarreia", "diarréia", "fezes líquidas", "fezes liquidas", "evacuações", "evacuacoes"],
  disfagia_odinofagia_degluticao: ["disfagia", "odinofagia", "dor ao engolir", "dificuldade para engolir"],
  alteracao_nivel_consciencia_confusao_mental: [
    "confusão",
    "confusao",
    "rebaixamento",
    "sonolento",
    "desorientado",
    "alteração do nível",
    "alteracao do nivel",
  ],
  intoxicacao_exposicao_overdose: ["intoxicação", "intoxicacao", "overdose", "ingestão de", "ingestao de", "envenenamento"],
};

const SECTION_MARKERS = {
  start: [
    "queixa principal",
    "queixa e duração",
    "queixa e duracao",
    "qp:",
    "qd:",
    "hma:",
    "hpma:",
    "história da moléstia atual",
    "historia da molestia atual",
    "história da doença atual",
    "historia da doenca atual",
  ],
  stop: [
    "antecedentes pessoais",
    "antecedentes familiares",
    "medicações em uso",
    "medicacoes em uso",
    "alergias",
    "exame físico",
    "exame fisico",
    "resultado de exames",
    "hipótese diagnóstica",
    "hipotese diagnostica",
    "conduta",
    "ap:",
    "af:",
    "muc:",
  ],
};

const TIER_WEIGHT: Record<string, number> = {
  CORE: 3,
  EXPECTED: 2,
  CONDITIONAL: 2,
  OPTIONAL: 0.5,
  NOT_APPLICABLE: 0,
};

const QUALITY_COEF: Record<string, number> = {
  PRESENTE_ADEQUADO: 1,
  PRESENTE_PARCIAL: 0.6,
  PRESENTE_VAGO: 0.4,
  PRESENTE_AMBIGUO: 0.3,
  PRESENTE_CONTRADITORIO: 0.1,
  AUSENTE_RELEVANTE: 0,
  NEGATIVA_EXPLICITA: 1,
  CONDICIONAL_NAO_ATIVADO: 0,
  NAO_APLICAVEL: 0,
};

export type FieldStatus =
  | "PRESENTE_ADEQUADO"
  | "PRESENTE_PARCIAL"
  | "PRESENTE_VAGO"
  | "PRESENTE_AMBIGUO"
  | "PRESENTE_CONTRADITORIO"
  | "AUSENTE_RELEVANTE"
  | "CONDICIONAL_NAO_ATIVADO"
  | "NAO_APLICAVEL"
  | "NEGATIVA_EXPLICITA";

export type S1CriterionResult = {
  id: string;
  label: string;
  bank: string;
  tier: string;
  status: FieldStatus;
  weight: number;
  evidence?: string;
};

export type AttractionRole =
  | "DOMINANTE"
  | "SECUNDÁRIO"
  | "TERCIÁRIO"
  | "FRACO"
  | "INCIDENTAL"
  | "INCOMPATÍVEL";

export type S1BankAttraction = {
  id: string;
  file: string;
  label: string;
  /** Coeficiente de atração semântica 0–1 */
  coeficiente: number;
  role: AttractionRole;
  evidencias_favoraveis: string[];
  evidencias_conflitantes: string[];
};

export type S1Result = {
  panda93: number;
  band: CiqBand;
  bandLabel: string;
  privacyRedactions: number;
  law: string;
  sourcePack: string;
  scopeNote: string;
  routing: {
    queixa_nuclear: string;
    queixa_principal_identificada: string;
    conceitos_secundarios: string[];
    json_primario: string;
    json_secundario: string;
    json_terciario: string;
    json_secundarios: string[];
    json_sugerido_auto: string;
    override_manual: boolean;
    arquivos_descartados_relevantes: string[];
    confianca: number;
    confianca_label: "MUITO ALTA" | "ALTA" | "MODERADA" | "BAIXA" | "INSUFICIENTE";
    margem_dominancia: number;
    classificacao_insegura: boolean;
    motivo_selecao: string;
    atracoes: S1BankAttraction[];
  };
  atracoes: S1BankAttraction[];
  informacoes_presentes: string[];
  informacoes_parciais: string[];
  informacoes_vagas: string[];
  ambiguidades: string[];
  contradicoes: string[];
  informacoes_ausentes_relevantes: string[];
  campos_condicionais_nao_ativados: string[];
  campos_nao_aplicaveis: string[];
  negativas_pertinentes_documentadas: string[];
  pontos_de_melhoria_prioritarios: Array<{
    nivel: "CRÍTICO" | "ALTO" | "MODERADO" | "BAIXO";
    texto: string;
  }>;
  avaliacao: {
    completude: number;
    clareza: number;
    relevancia: number;
    coerencia: number;
    seguranca_documental: number;
    score_global: number;
  };
  criteria: S1CriterionResult[];
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

function findEarliest(haystack: string, markers: string[]): number {
  let best = -1;
  for (const m of markers) {
    const n = normalize(m);
    const idx = haystack.indexOf(n);
    if (idx >= 0 && (best < 0 || idx < best)) best = idx;
  }
  return best;
}

function extractScope(text: string): { scope: string; note: string } {
  const haystack = normalize(text.trim());
  if (!haystack) return { scope: "", note: "Texto vazio." };
  const start = findEarliest(haystack, SECTION_MARKERS.start);
  if (start < 0) {
    return {
      scope: haystack,
      note: "Sem marcadores explícitos de QD/QP/HMA — analisado o texto integral (escopo presumido).",
    };
  }
  let end = haystack.length;
  for (const stop of SECTION_MARKERS.stop) {
    const n = normalize(stop);
    const idx = haystack.indexOf(n, start + 1);
    if (idx >= 0 && idx < end) end = idx;
  }
  return {
    scope: haystack.slice(start, end).trim() || haystack,
    note: "Análise restrita a QD/QP/HMA (HPMA).",
  };
}

function countMatches(haystack: string, terms: string[]): { count: number; hits: string[] } {
  const hits: string[] = [];
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    if (!term || term.length < 2) continue;
    if (termMatches(haystack, term)) {
      const n = normalize(term);
      if (!hits.some((h) => normalize(h) === n)) hits.push(term);
    }
  }
  return { count: hits.length, hits };
}

function nearNegation(haystack: string, term: string, markers: string[]): boolean {
  const nTerm = normalize(term);
  const idx = haystack.indexOf(nTerm);
  if (idx < 0) return false;
  const window = haystack.slice(Math.max(0, idx - 36), idx + nTerm.length + 12);
  return markers.some((m) => termMatches(window, m));
}

function scoreBankAttraction(
  haystack: string,
  bank: Bank,
): {
  score: number;
  favoraveis: string[];
  conflitantes: string[];
} {
  const alias = ROUTING_ALIASES[bank.id] ?? [];
  const routing = [...bank.routing_terms, ...alias];
  const criterionTerms = bank.criteria.flatMap((c) => c.terms).slice(0, 80);
  const allTerms = [...routing, ...criterionTerms];

  const favoraveis: string[] = [];
  const conflitantes: string[] = [];
  let L = 0;
  let S = 0;
  let C = 0;
  let D = 0;
  let A = 0;
  let P = 0;
  let N = 0;
  let I = 0;

  const { hits: routingHits } = countMatches(haystack, routing);
  for (const hit of routingHits) {
    if (nearNegation(haystack, hit, bank.negation_markers)) {
      conflitantes.push(`negado: ${hit}`);
      N += 0.22;
      continue;
    }
    favoraveis.push(hit);
    const spec = Math.min(1, normalize(hit).length / 16);
    L += 0.12 + spec * 0.1;
    S += 0.14 + spec * 0.08;
    const idx = haystack.indexOf(normalize(hit));
    const early = 1 - Math.min(1, Math.max(0, idx) / Math.max(90, haystack.length));
    C += early * 0.18;
  }

  const { hits: densHits } = countMatches(haystack, criterionTerms);
  const positiveDens = densHits.filter(
    (h) => !nearNegation(haystack, h, bank.negation_markers),
  );
  D += Math.min(0.35, positiveDens.length * 0.045);
  for (const h of positiveDens.slice(0, 6)) {
    if (!favoraveis.includes(h)) favoraveis.push(h);
  }

  // Anatomical / semiologic coherence via overlapping location-like terms
  const anatHints = [
    "tórax",
    "torax",
    "peito",
    "abdome",
    "abdomen",
    "cabeça",
    "cabeca",
    "lombar",
    "flanco",
    "pelve",
    "urin",
    "dispne",
    "falta de ar",
  ];
  const anatInText = anatHints.filter((t) => termMatches(haystack, t));
  const anatInBank = anatHints.filter((t) =>
    allTerms.some((bt) => normalize(bt).includes(normalize(t))),
  );
  const anatOverlap = anatInText.filter((t) =>
    anatInBank.some((b) => normalize(b) === normalize(t)),
  ).length;
  A += Math.min(0.18, anatOverlap * 0.06);

  // Context pertinence: QD/QP markers near hits
  if (
    termMatches(haystack, "queixa") ||
    termMatches(haystack, "hpma") ||
    termMatches(haystack, "hma") ||
    termMatches(haystack, "qd")
  ) {
    P += routingHits.length > 0 ? 0.12 : 0.02;
  } else {
    P += routingHits.length > 0 ? 0.08 : 0;
  }

  // Incidental single weak token
  if (routingHits.length === 1 && normalize(routingHits[0] || "").length < 6) {
    I += 0.18;
  }
  if (bank.generic) I += 0.12;
  if (bank.fallback) I += 0.2;

  // No positive evidence
  if (favoraveis.length === 0 && conflitantes.length === 0) {
    return { score: 0, favoraveis, conflitantes };
  }

  // SCORE = L + S + C + D + A + P − N − I  (normalized)
  const raw = L + S + C + D + A + P - N - I;
  const score = Math.max(0, Math.min(1, raw));
  return {
    score,
    favoraveis: favoraveis.slice(0, 8),
    conflitantes: conflitantes.slice(0, 6),
  };
}

function confidenceLabel(
  score: number,
  margem: number,
): "MUITO ALTA" | "ALTA" | "MODERADA" | "BAIXA" | "INSUFICIENTE" {
  if (score < 0.22) return "INSUFICIENTE";
  if (score >= 0.85 && margem >= 0.12) return "MUITO ALTA";
  if (score >= 0.7 && margem >= 0.08) return "ALTA";
  if (score >= 0.5) return "MODERADA";
  if (score >= 0.22) return "BAIXA";
  return "INSUFICIENTE";
}

function roleForRank(
  index: number,
  score: number,
  dominante: number,
): AttractionRole {
  if (score < 0.08) return "INCOMPATÍVEL";
  if (score < 0.18) return "INCIDENTAL";
  if (index === 0 && score >= 0.22) return "DOMINANTE";
  if (index === 1 && score >= 0.22 && score >= dominante * 0.45) return "SECUNDÁRIO";
  if (index === 2 && score >= 0.2 && score >= dominante * 0.35) return "TERCIÁRIO";
  if (score >= 0.18) return "FRACO";
  return "INCIDENTAL";
}

/** Calcula atração semântica de todos os BCs para o texto. */
export function computeBankAttractions(content: string): S1BankAttraction[] {
  const haystack = normalize(extractScope(blurPersonalData(content.trim()).sanitized).scope);
  const scored = PACK.banks.map((bank) => {
    const { score, favoraveis, conflitantes } = scoreBankAttraction(haystack, bank);
    return { bank, score, favoraveis, conflitantes };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  return scored.map((s, idx) => ({
    id: s.bank.id,
    file: s.bank.file,
    label: s.bank.label,
    coeficiente: Number(s.score.toFixed(3)),
    role: roleForRank(idx, s.score, top),
    evidencias_favoraveis: s.favoraveis,
    evidencias_conflitantes: s.conflitantes,
  }));
}

function evaluateCriterion(
  haystack: string,
  criterion: BankCriterion,
  bank: Bank,
  bankRole: "primary" | "secondary" | "tertiary",
): S1CriterionResult {
  let tier = String(criterion.tier || "EXPECTED");
  if (bankRole === "secondary" && tier === "CORE") tier = "EXPECTED";
  if (bankRole === "secondary" && tier === "EXPECTED") tier = "OPTIONAL";
  if (bankRole === "tertiary") {
    if (tier === "CORE") tier = "OPTIONAL";
    else if (tier === "EXPECTED") tier = "OPTIONAL";
  }

  if (tier === "CONDITIONAL") {
    const trigger = countMatches(haystack, criterion.terms).count > 0;
    if (!trigger) {
      return {
        id: criterion.id,
        label: criterion.label,
        bank: bank.file,
        tier,
        status: "CONDICIONAL_NAO_ATIVADO",
        weight: 0,
      };
    }
  }

  const seeds =
    criterion.terms.length > 0
      ? criterion.terms
      : [criterion.label, criterion.id.replace(/_/g, " ")];
  const { count, hits } = countMatches(haystack, seeds);
  const vagueHit = bank.vague_markers.some((v) => termMatches(haystack, v));
  const negated = hits.some((h) =>
    nearNegation(haystack, h, bank.negation_markers),
  );

  if (negated) {
    return {
      id: criterion.id,
      label: criterion.label,
      bank: bank.file,
      tier,
      status: "NEGATIVA_EXPLICITA",
      weight: TIER_WEIGHT[tier] ?? 1,
      evidence: hits[0],
    };
  }

  if (count === 0) {
    if (tier === "OPTIONAL" || bankRole !== "primary") {
      return {
        id: criterion.id,
        label: criterion.label,
        bank: bank.file,
        tier,
        status: "NAO_APLICAVEL",
        weight: 0,
      };
    }
    return {
      id: criterion.id,
      label: criterion.label,
      bank: bank.file,
      tier,
      status: "AUSENTE_RELEVANTE",
      weight: TIER_WEIGHT[tier] ?? 1,
    };
  }

  let status: FieldStatus = "PRESENTE_ADEQUADO";
  if (vagueHit && count <= 1) status = "PRESENTE_VAGO";
  else if (count === 1) status = "PRESENTE_PARCIAL";

  return {
    id: criterion.id,
    label: criterion.label,
    bank: bank.file,
    tier,
    status,
    weight: TIER_WEIGHT[tier] ?? 1,
    evidence: hits.slice(0, 3).join(", "),
  };
}

function detectContradictions(haystack: string): string[] {
  const out: string[] = [];
  if (
    termMatches(haystack, "hoje") &&
    (termMatches(haystack, "há três dias") ||
      termMatches(haystack, "ha tres dias") ||
      termMatches(haystack, "há 3 dias") ||
      termMatches(haystack, "ha 3 dias"))
  ) {
    out.push('Possível contradição temporal: menção a "hoje" e duração em dias.');
  }
  if (
    (termMatches(haystack, "contínua") || termMatches(haystack, "continua")) &&
    (termMatches(haystack, "uma vez por semana") ||
      termMatches(haystack, "intermitente"))
  ) {
    out.push("Possível contradição de padrão: contínua vs intermitente/episódica.");
  }
  if (
    (termMatches(haystack, "nega vômitos") ||
      termMatches(haystack, "nega vomitos") ||
      termMatches(haystack, "sem vômitos") ||
      termMatches(haystack, "sem vomitos")) &&
    (termMatches(haystack, "episódios de vômito") ||
      termMatches(haystack, "episodios de vomito") ||
      /\b\d+\s+episodios?\s+de\s+vomit/i.test(haystack))
  ) {
    out.push("Contradição: nega vômitos e descreve episódios de vômito.");
  }
  return out;
}

function dedupeCriteria(items: S1CriterionResult[]): S1CriterionResult[] {
  const map = new Map<string, S1CriterionResult>();
  for (const item of items) {
    const key = normalize(item.id) || normalize(item.label);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    // Keep the better-documented / higher-weight instance
    const prevScore = (QUALITY_COEF[prev.status] ?? 0) * prev.weight;
    const nextScore = (QUALITY_COEF[item.status] ?? 0) * item.weight;
    if (nextScore > prevScore) map.set(key, item);
    else if (
      prev.status === "AUSENTE_RELEVANTE" &&
      item.status !== "AUSENTE_RELEVANTE" &&
      item.status !== "NAO_APLICAVEL"
    ) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function improvementLevel(
  item: S1CriterionResult,
): "CRÍTICO" | "ALTO" | "MODERADO" | "BAIXO" {
  if (item.tier === "CORE") return "CRÍTICO";
  if (item.tier === "EXPECTED") return "ALTO";
  if (item.tier === "CONDITIONAL") return "MODERADO";
  return "BAIXO";
}

export type S1BankOption = {
  id: string;
  file: string;
  label: string;
  fallback: boolean;
  generic: boolean;
};

/** Catálogo dinâmico dos BCs disponíveis para consulta/override manual. */
export function listS1Banks(): S1BankOption[] {
  return PACK.banks
    .map((b) => ({
      id: b.id,
      file: b.file,
      label: b.label,
      fallback: b.fallback,
      generic: b.generic,
    }))
    .sort((a, b) => a.file.localeCompare(b.file, "pt"));
}

export type S1EvaluateOptions = {
  primaryFile?: string | null;
  secondaryFile?: string | null;
  tertiaryFile?: string | null;
};

function findBank(fileOrId: string | null | undefined): Bank | undefined {
  if (!fileOrId?.trim()) return undefined;
  const key = fileOrId.trim();
  return PACK.banks.find((b) => b.file === key || b.id === key);
}

/** S1 — análise crítica contextual QD/QP/HMA com atração semântica entre BCs. */
export function evaluatePainS1(
  content: string,
  options: S1EvaluateOptions = {},
): S1Result {
  const { sanitized, changes } = blurPersonalData(content.trim());
  const { scope, note } = extractScope(sanitized);
  const haystack = normalize(scope);

  const atracoes = computeBankAttractions(content);
  const scored = atracoes
    .map((a) => ({
      attraction: a,
      bank: PACK.banks.find((b) => b.file === a.file)!,
    }))
    .filter((s) => Boolean(s.bank));

  const top = scored[0];
  const second = scored[1];
  const third = scored[2];
  const primaryScore = top?.attraction.coeficiente ?? 0;
  const margem = Number(
    Math.max(0, primaryScore - (second?.attraction.coeficiente ?? 0)).toFixed(3),
  );

  const fallback =
    PACK.banks.find((b) => b.fallback) ??
    PACK.banks.find((b) => b.id.includes("informacao_insuficiente"));
  const genericFallback = PACK.banks.find((b) =>
    b.id.includes("queixa_inespecifica"),
  );

  let primary = top?.bank;
  let secondaryBank: Bank | undefined =
    second && second.attraction.role === "SECUNDÁRIO" ? second.bank : undefined;
  let tertiaryBank: Bank | undefined =
    third && third.attraction.role === "TERCIÁRIO" ? third.bank : undefined;
  let confidence = primaryScore;
  let classificacaoInsegura = false;
  let autoSuggested = primary?.file ?? "";

  if (!primary || primaryScore < 0.22) {
    primary = fallback ?? genericFallback ?? top?.bank;
    confidence = Math.min(primaryScore, 0.35);
    classificacaoInsegura = true;
    secondaryBank = undefined;
    tertiaryBank = undefined;
    autoSuggested = primary?.file ?? "";
  } else if (primary.generic && primaryScore < 0.45) {
    const specific = scored.find(
      (s) => !s.bank.generic && !s.bank.fallback && s.attraction.coeficiente >= 0.22,
    );
    if (specific) {
      primary = specific.bank;
      confidence = specific.attraction.coeficiente;
      autoSuggested = primary.file;
    }
  } else {
    autoSuggested = primary.file;
  }

  const manualPrimary = findBank(options.primaryFile);
  const manualSecondary = findBank(options.secondaryFile);
  const manualTertiary = findBank(options.tertiaryFile);
  const manualOverride = Boolean(
    manualPrimary || manualSecondary || manualTertiary,
  );

  if (manualPrimary) {
    primary = manualPrimary;
    confidence = Math.max(
      atracoes.find((a) => a.file === manualPrimary.file)?.coeficiente ?? 0,
      0.55,
    );
    classificacaoInsegura = false;
  }
  if (manualSecondary && manualSecondary.file !== primary?.file) {
    secondaryBank = manualSecondary;
  } else if (manualPrimary && !options.secondaryFile) {
    // keep auto secondary if distinct
    secondaryBank =
      secondaryBank && secondaryBank.file !== primary?.file
        ? secondaryBank
        : undefined;
  }
  if (
    manualTertiary &&
    manualTertiary.file !== primary?.file &&
    manualTertiary.file !== secondaryBank?.file
  ) {
    tertiaryBank = manualTertiary;
  } else if (manualPrimary && !options.tertiaryFile) {
    tertiaryBank =
      tertiaryBank &&
      tertiaryBank.file !== primary?.file &&
      tertiaryBank.file !== secondaryBank?.file
        ? tertiaryBank
        : undefined;
  }

  // Deduplicate roles
  if (secondaryBank?.file === primary?.file) secondaryBank = undefined;
  if (
    tertiaryBank?.file === primary?.file ||
    tertiaryBank?.file === secondaryBank?.file
  ) {
    tertiaryBank = undefined;
  }

  const confLabel = confidenceLabel(confidence, margem);

  const discarded = atracoes
    .filter(
      (a) =>
        a.file !== primary?.file &&
        a.file !== secondaryBank?.file &&
        a.file !== tertiaryBank?.file &&
        (a.role === "FRACO" ||
          a.role === "INCIDENTAL" ||
          a.role === "INCOMPATÍVEL") &&
        a.coeficiente >= 0.08,
    )
    .slice(0, 8)
    .map((a) => `${a.file} (${a.role}; coef=${a.coeficiente.toFixed(2)})`);

  const motivo = manualOverride
    ? `Aplicação manual P/S/T. Sugestão automática (atração): ${autoSuggested || "n/a"} (coef ${primaryScore.toFixed(2)}, margem ${margem.toFixed(2)}).`
    : classificacaoInsegura
      ? `INFORMAÇÃO INSUFICIENTE PARA CLASSIFICAÇÃO — fallback ${primary?.file ?? "n/a"}.`
      : `BANCO DOMINANTE por atração semântica: ${primary?.file} (coef ${confidence.toFixed(2)}, margem ${margem.toFixed(2)}, confiança ${confLabel}).`;

  const queixaNuclear =
    top?.attraction.evidencias_favoraveis.slice(0, 4).join(" · ") ||
    primary?.label ||
    "";

  // Build contextual schema from primary + secondary + tertiary
  const rawCriteria: S1CriterionResult[] = [];
  if (primary) {
    for (const c of primary.criteria) {
      rawCriteria.push(evaluateCriterion(haystack, c, primary, "primary"));
    }
  }
  if (secondaryBank) {
    for (const c of secondaryBank.criteria.slice(0, 10)) {
      rawCriteria.push(
        evaluateCriterion(haystack, c, secondaryBank, "secondary"),
      );
    }
  }
  if (tertiaryBank) {
    for (const c of tertiaryBank.criteria.slice(0, 6)) {
      rawCriteria.push(
        evaluateCriterion(haystack, c, tertiaryBank, "tertiary"),
      );
    }
  }

  const criteria = dedupeCriteria(rawCriteria);
  const contradictions = detectContradictions(haystack);

  // Safety documentation dimension
  const appliedSecondary = [secondaryBank, tertiaryBank].filter(
    Boolean,
  ) as Bank[];
  const safetyTerms = [
    ...(primary?.safety_terms ?? []),
    ...appliedSecondary.flatMap((b) => b.safety_terms),
  ];
  const safetyHits = countMatches(haystack, safetyTerms).count;
  const safetyGap =
    safetyTerms.length > 0 && safetyHits === 0 && !classificacaoInsegura;

  const applicable = criteria.filter(
    (c) =>
      c.status !== "NAO_APLICAVEL" &&
      c.status !== "CONDICIONAL_NAO_ATIVADO" &&
      c.weight > 0,
  );
  const weightedDoc = applicable.reduce(
    (acc, c) => acc + c.weight * (QUALITY_COEF[c.status] ?? 0),
    0,
  );
  const weightedMax = applicable.reduce((acc, c) => acc + c.weight, 0) || 1;
  const completude = Math.round((weightedDoc / weightedMax) * 100);

  const present = applicable.filter((c) =>
    c.status.startsWith("PRESENTE") || c.status === "NEGATIVA_EXPLICITA",
  );
  const clareza = Math.round(
    (present.filter((c) => c.status === "PRESENTE_ADEQUADO" || c.status === "NEGATIVA_EXPLICITA")
      .length /
      Math.max(1, present.length || applicable.length)) *
      100,
  );
  const relevancia = Math.round(
    Math.min(
      100,
      (1 - criteria.filter((c) => c.status === "NAO_APLICAVEL").length / Math.max(1, criteria.length)) *
        100 *
        (confidence || 0.4),
    ),
  );
  const coerencia = Math.max(
    0,
    Math.round(100 - contradictions.length * 25 - (criteria.filter((c) => c.status === "PRESENTE_AMBIGUO").length * 8)),
  );
  const seguranca = Math.max(
    0,
    Math.round(
      100 -
        (safetyGap ? 28 : 0) -
        criteria.filter((c) => c.status === "AUSENTE_RELEVANTE" && c.tier === "CORE").length * 10,
    ),
  );

  const scoreGlobal = Math.round(
    completude * 0.35 +
      clareza * 0.15 +
      relevancia * 0.15 +
      coerencia * 0.15 +
      seguranca * 0.2,
  );

  const panda93 = Math.max(0, Math.min(PANDA93_MAX, toPanda93(scoreGlobal)));
  const classified = classifyPanda93(panda93);

  const informacoes_presentes = criteria
    .filter((c) => c.status === "PRESENTE_ADEQUADO" || c.status === "NEGATIVA_EXPLICITA")
    .map((c) => `${c.label}${c.evidence ? ` (${c.evidence})` : ""}`);
  const informacoes_parciais = criteria
    .filter((c) => c.status === "PRESENTE_PARCIAL")
    .map((c) => c.label);
  const informacoes_vagas = criteria
    .filter((c) => c.status === "PRESENTE_VAGO")
    .map((c) => c.label);
  const ambiguidades = criteria
    .filter((c) => c.status === "PRESENTE_AMBIGUO")
    .map((c) => c.label);
  const ausentes = criteria
    .filter((c) => c.status === "AUSENTE_RELEVANTE")
    .map((c) => `${c.label} [${c.tier}]`);
  const condicionais = criteria
    .filter((c) => c.status === "CONDICIONAL_NAO_ATIVADO")
    .map((c) => c.label);
  const naoAplicaveis = criteria
    .filter((c) => c.status === "NAO_APLICAVEL")
    .map((c) => c.label);
  const negativas = criteria
    .filter((c) => c.status === "NEGATIVA_EXPLICITA")
    .map((c) => c.label);

  const melhorias = criteria
    .filter((c) => c.status === "AUSENTE_RELEVANTE" || c.status === "PRESENTE_VAGO" || c.status === "PRESENTE_PARCIAL")
    .map((c) => ({
      nivel: improvementLevel(c),
      texto:
        c.status === "AUSENTE_RELEVANTE"
          ? `Documentar ${c.label.toLowerCase()} (pertinente ao domínio ${c.bank}).`
          : `Melhorar especificidade de ${c.label.toLowerCase()}.`,
    }))
    .sort((a, b) => rankNivel(a.nivel) - rankNivel(b.nivel))
    .slice(0, 8);

  if (safetyGap) {
    melhorias.unshift({
      nivel: "CRÍTICO",
      texto:
        "Registrar presença/ausência explícita de elementos de alerta pertinentes à queixa (sem inferir negatividade).",
    });
  }

  const conceitosSecundarios = [
    secondaryBank?.label,
    tertiaryBank?.label,
  ].filter(Boolean) as string[];

  // Annotate applied roles on attractions copy
  const atracoesOut = atracoes.map((a) => {
    if (a.file === primary?.file) return { ...a, role: "DOMINANTE" as const };
    if (a.file === secondaryBank?.file)
      return { ...a, role: "SECUNDÁRIO" as const };
    if (a.file === tertiaryBank?.file)
      return { ...a, role: "TERCIÁRIO" as const };
    return a;
  });

  return {
    panda93,
    band: toBand(classified.band),
    bandLabel: classified.label,
    privacyRedactions: changes,
    law: PACK.law,
    sourcePack: `S1 BC pack v${PACK.v} (${PACK.bank_count} bancos)`,
    scopeNote: note,
    routing: {
      queixa_nuclear: queixaNuclear,
      queixa_principal_identificada: primary?.label ?? "",
      conceitos_secundarios: conceitosSecundarios,
      json_primario: primary?.file ?? "",
      json_secundario: secondaryBank?.file ?? "",
      json_terciario: tertiaryBank?.file ?? "",
      json_secundarios: [secondaryBank?.file, tertiaryBank?.file].filter(
        Boolean,
      ) as string[],
      json_sugerido_auto: autoSuggested,
      override_manual: manualOverride,
      arquivos_descartados_relevantes: discarded,
      confianca: Number(confidence.toFixed(2)),
      confianca_label: confLabel,
      margem_dominancia: margem,
      classificacao_insegura: classificacaoInsegura,
      motivo_selecao: motivo,
      atracoes: atracoesOut,
    },
    atracoes: atracoesOut,
    informacoes_presentes,
    informacoes_parciais,
    informacoes_vagas,
    ambiguidades,
    contradicoes: contradictions,
    informacoes_ausentes_relevantes: ausentes,
    campos_condicionais_nao_ativados: condicionais,
    campos_nao_aplicaveis: naoAplicaveis,
    negativas_pertinentes_documentadas: negativas,
    pontos_de_melhoria_prioritarios: melhorias,
    avaliacao: {
      completude,
      clareza,
      relevancia,
      coerencia,
      seguranca_documental: seguranca,
      score_global: scoreGlobal,
    },
    criteria,
  };
}

function rankNivel(n: "CRÍTICO" | "ALTO" | "MODERADO" | "BAIXO"): number {
  return { CRÍTICO: 0, ALTO: 1, MODERADO: 2, BAIXO: 3 }[n];
}
