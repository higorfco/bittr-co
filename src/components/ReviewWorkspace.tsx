"use client";

import { useState, useTransition } from "react";
import { evaluateAnamnesisH1 } from "@/lib/h1-evaluate";
import { PANDA93_MAX } from "@/lib/panda93";
import type { H1Result, TopicScore } from "@/lib/types";

function bandClass(score: number): string {
  if (score >= 84) return "band-excellent";
  if (score >= 70) return "band-good";
  if (score >= 56) return "band-partial";
  if (score >= 37) return "band-poor";
  return "band-critical";
}

function TopicRow({ topic }: { topic: TopicScore }) {
  return (
    <li className="topic-row">
      <div className="topic-head">
        <strong>{topic.label}</strong>
        <span className={`ciq-pill ${bandClass(topic.ciq)}`}>
          {topic.ciq}/{PANDA93_MAX}
        </span>
      </div>
    </li>
  );
}

function ResultView({ result }: { result: H1Result }) {
  return (
    <section className="panel result-panel" aria-live="polite">
      <div className="score-row">
        <div>
          <p className="eyebrow">Escore global</p>
          <p className="score">
            PANDA93: {result.cgqa}/{PANDA93_MAX}
          </p>
          <p className="acronym-note">
            Plataforma de Análise e Normalização de Dados em Anamnese
          </p>
          <p className={`band-label ${bandClass(result.cgqa)}`}>
            {result.bandLabel}
          </p>
        </div>
      </div>

      {result.privacyRedactions > 0 ? (
        <p className="privacy-note">
          {result.privacyRedactions} trecho(s) pessoal(is) anonimizado(s) antes
          da análise (LGPD).
        </p>
      ) : null}

      <h3>Escores</h3>
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
      <section className="panel">
        <label className="field-label" htmlFor="content">
          Anamnese
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Cole o texto da anamnese…"
          rows={14}
        />
        <div className="actions">
          <button
            type="button"
            className="btn-primary"
            onClick={runReview}
            disabled={!content.trim() || isPending}
          >
            {isPending ? "Avaliando…" : "Calcular PANDA93"}
          </button>
          <button type="button" className="btn-ghost" onClick={clearReview}>
            Limpar
          </button>
        </div>
      </section>

      {result ? <ResultView result={result} /> : null}
    </div>
  );
}
