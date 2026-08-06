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
          Revisão de informações para expor lacunas e fortalecer a montagem
          lógica.
        </p>
      </header>

      <main>
        <ReviewWorkspace />
      </main>

      <footer className="site-footer">
        BITTR CO. · ferramenta de revisão · v0.1
      </footer>
    </div>
  );
}
