"use client";

import { useMemo, useState, useTransition } from "react";
import { evaluateReview } from "@/lib/evaluate";
import { getTemplate, templates } from "@/lib/templates";
import type { FieldStatus, ReviewResult } from "@/lib/types";

const statusLabel: Record<FieldStatus, string> = {
  present: "Presente",
  partial: "Parcial",
  missing: "Ausente",
};

const statusClass: Record<FieldStatus, string> = {
  present: "status-present",
  partial: "status-partial",
  missing: "status-missing",
};

export function ReviewWorkspace() {
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [content, setContent] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const template = useMemo(() => getTemplate(templateId), [templateId]);

  function runReview() {
    startTransition(() => {
      const next = evaluateReview(content, template);
      setResult(next);
    });
  }

  function clearReview() {
    setContent("");
    setResult(null);
  }

  return (
    <div className="workspace">
      <section className="panel intro-panel">
        <p className="eyebrow">Ferramenta de revisão</p>
        <h2>Identifique lacunas antes de fechar a lógica</h2>
        <p className="lede">
          Cole o texto, escolha o modo de avaliação e veja quais dados cruciais
          faltam para a montagem lógica se sustentar.
        </p>
      </section>

      <section className="panel">
        <label className="field-label" htmlFor="template">
          Modo de avaliação
        </label>
        <div className="template-grid" role="list">
          {templates.map((item) => (
            <button
              key={item.id}
              type="button"
              role="listitem"
              className={`template-card ${templateId === item.id ? "active" : ""}`}
              onClick={() => {
                setTemplateId(item.id);
                setResult(null);
              }}
            >
              <span className="template-name">{item.name}</span>
              <span className="template-summary">{item.summary}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <label className="field-label" htmlFor="content">
          Informações para revisar
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Cole aqui o briefing, a nota de pesquisa, a narrativa ou o conjunto de fatos..."
          rows={10}
        />
        <div className="actions">
          <button
            type="button"
            className="btn-primary"
            onClick={runReview}
            disabled={!content.trim() || isPending}
          >
            {isPending ? "Avaliando…" : "Avaliar lacunas"}
          </button>
          <button type="button" className="btn-ghost" onClick={clearReview}>
            Limpar
          </button>
        </div>
      </section>

      {result ? (
        <section className="panel result-panel" aria-live="polite">
          <div className="score-row">
            <div>
              <p className="eyebrow">Completude</p>
              <p className="score">{result.completeness}%</p>
            </div>
            <div className="counters">
              <span>{result.presentCount} presentes</span>
              <span>{result.partialCount} parciais</span>
              <span>{result.missingCount} ausentes</span>
            </div>
          </div>

          <p className="verdict">{result.verdict}</p>

          <h3>Campos cruciais</h3>
          <ul className="field-list">
            {result.fields.map((item) => (
              <li key={item.field.id} className="field-item">
                <div className="field-head">
                  <strong>{item.field.label}</strong>
                  <span className={`status-pill ${statusClass[item.status]}`}>
                    {statusLabel[item.status]}
                  </span>
                </div>
                <p>{item.note}</p>
              </li>
            ))}
          </ul>

          <h3>Montagem lógica</h3>
          <ol className="logic-list">
            {result.logic.map((item) => (
              <li key={item.step} className={item.supported ? "ok" : "gap"}>
                <span className="logic-flag">
                  {item.supported ? "Elo ok" : "Elo frágil"}
                </span>
                <strong>{item.step}</strong>
                <p>{item.note}</p>
              </li>
            ))}
          </ol>

          <h3>Próximos reforços</h3>
          <ul className="reco-list">
            {result.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="panel checklist-panel">
          <h3>Checklist deste modo</h3>
          <ul className="checklist">
            {template.fields.map((field) => (
              <li key={field.id}>
                <strong>
                  {field.label}
                  {field.required ? "" : " (opcional)"}
                </strong>
                <span>{field.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
