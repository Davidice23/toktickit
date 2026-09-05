import express, { Request, Response } from "express";
import cors from "cors";
import { createHash, randomUUID } from "node:crypto";
import { RequestedPriority } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import multer from "multer";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

const attachmentRoot = path.resolve(process.cwd(), "storage", "attachments");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5 } });
const allowedAttachmentTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function safeOriginalName(value: string): string | null {
  const name = path.basename(value).trim();
  return name && name.length <= 255 && !/[\u0000-\u001f]/.test(name) ? name : null;
}

function hasValidSignature(file: Express.Multer.File): boolean {
  const bytes = file.buffer;
  if (file.mimetype === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (file.mimetype === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === "image/jpeg") return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (file.mimetype === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function parseAttachmentUpload(req: Request, res: Response, next: () => void) {
  upload.array("files", 5)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Attachment upload rejected" });
    if (error) return res.status(400).json({ error: "Attachment upload rejected" });
    return next();
  });
}

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    res.status(200).json(categories);
  } catch {
    res.status(500).json({ error: "Unable to load IT request categories" });
  }
});

app.get("/api/requesters", async (req: Request, res: Response) => {
  try {
    // The Lab 2 selector uses active=true (or the safe active-only default).
    // active=false intentionally means no activity filter for future staff views.
    const active = req.query.active === undefined || req.query.active === "true";
    const requesters = await getPrisma().requesterUser.findMany({
      where: active ? { isActive: true } : undefined,
      select: { id: true, name: true, isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    res.status(200).json(requesters);
  } catch {
    res.status(500).json({ error: "Unable to load Development Requesters" });
  }
});

app.get("/api/related-systems", async (req: Request, res: Response) => {
  try {
    const active = req.query.active === undefined || req.query.active === "true";
    const systems = await getPrisma().relatedSystem.findMany({
      where: active ? { isActive: true } : undefined,
      select: { id: true, name: true, isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    res.status(200).json(systems);
  } catch {
    res.status(500).json({ error: "Unable to load Related Systems" });
  }
});

const ticketDetailSelect = {
  id: true,
  ticketNumber: true,
  requesterId: true,
  categoryId: true,
  relatedSystemId: true,
  summary: true,
  description: true,
  requestedPriority: true,
  currentStatus: true,
  itPriority: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, name: true, email: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
} as const;

function positiveInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function validationError(res: Response, fields: Record<string, string>) {
  return res.status(400).json({ error: "Validation failed", fields });
}

app.post("/api/tickets", async (req: Request, res: Response) => {
  const requesterId = positiveInteger(req.header("X-Requester-Id"));
  const submissionKey = normalizeText(req.header("Idempotency-Key"));
  const body = req.body as Record<string, unknown>;
  const fields: Record<string, string> = {};

  if (!requesterId) fields.requesterId = "X-Requester-Id must be a positive integer";
  if (!submissionKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionKey)) {
    fields.idempotencyKey = "Idempotency-Key must be a UUID";
  }

  const categoryId = positiveInteger(body.categoryId);
  const relatedSystemId = positiveInteger(body.relatedSystemId);
  const summary = normalizeText(body.summary);
  const description = normalizeText(body.description);
  const requestedPriority = body.requestedPriority;
  if (!categoryId) fields.categoryId = "Category is required";
  if (!relatedSystemId) fields.relatedSystemId = "Related System is required";
  if (!summary || summary.length < 5 || summary.length > 120) fields.summary = "Summary must contain 5-120 characters";
  if (!description || description.length < 10 || description.length > 5000) fields.description = "Description must contain 10-5000 characters";
  if (typeof requestedPriority !== "string" || !Object.values(RequestedPriority).includes(requestedPriority as RequestedPriority)) {
    fields.requestedPriority = "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT";
  }
  if (Object.keys(fields).length) return validationError(res, fields);

  const validCategoryId = categoryId as number;
  const validRelatedSystemId = relatedSystemId as number;
  const validRequesterId = requesterId as number;
  const validSummary = summary as string;
  const validDescription = description as string;
  const validSubmissionKey = submissionKey as string;

  const canonicalPayload = JSON.stringify({ categoryId: validCategoryId, relatedSystemId: validRelatedSystemId, summary: validSummary, description: validDescription, requestedPriority });
  const submissionHash = createHash("sha256").update(canonicalPayload).digest("hex");

  try {
    const prisma = getPrisma();
    const requester = await prisma.requesterUser.findFirst({ where: { id: validRequesterId, isActive: true }, select: { id: true } });
    if (!requester) return validationError(res, { requesterId: "Requester is missing or inactive" });

    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirst({ where: { id: validCategoryId, isActive: true }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { id: validRelatedSystemId, isActive: true }, select: { id: true } }),
    ]);
    if (!category) fields.categoryId = "Category is missing or inactive";
    if (!relatedSystem) fields.relatedSystemId = "Related System is missing or inactive";
    if (Object.keys(fields).length) return validationError(res, fields);

    const existing = await prisma.ticket.findUnique({
      where: { requesterId_submissionKey: { requesterId: validRequesterId, submissionKey: validSubmissionKey } },
      select: { submissionHash: true, id: true },
    });
    if (existing) {
      if (existing.submissionHash !== submissionHash) return res.status(409).json({ error: "Idempotency-Key was already used with a different request" });
      const replay = await prisma.ticket.findUnique({ where: { id: existing.id }, select: ticketDetailSelect });
      res.setHeader("Idempotent-Replay", "true");
      return res.status(200).json({ data: replay });
    }

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          ticketNumber: null,
          submissionKey: validSubmissionKey,
          submissionHash,
          requesterId: validRequesterId,
          categoryId: validCategoryId,
          relatedSystemId: validRelatedSystemId,
          summary: validSummary,
          description: validDescription,
          requestedPriority: requestedPriority as RequestedPriority,
        },
        select: { id: true },
      });
      return tx.ticket.update({
        where: { id: created.id },
        data: { ticketNumber: `TKT-${String(created.id).padStart(6, "0")}` },
        select: ticketDetailSelect,
      });
    });
    return res.status(201).json({ data: ticket });
  } catch (error) {
    const correlationId = randomUUID();
    console.error(`[${correlationId}] ticket creation failed`, error);
    return res.status(500).json({ error: "Unable to create Ticket", correlationId });
  }
});

app.get("/api/tickets", async (req: Request, res: Response) => {
  const requesterId = positiveInteger(req.header("X-Requester-Id"));
  const allowedSorts = ["updatedAt", "ticketDate", "ticketNumber", "summary"];
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "updatedAt";
  const sortDirection = typeof req.query.sortDirection === "string" ? req.query.sortDirection : "desc";
  const page = req.query.page === undefined ? 1 : positiveInteger(req.query.page);
  const pageSizeValue = req.query.pageSize === undefined ? 10 : positiveInteger(req.query.pageSize);
  const pageSizes = [10, 20, 50];
  const fields: Record<string, string> = {};
  if (!requesterId) fields.requesterId = "X-Requester-Id must be a positive integer";
  if (!allowedSorts.includes(sortBy)) fields.sortBy = "Unsupported sort field";
  if (!["asc", "desc"].includes(sortDirection)) fields.sortDirection = "Sort direction must be asc or desc";
  if (!page) fields.page = "Page must be a positive integer";
  if (!pageSizeValue || !pageSizes.includes(pageSizeValue)) fields.pageSize = "Page size must be 10, 20, or 50";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search.length > 120) fields.search = "Search must contain at most 120 characters";
  const categoryId = req.query.categoryId === undefined ? null : positiveInteger(req.query.categoryId);
  const relatedSystemId = req.query.relatedSystemId === undefined ? null : positiveInteger(req.query.relatedSystemId);
  if (req.query.categoryId !== undefined && !categoryId) fields.categoryId = "Category ID must be a positive integer";
  if (req.query.relatedSystemId !== undefined && !relatedSystemId) fields.relatedSystemId = "Related System ID must be a positive integer";
  const priority = req.query.requestedPriority;
  if (priority !== undefined && !Object.values(RequestedPriority).includes(priority as RequestedPriority)) fields.requestedPriority = "Unsupported priority";
  if (req.query.status !== undefined && req.query.status !== "NEW") fields.status = "Unsupported status";
  if (Object.keys(fields).length) return validationError(res, fields);

  try {
    const where: any = { requesterId: requesterId as number };
    if (search) where.OR = [
      { ticketNumber: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
    if (categoryId) where.categoryId = categoryId;
    if (relatedSystemId) where.relatedSystemId = relatedSystemId;
    if (priority) where.requestedPriority = priority;
    if (req.query.status) where.currentStatus = req.query.status;
    const orderField = sortBy === "ticketDate" ? "createdAt" : sortBy;
    const orderBy: any[] = [{ [orderField]: sortDirection }, { id: "desc" }];
    const prisma = getPrisma();
    const [totalItems, data] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({ where, orderBy, skip: ((page as number) - 1) * (pageSizeValue as number), take: pageSizeValue as number, select: ticketDetailSelect }),
    ]);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / (pageSizeValue as number));
    return res.status(200).json({ data, meta: { page, pageSize: pageSizeValue, totalItems, totalPages, hasPreviousPage: (page as number) > 1, hasNextPage: (page as number) < totalPages } });
  } catch (error) {
    const correlationId = randomUUID();
    console.error(`[${correlationId}] ticket list failed`, error);
    return res.status(500).json({ error: "Unable to load Tickets", correlationId });
  }
});

app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
  const requesterId = positiveInteger(req.header("X-Requester-Id"));
  const ticketId = positiveInteger(req.params.ticketId);
  if (!requesterId || !ticketId) return res.status(400).json({ error: "Invalid Requester or Ticket ID" });
  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: { id: ticketId, requesterId },
      select: {
        ...ticketDetailSelect,
        attachments: {
          select: { id: true, ticketId: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removedReason: true },
          orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    return res.status(200).json({ data: ticket });
  } catch (error) {
    const correlationId = randomUUID();
    console.error(`[${correlationId}] ticket detail failed`, error);
    return res.status(500).json({ error: "Unable to load Ticket", correlationId });
  }
});

app.post("/api/tickets/:ticketId/attachments", parseAttachmentUpload, async (req: Request, res: Response) => {
  const requesterId = positiveInteger(req.header("X-Requester-Id"));
  const ticketId = positiveInteger(req.params.ticketId);
  if (!requesterId || !ticketId) return res.status(400).json({ error: "Invalid Requester or Ticket ID" });
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) return res.status(400).json({ error: "At least one file is required" });
  if (files.some((file) => !allowedAttachmentTypes.has(file.mimetype))) return res.status(400).json({ error: "Unsupported attachment type" });
  if (files.some((file) => !file.size || !hasValidSignature(file))) return res.status(400).json({ error: "Attachment content does not match its declared type" });
  const names = files.map((file) => safeOriginalName(file.originalname));
  if (names.some((name) => !name)) return res.status(400).json({ error: "Unsafe attachment filename" });
  const prisma = getPrisma();
  try {
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    const activeCount = await prisma.attachment.count({ where: { ticketId, removedAt: null } });
    if (activeCount + files.length > 5) return res.status(400).json({ error: "A Ticket can have at most five active attachments" });
    await mkdir(attachmentRoot, { recursive: true });
    const created: Array<{ id: number; originalName: string; mimeType: string; sizeBytes: number; uploadedAt: Date; removedAt: Date | null; removedReason: string | null }> = [];
    const stored: string[] = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const storedName = `${randomUUID()}${path.extname(names[index] as string).toLowerCase()}`;
        await writeFile(path.join(attachmentRoot, storedName), files[index].buffer, { flag: "wx" });
        stored.push(storedName);
        const row = await prisma.attachment.create({ data: { ticketId, originalName: names[index] as string, storedName, mimeType: files[index].mimetype, sizeBytes: files[index].size }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removedReason: true } });
        created.push(row);
      }
    } catch (error) {
      await Promise.all(stored.map((name) => unlink(path.join(attachmentRoot, name)).catch(() => undefined)));
      throw error;
    }
    return res.status(201).json({ data: created });
  } catch (error) {
    const correlationId = randomUUID(); console.error(`[${correlationId}] attachment upload failed`, error);
    return res.status(500).json({ error: "Unable to upload attachments", correlationId });
  }
});

app.get("/api/tickets/:ticketId/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  const requesterId = positiveInteger(req.header("X-Requester-Id")); const ticketId = positiveInteger(req.params.ticketId); const attachmentId = positiveInteger(req.params.attachmentId);
  if (!requesterId || !ticketId || !attachmentId) return res.status(400).json({ error: "Invalid attachment request" });
  const attachment = await getPrisma().attachment.findFirst({ where: { id: attachmentId, ticketId, removedAt: null, ticket: { requesterId } } });
  if (!attachment) return res.status(404).json({ error: "Attachment not found" });
  return res.download(path.join(attachmentRoot, attachment.storedName), attachment.originalName, (error) => { if (error && !res.headersSent) res.status(404).json({ error: "Attachment not found" }); });
});

app.delete("/api/tickets/:ticketId/attachments/:attachmentId", async (req: Request, res: Response) => {
  const requesterId = positiveInteger(req.header("X-Requester-Id")); const ticketId = positiveInteger(req.params.ticketId); const attachmentId = positiveInteger(req.params.attachmentId); const reason = normalizeText(req.body?.reason);
  if (!requesterId || !ticketId || !attachmentId || !reason || reason.length > 500) return res.status(400).json({ error: "A removal reason is required" });
  const result = await getPrisma().attachment.updateMany({ where: { id: attachmentId, ticketId, removedAt: null, ticket: { requesterId } }, data: { removedAt: new Date(), removedReason: reason } });
  if (!result.count) return res.status(404).json({ error: "Attachment not found" });
  return res.status(200).json({ data: { removed: true, attachmentId } });
});

export default app;
