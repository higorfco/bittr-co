import { ReviewWorkspace } from "@/components/ReviewWorkspace";

export default function Home() {
  return (
    <div className="app-shell">
      <header className="site-header">
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
        <ReviewWorkspace />
      </main>

      <footer className="site-footer">BITTR CO. · PANDA93</footer>
    </div>
  );
}
