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
        <div className="ornament" aria-hidden="true">
          ✦
        </div>
      </header>

      <main>
        <ReviewWorkspace key={mode} mode={mode} />
      </main>

      <footer className="site-footer">
        <p className="acronym-note footer-acronym">
          PANDA93 — Plataforma de Análise e Normalização de Dados em Anamnese
        </p>
        <p className="footer-brand">BITTR CO.</p>
      </footer>
    </div>
  );
}
