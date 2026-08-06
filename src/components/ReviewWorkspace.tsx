"use client";

import { useState, useTransition } from "react";
import { evaluateAnamnesisH1 } from "@/lib/h1-evaluate";
import type { H1Result, TopicScore } from "@/lib/types";

function bandClass(ciq: number): string {
  if (ciq >= 90) return "band-excellent";
  if (ciq >= 75) return "band-good";
  if (ciq >= 60) return "band-partial";
  if (ciq >= 40) return "band-poor";
  return "band-critical";
}

function TopicRow({ topic }: { topic: TopicScore }) {
  return (
    <li className="topic-row">
      <div className="topic-head">
        <strong>{topic.label}</strong>
        <span className={`ciq-pill ${bandClass(topic.ciq)}`}>
          {topic.ciq}/100
        </span>
      </div>
      <div className="dim-row" aria-label="Dimensões do CIQ">
        <span>C {topic.completeness}</span>
        <span>L {topic.clarity}</span>
        <span>R {topic.relevance}</span>
        <span>S {topic.safety}</span>
      </div>
    </li>
  );
}

function ResultView({ result }: { result: H1Result }) {
  const appliedPenalties = result.penalties.filter((p) => p.applied);

  return (
    <section className="panel result-panel" aria-live="polite">
      <div className="score-row">
        <div>
          <p className="eyebrow">Coeficiente global</p>
          <p className="score">
            CGQA: {result.cgqa}/100
          </p>
          <p className={`band-label ${bandClass(result.cgqa)}`}>
            {result.bandLabel}
          </p>
        </div>
      </div>

      {appliedPenalties.length > 0 ? (
        <div className="penalty-box">
          <p className="eyebrow">Penalidades de segurança</p>
          <ul>
            {appliedPenalties.map((p) => (
              <li key={p.id}>
                −{p.points}: {p.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <h3>Coeficientes individuais</h3>
      <ul className="topic-list">
        {result.topics.map((topic) => (
          <TopicRow key={topic.topicId} topic={topic} />
        ))}
      </ul>

      <h3>Informações faltantes</h3>
      {result.missing.length ? (
        <ul className="finding-list">
          {result.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">Nenhuma lacuna essencial evidente.</p>
      )}

      <h3>Informações confusas</h3>
      {result.confusing.length ? (
        <ul className="finding-list">
          {result.confusing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">Sem ambiguidades relevantes detectadas.</p>
      )}

      <h3>Informações irrelevantes ou excessivas</h3>
      {result.irrelevant.length ? (
        <ul className="finding-list">
          {result.irrelevant.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">Sem excesso relevante detectado.</p>
      )}

      <h3>Prioridades para correção</h3>
      <ol className="priority-list">
        {result.priorities.map((item, index) => (
          <li key={item}>
            <span className="priority-index">{index + 1}.</span> {item}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ReviewWorkspace() {
  const [content, setContent] = useState("");
  const [result, setResult] = useState<H1Result | null>(null);
  const [isPending, startTransition] = useTransition();

  function runReview() {
    startTransition(() => {
      setResult(evaluateAnamnesisH1(content));
    });
  }

  function clearReview() {
    setContent("");
    setResult(null);
  }

  return (
    <div className="workspace">
      <section className="panel intro-panel">
        <p className="eyebrow">Modo H1 · Anamnese</p>
        <h2>Coeficiente de Completude Clínica</h2>
        <p className="lede">
          Cole a anamnese. O algoritmo atribui CIQ por tópico (completude,
          clareza, relevância e segurança) e calcula o CGQA global com
          penalidades de segurança.
        </p>
      </section>

      <section className="panel">
        <label className="field-label" htmlFor="content">
          Texto da anamnese
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Cole aqui a anamnese completa (identificação, QP/QD, HMA, IS, AP, MUC, alergias, exame físico…)."
          rows={14}
        />
        <div className="actions">
          <button
            type="button"
            className="btn-primary"
            onClick={runReview}
            disabled={!content.trim() || isPending}
          >
            {isPending ? "Avaliando…" : "Avaliar anamnese"}
          </button>
          <button type="button" className="btn-ghost" onClick={clearReview}>
            Limpar
          </button>
        </div>
      </section>

      {result ? (
        <ResultView result={result} />
      ) : (
        <section className="panel checklist-panel">
          <h3>O que será avaliado</h3>
          <p className="lede">
            Identificação, QP/QD, HMA/HPMA, IS, AP, antecedentes cirúrgicos,
            MUC, alergias, AF, hábitos, ocupacional, gineco-obstétrica (se
            aplicável), sexual, epidemiológica e exame físico.
          </p>
          <ul className="dim-legend">
            <li>
              <strong>C 50</strong> Completude
            </li>
            <li>
              <strong>L 20</strong> Clareza
            </li>
            <li>
              <strong>R 20</strong> Relevância clínica
            </li>
            <li>
              <strong>S 10</strong> Segurança / alertas
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
