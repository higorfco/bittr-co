import { ReviewWorkspace } from "@/components/ReviewWorkspace";

export default function Home() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark">BITTR</span>
          <span className="brand-co">CO.</span>
        </div>
        <p className="tagline">
          Arte antiga da medicina — leitura da anamnese sob o escore PANDA93.
        </p>
        <p className="acronym-note">
          PANDA93 — Plataforma de Análise e Normalização de Dados em Anamnese
        </p>
      </header>

      <main>
        <ReviewWorkspace />
      </main>

      <footer className="site-footer">
        BITTR CO. · PANDA93
      </footer>
    </div>
  );
}
