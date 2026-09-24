import express, { Request, Response } from "express";
import cors from "cors";
import { createHash, randomUUID } from "node:crypto";
import { ITPriority, RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import multer from "multer";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AuthenticatedRequest,
  clearLoginFailures,
  clearSessionCookie,
  createSession,
  errorBody,
  hashPassword,
  isRateLimited,
  loginFailureKey,
  normalizeEmail,
  recordLoginFailure,
  requireCsrf,
  requireNormalSession,
  requireRoles,
  requireSession,
  getCsrfToken,
  safeUser,
  setSessionCookie,
  validatePassword,
  verifyPassword,
} from "./auth.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173";
app.use(cors({ origin: clientOrigin, credentials: true }));
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

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || typeof password !== "string" || !password) {
    res.status(400).json(errorBody("VALIDATION_ERROR", "Email and password are required", { email: "A valid email is required", password: "Password is required" }));
    return;
  }

  const key = loginFailureKey(req, email);
  if (isRateLimited(key)) {
    res.setHeader("Retry-After", "900");
    res.status(429).json(errorBody("RATE_LIMITED", "Too many login attempts. Try again later."));
    return;
  }

  try {
    const user = await getPrisma().requesterUser.findUnique({ where: { email } });
    const valid = Boolean(user?.isActive && await verifyPassword(user.passwordHash, password));
    if (!valid || !user) {
      recordLoginFailure(key);
      res.status(401).json(errorBody("INVALID_CREDENTIALS", "Invalid email or password"));
      return;
    }
    clearLoginFailures(key);
    const session = await createSession(user.id);
    setSessionCookie(res, session.rawToken);
    res.status(200).json({ data: { user: safeUser(user), mustChangePassword: user.mustChangePassword, csrfToken: session.rawCsrfToken } });
  } catch {
    res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to complete login"));
  }
});

app.get("/api/auth/me", requireSession, async (req: Request, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) return;
  try {
    const csrfToken = await getCsrfToken(auth.session.id, auth.rawToken);
    res.status(200).json({ data: { user: safeUser(auth.user), mustChangePassword: auth.user.mustChangePassword, csrfToken } });
  } catch {
    res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to load the current user"));
  }
});

app.post("/api/auth/logout", requireSession, requireCsrf, async (req: Request, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) return;
  try {
    await getPrisma().session.update({ where: { id: auth.session.id }, data: { revokedAt: new Date() } });
    clearSessionCookie(res);
    res.status(204).send();
  } catch {
    res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to log out"));
  }
});

app.post("/api/auth/change-password", requireSession, requireCsrf, async (req: Request, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) return;
  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
  const fields = validatePassword(newPassword, confirmPassword);
  if (typeof currentPassword !== "string" || !currentPassword) fields.currentPassword = "Current password is required";
  if (Object.keys(fields).length) {
    res.status(400).json(errorBody("VALIDATION_ERROR", "Password validation failed", fields));
    return;
  }
  if (!await verifyPassword(auth.user.passwordHash, currentPassword)) {
    res.status(401).json(errorBody("INVALID_CREDENTIALS", "Invalid current password"));
    return;
  }
  try {
    const passwordHash = await hashPassword(newPassword);
    await getPrisma().$transaction(async (tx) => {
      await tx.requesterUser.update({ where: { id: auth.user.id }, data: { passwordHash, mustChangePassword: false } });
      await tx.session.update({ where: { id: auth.session.id }, data: { revokedAt: new Date() } });
      await tx.session.updateMany({ where: { userId: auth.user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    const rotated = await createSession(auth.user.id);
    const updatedUser = await getPrisma().requesterUser.findUniqueOrThrow({ where: { id: auth.user.id } });
    setSessionCookie(res, rotated.rawToken);
    res.status(200).json({ data: { user: safeUser(updatedUser), mustChangePassword: false, csrfToken: rotated.rawCsrfToken } });
  } catch {
    res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to change password"));
  }
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
    const active = req.query.active === undefined || req.query.active === "true";
    const requesters = await getPrisma().requesterUser.findMany({
      where: active ? { isActive: true, role: "REQUESTER" } : { role: "REQUESTER" },
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
  return res.status(400).json(errorBody("VALIDATION_ERROR", "Check the highlighted values and try again.", fields));
}

app.post("/api/tickets", requireSession, requireNormalSession, requireRoles("REQUESTER"), requireCsrf, async (req: Request, res: Response) => {
  const requesterId = (req as AuthenticatedRequest).auth?.user.id ?? null;
  const submissionKey = normalizeText(req.header("Idempotency-Key"));
  const body = req.body as Record<string, unknown>;
  const fields: Record<string, string> = {};

  if (!requesterId) fields.requesterId = "Authenticated requester is required";
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
      if (existing.submissionHash !== submissionHash) return res.status(409).json(errorBody("IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used with a different request"));
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
          itPriority: requestedPriority as ITPriority,
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
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to create Ticket", undefined, correlationId));
  }
});

app.get("/api/tickets", requireSession, requireNormalSession, requireRoles("REQUESTER"), async (req: Request, res: Response) => {
  const requesterId = (req as AuthenticatedRequest).auth?.user.id ?? null;
  const allowedSorts = ["updatedAt", "ticketDate", "ticketNumber", "summary"];
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "updatedAt";
  const sortDirection = typeof req.query.sortDirection === "string" ? req.query.sortDirection : "desc";
  const page = req.query.page === undefined ? 1 : positiveInteger(req.query.page);
  const pageSizeValue = req.query.pageSize === undefined ? 10 : positiveInteger(req.query.pageSize);
  const pageSizes = [10, 20, 50];
  const fields: Record<string, string> = {};
  if (!requesterId) fields.requesterId = "Authenticated requester is required";
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
  if (req.query.status !== undefined && (typeof req.query.status !== "string" || !Object.values(TicketStatus).includes(req.query.status as TicketStatus))) fields.status = "Unsupported status";
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
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to load Tickets", undefined, correlationId));
  }
});

app.get("/api/tickets/:ticketId", requireSession, requireNormalSession, requireRoles("REQUESTER"), async (req: Request, res: Response) => {
  const requesterId = (req as AuthenticatedRequest).auth?.user.id ?? null;
  const ticketId = positiveInteger(req.params.ticketId);
  if (!requesterId || !ticketId) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: { id: ticketId, requesterId },
      select: {
        ...ticketDetailSelect,
        attachments: {
          select: { id: true, ticketId: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removedReason: true },
          orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
        },
        publicComments: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!ticket) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
    return res.status(200).json({ data: ticket });
  } catch (error) {
    const correlationId = randomUUID();
    console.error(`[${correlationId}] ticket detail failed`, error);
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to load Ticket", undefined, correlationId));
  }
});

app.post("/api/tickets/:ticketId/attachments", requireSession, requireNormalSession, requireRoles("REQUESTER"), requireCsrf, parseAttachmentUpload, async (req: Request, res: Response) => {
  const requesterId = (req as AuthenticatedRequest).auth?.user.id ?? null;
  const ticketId = positiveInteger(req.params.ticketId);
  if (!requesterId || !ticketId) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) return res.status(400).json(errorBody("VALIDATION_ERROR", "At least one file is required"));
  if (files.some((file) => !allowedAttachmentTypes.has(file.mimetype))) return res.status(400).json(errorBody("VALIDATION_ERROR", "Unsupported attachment type"));
  if (files.some((file) => !file.size || !hasValidSignature(file))) return res.status(400).json(errorBody("VALIDATION_ERROR", "Attachment content does not match its declared type"));
  const names = files.map((file) => safeOriginalName(file.originalname));
  if (names.some((name) => !name)) return res.status(400).json(errorBody("VALIDATION_ERROR", "Unsafe attachment filename"));
  const prisma = getPrisma();
  try {
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
    if (!ticket) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
    const activeCount = await prisma.attachment.count({ where: { ticketId, removedAt: null } });
    if (activeCount + files.length > 5) return res.status(400).json(errorBody("VALIDATION_ERROR", "A Ticket can have at most five active attachments"));
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
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to upload attachments", undefined, correlationId));
  }
});

app.get("/api/tickets/:ticketId/attachments/:attachmentId/download", requireSession, requireNormalSession, requireRoles("REQUESTER"), async (req: Request, res: Response) => {
  const requesterId = (req as AuthenticatedRequest).auth?.user.id ?? null; const ticketId = positiveInteger(req.params.ticketId); const attachmentId = positiveInteger(req.params.attachmentId);
  if (!requesterId || !ticketId || !attachmentId) return res.status(404).json(errorBody("NOT_FOUND", "Attachment not found"));
  const attachment = await getPrisma().attachment.findFirst({ where: { id: attachmentId, ticketId, removedAt: null, ticket: { requesterId } } });
  if (!attachment) return res.status(404).json(errorBody("NOT_FOUND", "Attachment not found"));
  return res.download(path.join(attachmentRoot, attachment.storedName), attachment.originalName, (error) => { if (error && !res.headersSent) res.status(404).json(errorBody("NOT_FOUND", "Attachment not found")); });
});

app.delete("/api/tickets/:ticketId/attachments/:attachmentId", requireSession, requireNormalSession, requireRoles("REQUESTER"), requireCsrf, async (req: Request, res: Response) => {
  const requesterId = (req as AuthenticatedRequest).auth?.user.id ?? null; const ticketId = positiveInteger(req.params.ticketId); const attachmentId = positiveInteger(req.params.attachmentId); const reason = normalizeText(req.body?.reason);
  if (!requesterId || !ticketId || !attachmentId || !reason || reason.length > 500) return res.status(400).json(errorBody("VALIDATION_ERROR", "A removal reason is required"));
  const result = await getPrisma().attachment.updateMany({ where: { id: attachmentId, ticketId, removedAt: null, ticket: { requesterId } }, data: { removedAt: new Date(), removedReason: reason } });
  if (!result.count) return res.status(404).json(errorBody("NOT_FOUND", "Attachment not found"));
  return res.status(200).json({ data: { removed: true, attachmentId } });
});

app.get("/api/tickets/:ticketId/comments", requireSession, requireNormalSession, requireRoles("REQUESTER"), async (req: Request, res: Response) => {
  const requesterId = (req as AuthenticatedRequest).auth?.user.id ?? null;
  const ticketId = positiveInteger(req.params.ticketId);
  if (!requesterId || !ticketId) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
  const ticket = await getPrisma().ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
  if (!ticket) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
  const data = await getPrisma().publicComment.findMany({ where: { ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } } });
  return res.status(200).json({ data, meta: {} });
});

app.post("/api/tickets/:ticketId/comments", requireSession, requireNormalSession, requireRoles("REQUESTER"), requireCsrf, async (req: Request, res: Response) => {
  const requesterId = (req as AuthenticatedRequest).auth?.user.id ?? null;
  const ticketId = positiveInteger(req.params.ticketId);
  const body = normalizeText(req.body?.body);
  if (!requesterId || !ticketId) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
  if (!body) return res.status(400).json(errorBody("CONTENT_REQUIRED", "Comment body is required", { body: "Comment body is required" }));
  if (body.length > 2000) return res.status(400).json(errorBody("CONTENT_TOO_LONG", "Public Comment must be at most 2,000 characters", { body: "Comment body must be at most 2,000 characters" }));
  const ticket = await getPrisma().ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
  if (!ticket) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
  const comment = await getPrisma().publicComment.create({
    data: { ticketId, authorId: requesterId, body },
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
  });
  return res.status(201).json({ data: comment });
});

app.post("/api/tickets/:ticketId/requester-resolution", requireSession, requireNormalSession, requireRoles("REQUESTER"), requireCsrf, async (req: Request, res: Response) => {
  const requesterId = (req as AuthenticatedRequest).auth?.user.id ?? null;
  const ticketId = positiveInteger(req.params.ticketId);
  if (!requesterId || !ticketId) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
  const result = await getPrisma().ticket.updateMany({ where: { id: ticketId, requesterId }, data: { requesterConfirmedResolved: true, requesterConfirmedResolvedAt: new Date() } });
  if (!result.count) return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
  const ticket = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { id: true, requesterConfirmedResolved: true, requesterConfirmedResolvedAt: true } });
  return res.status(200).json({ data: ticket });
});

// ---------------------------------------------------------------------------
// Lab 3 — IT Staff and Administrator operational Ticket workflow
// ---------------------------------------------------------------------------
const staffQueueSortFields: Record<string, string> = {
  updatedAt: "updatedAt",
  createdAt: "createdAt",
  ticketNumber: "ticketNumber",
  status: "currentStatus",
  itPriority: "itPriority",
  owner: "ownerId",
};
const staffQueueParams = new Set(["search", "status", "requestedPriority", "itPriority", "owner", "sortBy", "sortDirection", "page", "pageSize"]);
const staffTicketSelect = {
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
  ownerId: true,
  requesterConfirmedResolved: true,
  requesterConfirmedResolvedAt: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, email: true, role: true, isActive: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: {
    select: { id: true, ticketId: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removedReason: true },
    orderBy: [{ uploadedAt: "asc" as const }, { id: "asc" as const }],
  },
  publicComments: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
  },
  internalNotes: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
  },
};

const staffRoles = ["IT_STAFF", "ADMINISTRATOR"] as const;

function staffNotFound(res: Response) {
  return res.status(404).json(errorBody("NOT_FOUND", "Ticket not found"));
}

function staffContentError(res: Response, field: string, max: number) {
  return res.status(400).json(errorBody("CONTENT_TOO_LONG", field + " must be at most " + max.toLocaleString() + " characters", { body: "Content must be at most " + max.toLocaleString() + " characters" }));
}

app.get("/api/staff/tickets", requireSession, requireNormalSession, requireRoles(...staffRoles), async (req: Request, res: Response) => {
  const unknown = Object.keys(req.query).filter((key) => !staffQueueParams.has(key));
  const fields: Record<string, string> = {};
  if (unknown.length) fields.query = "Unsupported queue parameter";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search.length > 120) fields.search = "Search must contain at most 120 characters";
  const status = req.query.status;
  if (status !== undefined && (typeof status !== "string" || !Object.values(TicketStatus).includes(status as TicketStatus))) fields.status = "Unsupported status";
  const requestedPriority = req.query.requestedPriority;
  if (requestedPriority !== undefined && (typeof requestedPriority !== "string" || !Object.values(RequestedPriority).includes(requestedPriority as RequestedPriority))) fields.requestedPriority = "Unsupported requested priority";
  const itPriority = req.query.itPriority;
  if (itPriority !== undefined && (typeof itPriority !== "string" || (itPriority !== "UNASSIGNED" && !Object.values(ITPriority).includes(itPriority as ITPriority)))) fields.itPriority = "Unsupported IT priority";
  const owner = req.query.owner;
  if (owner !== undefined && typeof owner === "string" && !["unassigned", "me"].includes(owner) && !positiveInteger(owner)) fields.owner = "Owner must be unassigned, me, or a positive User ID";
  if (owner !== undefined && typeof owner !== "string") fields.owner = "Owner must be unassigned, me, or a positive User ID";
  const sortBy = req.query.sortBy === undefined ? "updatedAt" : req.query.sortBy;
  if (typeof sortBy !== "string" || !staffQueueSortFields[sortBy]) fields.sortBy = "Unsupported sort field";
  const sortDirection = req.query.sortDirection === undefined ? "desc" : req.query.sortDirection;
  if (sortDirection !== "asc" && sortDirection !== "desc") fields.sortDirection = "Sort direction must be asc or desc";
  const page = req.query.page === undefined ? 1 : positiveInteger(req.query.page);
  const pageSize = req.query.pageSize === undefined ? 20 : positiveInteger(req.query.pageSize);
  if (!page) fields.page = "Page must be a positive integer";
  if (!pageSize || ![10, 20, 50].includes(pageSize)) fields.pageSize = "Page size must be 10, 20, or 50";
  if (Object.keys(fields).length) return validationError(res, fields);

  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) return;
  const validPage = page as number;
  const validPageSize = pageSize as number;
  const where: any = {};
  if (search) {
    where.OR = [
      { ticketNumber: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { requester: { name: { contains: search, mode: "insensitive" } } },
      { requester: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (typeof status === "string") where.currentStatus = status;
  if (typeof requestedPriority === "string") where.requestedPriority = requestedPriority;
  if (typeof itPriority === "string") where.itPriority = itPriority === "UNASSIGNED" ? null : itPriority;
  if (owner === "unassigned") where.ownerId = null;
  if (owner === "me") where.ownerId = auth.user.id;
  if (typeof owner === "string" && positiveInteger(owner)) where.ownerId = positiveInteger(owner);
  try {
    const prisma = getPrisma();
    const orderField = staffQueueSortFields[sortBy as string];
    const [totalItems, data] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: [{ [orderField]: sortDirection }, { id: "desc" }],
        skip: (validPage - 1) * validPageSize,
        take: validPageSize,
        select: {
          id: true,
          ticketNumber: true,
          requesterId: true,
          summary: true,
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
          requester: { select: { id: true, name: true, email: true } },
          owner: { select: { id: true, name: true, email: true, role: true, isActive: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
        },
      }),
    ]);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / validPageSize);
    return res.status(200).json({ data, meta: { page: validPage, pageSize: validPageSize, totalItems, totalPages, hasPreviousPage: validPage > 1, hasNextPage: validPage < totalPages } });
  } catch (error) {
    const correlationId = randomUUID();
    console.error("[" + correlationId + "] staff queue failed", error);
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to load Staff Queue", undefined, correlationId));
  }
});

app.get("/api/staff/tickets/:ticketId", requireSession, requireNormalSession, requireRoles(...staffRoles), async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  if (!ticketId) return staffNotFound(res);
  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId }, select: staffTicketSelect });
    if (!ticket) return staffNotFound(res);
    return res.status(200).json({ data: ticket });
  } catch (error) {
    const correlationId = randomUUID();
    console.error("[" + correlationId + "] staff ticket detail failed", error);
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to load Staff Ticket", undefined, correlationId));
  }
});

app.get("/api/staff/tickets/:ticketId/attachments/:attachmentId/download", requireSession, requireNormalSession, requireRoles(...staffRoles), async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const attachmentId = positiveInteger(req.params.attachmentId);
  if (!ticketId || !attachmentId) return res.status(404).json(errorBody("NOT_FOUND", "Attachment not found"));
  const attachment = await getPrisma().attachment.findFirst({ where: { id: attachmentId, ticketId, removedAt: null } });
  if (!attachment) return res.status(404).json(errorBody("NOT_FOUND", "Attachment not found"));
  return res.download(path.join(attachmentRoot, attachment.storedName), attachment.originalName, (error) => {
    if (error && !res.headersSent) res.status(404).json(errorBody("NOT_FOUND", "Attachment not found"));
  });
});

app.post("/api/staff/tickets/:ticketId/claim", requireSession, requireNormalSession, requireRoles(...staffRoles), requireCsrf, async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const auth = (req as AuthenticatedRequest).auth;
  if (!ticketId || !auth) return staffNotFound(res);
  const updated = await getPrisma().ticket.updateMany({ where: { id: ticketId, ownerId: null }, data: { ownerId: auth.user.id } });
  if (!updated.count) return res.status(409).json(errorBody("CLAIM_CONFLICT", "Ticket is already owned"));
  return res.status(200).json({ data: { owner: safeUser(auth.user) } });
});

app.patch("/api/staff/tickets/:ticketId/assignment", requireSession, requireNormalSession, requireRoles(...staffRoles), requireCsrf, async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  if (!ticketId) return staffNotFound(res);
  if (!Object.prototype.hasOwnProperty.call(req.body ?? {}, "ownerId")) return validationError(res, { ownerId: "ownerId is required" });
  const rawOwnerId = req.body.ownerId;
  const ownerId = rawOwnerId === null ? null : positiveInteger(rawOwnerId);
  if (rawOwnerId !== null && !ownerId) return validationError(res, { ownerId: "ownerId must be null or a positive User ID" });
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, ownerId: true, currentStatus: true } });
  if (!ticket) return staffNotFound(res);
  if (ticket.ownerId === null && ownerId !== null) return res.status(409).json(errorBody("CLAIM_REQUIRED", "Use the claim endpoint for an unassigned Ticket"));
  if (ownerId === null && !["NEW", "OPEN"].includes(ticket.currentStatus)) return res.status(409).json(errorBody("OWNER_REQUIRED", "Tickets may only be unassigned while New or Open"));
  if (ownerId !== null) {
    const target = await prisma.requesterUser.findFirst({ where: { id: ownerId, isActive: true, role: { in: [...staffRoles] } }, select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true } });
    if (!target) return res.status(400).json(errorBody("INVALID_OWNER", "Owner must be an active IT Staff or Administrator"));
    const changed = await prisma.ticket.updateMany({ where: { id: ticketId, ownerId: ticket.ownerId, currentStatus: ticket.currentStatus }, data: { ownerId } });
    if (!changed.count) return res.status(409).json(errorBody("ASSIGNMENT_CONFLICT", "Ticket ownership or status changed; reload before assigning"));
    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { owner: { select: { id: true, name: true, email: true, role: true, isActive: true } } } });
    return res.status(200).json({ data: updated });
  }
  const changed = await prisma.ticket.updateMany({ where: { id: ticketId, ownerId: ticket.ownerId, currentStatus: ticket.currentStatus }, data: { ownerId: null } });
  if (!changed.count) return res.status(409).json(errorBody("ASSIGNMENT_CONFLICT", "Ticket ownership or status changed; reload before unassigning"));
  const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { owner: true } });
  return res.status(200).json({ data: updated });
});

app.patch("/api/staff/tickets/:ticketId/priority", requireSession, requireNormalSession, requireRoles(...staffRoles), requireCsrf, async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const itPriority = req.body?.itPriority;
  if (!ticketId) return staffNotFound(res);
  if (typeof itPriority !== "string" || !Object.values(ITPriority).includes(itPriority as ITPriority)) return validationError(res, { itPriority: "IT Priority must be LOW, MEDIUM, HIGH, or URGENT" });
  const updated = await getPrisma().ticket.updateMany({ where: { id: ticketId }, data: { itPriority: itPriority as ITPriority } });
  if (!updated.count) return staffNotFound(res);
  return res.status(200).json({ data: { id: ticketId, itPriority } });
});

const allowedStaffTransitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: [TicketStatus.OPEN, TicketStatus.CANCELLED],
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_REQUESTER, TicketStatus.CANCELLED],
  IN_PROGRESS: [TicketStatus.WAITING_FOR_REQUESTER, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  WAITING_FOR_REQUESTER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  RESOLVED: [TicketStatus.CLOSED, TicketStatus.REOPENED],
  CLOSED: [TicketStatus.REOPENED],
  REOPENED: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  CANCELLED: [TicketStatus.REOPENED],
};

app.patch("/api/staff/tickets/:ticketId/status", requireSession, requireNormalSession, requireRoles(...staffRoles), requireCsrf, async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const status = req.body?.status;
  if (!ticketId) return staffNotFound(res);
  if (typeof status !== "string" || !Object.values(TicketStatus).includes(status as TicketStatus)) return validationError(res, { status: "Unsupported status" });
  const nextStatus = status as TicketStatus;
  const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId }, select: { id: true, currentStatus: true, ownerId: true } });
  if (!ticket) return staffNotFound(res);
  if (!allowedStaffTransitions[ticket.currentStatus].includes(nextStatus)) return res.status(409).json(errorBody("INVALID_TRANSITION", "Status transition is not allowed"));
  if (nextStatus === TicketStatus.CANCELLED && (req.body.confirmation !== true || !normalizeText(req.body.reason))) return validationError(res, { confirmation: "Cancellation confirmation and reason are required" });
  if ((nextStatus === TicketStatus.RESOLVED || nextStatus === TicketStatus.CLOSED) && req.body.confirmation !== true) return validationError(res, { confirmation: "Confirmation is required for this status" });
  if (nextStatus === TicketStatus.REOPENED && !normalizeText(req.body.reason)) return validationError(res, { reason: "A reason is required when reopening" });
  if ((nextStatus === TicketStatus.IN_PROGRESS || nextStatus === TicketStatus.RESOLVED) && !ticket.ownerId) return validationError(res, { ownerId: "An active operational owner is required" });
  const changed = await getPrisma().ticket.updateMany({
    where: {
      id: ticketId,
      currentStatus: ticket.currentStatus,
      ...(nextStatus === TicketStatus.IN_PROGRESS || nextStatus === TicketStatus.RESOLVED ? { ownerId: { not: null } } : {}),
    },
    data: { currentStatus: nextStatus },
  });
  if (!changed.count) return res.status(409).json(errorBody("STATUS_CONFLICT", "Ticket status or owner changed; reload before updating"));
  const updated = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { id: true, currentStatus: true } });
  return res.status(200).json({ data: updated });
});

app.get("/api/staff/tickets/:ticketId/comments", requireSession, requireNormalSession, requireRoles(...staffRoles), async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  if (!ticketId) return staffNotFound(res);
  const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) return staffNotFound(res);
  const data = await getPrisma().publicComment.findMany({ where: { ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } } });
  return res.status(200).json({ data, meta: {} });
});

app.post("/api/staff/tickets/:ticketId/comments", requireSession, requireNormalSession, requireRoles(...staffRoles), requireCsrf, async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const body = normalizeText(req.body?.body);
  if (!ticketId) return staffNotFound(res);
  if (!body) return res.status(400).json(errorBody("CONTENT_REQUIRED", "Comment body is required", { body: "Comment body is required" }));
  if (body.length > 2000) return staffContentError(res, "Public Comment", 2000);
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) return;
  const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) return staffNotFound(res);
  const created = await getPrisma().publicComment.create({
    data: { ticketId, authorId: auth.user.id, body },
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
  });
  return res.status(201).json({ data: created });
});

app.get("/api/staff/tickets/:ticketId/internal-notes", requireSession, requireNormalSession, requireRoles(...staffRoles), async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  if (!ticketId) return staffNotFound(res);
  const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) return staffNotFound(res);
  const data = await getPrisma().internalNote.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
  });
  return res.status(200).json({ data, meta: {} });
});

app.post("/api/staff/tickets/:ticketId/internal-notes", requireSession, requireNormalSession, requireRoles(...staffRoles), requireCsrf, async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const body = normalizeText(req.body?.body);
  if (!ticketId) return staffNotFound(res);
  if (!body) return res.status(400).json(errorBody("CONTENT_REQUIRED", "Internal Note body is required", { body: "Internal Note body is required" }));
  if (body.length > 4000) return staffContentError(res, "Internal Note", 4000);
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) return;
  const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) return staffNotFound(res);
  const created = await getPrisma().internalNote.create({
    data: { ticketId, authorId: auth.user.id, body },
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
  });
  return res.status(201).json({ data: created });
});


// ---------------------------------------------------------------------------
// Lab 3 — Administrator User Management
// ---------------------------------------------------------------------------
const adminUserRoles = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
type AdminUserRole = typeof adminUserRoles[number];
const adminUserFields = { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true } as const;

function adminSafeUser(user: { id: number; name: string; email: string; role: string; isActive: boolean; mustChangePassword: boolean }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, mustChangePassword: user.mustChangePassword };
}

function adminUserNotFound(res: Response) {
  return res.status(404).json(errorBody("NOT_FOUND", "User not found"));
}

app.get("/api/admin/users", requireSession, requireNormalSession, requireRoles("ADMINISTRATOR"), async (req: Request, res: Response) => {
  const unknown = Object.keys(req.query).filter((key) => !["search", "role"].includes(key));
  const fields: Record<string, string> = {};
  if (unknown.length) fields.query = "Unsupported user parameter";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search.length > 120) fields.search = "Search must contain at most 120 characters";
  const role = req.query.role;
  if (role !== undefined && (typeof role !== "string" || !(adminUserRoles as readonly string[]).includes(role))) fields.role = "Unsupported role";
  if (Object.keys(fields).length) return validationError(res, fields);
  const where = {
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } : {}),
    ...(typeof role === "string" ? { role: role as AdminUserRole } : {}),
  };
  try {
    const users = await getPrisma().requesterUser.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], select: adminUserFields });
    return res.status(200).json({ data: users.map(adminSafeUser), meta: { totalItems: users.length } });
  } catch (error) {
    const correlationId = randomUUID();
    console.error("[" + correlationId + "] admin user list failed", error);
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to load Users", undefined, correlationId));
  }
});

app.post("/api/admin/users", requireSession, requireNormalSession, requireRoles("ADMINISTRATOR"), requireCsrf, async (req: Request, res: Response) => {
  const name = normalizeText(req.body?.name);
  const email = normalizeEmail(req.body?.email);
  const role = req.body?.role;
  const initialPassword = req.body?.initialPassword;
  const fields: Record<string, string> = {};
  if (!name || name.length > 120) fields.name = "Name is required and must be at most 120 characters";
  if (!email) fields.email = "A valid email is required";
  if (typeof role !== "string" || !(adminUserRoles as readonly string[]).includes(role)) fields.role = "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR";
  if (req.body?.isActive !== undefined && typeof req.body.isActive !== "boolean") fields.isActive = "isActive must be a boolean";
  const passwordFields = validatePassword(initialPassword);
  if (passwordFields.password) fields.initialPassword = passwordFields.password;
  if (Object.keys(fields).length) return validationError(res, fields);
  try {
    const prisma = getPrisma();
    const existing = await prisma.requesterUser.findUnique({ where: { email: email as string }, select: { id: true } });
    if (existing) return res.status(409).json(errorBody("DUPLICATE_EMAIL", "A user with this email already exists", { email: "Email is already in use" }));
    const passwordHash = await hashPassword(initialPassword as string);
    const user = await prisma.requesterUser.create({ data: { name: name as string, email: email as string, role: role as AdminUserRole, isActive: req.body?.isActive === undefined ? true : req.body.isActive as boolean, passwordHash, mustChangePassword: true } });
    return res.status(201).json({ data: adminSafeUser(user) });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") return res.status(409).json(errorBody("DUPLICATE_EMAIL", "A user with this email already exists", { email: "Email is already in use" }));
    const correlationId = randomUUID();
    console.error("[" + correlationId + "] admin user create failed", error);
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to create User", undefined, correlationId));
  }
});

app.patch("/api/admin/users/:userId", requireSession, requireNormalSession, requireRoles("ADMINISTRATOR"), requireCsrf, async (req: Request, res: Response) => {
  const userId = positiveInteger(req.params.userId);
  if (!userId) return adminUserNotFound(res);
  const body = req.body ?? {};
  const allowed = ["name", "email", "role", "isActive"];
  const fields: Record<string, string> = {};
  if (!Object.keys(body).some((key) => allowed.includes(key))) fields.body = "At least one editable field is required";
  const name = Object.prototype.hasOwnProperty.call(body, "name") ? normalizeText(body.name) : undefined;
  const email = Object.prototype.hasOwnProperty.call(body, "email") ? normalizeEmail(body.email) : undefined;
  const role = Object.prototype.hasOwnProperty.call(body, "role") ? body.role : undefined;
  if (name !== undefined && (!name || name.length > 120)) fields.name = "Name is required and must be at most 120 characters";
  if (Object.prototype.hasOwnProperty.call(body, "email") && !email) fields.email = "A valid email is required";
  if (role !== undefined && (typeof role !== "string" || !(adminUserRoles as readonly string[]).includes(role))) fields.role = "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR";
  if (Object.prototype.hasOwnProperty.call(body, "isActive") && typeof body.isActive !== "boolean") fields.isActive = "isActive must be a boolean";
  if (Object.keys(fields).length) return validationError(res, fields);
  const auth = (req as AuthenticatedRequest).auth;
  try {
    const prisma = getPrisma();
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    // Serialize Administrator mutations in PostgreSQL. Counting outside the
    // transaction allows two concurrent demotions to remove the final Admin.
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(334, 3)::text AS lock');
      const target = await tx.requesterUser.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } });
      if (!target) return { kind: "missing" as const };
      const nextRole = (role ?? target.role) as AdminUserRole;
      const nextActive = body.isActive === undefined ? target.isActive : body.isActive as boolean;
      if (auth?.user.id === userId && !nextActive) return { kind: "self" as const };
      if (email !== undefined) {
        const duplicate = await tx.requesterUser.findFirst({ where: { email: email as string, NOT: { id: userId } }, select: { id: true } });
        if (duplicate) return { kind: "duplicate" as const };
      }
      if (target.role === "ADMINISTRATOR" && target.isActive && (nextRole !== "ADMINISTRATOR" || !nextActive)) {
        const activeAdmins = await tx.requesterUser.count({ where: { role: "ADMINISTRATOR", isActive: true } });
        if (activeAdmins <= 1) return { kind: "last" as const };
      }
      const user = await tx.requesterUser.update({ where: { id: userId }, data, select: adminUserFields });
      if (!nextActive) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return { kind: "updated" as const, user };
    });
    if (outcome.kind === "missing") return adminUserNotFound(res);
    if (outcome.kind === "self") return res.status(409).json(errorBody("SELF_DEACTIVATION", "You cannot deactivate your own Administrator account"));
    if (outcome.kind === "duplicate") return res.status(409).json(errorBody("DUPLICATE_EMAIL", "A user with this email already exists", { email: "Email is already in use" }));
    if (outcome.kind === "last") return res.status(409).json(errorBody("LAST_ADMIN", "At least one active Administrator must remain"));
    return res.status(200).json({ data: adminSafeUser(outcome.user) });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") return res.status(409).json(errorBody("DUPLICATE_EMAIL", "A user with this email already exists", { email: "Email is already in use" }));
    const correlationId = randomUUID();
    console.error("[" + correlationId + "] admin user update failed", error);
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to update User", undefined, correlationId));
  }
});

app.post("/api/admin/users/:userId/initial-password", requireSession, requireNormalSession, requireRoles("ADMINISTRATOR"), requireCsrf, async (req: Request, res: Response) => {
  const userId = positiveInteger(req.params.userId);
  if (!userId) return adminUserNotFound(res);
  const initialPassword = req.body?.initialPassword;
  const fields = validatePassword(initialPassword);
  if (fields.password) return validationError(res, { initialPassword: fields.password });
  try {
    const passwordHash = await hashPassword(initialPassword as string);
    const updated = await getPrisma().$transaction(async (tx) => {
      const user = await tx.requesterUser.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true }, select: adminUserFields });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return user;
    });
    return res.status(200).json({ data: adminSafeUser(updated) });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2025") return adminUserNotFound(res);
    const correlationId = randomUUID();
    console.error("[" + correlationId + "] admin initial password failed", error);
    return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to reset initial password", undefined, correlationId));
  }
});
export default app;
