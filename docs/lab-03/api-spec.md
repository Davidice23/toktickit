# Lab 3 REST API Contract

> Contract status: Pending peer review. Implementation must not start until this contract is approved.

This document is normative for the Lab 3 API. It replaces the Lab 2 Development Requester identity with an authenticated User identity while preserving existing Ticket and Attachment data.

## 1. Conventions

- Base path: /api.
- JSON media type: application/json; charset=utf-8, except multipart uploads and file downloads.
- IDs are positive decimal integers.
- Timestamps are ISO 8601 UTC strings.
- Strings are trimmed before validation.
- Unknown JSON properties and unsupported query parameters return 400.
- Internal details, SQL, stack traces, password hashes, session tokens, CSRF secrets, and storage paths are never returned.
- Every protected operation is authorized by the backend.

### Success envelope

Single resources use:

    { "data": {} }

Collections use:

    { "data": [], "meta": {} }

No endpoint accepts requester identity from the body or from X-Requester-Id. A legacy header may be ignored or rejected, but it must never affect authorization.

### Error envelope

    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Check the highlighted values and try again.",
        "fields": { "email": "Enter a valid email address." },
        "correlationId": "uuid"
      }
    }

fields is present for field-addressable validation. correlationId is present for unexpected failures. Public messages are stable and safe. Missing and cross-owner resources use the same NOT_FOUND shape where existence must not be disclosed.

## 2. Authentication/session contract

### Session design

- The server generates a cryptographically random opaque session token.
- Only a one-way token hash is stored in Session.
- The cookie name is toktickit_session.
- The cookie is HttpOnly, SameSite=Lax for local development, Secure in HTTPS environments, path /, and expires after 8 hours of maximum session lifetime.
- Session lookup validates token hash, user active state, revokedAt, and expiresAt.
- Logout sets revokedAt and clears the cookie.
- Deactivation and initial-password reset revoke all sessions for the affected user; password change revokes the old session and creates one rotated session.
- The client never reads the session cookie.

### CSRF and CORS

- The server allows only the configured client origin; wildcard origin is not permitted with credentials.
- CORS credentials are enabled for the configured origin.
- Login may establish a session without a CSRF token because it has no authenticated session yet.
- The server issues a session-bound CSRF token after login and through current-user retrieval; the same token remains valid for the session so multiple tabs can share it. The client sends it as X-CSRF-Token on authenticated POST, PATCH, and DELETE requests.
- The server compares the submitted CSRF token to the session value using a constant-time comparison.
- SameSite and origin checks are defense in depth, not replacements for server-side authorization.

### Password rules

- Email is normalized before lookup.
- Passwords are never stored or logged in plaintext.
- New and changed passwords must be 12-128 characters, contain at least one non-whitespace character, match confirmation, and be hashed with Argon2id (memory 65536 KiB, iterations 3, parallelism 1).
- Invalid credentials and inactive accounts use the same public 401 response.
- Login failures are rate-limited to five attempts per normalized-email + IP pair in 15 minutes; the next failure returns 429 RATE_LIMITED with Retry-After: 900. The policy never reveals account existence and never logs credentials.
- A valid login with mustChangePassword true returns a limited session and user object but normal application APIs return PASSWORD_CHANGE_REQUIRED until the password change succeeds.

## 3. Resource shapes

### User

    {
      "id": 12,
      "name": "Anan Chaiya",
      "email": "anan.chaiya@example.test",
      "role": "REQUESTER",
      "isActive": true,
      "mustChangePassword": false
    }

Password hashes and initial passwords are never included.

### Ticket summary

    {
      "id": 42,
      "ticketNumber": "TKT-000042",
      "summary": "Laptop battery drains quickly",
      "requestedPriority": "MEDIUM",
      "itPriority": "HIGH",
      "currentStatus": "IN_PROGRESS",
      "owner": { "id": 8, "name": "IT Staff One", "role": "IT_STAFF" },
      "category": { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
      "createdAt": "2026-09-03T08:30:00.000Z",
      "updatedAt": "2026-09-03T08:35:00.000Z"
    }

### Comment and note

    {
      "id": 9,
      "ticketId": 42,
      "body": "The user confirmed the new driver is installed.",
      "author": { "id": 8, "name": "IT Staff One", "role": "IT_STAFF" },
      "createdAt": "2026-09-03T08:40:00.000Z"
    }

PublicComment and InternalNote use the same shape, but InternalNote is never returned to a Requester.

### Attachment

Attachment responses contain id, ticketId, originalName, mimeType, sizeBytes, uploadedAt, removedAt, removedReason, and state. They never expose storedName or a filesystem path.

## 4. Authentication endpoints

### POST /api/auth/login

Request:

    { "email": "anan.chaiya@example.test", "password": "local-only-password" }

Success 200:

    { "data": { "user": User, "mustChangePassword": true, "csrfToken": "opaque-token" } }

The response sets the session cookie. Validation errors use 400 VALIDATION_ERROR. Invalid or inactive credentials use 401 INVALID_CREDENTIALS. After five failures for the same normalized-email + IP pair within 15 minutes, the response is 429 RATE_LIMITED with Retry-After: 900. No response distinguishes a missing, inactive, or wrong-password account.

### GET /api/auth/me

Requires a valid session. Success 200 returns the current User, mustChangePassword, and a CSRF token. Missing, expired, or revoked sessions return 401 UNAUTHENTICATED.

### POST /api/auth/logout

Requires a valid session and CSRF token. Success returns 204 and clears/revokes the session. Repeated logout may safely return 204. A malformed authenticated request returns 401 or 403 without internal detail.

### POST /api/auth/change-password

Requires a valid session and CSRF token. The normal request is:

    {
      "currentPassword": "old-local-password",
      "newPassword": "new-local-password",
      "confirmPassword": "new-local-password"
    }

The server validates password rules, stores only the new hash, clears mustChangePassword, revokes the old session, creates a rotated session, and returns 200 with the updated User and a new CSRF token. Invalid input returns 400. Incorrect current password returns 401 INVALID_CREDENTIALS. A revoked session returns 401.

## 5. Authenticated Requester endpoints

All routes in this section require role REQUESTER and derive ownership from the session.

### POST /api/tickets

Headers: Idempotency-Key UUID, X-CSRF-Token.

Request:

    {
      "categoryId": 2,
      "relatedSystemId": 7,
      "summary": "Laptop battery drains quickly",
      "description": "Battery capacity falls from 100% to 20%.",
      "requestedPriority": "MEDIUM"
    }

The client cannot provide requesterId, currentStatus, itPriority, ownerId, or ticketNumber. Success is 201 for a new Ticket and 200 with Idempotent-Replay true for an exact replay. Reusing a key with a different normalized payload returns 409 IDEMPOTENCY_CONFLICT. Invalid body/reference data returns 400. Unauthenticated, forbidden, and unexpected responses use 401, 403, and 500 respectively.

### GET /api/tickets

Supported query parameters:

| Parameter | Values | Default |
| --- | --- | --- |
| search | trimmed text up to 120 characters | omitted |
| categoryId | positive integer | omitted |
| relatedSystemId | positive integer | omitted |
| requestedPriority | LOW, MEDIUM, HIGH, URGENT | omitted |
| status | required status enum | omitted |
| sortBy | updatedAt, ticketDate, ticketNumber, summary | updatedAt |
| sortDirection | asc, desc | desc |
| page | positive one-based integer | 1 |
| pageSize | 10, 20, 50 | 10 |

The server adds the authenticated user ownership predicate. Success 200 returns data and page metadata. Invalid queries return 400. No other user's Ticket appears.

### GET /api/tickets/:ticketId

Returns an owned Ticket detail with permitted Attachment metadata and Public Comments. Internal Notes are omitted. Missing, malformed, or cross-owner resources return a safe 404 NOT_FOUND response.

### Attachment endpoints

- POST /api/tickets/:ticketId/attachments: multipart files, CSRF, active owned Ticket, existing Lab 2 type/signature/size/count rules.
- GET /api/tickets/:ticketId/attachments/:attachmentId/download: active owned file download only for a Requester.
- DELETE /api/tickets/:ticketId/attachments/:attachmentId: JSON reason, CSRF, explicit soft removal.

Attachments preserve the existing Lab 2 lifecycle and never leak storage paths. Staff and Administrator detail responses include Attachment metadata, and `GET /api/staff/tickets/:ticketId/attachments/:attachmentId/download` permits them to download an existing non-removed file. Staff and Administrator cannot upload or remove Attachments. Invalid file, ownership, and unavailable-file failures use safe 400/404/413 responses.

### Public comments and requester resolution

- GET /api/tickets/:ticketId/comments: owned Ticket only, ordered oldest first.
- POST /api/tickets/:ticketId/comments: JSON body { "body": "..." }, CSRF, owned Ticket, non-blank bounded content; returns 201.
- POST /api/tickets/:ticketId/requester-resolution: CSRF, owned Ticket, records the Requester's indication idempotently; it does not change formal status.

## 6. IT Staff endpoints

The following routes require role IT_STAFF or ADMINISTRATOR. Both roles have the operational staff capability defined in the authorization matrix; User Management remains Administrator-only.

### GET /api/staff/tickets

Supported query parameters:

| Parameter | Values |
| --- | --- |
| search | ticket number, summary, description, requester name/email |
| status | one status enum |
| requestedPriority | LOW, MEDIUM, HIGH, URGENT |
| itPriority | LOW, MEDIUM, HIGH, URGENT, UNASSIGNED |
| owner | unassigned, me, positive user ID |
| sortBy | updatedAt, createdAt, ticketNumber, status, itPriority, owner |
| sortDirection | asc, desc |
| page | positive one-based integer |
| pageSize | 10, 20, 50 (default 20) |

Success 200 returns queue rows and metadata: page, pageSize, totalItems, totalPages, hasPreviousPage, and hasNextPage. Invalid parameters return 400 INVALID_QUERY. Empty data is a valid 200 response.

### GET /api/staff/tickets/:ticketId

IT Staff and Administrators receive full permitted operational detail including Attachments, Public Comments, Internal Notes, owner, priorities, status, and requester resolution indication. Requesters receive no Staff route data.

### POST /api/staff/tickets/:ticketId/claim

The caller must be IT Staff or Administrator. This endpoint atomically claims only an unassigned Ticket for the current caller. If an owner already exists, including a concurrent claim, it returns 409 CLAIM_CONFLICT. Claim does not change status.

### PATCH /api/staff/tickets/:ticketId/assignment

Request:

    { "ownerId": 8 }

This endpoint is for reassigning an already-owned Ticket or unassigning it. The target must be an active IT Staff or Administrator user. The caller must be IT Staff or Administrator. `ownerId: null` is permitted only when the Ticket is New or Open; otherwise the server returns 409 OWNER_REQUIRED. Reassignment of an unassigned Ticket must use the atomic claim endpoint and returns 409 CLAIM_REQUIRED here. Invalid role, inactive target, or missing Ticket returns 400/404. Success 200 returns the updated owner.

### PATCH /api/staff/tickets/:ticketId/priority

Request:

    { "itPriority": "HIGH" }

IT Staff or Administrator may mutate IT Priority. The field is independent of Requested Priority. Invalid enum or unavailable Ticket returns 400/404.

### PATCH /api/staff/tickets/:ticketId/status

Request:

    { "status": "RESOLVED", "confirmation": true }

The server validates the transition matrix, role, and the exact conditions in the Specification: Cancelled requires `confirmation: true` and a non-blank `reason`; Resolved and Closed require `confirmation: true`; Reopened requires a non-blank `reason`; In Progress and Resolved require an active owner. Invalid transitions return 409 INVALID_TRANSITION; missing conditions return 400 VALIDATION_ERROR; neither response mutates the Ticket. Success 200 returns the updated status.

## 7. Staff comments and notes

- GET /api/staff/tickets/:ticketId/comments: IT Staff and Administrator visibility.
- POST /api/staff/tickets/:ticketId/comments: IT Staff or Administrator for operational communication; JSON body, CSRF, 201 response.
- GET /api/staff/tickets/:ticketId/internal-notes: IT Staff and Administrator; no Requester access.
- POST /api/staff/tickets/:ticketId/internal-notes: IT Staff or Administrator; JSON body, CSRF, 201 response.

Public Comment body is trimmed and limited to 2,000 characters; Internal Note body is trimmed and limited to 4,000 characters. Blank or whitespace-only body returns 400 CONTENT_REQUIRED. Content over the applicable maximum returns 400 CONTENT_TOO_LONG. Entries are append-only: no edit or delete endpoint exists, and each entry is server-author/time stamped. A Requester never receives note content, including in error responses.

## 8. Administrator endpoints

All routes require role ADMINISTRATOR and CSRF for mutations.

### GET /api/admin/users

Query parameters are search (name or email) and optional role. The list returns User fields excluding credentials. Unknown parameters or invalid role return 400. Pagination is not mandatory for Lab 3.

### POST /api/admin/users

Request:

    {
      "name": "New Requester",
      "email": "new.requester@example.test",
      "role": "REQUESTER",
      "isActive": true,
      "initialPassword": "local-only-password"
    }

Success 201 returns the safe User shape and never returns passwordHash. Duplicate normalized email returns 409 DUPLICATE_EMAIL. Invalid name, email, role, or password returns 400.

### PATCH /api/admin/users/:userId

Request fields may include name, email, role, and isActive. The server permits only one role, rejects duplicate email, and applies self-deactivation and last-active-Administrator rules transactionally. Success 200 returns the safe User shape.

### POST /api/admin/users/:userId/initial-password

Request:

    { "initialPassword": "new-local-only-password" }

The server stores a hash, sets mustChangePassword true, revokes the target user's sessions, and returns the safe User shape without the password. Invalid input returns 400. Missing user returns 404.

No user deletion, bulk operation, import/export, email delivery, or multiple-role operation exists.

## 9. Authorization and status table

| Operation | Unauthenticated | Requester | IT Staff | Administrator |
| --- | --- | --- | --- | --- |
| Auth endpoints | Login only | Own session | Own session | Own session |
| Requester Ticket routes | 401 | Own only | 403 | 403 |
| Staff queue/detail | 401 | 403 | Full | Full |
| Assignment/priority/status | 401 | 403 | Full | Full |
| Attachment metadata/download on Staff detail | 401 | 403 | Full | Full |
| Attachment upload/remove | 401 | Own Ticket | 403 | 403 |
| Public Comments | 401 | Own Ticket | Full | Full |
| Internal Notes read | 401 | 403 | Full | Full |
| Internal Notes create | 401 | 403 | Full | Full |
| Admin users | 401 | 403 | 403 | Full |

## 10. Shared status/error behavior

| Condition | Status | Code |
| --- | --- | --- |
| Missing/expired/revoked session | 401 | UNAUTHENTICATED |
| Authenticated but wrong role | 403 | FORBIDDEN |
| Password change required | 403 | PASSWORD_CHANGE_REQUIRED |
| Invalid body/query/file | 400 | VALIDATION_ERROR |
| Missing or ownership-hidden resource | 404 | NOT_FOUND |
| Duplicate email/idempotency conflict | 409 | CONFLICT |
| Invalid status transition | 409 | INVALID_TRANSITION |
| Rate-limited login | 429 | RATE_LIMITED |
| Unexpected server/database failure | 500 | INTERNAL_ERROR plus correlationId |

The UI may provide richer wording, but it must not display raw exception text or sensitive account/resource existence details.
