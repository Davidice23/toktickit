# Lab 2 REST API Contract

**Contract status:** Approved by Wachirawit Photchamnian (67070505206) on 2026-09-03.

This document is normative for Lab 2. Examples use JSON unless a route explicitly uses multipart data or a file response.

## 1. Shared Conventions

- Base path: `/api`.
- Request/response media type: `application/json; charset=utf-8` unless otherwise stated.
- Timestamps: ISO 8601 UTC strings.
- IDs: positive decimal integers.
- Requester-owned routes require `X-Requester-Id: <positive integer>`.
- `X-Requester-Id` is a Lab 2 testing context, not authentication. The backend still applies it as an owner predicate.
- Strings are trimmed before validation and persistence.
- Unknown JSON properties and unsupported query parameters are rejected with `400`.
- Internal errors never include stack traces, SQL, credentials, or storage paths.

### Success envelope

Single resources use:

```json
{ "data": {} }
```

Collections use:

```json
{ "data": [] }
```

The Ticket list additionally returns `meta` pagination data.

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the highlighted values and try again.",
    "fields": {
      "summary": "Summary must contain 5 to 120 characters."
    },
    "correlationId": "a1b2c3d4"
  }
}
```

- `fields` is present only for field-addressable validation.
- `correlationId` is present for unexpected errors and may be present elsewhere.
- Cross-owner and missing resources share `NOT_FOUND` and the same public message.

## 2. Resource Shapes

### Requester

```json
{ "id": 1, "name": "Anan Example", "email": "anan@example.test" }
```

### Reference data

```json
{ "id": 1, "name": "Hardware" }
```

### Ticket summary

```json
{
  "id": 42,
  "ticketNumber": "TKT-000042",
  "ticketDate": "2026-09-03T08:30:00.000Z",
  "summary": "Laptop battery drains quickly",
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "currentStatus": "NEW",
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "updatedAt": "2026-09-03T08:30:00.000Z"
}
```

### Ticket detail

Ticket detail contains every Ticket summary property plus:

```json
{
  "requester": { "id": 1, "name": "Anan Example", "email": "anan@example.test" },
  "description": "Battery capacity falls from 100% to 20% in one hour.",
  "attachments": []
}
```

### Attachment metadata

```json
{
  "id": 9,
  "ticketId": 42,
  "originalName": "battery-report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 20543,
  "uploadedAt": "2026-09-03T08:35:00.000Z",
  "removedAt": null,
  "removedReason": null,
  "state": "ACTIVE"
}
```

`storedName` and `storagePath` are never returned.

## 3. Development Requesters

### `GET /api/requesters?active=true`

Returns active Development Requesters ordered by `name asc, id asc`.

- Required query: `active=true`; other values/parameters return `400`.
- `200`: `{ "data": [Requester] }`; an empty array is valid.
- `400`: invalid query.
- `500`: safe unexpected error.

Inactive rows are never included.

## 4. Reference Data

### `GET /api/categories?active=true`

### `GET /api/related-systems?active=true`

Each route returns active records ordered by `name asc, id asc`.

- `200`: `{ "data": [{ "id": 1, "name": "..." }] }`.
- `400`: invalid query.
- `500`: safe unexpected error.

## 5. Ticket Creation

### `POST /api/tickets`

Headers:

- `X-Requester-Id`: required positive integer.
- `Idempotency-Key`: required UUID generated once per logical form submission.

Request:

```json
{
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "requestedPriority": "MEDIUM",
  "description": "Battery capacity falls from 100% to 20% in one hour."
}
```

Validation:

- `categoryId`, `relatedSystemId`: required positive integers referencing active rows.
- `summary`: required trimmed string, 5-120 characters.
- `requestedPriority`: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- `description`: required trimmed string, 10-5,000 characters.
- Ticket Number, Ticket Date, Current Status, owner, and IT Priority are not accepted from the client.

Responses:

- `201`: first successful creation; `{ "data": TicketDetailWithoutAttachments }`.
- `200`: exact idempotent replay; returns the original resource and `Idempotent-Replay: true`.
- `400`: malformed headers/body, field validation, inactive/missing requester/reference data.
- `409`: an existing idempotency key is reused with a different normalized payload.
- `500`: safe unexpected error; no partial Ticket is committed.

## 6. My Tickets Query

### `GET /api/tickets`

Required header: `X-Requester-Id`.

Supported query parameters:

| Parameter | Values | Default |
| --- | --- | --- |
| `search` | trimmed text, 1-120 chars; Ticket Number, Summary, Description | omitted |
| `categoryId` | positive integer | omitted |
| `relatedSystemId` | positive integer | omitted |
| `requestedPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` | omitted |
| `status` | `NEW` for Lab 2 | omitted |
| `sortBy` | `updatedAt`, `ticketDate`, `ticketNumber`, `summary` | `updatedAt` |
| `sortDirection` | `asc`, `desc` | `desc` |
| `page` | positive one-based integer | `1` |
| `pageSize` | `10`, `20`, `50` | `10` |

Rules:

- Search is case-insensitive and combines with filters using AND.
- Multiple filters combine using AND.
- Default order is `updatedAt desc, id desc`.
- All other sorts add `id desc` as the deterministic tie-breaker.
- A page beyond the last page returns `data: []` with accurate metadata.

Success:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

Responses:

- `200`: owner-scoped results and metadata.
- `400`: missing/invalid Requester context or unsupported/malformed query.
- `500`: safe unexpected error.

## 7. Owned Ticket Detail

### `GET /api/tickets/:ticketId`

Required header: `X-Requester-Id`.

- `200`: `{ "data": TicketDetail }`, including active and removed Attachment metadata ordered by `uploadedAt asc, id asc`.
- `400`: malformed Requester or Ticket ID.
- `404`: Ticket is missing or not owned by the selected Requester.
- `500`: safe unexpected error.

The database query includes both Ticket ID and requester ID.

## 8. Attachment Upload

### `POST /api/tickets/:ticketId/attachments`

Required header: `X-Requester-Id`. Content type: `multipart/form-data`. One part named `file`; one file per request.

Validation:

- Ticket exists and is owned by selected Requester.
- Nonempty file.
- Allowed extension, declared MIME type, and detected signature agree: JPG/JPEG, PNG, WEBP, or PDF.
- Size is at most 5,242,880 bytes.
- Ticket has fewer than five active Attachments.
- Display filename is safe and no longer than 150 characters after normalization.

Responses:

- `201`: `{ "data": AttachmentMetadata }`.
- `400`: malformed route/context/multipart data or unsafe filename.
- `404`: Ticket missing or cross-owner.
- `409`: active Attachment count already equals five.
- `413`: file exceeds 5 MiB.
- `415`: unsupported or signature-mismatched file.
- `500`: safe unexpected error; compensation removes temporary/orphaned file/metadata.

## 9. Attachment Metadata

### `GET /api/tickets/:ticketId/attachments`

Required header: `X-Requester-Id`.

- `200`: `{ "data": [AttachmentMetadata] }`, including active and removed rows ordered by `uploadedAt asc, id asc`.
- `400`: malformed IDs/context.
- `404`: Ticket missing or cross-owner.
- `500`: safe unexpected error.

## 10. Attachment Download

### `GET /api/tickets/:ticketId/attachments/:attachmentId/download`

Required header: `X-Requester-Id`.

On success:

- `200` with validated `Content-Type`.
- `Content-Disposition: attachment; filename*=UTF-8''<encoded-safe-original-name>`.
- `X-Content-Type-Options: nosniff`.

Failures:

- `400`: malformed IDs/context.
- `404`: Ticket/Attachment missing, cross-owner, removed, or active metadata has no available file.
- `500`: safe unexpected error.

No redirect or path is returned.

## 11. Attachment Soft Removal

### `DELETE /api/tickets/:ticketId/attachments/:attachmentId`

Required header: `X-Requester-Id`.

Request:

```json
{ "reason": "Uploaded the wrong document" }
```

Validation: reason is required, trimmed, and 5-200 characters.

- `200`: `{ "data": RemovedAttachmentMetadata }`.
- `200`: owner replays removal; original `removedAt` and `removedReason` are unchanged.
- `400`: malformed IDs/context or invalid reason.
- `404`: Ticket/Attachment missing or cross-owner.
- `500`: safe unexpected error.

Physical file deletion is not part of the HTTP transaction. The removed resource is immediately inaccessible because all download queries require `removedAt IS NULL`.

## 12. Status and Error Code Matrix

| Status | Meaning in this contract |
| --- | --- |
| `200` | Successful retrieval/update or documented idempotent replay |
| `201` | Ticket or Attachment created |
| `400` | Malformed/unsupported parameter, header, or validated input |
| `404` | Missing, cross-owner, removed, or unavailable protected resource |
| `409` | Idempotency conflict or active Attachment count conflict |
| `413` | File larger than 5 MiB |
| `415` | Unsupported or signature-mismatched media |
| `500` | Safe unexpected server error |

## 13. Ownership Query Invariants

1. List: `where requesterId = currentRequesterId`.
2. Detail: `where id = ticketId AND requesterId = currentRequesterId`.
3. Attachment routes: join Attachment to Ticket and require both Ticket ID and requester ID.
4. Removed download: add `removedAt IS NULL`.
5. No route fetches globally and then filters ownership only in client code.

## 14. API-to-Acceptance Traceability

| Capability | Acceptance criteria |
| --- | --- |
| Requester/reference data | AC-01, AC-05, AC-06 |
| Ticket creation/idempotency | AC-07-AC-10 |
| Owner-scoped list/query | AC-11-AC-18 |
| Owned detail | AC-19, AC-20 |
| Attachment upload/metadata | AC-21, AC-22, AC-27 |
| Download/removal | AC-23-AC-26 |
| Safe unexpected errors | AC-30 |
