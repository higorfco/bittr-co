"use client";

import Image from "next/image";
import { useState, useTransition, type ReactNode } from "react";
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

function MissingPanel({
  title = "Informações faltantes",
  count,
  children,
}: {
  title?: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details className="missing-panel">
      <summary className="missing-panel-toggle">
        <span className="missing-panel-title">{title}</span>
        <span className="ciq-pill band-poor">{count}</span>
        <span className="missing-panel-hint" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="missing-panel-body">{children}</div>
    </details>
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

      <MissingPanel count={result.missing.length}>
        {result.missing.length ? (
          <ul className="finding-list">
            {result.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">Nenhuma lacuna essencial evidente.</p>
        )}
      </MissingPanel>
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

      <MissingPanel count={result.missing.length}>
        {result.missing.length ? (
          <ul className="finding-list">
            {result.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">Nenhuma lacuna essencial evidente.</p>
        )}
      </MissingPanel>
    </section>
  );
}

function ListBlock({
  title,
  items,
  empty = "Nenhum.",
}: {
  title: string;
  items: string[];
  empty?: string;
}) {
  return (
    <>
      <h3>{title}</h3>
      {items.length ? (
        <ul className="finding-list">
          {items.map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">{empty}</p>
      )}
    </>
  );
}

function S1ResultView({ result }: { result: S1Result }) {
  const a = result.avaliacao;
  const r = result.routing;

  return (
    <section className="panel result-panel" aria-live="polite">
      <div className="score-row">
        <div>
          <p className="eyebrow">S1 · Análise crítica QD/QP/HMA</p>
          <p className="score">
            PANDA93: {result.panda93}/{PANDA93_MAX}
          </p>
          <p className="acronym-note">{result.law}</p>
          <p className="acronym-note">{result.sourcePack}</p>
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

      <h3>Roteamento clínico</h3>
      <ul className="topic-list">
        <li className="topic-row">
          <div className="topic-head">
            <strong>Queixa dominante</strong>
            <span className="ciq-pill band-good">
              {r.queixa_principal_identificada || "—"}
            </span>
          </div>
        </li>
        <li className="topic-row">
          <div className="topic-head">
            <strong>JSON primário</strong>
            <span className="ciq-pill band-partial">{r.json_primario || "—"}</span>
          </div>
        </li>
        <li className="topic-row">
          <div className="topic-head">
            <strong>Confiança</strong>
            <span
              className={`ciq-pill ${r.confianca >= 0.7 ? "band-good" : r.confianca >= 0.5 ? "band-partial" : "band-poor"}`}
            >
              {r.confianca.toFixed(2)}
              {r.classificacao_insegura ? " · INSEGURA" : ""}
            </span>
          </div>
        </li>
      </ul>
      <p className="scope-note">{r.motivo_selecao}</p>
      {r.json_secundarios.length ? (
        <p className="scope-note">
          Secundários: {r.json_secundarios.join(", ")}
        </p>
      ) : null}

      <h3>Avaliação</h3>
      <ul className="topic-list">
        {(
          [
            ["Completude", a.completude],
            ["Clareza", a.clareza],
            ["Relevância", a.relevancia],
            ["Coerência", a.coerencia],
            ["Segurança documental", a.seguranca_documental],
            ["Score global", a.score_global],
          ] as const
        ).map(([label, value]) => (
          <li key={label} className="topic-row">
            <div className="topic-head">
              <strong>{label}</strong>
              <span className={`ciq-pill ${bandClass(toPanda93Like(value))}`}>
                {value}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <ListBlock title="Informações presentes" items={result.informacoes_presentes} />
      <ListBlock title="Ambiguidades" items={result.ambiguidades} />
      <ListBlock title="Contradições" items={result.contradicoes} />
      <ListBlock
        title="Negativas pertinentes"
        items={result.negativas_pertinentes_documentadas}
      />

      <MissingPanel
        count={
          result.informacoes_ausentes_relevantes.length +
          result.informacoes_parciais.length +
          result.informacoes_vagas.length +
          result.pontos_de_melhoria_prioritarios.length
        }
      >
        <ListBlock
          title="Ausentes relevantes"
          items={result.informacoes_ausentes_relevantes}
          empty="Nenhuma lacuna relevante no contexto."
        />
        <ListBlock
          title="Informações parciais"
          items={result.informacoes_parciais}
        />
        <ListBlock title="Informações vagas" items={result.informacoes_vagas} />
        <ListBlock
          title="Condicionais não ativados"
          items={result.campos_condicionais_nao_ativados}
        />
        <h3>Pontos de melhoria prioritários</h3>
        {result.pontos_de_melhoria_prioritarios.length ? (
          <ul className="finding-list">
            {result.pontos_de_melhoria_prioritarios.map((item) => (
              <li key={`${item.nivel}-${item.texto}`}>
                [{item.nivel}] {item.texto}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">Nenhuma lacuna de alto valor evidente.</p>
        )}
      </MissingPanel>

      <ListBlock
        title="Não aplicáveis"
        items={result.campos_nao_aplicaveis}
      />

      {r.arquivos_descartados_relevantes.length ? (
        <ListBlock
          title="Arquivos descartados (auditoria)"
          items={r.arquivos_descartados_relevantes}
        />
      ) : null}
    </section>
  );
}

function toPanda93Like(score100: number): number {
  return Math.round((score100 / 100) * PANDA93_MAX);
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
            aria-label="S1"
            aria-pressed={mode === item}
            className={`mode-btn mode-btn-s1 ${mode === item ? "active" : ""}`}
            onClick={() => onChange(item)}
          >
            <Image
              src="/s1-hipocrates.png"
              alt=""
              className="mode-s1-icon"
              width={176}
              height={176}
              priority
            />
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
      field: "QD / QP / HMA (HPMA)",
      placeholder:
        "Cole a Queixa e Duração, Queixa Principal e/ou História da Moléstia Atual…",
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
