import type { CiqBand, GlobalPenalty, H1Result, ItemAssessment, TopicScore } from "./types";
import {
  classifyScore,
  conceptsById,
  conditionalRedRequirements,
  DOC_BY_DOMAIN,
  DOMAIN_LABELS,
  evaluateRequirement,
  isInformed,
  matchConcept,
  normalize,
  qualityFlags,
  relations,
  resolveDomainRequirements,
  termMatches,
  weights,
} from "./terminologia";

function toCiqBand(band: string): CiqBand {
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

function domainMentioned(haystack: string, domain: string): boolean {
  const docId = DOC_BY_DOMAIN[domain];
  if (docId) {
    const docHit = matchConcept(haystack, docId);
    if (docHit && docHit.status !== "ABSENT") return true;
  }

  return Object.values(conceptsById).some(
    (c) => c.d === domain && matchConcept(haystack, c.i)?.status !== "ABSENT",
  );
}

function isDomainApplicable(haystack: string, domain: string): boolean {
  if (domain === "go") {
    return (
      termMatches(haystack, "feminino") ||
      termMatches(haystack, "mulher") ||
      termMatches(haystack, "gestante") ||
      termMatches(haystack, "menstru") ||
      termMatches(haystack, "dum") ||
      termMatches(haystack, "ginec") ||
      termMatches(haystack, "obstetr") ||
      domainMentioned(haystack, "go")
    );
  }

  if (domain === "sx") {
    return (
      domainMentioned(haystack, "sx") ||
      termMatches(haystack, "sexual") ||
      termMatches(haystack, "ist") ||
      termMatches(haystack, "dst")
    );
  }

  if (domain === "is") {
    // IS permanece no denominador; ausência pesa na completude
    return true;
  }

  return true;
}

function scoreClarityFromFlags(
  haystack: string,
  presentIds: Set<string>,
): { score: number; notes: string[] } {
  let score = weights.dim.clareza;
  const notes: string[] = [];

  for (const flag of qualityFlags) {
    if (flag.t?.some((t) => termMatches(haystack, t))) {
      const penalty = Math.min(5, flag.p ?? 2);
      score -= flag.b ? Math.min(4, penalty) : Math.min(3, penalty);
      notes.push(flag.c.split("_").join(" "));
      continue;
    }

    if (flag.k?.length) {
      const positive = flag.k.filter((k) => !k.startsWith("!"));
      const negative = flag.k.filter((k) => k.startsWith("!")).map((k) => k.slice(1));
      const posOk = positive.every((id) => presentIds.has(id));
      const negMissing = negative.some((id) => !presentIds.has(id));
      if (posOk && negMissing && flag.f) {
        score -= Math.min(5, flag.p ?? 4);
        notes.push(flag.c.split("_").join(" "));
      }
    }
  }

  return { score: Math.max(0, score), notes: [...new Set(notes)] };
}

function scoreRelevance(raw: string, haystack: string): { score: number; notes: string[] } {
  let score = weights.dim.relevancia;
  const notes: string[] = [];
  const words = raw.trim().split(/\s+/).filter(Boolean).length;

  if (words > 700) {
    score -= 5;
    notes.push("Excesso de texto que dificulta localizar dados essenciais.");
  } else if (words > 450) {
    score -= 2;
    notes.push("Texto longo com risco de diluir informação importante.");
  }

  for (const flag of qualityFlags.filter((f) => f.z)) {
    if (flag.t?.some((t) => termMatches(haystack, t))) {
      score -= Math.min(5, flag.p ?? 2);
      notes.push(flag.c.split("_").join(" "));
    }
  }

  const sentences = raw
    .split(/[.!?\n]+/)
    .map((s) => normalize(s))
    .filter((s) => s.length > 25);
  const seen = new Map<string, number>();
  for (const s of sentences) {
    const key = s.slice(0, 60);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  if ([...seen.values()].filter((n) => n >= 2).length >= 2) {
    score -= 4;
    notes.push("repeticao sem ganho");
  }

  return { score: Math.max(0, score), notes: [...new Set(notes)] };
}

function scoreSafety(
  haystack: string,
  domain: string,
  mentioned: boolean,
): { score: number; notes: string[] } {
  const notes: string[] = [];
  const redReqs = conditionalRedRequirements(haystack).filter((req) =>
    req.split("|").some((id) => {
      const concept = conceptsById[id];
      return concept?.d === "red" && (!concept.a || concept.a.length === 0 || domain === "hma" || domain === "ef" || domain === "qp");
    }),
  );

  // Domínios sem red flags aplicáveis: segurança plena se coerente
  if (!redReqs.length && !["hma", "qp", "ef", "alg"].includes(domain)) {
    return { score: weights.dim.seguranca, notes };
  }

  if (!mentioned && ["hma", "qp", "ef", "alg"].includes(domain)) {
    return {
      score: 0,
      notes: [`Sinais de alerta / segurança não pesquisados em ${DOMAIN_LABELS[domain]}.`],
    };
  }

  if (!redReqs.length) {
    // Sem contexto de alerta específico: parcial se domínio crítico presente
    const generic = ["RED019", "RED004", "RED008", "RED007"].filter((id) =>
      matchConcept(haystack, id)?.status !== "ABSENT",
    );
    if (generic.length || termMatches(haystack, "nega") || termMatches(haystack, "sem sinais")) {
      return { score: 7, notes: ["Avaliação parcialmente adequada de alertas."] };
    }
    return { score: 4, notes: ["Avaliação superficial de sinais de alerta."] };
  }

  let covered = 0;
  for (const req of redReqs) {
    const result = evaluateRequirement(haystack, req);
    if (result.ok) covered += 1;
    else notes.push(`Alerta não pesquisado: ${result.label}`);
  }

  const ratio = covered / redReqs.length;
  if (ratio >= 0.75) return { score: 10, notes: notes.slice(0, 2) };
  if (ratio >= 0.4) return { score: 7, notes };
  if (ratio > 0) return { score: 4, notes };
  return { score: 0, notes };
}

function scoreDomain(raw: string, haystack: string, domain: string): TopicScore {
  const label = DOMAIN_LABELS[domain] ?? domain;
  const weight = weights.domains[domain] ?? 1;
  const applicable = isDomainApplicable(haystack, domain);

  if (!applicable) {
    return {
      topicId: domain,
      label,
      weight,
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

  const mentioned = domainMentioned(haystack, domain);
  const reqIds = resolveDomainRequirements(haystack, domain);
  // Domínio IS: usa DOC004 como requisito mínimo se não houver lista
  const effectiveReqs =
    reqIds.length > 0 ? reqIds : domain === "is" ? ["DOC004"] : [];

  const items: ItemAssessment[] = [];
  const presentIds = new Set<string>();
  let informed = 0;
  let applicableCount = 0;

  for (const req of effectiveReqs) {
    const result = evaluateRequirement(haystack, req);
    if (result.status === "NA") {
      items.push({ id: req, label: result.label, status: "not_applicable" });
      continue;
    }

    applicableCount += 1;
    if (result.ok) {
      informed += 1;
      result.ids.forEach((id) => presentIds.add(id));
      items.push({ id: req, label: result.label, status: "informed" });
    } else {
      items.push({ id: req, label: result.label, status: "missing" });
    }
  }

  // Indexar hits do domínio para flags
  for (const concept of Object.values(conceptsById)) {
    if (concept.d !== domain) continue;
    const hit = matchConcept(haystack, concept.i);
    if (hit && isInformed(hit.status)) presentIds.add(concept.i);
  }

  const completeness =
    !mentioned && applicableCount > 0
      ? 0
      : applicableCount === 0
        ? weights.dim.completude
        : (informed / applicableCount) * weights.dim.completude;

  const clarity = mentioned
    ? scoreClarityFromFlags(haystack, presentIds)
    : { score: 0, notes: [`Tópico “${label}” não identificado.`] };
  const relevance = mentioned
    ? scoreRelevance(raw, haystack)
    : { score: 0, notes: [] as string[] };
  const safety = scoreSafety(haystack, domain, mentioned);

  const ciq = Math.max(
    0,
    Math.min(
      100,
      Math.round(completeness + clarity.score + relevance.score + safety.score),
    ),
  );
  const { band } = classifyScore(ciq);

  return {
    topicId: domain,
    label,
    weight,
    applicable: true,
    ciq,
    completeness: Math.round(completeness * 10) / 10,
    clarity: clarity.score,
    relevance: relevance.score,
    safety: safety.score,
    band: toCiqBand(band),
    items,
  };
}

function computePenalties(haystack: string, topics: TopicScore[]): GlobalPenalty[] {
  const byId = Object.fromEntries(topics.map((t) => [t.topicId, t]));
  const allergy = evaluateRequirement(haystack, "ALG001|ALG002");
  const muc = evaluateRequirement(haystack, "MUC001");
  const vitals = ["EF005", "EF006", "EF007", "EF008", "EF009"].map((id) =>
    evaluateRequirement(haystack, id),
  );
  const hasComorbidity =
    evaluateRequirement(haystack, "AP001").ok ||
    evaluateRequirement(haystack, "AP006").ok ||
    Object.keys(conceptsById).some(
      (id) => id.startsWith("DX") && matchConcept(haystack, id)?.status === "POS",
    );

  const redMissing = conditionalRedRequirements(haystack).some(
    (req) => !evaluateRequirement(haystack, req).ok,
  );

  const contradiction = relations.some((rel) => {
    if (!rel.i.startsWith("CON")) return false;
    // Heurística: se ambos os lados lexicais conflitantes aparecem
    const sides = rel.k;
    if (sides.length < 2) return false;
    const left = sides[0].replace(/^NEG:/, "");
    const right = sides[1].split("|")[0].replace(/^NEG:/, "");
    const leftHit = matchConcept(haystack, left);
    const rightHit = matchConcept(haystack, right);
    if (!leftHit || !rightHit) return false;
    if (sides[0].startsWith("NEG:")) {
      return leftHit.status === "NEG" && rightHit.status === "POS";
    }
    return leftHit.status === "POS" && rightHit.status === "POS" && left !== right;
  });

  const chronologyMissing =
    !evaluateRequirement(haystack, "HMA001").ok ||
    !evaluateRequirement(haystack, "HMA004").ok;

  return [
    {
      id: "alergias_ausentes",
      label: "Ausência de alergias",
      points: weights.penalties.alergias_ausentes,
      applied: !allergy.ok,
    },
    {
      id: "muc_ausente_quando_aplicavel",
      label: "Ausência de MUC em paciente com comorbidades ou uso provável de medicamentos",
      points: weights.penalties.muc_ausente_quando_aplicavel,
      applied: hasComorbidity && !muc.ok,
    },
    {
      id: "sinais_vitais_ausentes",
      label: "Ausência de sinais vitais em atendimento presencial",
      points: weights.penalties.sinais_vitais_ausentes,
      applied: vitals.filter((v) => v.ok).length < 3,
    },
    {
      id: "red_flag_nao_pesquisado",
      label: "Ausência de avaliação de sinal de alerta diretamente relacionado à queixa",
      points: weights.penalties.red_flag_nao_pesquisado,
      applied: redMissing || (byId.hma?.safety ?? 0) <= 4,
    },
    {
      id: "contradicao_critica",
      label: "Contradição clinicamente relevante",
      points: weights.penalties.contradicao_critica,
      applied: contradiction,
    },
    {
      id: "cronologia_hma_ausente",
      label: "Ausência de cronologia mínima na HMA",
      points: weights.penalties.cronologia_hma_ausente,
      applied: chronologyMissing,
    },
  ];
}

export function evaluateAnamnesisH1(content: string): H1Result {
  const raw = content.trim();
  const haystack = normalize(raw);

  const domains = Object.keys(weights.domains);
  const topics = domains.map((domain) => scoreDomain(raw, haystack, domain));
  const applicable = topics.filter((t) => t.applicable);

  const weightSum = applicable.reduce((acc, t) => acc + t.weight, 0) || 1;
  const weighted = applicable.reduce((acc, t) => acc + t.ciq * t.weight, 0);
  const cgqaBeforePenalties = weighted / weightSum;

  const penalties = computePenalties(haystack, topics);
  const penaltyTotal = penalties
    .filter((p) => p.applied)
    .reduce((acc, p) => acc + p.points, 0);
  const cgqa = Math.max(0, Math.min(100, Math.round(cgqaBeforePenalties - penaltyTotal)));
  const classified = classifyScore(cgqa);

  const missing: string[] = [];
  const confusing: string[] = [];
  const irrelevant: string[] = [];

  for (const topic of applicable) {
    for (const item of topic.items) {
      if (item.status === "missing") {
        missing.push(`${item.label} (${topic.label}).`);
      }
    }
  }

  const clarityGlobal = scoreClarityFromFlags(haystack, new Set());
  confusing.push(...clarityGlobal.notes);
  const relevanceGlobal = scoreRelevance(raw, haystack);
  irrelevant.push(...relevanceGlobal.notes);

  for (const flag of qualityFlags) {
    if (flag.t?.some((t) => termMatches(haystack, t))) {
      if (flag.b) confusing.push(flag.c.split("_").join(" "));
      if (flag.z) irrelevant.push(flag.c.split("_").join(" "));
      if (flag.f) missing.push(flag.c.split("_").join(" "));
    }
  }

  const priorities: string[] = [];
  if (penalties.find((p) => p.id === "red_flag_nao_pesquisado")?.applied) {
    priorities.push("Completar sinais de alerta.");
  }
  if (penalties.find((p) => p.id === "cronologia_hma_ausente")?.applied) {
    priorities.push("Esclarecer a cronologia.");
  }
  if (
    penalties.find((p) => p.id === "alergias_ausentes")?.applied ||
    penalties.find((p) => p.id === "muc_ausente_quando_aplicavel")?.applied
  ) {
    priorities.push("Confirmar medicações e alergias.");
  }
  if (irrelevant.length) priorities.push("Remover redundâncias.");
  if (!priorities.length) {
    priorities.push("Revisar tópicos com menor CIQ e consolidar dados essenciais.");
  }

  return {
    cgqa,
    cgqaBeforePenalties: Math.round(cgqaBeforePenalties),
    band: toCiqBand(classified.band),
    bandLabel: classified.label,
    topics: applicable.sort((a, b) => b.weight - a.weight || b.ciq - a.ciq),
    penalties,
    missing: [...new Set(missing)].slice(0, 14),
    confusing: [...new Set(confusing)].slice(0, 10),
    irrelevant: [...new Set(irrelevant)].slice(0, 8),
    priorities: priorities.slice(0, 6),
  };
}
