# Lab 4 API Contract

> **Status: Draft for Issue #64 peer review.** Endpoint names and field shapes below are a proposed Contract. Existing Lab 1-3 routes remain available unless this document explicitly extends their request/response requirements. All examples omit secrets and are illustrative rather than captured results.

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

`POST` Action create additionally requires a non-empty `Idempotency-Key` HTTP header. The key is scoped to authenticated actor and Ticket. A replay with the same normalized request returns the original successful representation; the same key with a different normalized request returns `409 IDEMPOTENCY_KEY_REUSED`.

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

`performedBy` and `actionAt` are null until completion. The server fills both on the first transition to `COMPLETED`; a requester sees the same safe public Action content for an owned Ticket. Internal audit/event detail is not included in this representation.

### 2.2 Lifecycle values

```text
ActionStatus = PLANNED | IN_PROGRESS | COMPLETED | CANCELLED
TicketStatus = NEW | OPEN | IN_PROGRESS | WAITING_FOR_REQUESTER |
               RESOLVED | CLOSED | REOPENED | CANCELLED
```

## 3. Actions Taken endpoints

### 3.1 Read Actions on an owned Requester Ticket

`GET /api/tickets/:ticketId/actions`

| Caller | Result |
| --- | --- |
| Requester owning the Ticket | `200` safe Action list, ordered `createdAt ASC, id ASC` |
| Different Requester / missing Ticket | `404 TICKET_NOT_FOUND` |
| Staff/Admin | Use staff route to keep operational detail policy explicit |

Response:

```json
{ "data": [/* Safe Action representation */], "meta": { "totalItems": 2 } }
```

### 3.2 Read Actions on an operational Ticket

`GET /api/staff/tickets/:ticketId/actions`

| Caller | Result |
| --- | --- |
| IT Staff or Administrator with a normal session | `200` list with safe operational Action fields |
| Requester | `403 FORBIDDEN` |
| Missing Ticket | `404 TICKET_NOT_FOUND` |

The list remains bounded only if pagination becomes necessary. Initial Lab 4 uses all Actions for one Ticket because a Ticket detail screen needs a complete history; API documentation/tests must establish a maximum/alternate paginated form before unbounded production-scale behavior is introduced.

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

## 5. Ticket/Action history

`GET /api/staff/tickets/:ticketId/history`

IT Staff/Admin receive ordered safe workflow and Action lifecycle events. The response does not expose Internal Note body, secrets, or hidden operational details. The requester Ticket detail receives only the Action list; a dedicated requester history endpoint is out of scope unless separately approved.

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

Exact conservative limits are finalized in implementation tests and documented there: Action description 1-2,000 trimmed characters; Result 1-2,000 when completed; Follow-up Note 1-2,000 when required; Attachment Notes 0-2,000; cancellation reason 1-1,000. All text is rendered as text, not HTML. Malformed IDs, unknown enum values, blank required text, future/invalid client fields, missing CSRF, expired session, failed database operations, and unrelated nested IDs return deterministic safe outcomes.

## 8. Compatibility

Lab 1-3 health, auth, Requester Ticket, Attachments, Public Comments, Internal Notes, staff queue/detail, ownership, priority, status, and administration APIs remain supported. Client compatibility overloads used only for old tests must not become a security path. Lab 4 removes no existing authorization check and must not restore `X-Requester-Id`/local identity selection as an authorization mechanism.
