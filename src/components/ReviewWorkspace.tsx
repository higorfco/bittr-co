"use client";

import { useState, useTransition } from "react";
import { evaluateAnamnesisH1 } from "@/lib/h1-evaluate";
import { evaluateStrokeH2 } from "@/lib/h2-evaluate";
import { PANDA93_MAX } from "@/lib/panda93";
import type { H1Result, TopicScore } from "@/lib/types";
import type { H2Result } from "@/lib/h2-evaluate";

export type AppMode = "H1" | "H2";

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

function H1ResultView({ result }: { result: H1Result }) {
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

function H2ResultView({ result }: { result: H2Result }) {
  const presentOptional = result.items.filter((i) => i.present && !i.essential);
  const presentEssential = result.items.filter((i) => i.present && i.essential);

  return (
    <section className="panel result-panel" aria-live="polite">
      <div className="score-row">
        <div>
          <p className="eyebrow">Initial assessment · AVC</p>
          <p className="score">
            PANDA93: {result.panda93}/{PANDA93_MAX}
          </p>
          <p className="acronym-note">
            {result.presentCount}/{result.totalEssential} itens essenciais
            presentes
          </p>
          <p className={`band-label ${bandClass(result.panda93)}`}>
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

      <h3>Presentes</h3>
      <ul className="topic-list">
        {[...presentEssential, ...presentOptional].map((item) => (
          <li key={item.id} className="topic-row">
            <div className="topic-head">
              <strong>{item.label}</strong>
              <span className="ciq-pill band-good">OK</span>
            </div>
          </li>
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

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}) {
  return (
    <div className="mode-switch" role="tablist" aria-label="Modo de análise">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "H1"}
        className={`mode-btn ${mode === "H1" ? "active" : ""}`}
        onClick={() => onChange("H1")}
      >
        (H1)
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "H2"}
        className={`mode-btn ${mode === "H2" ? "active" : ""}`}
        onClick={() => onChange("H2")}
      >
        (H2)
      </button>
    </div>
  );
}

export function ReviewWorkspace({ mode }: { mode: AppMode }) {
  const [content, setContent] = useState("");
  const [h1Result, setH1Result] = useState<H1Result | null>(null);
  const [h2Result, setH2Result] = useState<H2Result | null>(null);
  const [isPending, startTransition] = useTransition();

  function runReview() {
    startTransition(() => {
      if (mode === "H1") {
        setH2Result(null);
        setH1Result(evaluateAnamnesisH1(content));
      } else {
        setH1Result(null);
        setH2Result(evaluateStrokeH2(content));
      }
    });
  }

  function clearReview() {
    setContent("");
    setH1Result(null);
    setH2Result(null);
  }

  const placeholder =
    mode === "H1"
      ? "Cole o texto da anamnese…"
      : "Cole a avaliação inicial de AVC / initial assessment…";

  return (
    <div className="workspace">
      <section className="panel">
        <label className="field-label" htmlFor="content">
          {mode === "H1" ? "Anamnese" : "Initial assessment"}
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={placeholder}
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

      {mode === "H1" && h1Result ? <H1ResultView result={h1Result} /> : null}
      {mode === "H2" && h2Result ? <H2ResultView result={h2Result} /> : null}
    </div>
  );
}
