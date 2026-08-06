import conceptsJson from "@/data/terminologia/concepts.json";
import negationJson from "@/data/terminologia/negation.json";
import qualityFlagsJson from "@/data/terminologia/quality_flags.json";
import relationsJson from "@/data/terminologia/relations.json";
import requirementsJson from "@/data/terminologia/requirements.json";
import weightsJson from "@/data/terminologia/weights.json";
import type {
  Concept,
  ConceptHit,
  DomainRequirement,
  MatchStatus,
  NegationLexeme,
  QualityFlag,
  Relation,
  WeightsPack,
} from "./types";

export const concepts = conceptsJson as Concept[];
export const negationLexemes = negationJson as NegationLexeme[];
export const qualityFlags = qualityFlagsJson as QualityFlag[];
export const relations = relationsJson as Relation[];
export const requirements = requirementsJson as DomainRequirement[];
export const weights = weightsJson as unknown as WeightsPack;

export const conceptsById: Record<string, Concept> = Object.fromEntries(
  concepts.map((c) => [c.i, c]),
);

export const DOMAIN_LABELS: Record<string, string> = {
  id: "Identificação",
  qp: "QP/QD",
  hma: "HMA/HPMA",
  is: "IS",
  ap: "AP",
  ac: "Antecedentes cirúrgicos",
  muc: "MUC",
  alg: "Alergias",
  af: "AF",
  hv: "Hábitos de vida",
  oc: "História ocupacional",
  go: "História ginecológica e obstétrica",
  sx: "História sexual",
  ep: "História epidemiológica",
  ef: "Exame físico",
};

export const DOC_BY_DOMAIN: Record<string, string> = {
  id: "DOC001",
  qp: "DOC002",
  hma: "DOC003",
  is: "DOC004",
  ap: "DOC005",
  ac: "DOC006",
  muc: "DOC007",
  alg: "DOC008",
  af: "DOC009",
  hv: "DOC010",
  oc: "DOC011",
  go: "DOC012",
  sx: "DOC013",
  ep: "DOC014",
  ef: "DOC015",
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function termMatches(haystack: string, term: string): boolean {
  const nTerm = normalize(term);
  if (!nTerm) return false;

  // Termos curtos exigem fronteira de palavra para evitar falso positivo (ex.: "t", "pa", "is")
  if (nTerm.length <= 2) {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(nTerm)}(?:$|[^\\p{L}\\p{N}])`, "u");
    return re.test(haystack);
  }

  return haystack.includes(nTerm);
}

function windowAround(haystack: string, index: number, radius = 48): string {
  return haystack.slice(Math.max(0, index - radius), index + radius);
}

function detectPolarity(haystack: string, matchedTerm: string): MatchStatus {
  const nTerm = normalize(matchedTerm);
  const idx = haystack.indexOf(nTerm);
  const local = idx >= 0 ? windowAround(haystack, idx) : haystack;

  for (const lex of negationLexemes) {
    if (lex.c === "POS") continue;
    if (lex.t.some((t) => termMatches(local, t))) {
      return lex.c;
    }
  }

  // POS explícito
  const pos = negationLexemes.find((l) => l.c === "POS");
  if (pos?.t.some((t) => termMatches(local, t))) return "POS";

  return "POS";
}

export function matchConcept(haystack: string, conceptId: string): ConceptHit | null {
  const concept = conceptsById[conceptId];
  if (!concept) return null;

  for (const term of concept.t) {
    if (termMatches(haystack, term)) {
      return {
        concept,
        status: detectPolarity(haystack, term),
        matchedTerm: term,
      };
    }
  }

  return {
    concept,
    status: "ABSENT",
  };
}

export function isInformed(status: MatchStatus): boolean {
  return status === "POS" || status === "NEG";
}

export function isNotApplicable(status: MatchStatus): boolean {
  return status === "NA";
}

/** Avalia requisito que pode ser OR ("ALG001|ALG002") */
export function evaluateRequirement(
  haystack: string,
  req: string,
): { ok: boolean; status: MatchStatus; label: string; ids: string[] } {
  const ids = req.split("|").map((s) => s.trim());
  const hits = ids.map((id) => matchConcept(haystack, id));
  const labels = ids
    .map((id) => conceptsById[id]?.c?.split("_").join(" ") ?? id)
    .join(" ou ");

  const applicableHit = hits.find((h) => h && h.status === "NA");
  if (applicableHit) {
    return { ok: true, status: "NA", label: labels, ids };
  }

  const informed = hits.find((h) => h && isInformed(h.status));
  if (informed) {
    return { ok: true, status: informed.status, label: labels, ids };
  }

  const unknown = hits.find((h) => h && (h.status === "UNK" || h.status === "NI"));
  if (unknown) {
    return { ok: false, status: unknown.status, label: labels, ids };
  }

  return { ok: false, status: "ABSENT", label: labels, ids };
}

export function detectClinicalContexts(haystack: string): string[] {
  const triggers: Array<{ id: string; terms: string[] }> = [
    { id: "dor", terms: ["dor", "algias", "algia"] },
    { id: "dispneia", terms: ["dispneia", "falta de ar", "dificuldade respirat"] },
    { id: "dor_toracica", terms: ["dor toracica", "dor torácica", "precordialgia", "opressao no peito"] },
    { id: "dor_abdominal", terms: ["dor abdominal", "dor no abdomen", "dor no abdômen"] },
    { id: "cefaleia", terms: ["cefaleia", "dor de cabeca", "dor de cabeça"] },
    { id: "febre", terms: ["febre", "febril", "hipertermia"] },
    { id: "sincope", terms: ["sincope", "síncope", "desmaio"] },
    {
      id: "deficit_neurologico",
      terms: ["deficit", "déficit", "paresia", "plegia", "disartria", "assimetria facial"],
    },
    { id: "sangramento", terms: ["sangramento", "hemorragia", "hematemese", "melena", "hemoptise"] },
    { id: "trauma", terms: ["trauma", "queda", "atropelamento", "acidente"] },
    {
      id: "alteracao_consciencia",
      terms: ["rebaixamento", "confuso", "sonolento", "comatoso", "alteracao do nivel"],
    },
    { id: "vomitos", terms: ["vomito", "vômito", "emese"] },
    { id: "diarreia", terms: ["diarreia", "diarréia"] },
    { id: "sintomas_urinarios", terms: ["disuria", "disúria", "polaciuria", "hematuria"] },
    { id: "sintomas_respiratorios", terms: ["tosse", "chiado", "expectoracao", "dispneia"] },
    { id: "sintomas_psiquiatricos", terms: ["ansiedade", "depressao", "ideacao", "suicida", "psiquiatr"] },
    { id: "intoxicacao", terms: ["intoxicacao", "intoxicação", "overdose", "ingestao de"] },
    { id: "reacao_alergica", terms: ["reacao alerg", "reação alerg", "anafilaxia", "urticaria"] },
    {
      id: "gestacao_possivel",
      terms: ["gestante", "gravida", "grávida", "atraso menstrual", "dum"],
    },
  ];

  return triggers.filter((t) => t.terms.some((term) => termMatches(haystack, term))).map((t) => t.id);
}

export function resolveDomainRequirements(
  haystack: string,
  domain: string,
): string[] {
  const base = requirements.find((r) => r.d === domain)?.req ?? [];
  const contexts = detectClinicalContexts(haystack);

  const conditionalForDomain = requirements
    .filter((r) => r.if && contexts.includes(r.if))
    .flatMap((r) => r.req)
    .filter((req) =>
      req.split("|").some((id) => conceptsById[id]?.d === domain),
    );

  return [...new Set([...base, ...conditionalForDomain])];
}

export function conditionalRedRequirements(haystack: string): string[] {
  const contexts = detectClinicalContexts(haystack);
  return [
    ...new Set(
      requirements
        .filter((r) => r.if && contexts.includes(r.if))
        .flatMap((r) => r.req)
        .filter((req) =>
          req.split("|").some((id) => conceptsById[id]?.d === "red"),
        ),
    ),
  ];
}

export function classifyScore(score: number): { band: string; label: string } {
  for (const [min, max, name] of weights.classes) {
    if (score >= min && score <= max) {
      const labels: Record<string, string> = {
        excelente: "Excelente",
        adequado: "Adequado",
        parcial: "Parcialmente adequado",
        insuficiente: "Insuficiente",
        critico: "Criticamente incompleto",
      };
      return { band: name, label: labels[name] ?? name };
    }
  }
  return { band: "critico", label: "Criticamente incompleto" };
}
