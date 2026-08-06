"use client";

import { useState, useTransition } from "react";
import { evaluateAnamnesisH1 } from "@/lib/h1-evaluate";
import { evaluateStrokeH2, type H2Result } from "@/lib/h2-evaluate";
import { evaluateChestPainH3, type H3Result } from "@/lib/h3-evaluate";
import { evaluatePainS1, type S1Result } from "@/lib/s1-evaluate";
import { PANDA93_MAX } from "@/lib/panda93";
import type { H1Result, TopicScore } from "@/lib/types";

export type AppMode = "S1" | "H1" | "H2" | "H3";

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

function ChecklistResultView({
  eyebrow,
  result,
}: {
  eyebrow: string;
  result: H2Result | H3Result;
}) {
  const presentOptional = result.items.filter((i) => i.present && !i.essential);
  const presentEssential = result.items.filter((i) => i.present && i.essential);

  return (
    <section className="panel result-panel" aria-live="polite">
      <div className="score-row">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <p className="score">
            PANDA93: {result.panda93}/{PANDA93_MAX}
          </p>
          <p className="acronym-note">
            {result.presentCount}/{result.totalEssential} itens essenciais
            presentes
          </p>
          <p className="acronym-note">Fonte: {result.sourceTitle}</p>
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

function S1ResultView({ result }: { result: S1Result }) {
  return (
    <section className="panel result-panel" aria-live="polite">
      <div className="score-row">
        <div>
          <p className="eyebrow">S1 · Dor na QP + HPMA</p>
          <p className="score">
            PANDA93: {result.panda93}/{PANDA93_MAX}
          </p>
          <p className="acronym-note">{result.law}</p>
          <p className="acronym-note">Terminologia: {result.sourcePack}</p>
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

      <p className="scope-note">{result.scopeNote}</p>

      <h3>Etapa 1 — Existe dor?</h3>
      <p className="s1-presence">{result.painPresence}</p>

      <h3>Etapa 2 — Atributos da dor</h3>
      <ul className="topic-list">
        {result.attributes.map((item) => (
          <li key={item.key} className="topic-row">
            <div className="topic-head">
              <strong>{item.key}</strong>
              <span
                className={`ciq-pill ${item.found || item.key === "Dor" ? "band-good" : "band-poor"}`}
              >
                {item.value ?? "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <h3>Etapa 3 — Completude</h3>
      <ul className="topic-list">
        {result.completeness.map((item) => (
          <li key={item.key} className="topic-row">
            <div className="topic-head">
              <strong>{item.key}</strong>
              <span
                className={`ciq-pill ${item.found ? "band-good" : "band-poor"}`}
              >
                {item.found ? "presente" : "ausente"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <h3>Etapa 4 — Informações faltantes</h3>
      {result.missingBlocks.length ? (
        <ul className="finding-list s1-missing">
          {result.missingBlocks.map((block) => (
            <li key={block}>
              <pre className="s1-missing-block">{block}</pre>
            </li>
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
  const sModes: AppMode[] = ["S1"];
  const hModes: AppMode[] = ["H1", "H2", "H3"];

  return (
    <div className="mode-switch-stack">
      <nav className="mode-switch mode-switch-s" aria-label="Modelos S">
        {sModes.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={mode === item}
            className={`mode-btn ${mode === item ? "active" : ""}`}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <nav className="mode-switch mode-switch-h" aria-label="Modelos H">
        {hModes.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={mode === item}
            className={`mode-btn ${mode === item ? "active" : ""}`}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function ReviewWorkspace({ mode }: { mode: AppMode }) {
  const [content, setContent] = useState("");
  const [s1Result, setS1Result] = useState<S1Result | null>(null);
  const [h1Result, setH1Result] = useState<H1Result | null>(null);
  const [h2Result, setH2Result] = useState<H2Result | null>(null);
  const [h3Result, setH3Result] = useState<H3Result | null>(null);
  const [isPending, startTransition] = useTransition();

  function runReview() {
    startTransition(() => {
      setS1Result(null);
      setH1Result(null);
      setH2Result(null);
      setH3Result(null);
      if (mode === "S1") setS1Result(evaluatePainS1(content));
      if (mode === "H1") setH1Result(evaluateAnamnesisH1(content));
      if (mode === "H2") setH2Result(evaluateStrokeH2(content));
      if (mode === "H3") setH3Result(evaluateChestPainH3(content));
    });
  }

  function clearReview() {
    setContent("");
    setS1Result(null);
    setH1Result(null);
    setH2Result(null);
    setH3Result(null);
  }

  const labels: Record<AppMode, { field: string; placeholder: string }> = {
    S1: {
      field: "QP + HPMA (dor)",
      placeholder:
        "Cole a Queixa Principal e a História da Moléstia Atual…",
    },
    H1: {
      field: "Anamnese",
      placeholder: "Cole o texto da anamnese…",
    },
    H2: {
      field: "Initial assessment · AVC",
      placeholder: "Cole a avaliação inicial de AVC…",
    },
    H3: {
      field: "Chest pain / chest wall trauma",
      placeholder: "Cole o texto de dor torácica ou trauma de parede torácica…",
    },
  };

  return (
    <div className="workspace">
      <section className="panel">
        <label className="field-label" htmlFor="content">
          {labels[mode].field}
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={labels[mode].placeholder}
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

      {mode === "S1" && s1Result ? <S1ResultView result={s1Result} /> : null}
      {mode === "H1" && h1Result ? <H1ResultView result={h1Result} /> : null}
      {mode === "H2" && h2Result ? (
        <ChecklistResultView
          eyebrow="Initial assessment · AVC"
          result={h2Result}
        />
      ) : null}
      {mode === "H3" && h3Result ? (
        <ChecklistResultView
          eyebrow="Chest pain · chest wall trauma"
          result={h3Result}
        />
      ) : null}
    </div>
  );
}
