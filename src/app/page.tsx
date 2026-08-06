"use client";

import { useState } from "react";
import {
  ModeSwitch,
  ReviewWorkspace,
  type AppMode,
} from "@/components/ReviewWorkspace";

export default function Home() {
  const [mode, setMode] = useState<AppMode>("H1");

  return (
    <div className="app-shell">
      <header className="site-header">
        <ModeSwitch mode={mode} onChange={setMode} />
        <div className="brand">
          <span className="brand-mark">BITTR</span>
          <span className="brand-co">CO.</span>
        </div>
        <p className="tagline">Prezando pela melhor assistência</p>
        <div className="ornament" aria-hidden="true">
          ✦
        </div>
        <p className="acronym-note">
          PANDA93 — Plataforma de Análise e Normalização de Dados em Anamnese
        </p>
      </header>

      <main>
        <ReviewWorkspace key={mode} mode={mode} />
      </main>

      <footer className="site-footer">BITTR CO. · PANDA93 · {mode}</footer>
    </div>
  );
}
