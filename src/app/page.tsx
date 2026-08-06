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
          Qualidade da anamnese — coeficiente de completude clínica (H1).
        </p>
      </header>

      <main>
        <ReviewWorkspace />
      </main>

      <footer className="site-footer">
        BITTR CO. · modo H1 · v0.2
      </footer>
    </div>
  );
}
