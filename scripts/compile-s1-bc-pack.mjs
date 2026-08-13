import fs from "fs";
import path from "path";

const BC_DIR = path.join("src", "data", "s1", "bc");
const OUT = path.join("src", "data", "s1", "s1_bc_pack.json");

const FALLBACK_FILES = new Set([
  "BC_informacao_insuficiente_classificacao.json",
]);
const GENERIC_FILES = new Set([
  "BC_queixa_inespecifica_mal_estar_geral.json",
  "BC_alteracoes_metabolicas_sistemicas_inespecificas.json",
]);

const UNIVERSAL_CRITERIA = [
  {
    id: "inicio",
    label: "Início",
    tier: "CORE",
    seeds: [
      "início",
      "inicio",
      "começou",
      "comecou",
      "súbito",
      "subito",
      "gradual",
      "insidioso",
    ],
  },
  {
    id: "duracao",
    label: "Duração",
    tier: "CORE",
    seeds: [
      "há",
      "duração",
      "duracao",
      "minutos",
      "horas",
      "dias",
      "semanas",
      "meses",
    ],
  },
  {
    id: "evolucao",
    label: "Evolução",
    tier: "EXPECTED",
    seeds: [
      "evolução",
      "evolucao",
      "piorando",
      "melhorando",
      "progressivo",
      "estável",
      "estavel",
    ],
  },
  {
    id: "intensidade",
    label: "Intensidade",
    tier: "EXPECTED",
    seeds: ["intensidade", "forte", "leve", "moderada", "/10", "escala"],
  },
  {
    id: "localizacao",
    label: "Localização",
    tier: "EXPECTED",
    seeds: ["localiza", "região", "regiao", "lado", "direita", "esquerda"],
  },
  {
    id: "fatores_piora",
    label: "Fatores de piora",
    tier: "EXPECTED",
    seeds: ["piora", "agrava", "desencade"],
  },
  {
    id: "fatores_melhora",
    label: "Fatores de melhora",
    tier: "EXPECTED",
    seeds: ["melhora", "alivia", "alívio", "alivio"],
  },
  {
    id: "sintomas_associados",
    label: "Sintomas associados",
    tier: "EXPECTED",
    seeds: ["associad", "acompanhad", "junto com"],
  },
  {
    id: "episodios_previos",
    label: "Episódios prévios",
    tier: "OPTIONAL",
    seeds: ["prévio", "previo", "já teve", "ja teve", "recorrente"],
  },
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function walkTerms(node, acc = new Set(), depth = 0) {
  if (depth > 12 || node == null) return acc;
  if (typeof node === "string") {
    const t = node.trim();
    if (
      t.length >= 3 &&
      t.length <= 80 &&
      !/^https?:/i.test(t) &&
      t.split(" ").length <= 12
    ) {
      acc.add(t);
    }
    return acc;
  }
  if (Array.isArray(node)) {
    for (const x of node) walkTerms(x, acc, depth + 1);
    return acc;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (
        [
          "purpose",
          "references",
          "source_prompt",
          "fonte_integral",
          "fonte_integral_prompt",
          "prompt_fonte_integral",
          "fonte_compilada",
          "core_principles",
          "restricoes",
          "prohibited_actions",
          "nao_finalidades",
        ].includes(k)
      ) {
        continue;
      }
      walkTerms(v, acc, depth + 1);
    }
  }
  return acc;
}

function asStringArray(v) {
  if (!v) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  if (typeof v === "object") {
    const out = [];
    for (const val of Object.values(v)) {
      if (typeof val === "string") out.push(val);
      else if (Array.isArray(val))
        out.push(...val.filter((x) => typeof x === "string"));
      else if (val && typeof val === "object" && Array.isArray(val.terms))
        out.push(...val.terms.filter((x) => typeof x === "string"));
    }
    return out;
  }
  return [];
}

function extractRoutingTerms(j, file) {
  const terms = new Set();
  const stem = file.replace(/^BC_/, "").replace(/\.json$/i, "").replace(/_/g, " ");
  terms.add(stem);
  for (const part of stem.split(" ")) if (part.length > 3) terms.add(part);

  const meta = j.metadata || j.meta || {};
  for (const k of [
    "name",
    "nome",
    "title",
    "titulo",
    "complaint",
    "chief_complaint",
    "domain",
  ]) {
    const v = meta[k];
    if (typeof v === "string") terms.add(v);
    if (Array.isArray(v))
      v.forEach((x) => typeof x === "string" && terms.add(x));
  }

  const buckets = [
    j.complaint?.synonyms,
    j.complaint?.colloquial_related,
    j.complaint?.canonical,
    j.lexicon?.chief_complaint,
    j.core_complaint,
    j.termos_queixa,
    j.queixa_alvo,
    j.fenomenos_e_sinonimos,
    j.core_terms,
    j.manifestacoes_principais,
    j.termos_inespecificos,
  ];
  for (const b of buckets) asStringArray(b).forEach((t) => terms.add(t));

  if (j.complaint_terms && typeof j.complaint_terms === "object") {
    for (const [k, v] of Object.entries(j.complaint_terms)) {
      terms.add(k.replace(/_/g, " "));
      asStringArray(v).forEach((t) => terms.add(t));
    }
  }
  if (j.concepts?.chief_complaint) {
    for (const [k, v] of Object.entries(j.concepts.chief_complaint)) {
      terms.add(k.replace(/_/g, " "));
      asStringArray(v?.terms || v).forEach((t) => terms.add(t));
    }
  }
  if (j.queixas_alvo && typeof j.queixas_alvo === "object") {
    for (const [k, v] of Object.entries(j.queixas_alvo)) {
      terms.add(k.replace(/_/g, " "));
      asStringArray(v).forEach((t) => terms.add(t));
    }
  }
  if (j.core_concepts) asStringArray(j.core_concepts).forEach((t) => terms.add(t));
  if (j.phenomena) {
    for (const [k, v] of Object.entries(j.phenomena)) {
      terms.add(k.replace(/_/g, " "));
      asStringArray(v).forEach((t) => terms.add(t));
    }
  }
  if (j.semantic_classes) {
    for (const [k, v] of Object.entries(j.semantic_classes)) {
      terms.add(k.replace(/_/g, " "));
      asStringArray(v).forEach((t) => terms.add(t));
    }
  }

  return [...terms]
    .map((t) => String(t).trim())
    .filter((t) => t.length >= 3 && t.length <= 60 && t.split(/\s+/).length <= 8)
    .slice(0, 120);
}

function extractCriteria(j) {
  const criteria = [];
  const push = (id, label, tier, terms) => {
    const cleanTerms = [
      ...new Set(
        (terms || []).filter((t) => typeof t === "string" && t.trim().length >= 2),
      ),
    ].slice(0, 40);
    if (!criteria.some((c) => c.id === id)) {
      criteria.push({ id, label, tier, terms: cleanTerms });
    }
  };

  const oc = j.output_contract?.characterization_fields;
  if (Array.isArray(oc)) {
    for (const field of oc) {
      const terms = [];
      if (j.concepts) {
        for (const [group, items] of Object.entries(j.concepts)) {
          if (
            normalize(group).includes(normalize(field).slice(0, 5)) ||
            normalize(field).includes(normalize(group).slice(0, 5))
          ) {
            walkTerms(items, new Set()).forEach((t) => terms.push(t));
          }
        }
      }
      push(field, field.replace(/_/g, " "), "CORE", terms);
    }
  }

  const minCore = j.minimum_characterization_fields?.core;
  if (Array.isArray(minCore)) {
    for (const field of minCore)
      push(field, field.replace(/_/g, " "), "CORE", []);
  }
  const minCtx = j.minimum_characterization_fields?.context_dependent;
  if (Array.isArray(minCtx)) {
    for (const field of minCtx)
      push(field, field.replace(/_/g, " "), "CONDITIONAL", []);
  }

  if (Array.isArray(j.clinical_fields)) {
    for (const field of j.clinical_fields) {
      const id = field.id || field.name || field.field || field.campo;
      if (!id) continue;
      const terms = asStringArray(
        field.terms || field.lexicon || field.markers || field.patterns,
      );
      push(
        String(id),
        String(field.label || id).replace(/_/g, " "),
        field.essential ? "CORE" : "EXPECTED",
        terms,
      );
    }
  }

  for (const key of ["domains", "dominios", "eixos", "eixos_transversais"]) {
    const dom = j[key];
    if (!dom || typeof dom !== "object" || Array.isArray(dom)) continue;
    for (const [id, val] of Object.entries(dom)) {
      const terms = [...walkTerms(val, new Set())].slice(0, 40);
      push(id, id.replace(/_/g, " "), "EXPECTED", terms);
    }
  }

  for (const key of [
    "campos_essenciais",
    "critical_fields",
    "campos_a_auditar",
    "campos_critica_hma",
    "critical_missing_fields_priority",
  ]) {
    const v = j[key];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string")
          push(item, item.replace(/_/g, " "), "CORE", []);
        else if (item && typeof item === "object") {
          const id = item.id || item.campo || item.field || item.name;
          if (id)
            push(
              String(id),
              String(item.label || id).replace(/_/g, " "),
              "CORE",
              asStringArray(item.terms),
            );
        }
      }
    } else if (v && typeof v === "object") {
      for (const [id, val] of Object.entries(v)) {
        push(
          id,
          id.replace(/_/g, " "),
          "CORE",
          [...walkTerms(val, new Set())].slice(0, 30),
        );
      }
    }
  }

  if (j.lexicon && typeof j.lexicon === "object") {
    for (const [id, val] of Object.entries(j.lexicon)) {
      if (id === "chief_complaint") continue;
      push(id, id.replace(/_/g, " "), "EXPECTED", asStringArray(val).slice(0, 40));
    }
  }

  if (j.pain_attributes && typeof j.pain_attributes === "object") {
    for (const [id, val] of Object.entries(j.pain_attributes)) {
      push(
        id,
        id.replace(/_/g, " "),
        "CORE",
        [...walkTerms(val, new Set())].slice(0, 40),
      );
    }
  }

  if (criteria.length === 0) {
    for (const u of UNIVERSAL_CRITERIA) push(u.id, u.label, u.tier, u.seeds);
  } else {
    for (const c of criteria) {
      if (c.terms.length) continue;
      const u = UNIVERSAL_CRITERIA.find(
        (x) =>
          normalize(x.id) === normalize(c.id) ||
          normalize(c.id).includes(normalize(x.id)),
      );
      if (u) c.terms = [...u.seeds];
    }
  }

  return criteria.slice(0, 28);
}

function extractNegation(j) {
  const sets = [
    j.linguistic_markers?.negation,
    j.negation,
    j.negation_detection,
    j.pertinent_negation,
    j.negativas_pertinentes,
    j.explicit_negations,
  ];
  const out = new Set(["nega", "sem", "ausente", "não", "nao", "nunca"]);
  for (const s of sets) asStringArray(s).forEach((t) => out.add(t));
  return [...out].slice(0, 40);
}

function extractVague(j) {
  const sets = [
    j.linguistic_markers?.uncertainty,
    j.ambiguity_patterns,
    j.ambiguity_dictionary,
    j.termos_ambiguos,
    j.termos_inespecificos,
  ];
  const out = new Set([
    "há algum tempo",
    "ha algum tempo",
    "passou mal",
    "teve crise",
    "ficou estranho",
    "alterou a urina",
  ]);
  for (const s of sets) asStringArray(s).forEach((t) => out.add(t));
  return [...out].filter((t) => t.length >= 3).slice(0, 40);
}

function extractSafety(j) {
  const sets = [
    j.safety_features,
    j.red_flags_documentation,
    j.red_flags_documentais,
    j.sinais_alerta_textuais,
    j.elementos_gravidade,
    j.seguranca_alta_relevancia,
  ];
  const out = new Set();
  for (const s of sets) {
    if (Array.isArray(s)) {
      for (const item of s) {
        if (typeof item === "string") out.add(item);
        else if (item && typeof item === "object")
          asStringArray(item.terms || item.markers || item).forEach((t) =>
            out.add(t),
          );
      }
    } else if (s && typeof s === "object") {
      walkTerms(s, out);
    }
  }
  return [...out]
    .filter((t) => typeof t === "string" && t.length >= 3 && t.length <= 60)
    .slice(0, 50);
}

function labelFor(j, file) {
  const meta = j.metadata || j.meta || {};
  return (
    meta.title ||
    meta.titulo ||
    meta.name ||
    meta.nome ||
    meta.complaint ||
    (Array.isArray(meta.chief_complaint)
      ? meta.chief_complaint[0]
      : meta.chief_complaint) ||
    file.replace(/^BC_/, "").replace(/\.json$/i, "").replace(/_/g, " ")
  );
}

const files = fs
  .readdirSync(BC_DIR)
  .filter((f) => f.startsWith("BC_") && f.endsWith(".json"))
  .sort((a, b) => a.localeCompare(b, "pt"));

const banks = [];
for (const file of files) {
  const j = JSON.parse(fs.readFileSync(path.join(BC_DIR, file), "utf8"));
  const routing = extractRoutingTerms(j, file);
  banks.push({
    id: file.replace(/^BC_/, "").replace(/\.json$/i, ""),
    file,
    label: labelFor(j, file),
    fallback: FALLBACK_FILES.has(file),
    generic: GENERIC_FILES.has(file) || FALLBACK_FILES.has(file),
    routing_terms: routing,
    routing_norm: routing.map(normalize).filter(Boolean),
    criteria: extractCriteria(j),
    negation_markers: extractNegation(j),
    vague_markers: extractVague(j),
    safety_terms: extractSafety(j),
    term_count: walkTerms(j, new Set()).size,
  });
}

const pack = {
  v: "2.0.0",
  mode: "S1",
  law: "Análise textual clínica contextual de QD/QP/HMA com routing entre BCs",
  generated_at: new Date().toISOString(),
  bank_count: banks.length,
  banks,
};

fs.writeFileSync(OUT, JSON.stringify(pack));
console.log("wrote", OUT, "banks", banks.length, "bytes", fs.statSync(OUT).size);
for (const b of banks) {
  console.log(
    b.file,
    "| routing",
    b.routing_terms.length,
    "| criteria",
    b.criteria.length,
    "| fb",
    b.fallback,
    "| gen",
    b.generic,
  );
}
