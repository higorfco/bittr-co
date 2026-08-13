"use client";

import Image from "next/image";
import { useState, useTransition, type ReactNode } from "react";
import { evaluateAnamnesisH1 } from "@/lib/h1-evaluate";
import { evaluateStrokeH2, type H2Result } from "@/lib/h2-evaluate";
import { evaluateChestPainH3, type H3Result } from "@/lib/h3-evaluate";
import {
  computeBankAttractions,
  evaluatePainS1,
  listS1Banks,
  type S1BankAttraction,
  type S1Result,
} from "@/lib/s1-evaluate";
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

function CollapsePanel({
  title,
  badge,
  badgeClass = "band-partial",
  children,
}: {
  title: string;
  badge?: string | number;
  badgeClass?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="missing-panel"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="missing-panel-toggle">
        <span className="missing-panel-title">{title}</span>
        {badge !== undefined ? (
          <span className={`ciq-pill ${badgeClass}`}>{badge}</span>
        ) : null}
        <span className="missing-panel-hint" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="missing-panel-body">{children}</div>
    </details>
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
    <CollapsePanel title={title} badge={count} badgeClass="band-poor">
      {children}
    </CollapsePanel>
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

      <CollapsePanel title="Escores" badge={result.topics.length}>
        <ul className="topic-list">
          {result.topics.map((topic) => (
            <TopicRow key={topic.topicId} topic={topic} />
          ))}
        </ul>
      </CollapsePanel>

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

      <CollapsePanel
        title="Presentes"
        badge={presentEssential.length + presentOptional.length}
        badgeClass="band-good"
      >
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
      </CollapsePanel>

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
      {title ? <h3>{title}</h3> : null}
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

function coefPill(coef: number): string {
  if (coef >= 0.7) return "band-good";
  if (coef >= 0.45) return "band-partial";
  if (coef >= 0.22) return "band-poor";
  return "band-critical";
}

function AttractionList({ items }: { items: S1BankAttraction[] }) {
  return (
    <ul className="topic-list attraction-list">
      {items.map((item) => (
        <li key={item.file} className="topic-row">
          <div className="topic-head">
            <strong>
              {item.role !== "INCIDENTAL" && item.role !== "INCOMPATÍVEL"
                ? `[${item.role}] `
                : ""}
              {item.file}
            </strong>
            <span className={`ciq-pill ${coefPill(item.coeficiente)}`}>
              {item.coeficiente.toFixed(2)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function S1ResultView({
  result,
  primaryFile,
  secondaryFile,
  tertiaryFile,
  onRolesChange,
}: {
  result: S1Result;
  primaryFile: string;
  secondaryFile: string;
  tertiaryFile: string;
  onRolesChange: (next: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  }) => void;
}) {
  const a = result.avaliacao;
  const r = result.routing;
  const banks = listS1Banks();

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

      <CollapsePanel
        title="Roteamento clínico"
        badge={r.confianca_label}
        badgeClass={coefPill(r.confianca)}
      >
        <ul className="topic-list">
          <li className="topic-row">
            <div className="topic-head">
              <strong>Queixa nuclear</strong>
              <span className="ciq-pill band-good">
                {r.queixa_nuclear || "—"}
              </span>
            </div>
          </li>
          <li className="topic-row">
            <div className="topic-head">
              <strong>Primário</strong>
              <span className="ciq-pill band-partial">
                {r.json_primario || "—"}
              </span>
            </div>
          </li>
          <li className="topic-row">
            <div className="topic-head">
              <strong>Secundário</strong>
              <span className="ciq-pill band-partial">
                {r.json_secundario || "—"}
              </span>
            </div>
          </li>
          <li className="topic-row">
            <div className="topic-head">
              <strong>Terciário</strong>
              <span className="ciq-pill band-partial">
                {r.json_terciario || "—"}
              </span>
            </div>
          </li>
          <li className="topic-row">
            <div className="topic-head">
              <strong>Confiança / margem</strong>
              <span className={`ciq-pill ${coefPill(r.confianca)}`}>
                {r.confianca.toFixed(2)} · {r.confianca_label} · Δ
                {r.margem_dominancia.toFixed(2)}
                {r.classificacao_insegura ? " · INSEGURA" : ""}
                {r.override_manual ? " · MANUAL" : ""}
              </span>
            </div>
          </li>
        </ul>
        <p className="scope-note">{r.motivo_selecao}</p>
      </CollapsePanel>

      <CollapsePanel
        title="Atração semântica dos BCs"
        badge={result.atracoes.length}
      >
        <AttractionList items={result.atracoes} />
      </CollapsePanel>

      <CollapsePanel
        title="Seleção P / S / T (opcional)"
        badge="override"
      >
        <label className="field-label" htmlFor="s1-primary">
          Primário
        </label>
        <select
          id="s1-primary"
          className="bank-select bank-select-compact"
          value={primaryFile}
          onChange={(e) => onRolesChange({ primary: e.target.value })}
        >
          <option value="">Automático</option>
          {banks.map((bank) => {
            const coef =
              result.atracoes.find((a) => a.file === bank.file)?.coeficiente ??
              0;
            return (
              <option key={bank.file} value={bank.file}>
                {coef.toFixed(2)} · {bank.file}
              </option>
            );
          })}
        </select>

        <label className="field-label" htmlFor="s1-secondary">
          Secundário
        </label>
        <select
          id="s1-secondary"
          className="bank-select bank-select-compact"
          value={secondaryFile}
          onChange={(e) => onRolesChange({ secondary: e.target.value })}
        >
          <option value="">Nenhum / automático</option>
          {banks.map((bank) => {
            const coef =
              result.atracoes.find((a) => a.file === bank.file)?.coeficiente ??
              0;
            return (
              <option key={bank.file} value={bank.file}>
                {coef.toFixed(2)} · {bank.file}
              </option>
            );
          })}
        </select>

        <label className="field-label" htmlFor="s1-tertiary">
          Terciário
        </label>
        <select
          id="s1-tertiary"
          className="bank-select bank-select-compact"
          value={tertiaryFile}
          onChange={(e) => onRolesChange({ tertiary: e.target.value })}
        >
          <option value="">Nenhum / automático</option>
          {banks.map((bank) => {
            const coef =
              result.atracoes.find((a) => a.file === bank.file)?.coeficiente ??
              0;
            return (
              <option key={bank.file} value={bank.file}>
                {coef.toFixed(2)} · {bank.file}
              </option>
            );
          })}
        </select>
      </CollapsePanel>

      <CollapsePanel title="Avaliação" badge={a.score_global}>
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
      </CollapsePanel>

      <CollapsePanel
        title="Informações presentes"
        badge={result.informacoes_presentes.length}
        badgeClass="band-good"
      >
        <ListBlock title="" items={result.informacoes_presentes} />
      </CollapsePanel>
      <CollapsePanel title="Ambiguidades" badge={result.ambiguidades.length}>
        <ListBlock title="" items={result.ambiguidades} />
      </CollapsePanel>
      <CollapsePanel title="Contradições" badge={result.contradicoes.length}>
        <ListBlock title="" items={result.contradicoes} />
      </CollapsePanel>
      <CollapsePanel
        title="Negativas pertinentes"
        badge={result.negativas_pertinentes_documentadas.length}
        badgeClass="band-good"
      >
        <ListBlock
          title=""
          items={result.negativas_pertinentes_documentadas}
        />
      </CollapsePanel>

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

      <CollapsePanel
        title="Não aplicáveis"
        badge={result.campos_nao_aplicaveis.length}
      >
        <ListBlock title="" items={result.campos_nao_aplicaveis} />
      </CollapsePanel>

      {r.arquivos_descartados_relevantes.length ? (
        <CollapsePanel
          title="Arquivos descartados (auditoria)"
          badge={r.arquivos_descartados_relevantes.length}
        >
          <ListBlock title="" items={r.arquivos_descartados_relevantes} />
        </CollapsePanel>
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
  const [s1Primary, setS1Primary] = useState("");
  const [s1Secondary, setS1Secondary] = useState("");
  const [s1Tertiary, setS1Tertiary] = useState("");
  const [s1Preview, setS1Preview] = useState<S1BankAttraction[]>([]);
  const [s1Result, setS1Result] = useState<S1Result | null>(null);
  const [h1Result, setH1Result] = useState<H1Result | null>(null);
  const [h2Result, setH2Result] = useState<H2Result | null>(null);
  const [h3Result, setH3Result] = useState<H3Result | null>(null);
  const [isPending, startTransition] = useTransition();
  const s1Banks = listS1Banks();

  function refreshPreview(text: string) {
    if (!text.trim()) {
      setS1Preview([]);
      return;
    }
    setS1Preview(computeBankAttractions(text));
  }

  function runS1(next?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  }) {
    const primary = next?.primary !== undefined ? next.primary : s1Primary;
    const secondary =
      next?.secondary !== undefined ? next.secondary : s1Secondary;
    const tertiary = next?.tertiary !== undefined ? next.tertiary : s1Tertiary;
    setS1Result(
      evaluatePainS1(content, {
        primaryFile: primary || null,
        secondaryFile: secondary || null,
        tertiaryFile: tertiary || null,
      }),
    );
  }

  function runReview() {
    startTransition(() => {
      setS1Result(null);
      setH1Result(null);
      setH2Result(null);
      setH3Result(null);
      if (mode === "S1") runS1();
      if (mode === "H1") setH1Result(evaluateAnamnesisH1(content));
      if (mode === "H2") setH2Result(evaluateStrokeH2(content));
      if (mode === "H3") setH3Result(evaluateChestPainH3(content));
    });
  }

  function clearReview() {
    setContent("");
    setS1Primary("");
    setS1Secondary("");
    setS1Tertiary("");
    setS1Preview([]);
    setS1Result(null);
    setH1Result(null);
    setH2Result(null);
    setH3Result(null);
  }

  function handleRolesChange(next: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  }) {
    if (next.primary !== undefined) setS1Primary(next.primary);
    if (next.secondary !== undefined) setS1Secondary(next.secondary);
    if (next.tertiary !== undefined) setS1Tertiary(next.tertiary);
    if (!content.trim()) return;
    startTransition(() => {
      runS1(next);
    });
  }

  const INPUT_PLACEHOLDER = "Ἄγε, λέγε μοι· τί ἔμαθες";

  return (
    <div className="workspace">
      <section className="panel">
        <textarea
          id="content"
          aria-label="Texto clínico"
          value={content}
          onChange={(event) => {
            const value = event.target.value;
            setContent(value);
            if (mode === "S1") refreshPreview(value);
          }}
          placeholder={INPUT_PLACEHOLDER}
          rows={14}
        />

        {mode === "S1" ? (
          <CollapsePanel
            title="CARAPUÇA A SERVIR"
            badge={s1Banks.length}
          >
            <AttractionList
              items={
                s1Preview.length
                  ? s1Preview
                  : s1Banks.map((b) => ({
                      id: b.id,
                      file: b.file,
                      label: b.label,
                      coeficiente: 0,
                      role: "INCIDENTAL" as const,
                      evidencias_favoraveis: [],
                      evidencias_conflitantes: [],
                    }))
              }
            />
            <label className="field-label" htmlFor="s1-primary-pre">
              Primário (opcional)
            </label>
            <select
              id="s1-primary-pre"
              className="bank-select bank-select-compact"
              value={s1Primary}
              onChange={(e) => setS1Primary(e.target.value)}
            >
              <option value="">Automático</option>
              {s1Banks.map((bank) => {
                const coef =
                  s1Preview.find((a) => a.file === bank.file)?.coeficiente ?? 0;
                return (
                  <option key={bank.file} value={bank.file}>
                    {coef.toFixed(2)} · {bank.file}
                  </option>
                );
              })}
            </select>
            <label className="field-label" htmlFor="s1-secondary-pre">
              Secundário (opcional)
            </label>
            <select
              id="s1-secondary-pre"
              className="bank-select bank-select-compact"
              value={s1Secondary}
              onChange={(e) => setS1Secondary(e.target.value)}
            >
              <option value="">Nenhum / automático</option>
              {s1Banks.map((bank) => {
                const coef =
                  s1Preview.find((a) => a.file === bank.file)?.coeficiente ?? 0;
                return (
                  <option key={bank.file} value={bank.file}>
                    {coef.toFixed(2)} · {bank.file}
                  </option>
                );
              })}
            </select>
            <label className="field-label" htmlFor="s1-tertiary-pre">
              Terciário (opcional)
            </label>
            <select
              id="s1-tertiary-pre"
              className="bank-select bank-select-compact"
              value={s1Tertiary}
              onChange={(e) => setS1Tertiary(e.target.value)}
            >
              <option value="">Nenhum / automático</option>
              {s1Banks.map((bank) => {
                const coef =
                  s1Preview.find((a) => a.file === bank.file)?.coeficiente ?? 0;
                return (
                  <option key={bank.file} value={bank.file}>
                    {coef.toFixed(2)} · {bank.file}
                  </option>
                );
              })}
            </select>
          </CollapsePanel>
        ) : null}

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

      {mode === "S1" && s1Result ? (
        <S1ResultView
          result={s1Result}
          primaryFile={s1Primary}
          secondaryFile={s1Secondary}
          tertiaryFile={s1Tertiary}
          onRolesChange={handleRolesChange}
        />
      ) : null}
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
