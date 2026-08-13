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

export type S1Result = {
  panda93: number;
  band: CiqBand;
  bandLabel: string;
  privacyRedactions: number;
  law: string;
  sourcePack: string;
  scopeNote: string;
  routing: {
    queixa_principal_identificada: string;
    conceitos_secundarios: string[];
    json_primario: string;
    json_secundarios: string[];
    arquivos_descartados_relevantes: string[];
    confianca: number;
    classificacao_insegura: boolean;
    motivo_selecao: string;
  };
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

function scoreBank(haystack: string, bank: Bank): number {
  const alias = ROUTING_ALIASES[bank.id] ?? [];
  const routing = [...bank.routing_terms, ...alias];
  const { count, hits } = countMatches(haystack, routing);
  if (count === 0) return 0;

  // Prefer longer / more specific hits
  const specificity =
    hits.reduce((acc, h) => acc + Math.min(1, normalize(h).length / 18), 0) /
    Math.max(1, hits.length);

  let score = Math.min(1, count / 4) * 0.55 + specificity * 0.25;

  // Centrality: early mention boost
  const firstIdx = Math.min(
    ...hits.map((h) => {
      const i = haystack.indexOf(normalize(h));
      return i < 0 ? haystack.length : i;
    }),
  );
  const early = 1 - Math.min(1, firstIdx / Math.max(80, haystack.length));
  score += early * 0.15;

  if (bank.generic) score *= 0.55;
  if (bank.fallback) score *= 0.35;

  // Mild penalty if only very generic single token
  if (count === 1 && normalize(hits[0] || "").length < 6) score *= 0.7;

  return Math.max(0, Math.min(1, score));
}

function classifyApplicability(
  score: number,
  bank: Bank,
  primaryScore: number,
): "PRIMÁRIO" | "SECUNDÁRIO" | "CONDICIONAL" | "NÃO APLICÁVEL" {
  if (bank.fallback) return "NÃO APLICÁVEL";
  if (score < 0.18) return "NÃO APLICÁVEL";
  if (score >= primaryScore - 0.02 && score >= 0.34) return "PRIMÁRIO";
  if (score >= 0.28) return "SECUNDÁRIO";
  if (score >= 0.18) return "CONDICIONAL";
  return "NÃO APLICÁVEL";
}

function evaluateCriterion(
  haystack: string,
  criterion: BankCriterion,
  bank: Bank,
  isPrimary: boolean,
): S1CriterionResult {
  let tier = String(criterion.tier || "EXPECTED");
  // Secondary banks: demote CORE→EXPECTED to avoid checklist blindness across domains
  if (!isPrimary && tier === "CORE") tier = "EXPECTED";
  if (!isPrimary && tier === "EXPECTED") tier = "OPTIONAL";

  // Conditional fields require a trigger term family present
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
  const negated = hits.some((h) => nearNegation(haystack, h, bank.negation_markers));

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
    // Optional absence is not a relevant gap
    if (tier === "OPTIONAL") {
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

/** S1 — análise crítica contextual QD/QP/HMA com routing entre BCs. */
export function evaluatePainS1(content: string): S1Result {
  const { sanitized, changes } = blurPersonalData(content.trim());
  const { scope, note } = extractScope(sanitized);
  const haystack = normalize(scope);

  const scored = PACK.banks
    .map((bank) => ({ bank, score: scoreBank(haystack, bank) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const primaryScore = top?.score ?? 0;
  const fallback =
    PACK.banks.find((b) => b.fallback) ??
    PACK.banks.find((b) => b.id.includes("informacao_insuficiente"));

  let primary = top?.bank;
  let confidence = primaryScore;
  let classificacaoInsegura = false;

  if (!primary || primaryScore < 0.22) {
    primary = fallback ?? top?.bank;
    confidence = Math.min(primaryScore, 0.35);
    classificacaoInsegura = true;
  } else if (primary.generic && primaryScore < 0.45) {
    // Prefer a more specific bank if close
    const specific = scored.find((s) => !s.bank.generic && s.score >= 0.22);
    if (specific) {
      primary = specific.bank;
      confidence = specific.score;
    }
  }

  // Near-tie primary candidates → lower confidence
  const near = scored.filter(
    (s) =>
      !s.bank.generic &&
      s.score >= primaryScore - 0.08 &&
      s.score >= 0.22 &&
      s.bank.file !== primary?.file,
  );
  if (near.length > 0) confidence = Math.min(confidence, 0.62);

  const secondary = scored
    .filter(
      (s) =>
        s.bank.file !== primary?.file &&
        !s.bank.fallback &&
        classifyApplicability(s.score, s.bank, primaryScore) === "SECUNDÁRIO",
    )
    .slice(0, 2)
    .map((s) => s.bank);

  const discarded = scored
    .filter((s) => {
      const cls = classifyApplicability(s.score, s.bank, primaryScore);
      return (
        s.score >= 0.12 &&
        s.bank.file !== primary?.file &&
        !secondary.some((x) => x.file === s.bank.file) &&
        (cls === "NÃO APLICÁVEL" || cls === "CONDICIONAL")
      );
    })
    .slice(0, 6)
    .map(
      (s) =>
        `${s.bank.file} (${clsLabel(classifyApplicability(s.score, s.bank, primaryScore))}; score=${s.score.toFixed(2)})`,
    );

  const motivo = classificacaoInsegura
    ? `CLASSIFICACAO_INSEGURA — correspondência insuficiente; fallback ${primary?.file ?? "n/a"}.`
    : `JSON selecionado: ${primary?.file}. Motivo: maior SCORE_DE_APLICABILIDADE (${confidence.toFixed(2)}) para a queixa dominante inferida do texto.`;

  // Build contextual schema from primary + secondaries
  const rawCriteria: S1CriterionResult[] = [];
  if (primary) {
    for (const c of primary.criteria) {
      rawCriteria.push(evaluateCriterion(haystack, c, primary, true));
    }
  }
  for (const bank of secondary) {
    for (const c of bank.criteria.slice(0, 8)) {
      rawCriteria.push(evaluateCriterion(haystack, c, bank, false));
    }
  }

  const criteria = dedupeCriteria(rawCriteria);
  const contradictions = detectContradictions(haystack);

  // Safety documentation dimension
  const safetyTerms = [
    ...(primary?.safety_terms ?? []),
    ...secondary.flatMap((b) => b.safety_terms),
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

  const conceitosSecundarios = secondary.map((b) => b.label);

  return {
    panda93,
    band: toBand(classified.band),
    bandLabel: classified.label,
    privacyRedactions: changes,
    law: PACK.law,
    sourcePack: `S1 BC pack v${PACK.v} (${PACK.bank_count} bancos)`,
    scopeNote: note,
    routing: {
      queixa_principal_identificada: primary?.label ?? "",
      conceitos_secundarios: conceitosSecundarios,
      json_primario: primary?.file ?? "",
      json_secundarios: secondary.map((b) => b.file),
      arquivos_descartados_relevantes: discarded,
      confianca: Number(confidence.toFixed(2)),
      classificacao_insegura: classificacaoInsegura,
      motivo_selecao: motivo,
    },
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

function clsLabel(
  c: "PRIMÁRIO" | "SECUNDÁRIO" | "CONDICIONAL" | "NÃO APLICÁVEL",
): string {
  return c;
}

function rankNivel(n: "CRÍTICO" | "ALTO" | "MODERADO" | "BAIXO"): number {
  return { CRÍTICO: 0, ALTO: 1, MODERADO: 2, BAIXO: 3 }[n];
}
