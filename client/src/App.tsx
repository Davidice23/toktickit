import { useEffect, useState } from "react";
import { checkSystem, Category, fetchRequesters, Requester } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";
type RequesterUiState = "idle" | "loading" | "ready" | "empty" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [requesterUiState, setRequesterUiState] = useState<RequesterUiState>("idle");
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedRequester, setSelectedRequester] = useState<Requester | null>(null);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const storedId = localStorage.getItem("toktickit.devRequesterId");
    if (!storedId) return;
    fetchRequesters().then((available) => {
      const requester = available.find(({ id }) => String(id) === storedId);
      if (requester) setSelectedRequester(requester);
      else localStorage.removeItem("toktickit.devRequesterId");
    }).catch(() => {
      localStorage.removeItem("toktickit.devRequesterId");
    });
  }, []);

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

  async function loadRequesters() {
    setRequesterUiState("loading");
    try {
      const result = await fetchRequesters();
      setRequesters(result);
      setRequesterUiState(result.length ? "ready" : "empty");
    } catch {
      setRequesters([]);
      setRequesterUiState("error");
    }
  }

  function continueAsRequester() {
    const requester = requesters.find(({ id }) => String(id) === selectedId);
    if (!requester) return;
    localStorage.setItem("toktickit.devRequesterId", String(requester.id));
    setSelectedRequester(requester);
    setRequesterUiState("idle");
  }

  function changeRequester() {
    localStorage.removeItem("toktickit.devRequesterId");
    setSelectedRequester(null);
    setSelectedId("");
    loadRequesters();
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
          <span className="requester-context" aria-label="Current Requester">Requester: {selectedRequester?.name ?? "Not selected"}</span>
          <button className="nav-action" type="button" onClick={() => { setMenuOpen(false); changeRequester(); }}>Change Requester</button>
        </nav>
      </header>

      <main id="top" className="app-main">
        <section className="page-card" aria-labelledby="page-title">
          <p className="eyebrow">IT Service Desk</p>
          <h1 id="page-title">Requester workspace</h1>
          <p className="page-intro">A clear, responsive workspace for creating and tracking your IT requests.</p>

          {!selectedRequester && (
            <section className="requester-card" aria-labelledby="requester-heading">
              <h2 id="requester-heading">Select Development Requester</h2>
              <p className="helper-text">This selector is for Lab 2 testing only; it is not login or authentication. Authentication arrives in Lab 3.</p>
              {requesterUiState === "idle" && <button className="btn btn-secondary-green" type="button" onClick={loadRequesters}>Choose Requester</button>}
              {requesterUiState === "loading" && <div className="state-callout state-info" role="status" aria-live="polite"><strong>Loading:</strong> Development Requesters...</div>}
              {requesterUiState === "error" && <div className="state-callout state-error" role="alert"><strong>Unable to load Requesters.</strong><button className="retry-button" type="button" onClick={loadRequesters}>Retry</button></div>}
              {requesterUiState === "empty" && <div className="state-callout state-warning" role="status">No active Development Requesters are available.</div>}
              {requesterUiState === "ready" && <div className="requester-form">
                <label htmlFor="requester-select">Development Requester</label>
                <select id="requester-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  <option value="">Select a Requester</option>
                  {requesters.map((requester) => <option key={requester.id} value={requester.id}>{requester.name}</option>)}
                </select>
                <button className="btn btn-primary-green" type="button" disabled={!selectedId} onClick={continueAsRequester}>Continue</button>
              </div>}
            </section>
          )}

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
