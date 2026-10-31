# Lab 4 API Contract

> **Status: Approved Contract baseline (PR #75); endpoint implementation is tracked by Issues #66-#72.** Existing Lab 1-3 routes remain available unless this document explicitly extends their request/response requirements. All examples omit secrets and are illustrative rather than captured results.

> **Proposed #66 amendment — learner approved the pagination and retry direction; peer re-review and disposable-database verification pending.** The pagination, history, note validation, requester projection, and idempotency-receipt details below are not yet an integrated or peer-approved Contract revision.

> **Proposed #71 implementation detail — peer review and database-backed CI pending.** An operational account cannot be deactivated or demoted to Requester while it owns a Ticket in `IN_PROGRESS`, `RESOLVED`, or `CLOSED`; the affected Tickets must first be reassigned. This preserves BR-14 during concurrent owner changes.

## 1. Common conventions

### 1.1 Authentication, authorization, and response envelopes

- Protected routes use the existing HttpOnly session cookie. Mutating protected routes require `X-CSRF-Token` and a normal session.
- Requester identity, Action actors, and authorization scope always come from the session. The server ignores/rejects body fields such as `requesterId`, `performedById`, `createdById`, `actorId`, and raw role claims.
- Successful single-resource responses use `{ "data": ... }`; lists use `{ "data": [...], "meta": ... }`.
- Safe errors use `{ "error": { "code": "UPPER_SNAKE", "message": "safe message", "fields": { "field": "message" }, "correlationId": "optional-safe-id" } }`. `fields` and `correlationId` are optional.
- `401` means no valid session, `403` means a known authenticated role lacks a non-sensitive capability, and `404` is used for nonexistent or ownership-hidden nested resources. `409` covers idempotency, transition, and stale-version conflicts. No response contains stack traces, SQL, credentials, cookies, or another user's private data.
- Date/times are RFC 3339 UTC strings. The UI converts them to Asia/Bangkok for display.

### 1.2 Mutation coordination

All Lab 4 Action mutations and Ticket assignment/priority/status mutations include `expectedTicketVersion` in the JSON body. Action edit/status mutations additionally include `expectedActionVersion`. The server validates versions and all related gate predicates inside the same parent-Ticket transaction/coordination boundary.

Current Action write lock order is: lock the parent Ticket `FOR UPDATE`; share-lock the active operational actor; read the child Action where needed; share-lock a newly selected assignee where applicable; then write the Action, receipt/events, and Ticket version in the same transaction. The future Ticket workflow implementation (#71) must use a compatible coordination order, including role/deactivation races; this document does not claim that legacy Ticket mutation paths have already been migrated.

`POST` Action create additionally requires a non-empty `Idempotency-Key` HTTP header. The key is scoped to authenticated actor and Ticket. A replay with the same normalized Action fields returns the original successful JSON representation, including its original Ticket version, with status `200` instead of the initial `201`; the same key with different normalized Action fields returns `409 IDEMPOTENCY_KEY_REUSED`. `expectedTicketVersion` is a concurrency precondition and is excluded from the fingerprint, but must still be a valid positive integer on retry. A replayed version is historical: reload current Ticket/Action state before further mutations. The immutable response receipt is retained with the Action; this Lab has no expiry or hard-delete operation. Historical Actions without a receipt return `409 IDEMPOTENCY_RECEIPT_UNAVAILABLE` on matching-key retry: check the existing Action rather than inventing an old response or issuing a new key blindly.

If a write is stale, the server returns `409 STALE_VERSION`; it never silently replaces newer values. The UI then reloads the Ticket and lets the user reconcile the draft.

## 2. Resource shapes

### 2.1 Safe Action representation

```json
{
  "id": 41,
  "ticketId": 18,
  "status": "IN_PROGRESS",
  "description": "Collect browser diagnostic information.",
  "result": null,
  "followUpRequired": true,
  "followUpNote": "Requester will verify access after the cache is cleared.",
  "attachmentNotes": "See the existing screenshot attachment on this Ticket.",
  "assignee": { "id": 7, "name": "IT Staff A", "role": "IT_STAFF", "isActive": true },
  "performedBy": null,
  "actionAt": null,
  "cancelledAt": null,
  "cancellationReason": null,
  "version": 3,
  "createdAt": "2026-10-29T08:30:00.000Z",
  "updatedAt": "2026-10-29T09:10:00.000Z"
}
```

`performedBy` and `actionAt` are null until completion. The server fills both on the first transition to `COMPLETED`. Staff/Admin use the representation above; a Requester of an owned Ticket receives the same shared Action content but `assignee` and `performedBy` expose only `{ id, name }`, not the account role or activation status. Internal audit/event detail is not included in this representation.

### 2.2 Lifecycle values

```text
ActionStatus = PLANNED | IN_PROGRESS | COMPLETED | CANCELLED
TicketStatus = NEW | OPEN | IN_PROGRESS | WAITING_FOR_REQUESTER |
               RESOLVED | CLOSED | REOPENED | CANCELLED
```

## 3. Actions Taken endpoints

### 3.1 Read Actions on an owned Requester Ticket

`GET /api/tickets/:ticketId/actions`

Query: `page` defaults to `1`; `pageSize` defaults to `20` and accepts `10`, `20`, or `50`. Action pages are not limited to 100: the maximum page for a chosen page size is `floor(2147483647 / pageSize) + 1`, ensuring the zero-based Prisma offset remains a signed 32-bit integer and covers the positive generated Action-ID space. Items are ordered `createdAt ASC, id ASC`. Ticket authorization, count, and page data use one repeatable-read transaction snapshot per request; separate page requests are not a shared snapshot while records change.

| Caller | Result |
| --- | --- |
| Requester owning the Ticket | `200` safe Action list, ordered `createdAt ASC, id ASC` |
| Different Requester / missing Ticket | `404 TICKET_NOT_FOUND` |
| Staff/Admin | Use staff route to keep operational detail policy explicit |

Response:

```json
{ "data": [/* Safe Action representation */], "meta": { "page": 1, "pageSize": 20, "totalItems": 2, "totalPages": 1, "hasPreviousPage": false, "hasNextPage": false } }
```

### 3.2 Read Actions on an operational Ticket

`GET /api/staff/tickets/:ticketId/actions`

Uses the same bounded pagination and deterministic ordering as the Requester Action list.

| Caller | Result |
| --- | --- |
| IT Staff or Administrator with a normal session | `200` list with safe operational Action fields |
| Requester | `403 FORBIDDEN` |
| Missing Ticket | `404 TICKET_NOT_FOUND` |

Action lists are paginated to avoid unbounded responses while allowing the Ticket detail UI to load the complete history across pages.

### 3.3 Create Action

`POST /api/staff/tickets/:ticketId/actions`

Headers: `Content-Type: application/json`, `X-CSRF-Token`, `Idempotency-Key`.

```json
{
  "expectedTicketVersion": 6,
  "assigneeId": 7,
  "description": "Collect browser diagnostic information.",
  "followUpRequired": true,
  "followUpNote": "Requester will verify the fix.",
  "attachmentNotes": "Existing screenshot attachment shows the error."
}
```

Rules and outcomes:

- IT Staff/Admin only. The Ticket must be reachable in the operational scope and not in a terminal state where the Contract forbids new Actions.
- `assigneeId` must identify an active IT Staff/Admin. Description is trimmed, non-empty, and within the length limit in `specification.md`; follow-up note is required iff follow-up is true.
- For create, edit, and completion, non-blank follow-up notes are rejected when the resulting `followUpRequired` is false; when true, the trimmed note is required. An explicitly supplied blank follow-up note is invalid. Turning follow-up off clears the old note. If a legacy record already has a note while follow-up is false, an unrelated edit/completion is rejected until the client explicitly clears the note or enables follow-up; it is not silently erased. Optional attachment notes containing only whitespace normalize to `null` in both create and edit.
- Server creates `PLANNED`, sets immutable creation/audit actor from session, appends an Action event, increments parent Ticket workflow version, and never accepts `performedBy`, `status`, `result`, timestamps, or audit IDs from the client.
- `201` returns `{ data: Action }` and the current Ticket version in `meta.ticketVersion`.
- `400 VALIDATION_ERROR`, `404 TICKET_NOT_FOUND`, `409 STALE_VERSION`, `409 IDEMPOTENCY_KEY_REUSED`, or safe `500 INTERNAL_ERROR` occur as applicable.

### 3.4 Edit or reassign a non-terminal Action

`PATCH /api/staff/tickets/:ticketId/actions/:actionId`

```json
{
  "expectedTicketVersion": 7,
  "expectedActionVersion": 1,
  "assigneeId": 9,
  "description": "Collect and compare browser diagnostic information.",
  "followUpRequired": false,
  "attachmentNotes": "See attachment 3 in this Ticket."
}
```

The body may include only mutable fields. `status`, `result`, `performedBy`, `actionAt`, `cancelledAt`, `cancellationReason`, actor IDs, and audit data are rejected here. An update to a terminal Action returns `409 ACTION_TERMINAL`; lifecycle changes use the status route. The server appends a redacted-safe edit/reassignment event, increments Action and parent Ticket versions, and returns `200` with the updated Action and `meta.ticketVersion`.

### 3.5 Transition, complete, or cancel an Action

`PATCH /api/staff/tickets/:ticketId/actions/:actionId/status`

```json
{
  "expectedTicketVersion": 8,
  "expectedActionVersion": 2,
  "status": "COMPLETED",
  "result": "Browser cache was cleared; the Requester can sign in.",
  "followUpRequired": true,
  "followUpNote": "Requester must confirm after the next sign-in."
}
```

Allowed transitions are defined by BR-06. For `COMPLETED`, Result and conditional follow-up note are validated, `performedBy` becomes the authenticated actor, and `actionAt` becomes server UTC time. For `CANCELLED`, a trimmed `cancellationReason` is required. Both terminal transitions append an immutable event and increment both relevant versions. Completion/cancellation is still rejected if the caller has lost authorization, the Action does not belong to the Ticket path, the assignee became inactive where the Contract requires an active assignee, or a stale version is supplied.

## 4. Ticket operations extended by Lab 4

Existing endpoints retain their paths and authorization. The following mutation requests gain `expectedTicketVersion` and participate in the same parent Ticket coordination protocol:

| Endpoint | Added request fields | Important Lab 4 behavior |
| --- | --- | --- |
| `POST /api/staff/tickets/:ticketId/claim` | `expectedTicketVersion` | Claims only an unowned Ticket; returns `409 STALE_VERSION`/safe conflict instead of silently changing a newer owner. |
| `PATCH /api/staff/tickets/:ticketId/assignment` | `expectedTicketVersion`, `ownerId` | Assignee must be active operational user or null only if status rules permit unassignment. |
| `PATCH /api/staff/tickets/:ticketId/priority` | `expectedTicketVersion`, `itPriority` | Retains existing priority validation and increments workflow version. |
| `PATCH /api/staff/tickets/:ticketId/status` | `expectedTicketVersion`, `status`, optional `confirmation`, optional `reason` | Applies the complete Ticket transition matrix and Resolution gate in the same transaction as Action reads. |

Status response example:

```json
{
  "data": {
    "id": 18,
    "currentStatus": "RESOLVED",
    "resolvedAt": "2026-10-29T10:00:00.000Z",
    "workflowVersion": 9
  }
}
```

`RESOLVED` is rejected with `422 RESOLUTION_GATE_FAILED` and field/safe rule identifiers when the active owner, completed Action with Result, or absence of active Actions is missing. A Requester advisory endpoint remains separate and cannot satisfy or bypass this gate.

Staff Ticket detail and queue expose `workflowVersion` for clients to submit with the four workflow mutations. The existing Staff detail UI sends the version it loaded and preserves status form values on a failed mutation. For an Administrator `PATCH /api/admin/users/:userId`, attempts to deactivate or demote an operational owner with a Ticket in `IN_PROGRESS`, `RESOLVED`, or `CLOSED` return `409 ACTIVE_TICKET_OWNERSHIP`; after reassignment the mutation may proceed. The admin transaction locks the User before checking ownership, while workflow mutations lock Ticket then share-lock Users; the admin path does not lock Ticket rows while holding the User lock. This policy and its concurrency tests require peer review before integration.

## 5. Ticket/Action history

`GET /api/staff/tickets/:ticketId/history`

IT Staff/Admin receive ordered safe workflow and Action lifecycle events. History uses the same allowed page sizes, without the previous 100-page cap; page/offset must be exactly representable as a JavaScript safe integer. PostgreSQL performs a parameterized `UNION ALL`, ordering, `LIMIT`, and `OFFSET`, so the application materializes at most one page, rather than every preceding page. Deep offset queries can still scan or sort many rows; performance-smoke evidence and a keyset option for large deployments remain future work, not a production SLA. Events are ordered by `createdAt ASC`, then source (`ACTION` before `TICKET`), then numeric event ID ascending. Both event sources include the same fields, including `confirmation` (`null` for Action events). Ticket existence, counts, and page rows use one repeatable-read snapshot per request, not a shared snapshot across separate requests. The response does not expose Internal Note body, secrets, or hidden operational details. The requester Ticket detail receives only the Action list; a dedicated requester history endpoint is out of scope unless separately approved.

## 6. Dashboard endpoints

### 6.1 Requester dashboard

`GET /api/dashboard/requester`

Requester only. Example:

```json
{
  "data": {
    "asOf": "2026-10-29T10:00:00.000Z",
    "metrics": {
      "openTickets": 3,
      "waitingForRequester": 1,
      "recentlyUpdated": 2,
      "recentlyResolved": 1
    },
    "attentionTickets": [{ "id": 18, "ticketNumber": "TKT-018", "currentStatus": "WAITING_FOR_REQUESTER", "updatedAt": "..." }],
    "recentlyUpdatedTickets": [],
    "recentlyResolvedTickets": [],
    "drillDown": {
      "openTickets": "/my-tickets?scope=open",
      "waitingForRequester": "/my-tickets?status=WAITING_FOR_REQUESTER",
      "recentlyUpdated": "/my-tickets?scope=recently-updated",
      "recentlyResolved": "/my-tickets?scope=recently-resolved"
    }
  }
}
```

Each array is bounded to five rows and ordered according to BR-17/BR-21/BR-22. The existing requester Tickets endpoint is extended with documented, server-enforced `scope`/`status` filters used by these URLs. It still scopes all data to the session Requester.

### 6.2 Operational dashboard

`GET /api/dashboard/staff`

IT Staff/Admin only. Example metric groups:

```json
{
  "data": {
    "asOf": "2026-10-29T10:00:00.000Z",
    "metrics": {
      "unassignedOpenTickets": 4,
      "myOwnedOpenTickets": 2,
      "myActiveActions": 3,
      "myRecentlyCompletedActions": 1,
      "urgentOpenTickets": 2
    },
    "myActiveActions": [/* bounded Action rows */],
    "recentOrUrgentTickets": [/* bounded staff Ticket rows */],
    "drillDown": {
      "unassignedOpenTickets": "/staff-tickets?scope=unassigned-open",
      "myOwnedOpenTickets": "/staff-tickets?scope=my-owned-open",
      "myActiveActions": "/staff-tickets?scope=my-active-actions",
      "urgentOpenTickets": "/staff-tickets?scope=urgent-open"
    },
    "adminAccountSummary": null
  }
}
```

For Administrator, `adminAccountSummary` may contain only aggregate active user counts by role. It is `null` for IT Staff. Existing staff list filters are extended to implement the documented drill-downs; Action drill-down opens a Ticket detail with the relevant Action selected or filtered, rather than pretending a Ticket-only query is an Action list.

## 7. Validation limits and safe failures

Limits: Action description 1-2,000 trimmed characters; Result 1-2,000 when completed; Follow-up Note 1-2,000 when required; Attachment Notes 0-2,000; cancellation reason 1-1,000; idempotency key 1-200 characters after trimming. All text is rendered as text, not HTML. Malformed IDs, unknown enum values, blank required text, future/invalid client fields, missing CSRF, expired session, failed database operations, and unrelated nested IDs return deterministic safe outcomes.

## 8. Compatibility

Lab 1-3 health, auth, Requester Ticket, Attachments, Public Comments, Internal Notes, staff queue/detail, ownership, priority, status, and administration APIs remain supported. Client compatibility overloads used only for old tests must not become a security path. Lab 4 removes no existing authorization check and must not restore `X-Requester-Id`/local identity selection as an authorization mechanism.
