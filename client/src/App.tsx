import { useState } from "react";
import { checkSystem, Category } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleCheck() {
    setState("loading");

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setCategories([]);
      setState("error");
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="app-brand" href="#top" aria-label="TokTickIT home">TokTickIT</a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
        <nav id="primary-navigation" className={`primary-navigation${menuOpen ? " is-open" : ""}`} aria-label="Primary navigation">
          <a className="nav-link is-active" href="#my-tickets" aria-current="page" onClick={() => setMenuOpen(false)}>My Tickets</a>
          <a className="nav-link" href="#create-ticket" onClick={() => setMenuOpen(false)}>Create Ticket</a>
          <span className="requester-context" aria-label="Current Requester">Requester: Not selected</span>
          <button className="nav-action" type="button" onClick={() => setMenuOpen(false)}>Change Requester</button>
        </nav>
      </header>

      <main id="top" className="app-main">
        <section className="page-card" aria-labelledby="page-title">
          <p className="eyebrow">IT Service Desk</p>
          <h1 id="page-title">Requester workspace</h1>
          <p className="page-intro">A clear, responsive workspace for creating and tracking your IT requests.</p>

          <button className="btn btn-primary-green" onClick={handleCheck} disabled={state === "loading"}>
            {state === "loading" ? "Loading..." : "Check System"}
          </button>

          {state === "loading" && (
            <div className="state-callout state-info" role="status" aria-live="polite">
              <strong>Loading:</strong> Checking TokTickIT API...
            </div>
          )}

          {state === "success" && (
            <>
              <div className="state-callout state-success" role="status">
                <strong>System Status:</strong> Online
              </div>

              <section aria-labelledby="category-heading">
                <h2 id="category-heading">IT Request Categories</h2>
                <ul className="category-list">
                  {categories.map((category) => (
                    <li className="category-item" key={category.id}>{category.name}</li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {state === "error" && (
            <div className="state-callout state-error" role="alert">
              <p><strong>System Status:</strong> Offline</p>
              <p>Unable to connect to TokTickIT API</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
