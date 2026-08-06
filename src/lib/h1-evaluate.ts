import { classifyCiq, H1_TOPICS } from "./h1-topics";
import type {
  AnamnesisTopic,
  EssentialItem,
  GlobalPenalty,
  H1Result,
  ItemAssessment,
  TopicScore,
} from "./types";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function hasAny(haystack: string, patterns: string[]): boolean {
  return patterns.some((p) => haystack.includes(normalize(p)));
}

function countMatches(haystack: string, patterns: string[]): number {
  return patterns.filter((p) => haystack.includes(normalize(p))).length;
}

function isExplicitDenial(haystack: string, around: string[]): boolean {
  const denial = [
    "nega",
    "sem ",
    "nao possui",
    "não possui",
    "nao usa",
    "não usa",
    "ausente",
    "nao refere",
    "não refere",
    "nada digno",
  ];
  return around.some((term) => {
    const n = normalize(term);
    if (!haystack.includes(n)) return false;
    const idx = haystack.indexOf(n);
    const window = haystack.slice(Math.max(0, idx - 40), idx + n.length + 40);
    return denial.some((d) => window.includes(normalize(d)));
  });
}

function topicMentioned(haystack: string, topic: AnamnesisTopic): boolean {
  return hasAny(haystack, topic.patterns) || topic.essentialItems.some((item) => hasAny(haystack, item.patterns));
}

function isTopicApplicable(haystack: string, topic: AnamnesisTopic): boolean {
  if (!topic.optionallyApplicable) {
    // Core clinical topics remain in denominator if anamnesis-like content exists
    return true;
  }

  if (topic.contextRequiredPatterns && hasAny(haystack, topic.contextRequiredPatterns)) {
    return true;
  }

  // If explicitly present, include; otherwise exclude from denominator
  return hasAny(haystack, topic.patterns);
}

function assessItem(haystack: string, item: EssentialItem): ItemAssessment {
  if (item.notApplicablePatterns && hasAny(haystack, item.notApplicablePatterns)) {
    return { id: item.id, label: item.label, status: "not_applicable" };
  }

  const matched = hasAny(haystack, item.patterns);
  const denied = isExplicitDenial(haystack, item.patterns);

  if (matched || denied) {
    return { id: item.id, label: item.label, status: "informed" };
  }

  return { id: item.id, label: item.label, status: "missing" };
}

function scoreCompleteness(items: ItemAssessment[]): number {
  const applicable = items.filter((i) => i.status !== "not_applicable");
  if (applicable.length === 0) return 50;
  const informed = applicable.filter((i) => i.status === "informed").length;
  return (informed / applicable.length) * 50;
}

function scoreClarity(raw: string, haystack: string, topic: AnamnesisTopic): {
  score: number;
  notes: string[];
} {
  let score = 20;
  const notes: string[] = [];

  const vaguePatterns: Array<{ pattern: string; note: string; penalty: number }> = [
    { pattern: "ha algum tempo", note: "Tempo vago (“há algum tempo”).", penalty: 2 },
    { pattern: "há algum tempo", note: "Tempo vago (“há algum tempo”).", penalty: 2 },
    { pattern: "alguns remedios", note: "Medicações vagas (“alguns remédios”).", penalty: 5 },
    { pattern: "alguns remédios", note: "Medicações vagas (“alguns remédios”).", penalty: 5 },
    { pattern: "alguns medicamentos", note: "Medicações sem nome/dose/frequência.", penalty: 5 },
    { pattern: "febre alta", note: "“Febre alta” sem temperatura ou duração.", penalty: 5 },
    { pattern: "dor frequente", note: "“Dor frequente” sem periodicidade.", penalty: 2 },
    { pattern: "dores", note: "Dor sem especificação suficiente.", penalty: 2 },
    { pattern: "antibiotico", note: "Antibiótico sem nome, dose ou duração.", penalty: 5 },
    { pattern: "antibiótico", note: "Antibiótico sem nome, dose ou duração.", penalty: 5 },
  ];

  for (const item of vaguePatterns) {
    if (raw.toLowerCase().includes(item.pattern) || haystack.includes(normalize(item.pattern))) {
      // Only apply if topic is related or text is general HMA/MUC
      if (
        topic.id === "hma" ||
        topic.id === "muc" ||
        topic.id === "qp_qd" ||
        topic.id === "alergias" ||
        topicMentioned(haystack, topic)
      ) {
        score -= item.penalty;
        notes.push(item.note);
      }
    }
  }

  // Ambiguity: allergy denial + allergic reaction description
  if (
    topic.id === "alergias" &&
    hasAny(haystack, ["nega alerg", "sem alerg"]) &&
    hasAny(haystack, ["reacao alerg", "reação alerg", "urticaria", "urticária", "anafilax"])
  ) {
    score -= 4;
    notes.push("Contradição: nega alergias e descreve reação alérgica.");
  }

  // Chronology issues for HMA
  if (topic.id === "hma") {
    const hasStart = hasAny(haystack, ["inicio", "início", "desde", "há ", "ha "]);
    const hasEvolution = hasAny(haystack, ["evolu", "piorou", "melhorou", "depois"]);
    if (hasStart && !hasEvolution && haystack.length > 200) {
      score -= 3;
      notes.push("Cronologia incompleta na HMA.");
    }
    if (!hasStart && topicMentioned(haystack, topic)) {
      score -= 5;
      notes.push("Cronologia incompreensível ou ausente.");
    }
  }

  // Dose/frequency missing when medications mentioned vaguely
  if (topic.id === "muc" && hasAny(haystack, ["medic", "em uso", "faz uso"])) {
    if (!hasAny(haystack, ["mg", "mcg", "ml", "ui"])) {
      score -= 5;
      notes.push("Ausência de unidade/dose quando necessária.");
    }
    if (!hasAny(haystack, ["vez", "ao dia", "1x", "2x", "12/12", "8/8"])) {
      score -= 5;
      notes.push("Ausência de frequência quando necessária.");
    }
  }

  return { score: Math.max(0, score), notes: [...new Set(notes)] };
}

function scoreRelevance(raw: string, haystack: string): {
  score: number;
  notes: string[];
} {
  let score = 20;
  const notes: string[] = [];

  const words = raw.trim().split(/\s+/).filter(Boolean).length;
  if (words > 700) {
    score -= 5;
    notes.push("Excesso de texto dificulta localizar dados essenciais.");
  } else if (words > 450) {
    score -= 2;
    notes.push("Texto longo com risco de diluir informação importante.");
  }

  // Crude repetition detection: repeated 4+ gram chunks
  const sentences = raw
    .split(/[.!?\n]+/)
    .map((s) => normalize(s).trim())
    .filter((s) => s.length > 25);
  const seen = new Map<string, number>();
  for (const s of sentences) {
    const key = s.slice(0, 60);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const repeats = [...seen.values()].filter((n) => n >= 2).length;
  if (repeats >= 3) {
    score -= 4;
    notes.push("Repetição extensa de trechos semelhantes.");
  } else if (repeats >= 1) {
    score -= 2;
    notes.push("Detalhe redundante detectado.");
  }

  // Admin fluff
  if (hasAny(haystack, ["numero do prontuario", "número do prontuário", "senha do wifi", "protocolo administrativo"])) {
    score -= 3;
    notes.push("Detalhe administrativo sem impacto clínico aparente.");
  }

  return { score: Math.max(0, score), notes };
}

function scoreSafety(haystack: string, topic: AnamnesisTopic, mentioned: boolean): {
  score: number;
  notes: string[];
} {
  const notes: string[] = [];
  if (!topic.redFlagPatterns.length) {
    return { score: 10, notes };
  }

  if (!mentioned) {
    return {
      score: 0,
      notes: [`Sinais de alerta de “${topic.label}” não pesquisados (tópico ausente).`],
    };
  }

  const hits = countMatches(haystack, topic.redFlagPatterns);
  const denialNearFlags =
    hasAny(haystack, ["nega", "sem sinais", "sem alerta", "sem red flag"]) && hits === 0
      ? true
      : isExplicitDenial(haystack, topic.redFlagPatterns);

  if (hits >= 2 || (hits >= 1 && denialNearFlags)) {
    return { score: 10, notes };
  }
  if (hits === 1 || denialNearFlags) {
    return { score: 7, notes: [`Avaliação parcial de sinais de alerta em “${topic.label}”.`] };
  }
  if (hasAny(haystack, ["alerta", "red flag", "sinais de gravidade"])) {
    return { score: 4, notes: [`Avaliação superficial de alertas em “${topic.label}”.`] };
  }

  return {
    score: 0,
    notes: [`Sinais de alerta relevantes não pesquisados em “${topic.label}”.`],
  };
}

function scoreTopic(raw: string, haystack: string, topic: AnamnesisTopic): TopicScore {
  const applicable = isTopicApplicable(haystack, topic);
  if (!applicable) {
    return {
      topicId: topic.id,
      label: topic.label,
      weight: topic.weight,
      applicable: false,
      ciq: 0,
      completeness: 0,
      clarity: 0,
      relevance: 0,
      safety: 0,
      band: "criticamente_incompleto",
      items: [],
    };
  }

  const mentioned = topicMentioned(haystack, topic);
  const items = topic.essentialItems.map((item) => assessItem(haystack, item));

  // If topic never appears, essential items stay missing (except N/A)
  const completeness = mentioned ? scoreCompleteness(items) : 0;
  const clarity = mentioned
    ? scoreClarity(raw, haystack, topic)
    : { score: 0, notes: [`Tópico “${topic.label}” não identificado no texto.`] };
  const relevance = mentioned
    ? scoreRelevance(raw, haystack)
    : { score: 0, notes: [] as string[] };
  // For absent optional-like core topics, relevance should not invent points
  const relevanceScore = mentioned ? relevance.score : 0;
  const safety = scoreSafety(haystack, topic, mentioned);

  // When topic absent, CIQ reflects missing content but safety still counts
  const ciq = Math.max(
    0,
    Math.min(100, Math.round(completeness + clarity.score + relevanceScore + safety.score)),
  );
  const { band } = classifyCiq(ciq);

  return {
    topicId: topic.id,
    label: topic.label,
    weight: topic.weight,
    applicable: true,
    ciq,
    completeness: Math.round(completeness * 10) / 10,
    clarity: clarity.score,
    relevance: relevanceScore,
    safety: safety.score,
    band,
    items,
  };
}

function computePenalties(
  haystack: string,
  topics: TopicScore[],
): GlobalPenalty[] {
  const byId = Object.fromEntries(topics.map((t) => [t.topicId, t]));
  const hasComorbidity = hasAny(haystack, [
    "hipertens",
    "diabetes",
    "asma",
    "dpoc",
    "cardiopat",
    "comorb",
    "insuficiencia",
    "insuficiência",
  ]);
  const likelyMeds =
    hasComorbidity || hasAny(haystack, ["medic", "faz uso", "em uso", "comprimido"]);

  const allergyTopic = byId.alergias;
  const mucTopic = byId.muc;
  const examTopic = byId.exame_fisico;
  const hmaTopic = byId.hma;
  const qpTopic = byId.qp_qd;

  const allergyMissing =
    !allergyTopic ||
    allergyTopic.ciq < 40 ||
    allergyTopic.items.some((i) => i.id === "status" && i.status === "missing");

  const mucMissing =
    likelyMeds &&
    (!mucTopic ||
      mucTopic.ciq < 40 ||
      mucTopic.items.filter((i) => i.status === "missing").length >= 2);

  const vitalsMissing =
    !examTopic ||
    examTopic.items.some((i) => i.id === "sinais_vitais" && i.status === "missing");

  const alertMissing =
    (hmaTopic && hmaTopic.safety <= 4) ||
    (qpTopic && qpTopic.safety <= 4 && hasAny(haystack, ["dor torac", "dor torác", "dispneia", "sincope", "síncope"]));

  const contradiction =
    hasAny(haystack, ["nega alerg"]) &&
    hasAny(haystack, ["reacao alerg", "reação alerg", "urticaria", "urticária"]);

  const chronologyMissing =
    hmaTopic &&
    hmaTopic.items.some((i) => i.id === "cronologia" && i.status === "missing") &&
    hmaTopic.items.some((i) => i.id === "inicio" && i.status === "missing");

  return [
    {
      id: "alergias",
      label: "Ausência de alergias",
      points: 10,
      applied: Boolean(allergyMissing),
    },
    {
      id: "muc",
      label: "Ausência de MUC em paciente com comorbidades ou uso provável de medicamentos",
      points: 10,
      applied: Boolean(mucMissing),
    },
    {
      id: "sinais_vitais",
      label: "Ausência de sinais vitais em atendimento presencial",
      points: 10,
      applied: Boolean(vitalsMissing),
    },
    {
      id: "alerta",
      label: "Ausência de avaliação de sinal de alerta relacionado à queixa",
      points: 15,
      applied: Boolean(alertMissing),
    },
    {
      id: "contradicao",
      label: "Contradição clinicamente relevante",
      points: 10,
      applied: contradiction,
    },
    {
      id: "cronologia",
      label: "Ausência de cronologia mínima na HMA",
      points: 5,
      applied: Boolean(chronologyMissing),
    },
  ];
}

function collectFindings(
  raw: string,
  haystack: string,
  topics: TopicScore[],
  clarityNotes: string[],
  relevanceNotes: string[],
): Pick<H1Result, "missing" | "confusing" | "irrelevant" | "priorities"> {
  const missing: string[] = [];
  for (const topic of topics.filter((t) => t.applicable)) {
    for (const item of topic.items) {
      if (item.status === "missing") {
        missing.push(`${item.label} (${topic.label}).`);
      }
    }
    if (!topicMentioned(haystack, H1_TOPICS.find((t) => t.id === topic.topicId)!)) {
      missing.push(`Registro do tópico “${topic.label}”.`);
    }
  }

  const confusing = [...new Set(clarityNotes)];
  const irrelevant = [...new Set(relevanceNotes)];

  const priorities: string[] = [];
  const byId = Object.fromEntries(topics.map((t) => [t.topicId, t]));
  if ((byId.hma?.safety ?? 10) < 7 || (byId.exame_fisico?.safety ?? 10) < 7) {
    priorities.push("Completar sinais de alerta.");
  }
  if (
    byId.hma?.items.some((i) => i.id === "cronologia" && i.status === "missing") ||
    confusing.some((c) => c.toLowerCase().includes("cronolog"))
  ) {
    priorities.push("Esclarecer a cronologia.");
  }
  if ((byId.muc?.ciq ?? 100) < 75 || (byId.alergias?.ciq ?? 100) < 75) {
    priorities.push("Confirmar medicações e alergias.");
  }
  if (irrelevant.length) {
    priorities.push("Remover redundâncias.");
  }
  if (!priorities.length) {
    priorities.push("Revisar tópicos com menor CIQ e consolidar dados essenciais.");
  }

  return {
    missing: [...new Set(missing)].slice(0, 12),
    confusing: confusing.slice(0, 8),
    irrelevant: irrelevant.slice(0, 8),
    priorities: priorities.slice(0, 6),
  };
}

export function evaluateAnamnesisH1(content: string): H1Result {
  const raw = content.trim();
  const haystack = normalize(raw);

  const clarityNotes: string[] = [];
  const relevanceNotes: string[] = [];

  const topics = H1_TOPICS.map((topic) => {
    const scored = scoreTopic(raw, haystack, topic);
    if (scored.applicable) {
      const clarity = scoreClarity(raw, haystack, topic);
      const relevance = scoreRelevance(raw, haystack);
      clarityNotes.push(...clarity.notes);
      relevanceNotes.push(...relevance.notes);
    }
    return scored;
  });

  const applicable = topics.filter((t) => t.applicable);
  const weightSum = applicable.reduce((acc, t) => acc + t.weight, 0) || 1;
  const weighted = applicable.reduce((acc, t) => acc + t.ciq * t.weight, 0);
  const cgqaBeforePenalties = weighted / weightSum;

  const penalties = computePenalties(haystack, topics);
  const penaltyTotal = penalties.filter((p) => p.applied).reduce((acc, p) => acc + p.points, 0);
  const cgqa = Math.max(0, Math.min(100, Math.round(cgqaBeforePenalties - penaltyTotal)));
  const { band, label } = classifyCiq(cgqa);

  const findings = collectFindings(raw, haystack, topics, clarityNotes, relevanceNotes);

  return {
    cgqa,
    cgqaBeforePenalties: Math.round(cgqaBeforePenalties),
    band,
    bandLabel: label,
    topics: applicable.sort((a, b) => b.weight - a.weight || b.ciq - a.ciq),
    penalties,
    ...findings,
  };
}
