import { FormEvent, useEffect, useState } from "react";
import { Category, createTicket, fetchCategories, fetchRelatedSystems, RelatedSystem, CreatedTicket } from "./api.js";

interface Props { requesterId: number; }

export default function CreateTicket({ requesterId }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [priority, setPriority] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "submitting" | "success">("loading");
  const [created, setCreated] = useState<CreatedTicket | null>(null);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchRelatedSystems()]).then(([loadedCategories, loadedSystems]) => {
      setCategories(loadedCategories); setSystems(loadedSystems); setStatus("ready");
    }).catch(() => setStatus("error"));
  }, []);

  function validate() {
    const next: Record<string, string> = {};
    if (!categoryId) next.categoryId = "Category is required";
    if (!relatedSystemId) next.relatedSystemId = "Related System is required";
    if (!summary.trim() || summary.trim().length < 5 || summary.trim().length > 120) next.summary = "Summary must contain 5-120 characters";
    if (!description.trim() || description.trim().length < 10 || description.trim().length > 5000) next.description = "Description must contain 10-5000 characters";
    if (!priority) next.priority = "Requested Priority is required";
    setErrors(next); return next;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (Object.keys(validate()).length) return;
    setStatus("submitting");
    try {
      const ticket = await createTicket(requesterId, { categoryId: Number(categoryId), relatedSystemId: Number(relatedSystemId), summary: summary.trim(), description: description.trim(), requestedPriority: priority }, crypto.randomUUID());
      setCreated(ticket); setStatus("success");
    } catch (error) {
      setErrors((error as Error & { fields?: Record<string, string> }).fields ?? {}); setStatus("ready");
    }
  }

  if (status === "success" && created) return <div className="state-callout state-success" role="status"><strong>Ticket created:</strong> {created.ticketNumber}<p>{created.summary}</p><button type="button" className="btn btn-secondary-green" onClick={() => { setCreated(null); setSummary(""); setDescription(""); setCategoryId(""); setRelatedSystemId(""); setPriority(""); setStatus("ready"); }}>Create Another Ticket</button></div>;
  if (status === "loading") return <div className="state-callout state-info" role="status">Loading Categories and Related Systems...</div>;
  if (status === "error") return <div className="state-callout state-error" role="alert">Unable to load reference data. <button type="button" className="retry-button" onClick={() => window.location.reload()}>Retry</button></div>;
  return <form className="ticket-form" onSubmit={submit} noValidate>
    <h2 id="create-ticket-heading">Create Ticket</h2>
    <p className="helper-text">Ticket Number and Ticket Date are generated after submission.</p>
    <label htmlFor="ticket-category">Category</label>
    <select id="ticket-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-invalid={Boolean(errors.categoryId)} aria-describedby={errors.categoryId ? "category-error" : undefined}><option value="">Select a Category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
    {errors.categoryId && <span id="category-error" className="field-error">{errors.categoryId}</span>}
    <label htmlFor="ticket-system">Related System</label>
    <select id="ticket-system" value={relatedSystemId} onChange={(event) => setRelatedSystemId(event.target.value)} aria-invalid={Boolean(errors.relatedSystemId)}><option value="">Select a Related System</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select>
    {errors.relatedSystemId && <span className="field-error">{errors.relatedSystemId}</span>}
    <label htmlFor="ticket-priority">Requested Priority</label>
    <select id="ticket-priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Select Priority</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
    <label htmlFor="ticket-summary">Summary <span aria-hidden="true">*</span></label><input id="ticket-summary" value={summary} onChange={(event) => setSummary(event.target.value)} aria-invalid={Boolean(errors.summary)} />{errors.summary && <span className="field-error">{errors.summary}</span>}
    <label htmlFor="ticket-description">Description <span aria-hidden="true">*</span></label><textarea id="ticket-description" value={description} onChange={(event) => setDescription(event.target.value)} aria-invalid={Boolean(errors.description)} />{errors.description && <span className="field-error">{errors.description}</span>}
    <button className="btn btn-primary-green" type="submit" disabled={status === "submitting"}>{status === "submitting" ? "Submitting..." : "Submit Ticket"}</button>
  </form>;
}
