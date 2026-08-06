import type {
  CrucialField,
  FieldAssessment,
  FieldStatus,
  LogicStepAssessment,
  ReviewResult,
  ReviewTemplate,
} from "./types";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function assessField(content: string, field: CrucialField): FieldAssessment {
  const haystack = normalize(content);
  const matchedTerms = field.keywords.filter((keyword) =>
    haystack.includes(normalize(keyword)),
  );

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const densityHint = wordCount > 40 ? 1 : 0;

  let status: FieldStatus = "missing";
  let note = "Não há indício claro deste dado no texto.";

  if (matchedTerms.length >= 2 || (matchedTerms.length === 1 && densityHint)) {
    status = "present";
    note = `Sinal encontrado via: ${matchedTerms.slice(0, 3).join(", ")}.`;
  } else if (matchedTerms.length === 1) {
    status = "partial";
    note = `Menção frágil a “${matchedTerms[0]}”. Vale detalhar.`;
  } else if (field.required && wordCount < 12) {
    status = "missing";
    note = "Texto curto demais para cobrir este campo crucial.";
  }

  return { field, status, note, matchedTerms };
}

function assessLogic(
  template: ReviewTemplate,
  fields: FieldAssessment[],
): LogicStepAssessment[] {
  const byId = Object.fromEntries(fields.map((f) => [f.field.id, f]));

  return template.logicSteps.map((step, index) => {
    const required = fields.filter((f) => f.field.required);
    const covered = required.filter((f) => f.status !== "missing").length;
    const coverage = required.length === 0 ? 1 : covered / required.length;

    // Heurística por template: cada passo olha um subconjunto típico
    const checks: Array<() => boolean> = [
      () =>
        ["contexto", "atores", "objetivo", "gancho"].some(
          (id) => byId[id] && byId[id].status !== "missing",
        ) || coverage >= 0.35,
      () =>
        ["fonte", "evidencia", "opcoes", "fatos", "criterios"].some(
          (id) => byId[id] && byId[id].status !== "missing",
        ) || coverage >= 0.5,
      () =>
        ["hipotese", "riscos", "causa", "custos"].some(
          (id) => byId[id] && byId[id].status !== "missing",
        ) || coverage >= 0.65,
      () =>
        ["conclusao", "recomendacao", "fechamento", "proximo"].some(
          (id) => byId[id] && byId[id].status === "present",
        ) || coverage >= 0.8,
    ];

    const supported = (checks[index] ?? (() => coverage >= 0.7))();

    return {
      step,
      supported,
      note: supported
        ? "Elo sustentado pelos dados atuais."
        : "Elo frágil: falta dado crucial nesta etapa da montagem.",
    };
  });
}

export function evaluateReview(
  content: string,
  template: ReviewTemplate,
): ReviewResult {
  const fields = template.fields.map((field) => assessField(content, field));
  const logic = assessLogic(template, fields);

  const presentCount = fields.filter((f) => f.status === "present").length;
  const partialCount = fields.filter((f) => f.status === "partial").length;
  const missingCount = fields.filter((f) => f.status === "missing").length;

  const weighted =
    presentCount * 1 +
    partialCount * 0.45 +
    fields.filter((f) => !f.field.required && f.status === "missing").length * 0.1;
  const completeness = Math.round(
    Math.min(100, (weighted / Math.max(fields.length, 1)) * 100),
  );

  const brokenLinks = logic.filter((l) => !l.supported).length;
  const criticalMissing = fields.filter(
    (f) => f.field.required && f.status === "missing",
  );

  let verdict =
    "A montagem lógica está coerente o bastante para revisão avançada.";
  if (criticalMissing.length >= 3 || completeness < 45) {
    verdict =
      "Há lacunas críticas: a montagem lógica ainda não se sustenta.";
  } else if (criticalMissing.length > 0 || brokenLinks > 0) {
    verdict =
      "Parcialmente utilizável: complete os elos fracos antes de concluir.";
  }

  const recommendations = [
    ...criticalMissing
      .slice(0, 4)
      .map((f) => `Preencher “${f.field.label}”: ${f.field.description}`),
    ...logic
      .filter((l) => !l.supported)
      .slice(0, 2)
      .map((l) => `Reforçar o elo: ${l.step}`),
  ];

  if (recommendations.length === 0) {
    recommendations.push(
      "Rodar uma segunda passagem buscando contrapontos e limitações.",
    );
  }

  return {
    completeness,
    missingCount,
    partialCount,
    presentCount,
    fields,
    logic,
    verdict,
    recommendations,
  };
}
