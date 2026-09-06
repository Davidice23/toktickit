import { FormEvent, useEffect, useState } from "react";
import { Category, createTicket, fetchCategories, fetchRelatedSystems, RelatedSystem, CreatedTicket, uploadAttachments } from "./api.js";

interface Props { requesterId: number; onViewTicket?: (ticketId: number) => void; onMyTickets?: () => void; }

export default function CreateTicket({ requesterId, onViewTicket, onMyTickets }: Props) {
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
  const [files, setFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [uploadFailure, setUploadFailure] = useState("");

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
    if (files.length > 5) next.attachments = "Select no more than five attachments";
    setErrors(next); return next;
  }

  function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    const invalid = selected.find((file) => !allowed.has(file.type) || file.size > 5 * 1024 * 1024);
    setAttachmentError(invalid ? `${invalid.name} is invalid. Use JPG, PNG, WEBP, or PDF up to 5 MB.` : "");
    setFiles(invalid ? selected.filter((file) => allowed.has(file.type) && file.size <= 5 * 1024 * 1024).slice(0, 5) : selected.slice(0, 5));
    event.target.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (Object.keys(validate()).length) return;
    setStatus("submitting");
    try {
      const ticket = await createTicket(requesterId, { categoryId: Number(categoryId), relatedSystemId: Number(relatedSystemId), summary: summary.trim(), description: description.trim(), requestedPriority: priority }, crypto.randomUUID());
      if (files.length) { try { await uploadAttachments(requesterId, ticket.id, files); } catch { setUploadFailure("Ticket was created, but one or more attachments could not be uploaded. Add them from Ticket Detail or retry."); } }
      setCreated(ticket); setStatus("success");
    } catch (error) {
      setErrors((error as Error & { fields?: Record<string, string> }).fields ?? {}); setStatus("ready");
    }
  }

  if (status === "success" && created) return <div className="state-callout state-success" role="status"><strong>Ticket created:</strong> {created.ticketNumber}<p>{created.summary}</p>{uploadFailure && <p className="state-callout state-warning">{uploadFailure}</p>}<div className="success-actions">{onViewTicket && <button type="button" className="btn btn-primary-green" onClick={() => onViewTicket(created.id)}>View Ticket</button>}{onMyTickets && <button type="button" className="btn btn-secondary-green" onClick={onMyTickets}>My Tickets</button>}<button type="button" className="btn btn-secondary-green" onClick={() => { setCreated(null); setSummary(""); setDescription(""); setCategoryId(""); setRelatedSystemId(""); setPriority(""); setFiles([]); setUploadFailure(""); setStatus("ready"); }}>Create Another Ticket</button></div></div>;
  if (status === "loading") return <div className="state-callout state-info" role="status">Loading Categories and Related Systems...</div>;
  if (status === "error") return <div className="state-callout state-error" role="alert">Unable to load reference data. <button type="button" className="retry-button" onClick={() => window.location.reload()}>Retry</button></div>;
  return <form className="ticket-form" onSubmit={submit} noValidate>
    <h2 id="create-ticket-heading">Create Ticket</h2>
    <p className="helper-text">Ticket Number and Ticket Date are generated after submission.</p>
    <label htmlFor="ticket-category">Category</label>
    <select id="ticket-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-invalid={Boolean(errors.categoryId)} aria-describedby={errors.categoryId ? "category-error" : undefined}><option value="">Select a Category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
    {errors.categoryId && <span id="category-error" className="field-error">{errors.categoryId}</span>}
    <label htmlFor="ticket-system">Related System</label>
    <select id="ticket-system" value={relatedSystemId} onChange={(event) => setRelatedSystemId(event.target.value)} aria-invalid={Boolean(errors.relatedSystemId)} aria-describedby={errors.relatedSystemId ? "system-error" : undefined}><option value="">Select a Related System</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select>
    {errors.relatedSystemId && <span id="system-error" className="field-error">{errors.relatedSystemId}</span>}
    <label htmlFor="ticket-priority">Requested Priority</label>
    <select id="ticket-priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Select Priority</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
    <label htmlFor="ticket-summary">Summary <span aria-hidden="true">*</span></label><input id="ticket-summary" value={summary} onChange={(event) => setSummary(event.target.value)} aria-required="true" aria-invalid={Boolean(errors.summary)} aria-describedby={errors.summary ? "summary-error" : undefined} />{errors.summary && <span id="summary-error" className="field-error">{errors.summary}</span>}
    <label htmlFor="ticket-description">Description <span aria-hidden="true">*</span></label><textarea id="ticket-description" value={description} onChange={(event) => setDescription(event.target.value)} aria-required="true" aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "description-error" : undefined} />{errors.description && <span id="description-error" className="field-error">{errors.description}</span>}
    <label htmlFor="ticket-attachments">Attachments (JPG, PNG, WEBP, PDF; max 5 MB each)</label><input id="ticket-attachments" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={selectFiles} aria-describedby={attachmentError || errors.attachments ? "attachment-error" : undefined} />{files.length > 0 && <ul className="attachment-selection">{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} ({Math.ceil(file.size / 1024)} KB)</li>)}</ul>}{attachmentError && <span id="attachment-error" className="field-error">{attachmentError}</span>}{errors.attachments && <span className="field-error">{errors.attachments}</span>}
    <button className="btn btn-primary-green" type="submit" disabled={status === "submitting"}>{status === "submitting" ? "Submitting..." : "Submit Ticket"}</button>
  </form>;
}
