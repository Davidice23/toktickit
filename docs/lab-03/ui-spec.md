# Lab 3 Zen Green UI Specification

> Contract status: Approved in PR #36. This document remains the UI acceptance
> contract; the checklist below distinguishes verified remediation evidence from
> remaining manual accessibility checks.

This specification extends the Lab 2 Zen Green language. Lab 3 screens must look like one application, not a second visual system.

## 1. Route map and application shell

| Route | Access | Purpose |
| --- | --- | --- |
| /login | Public | Email/password authentication |
| /change-password | Authenticated, mustChangePassword | Mandatory initial-password change |
| /tickets | Requester | My Tickets |
| /tickets/new | Requester | Create Ticket |
| /tickets/:ticketId | Requester owner | Requester Ticket Detail |
| /staff/tickets | IT Staff or Administrator | Ticket Queue |
| /staff/tickets/:ticketId | IT Staff or Administrator | Staff Ticket Detail |
| /admin/users | Administrator | User Management |

The root route redirects to Login when unauthenticated and to a role-appropriate landing route when authenticated. A current-user bootstrap runs before protected content is rendered. Direct navigation to a forbidden route produces a safe Forbidden state and never relies on hidden links as authorization.

The authenticated shell contains:

- TokTickIT brand and consistent header.
- Current user's name and role badge.
- Role-specific navigation only; an Administrator sees both User Management and the operational Ticket Queue/Detail because the authorization matrix grants both capabilities.
- Logout action.
- Visible loading, session-expired, and failure states.
- Main landmark, ordered headings, keyboard-visible focus, and responsive navigation.

## 2. Shared Zen Green rules

Reuse Lab 2 tokens and components:

| Token | Value |
| --- | --- |
| Primary green | #006B3C |
| Hover green | #005631 |
| Secondary green | #0B7A46 |
| Pale green | #EAF6EF |
| Page background | #F5F7F6 |
| Surface | #FFFFFF |
| Text | #17362A |
| Muted text | #52685F |
| Border | #C8D5CF |
| Error | #9B1C1C |
| Error background | #FDECEC |
| Warning | #8A4B08 |
| Focus | #0B7A46 |

Controls have at least 44px touch targets, 8px control radius, 12px card radius, persistent 3px focus ring, and readable labels. Editable controls use white surfaces. Read-only values use the documented read-only treatment and remain selectable.

Status, Requested Priority, IT Priority, role, ownership, and Attachment badges always contain readable text; color alone never carries meaning. Busy controls retain stable width and text such as Signing in or Saving.

## 3. Shared modes and feedback

Every screen identifies the meaningful modes:

- Initial/loading: labeled status or skeleton with aria-live where appropriate.
- Ready: usable content and primary action.
- Busy/saving: mutation controls disabled without losing input.
- Validation: message immediately below the affected field, aria-invalid and aria-describedby.
- Success: confirmation and clear next action.
- Empty: no records exist, with a useful next action.
- No results: filters/search produced no match, with Clear Filters.
- Forbidden: role cannot perform the operation.
- Not found: resource missing or ownership-hidden.
- Conflict: duplicate, stale, or unsafe business operation.
- Unexpected failure: safe message, optional correlation ID, and Retry when meaningful.

## 4. Login screen

### Structure and controls

- TokTickIT heading and concise authentication guidance.
- Labeled Email and Password fields.
- Primary Log in button.
- Field-level validation and a page-level safe failure callout.
- Busy state that disables duplicate submission.

### Required states

- Initial ready form.
- Invalid email/password validation.
- Invalid or inactive credentials with safe non-enumerating feedback.
- Busy login.
- Network/server failure with Retry.
- Successful login routes to Change Password when required or to the role landing screen.

Password inputs are never echoed, retained after a failed security response unless explicitly justified, or shown in screenshots as real secrets.

## 5. Mandatory Change Password screen

### Structure and controls

- Current Password, New Password, Confirm New Password.
- Visible password rules and confirmation guidance.
- Primary Change Password action.
- Logout action.
- No normal application navigation while mustChangePassword is true.

### Required states

- Invalid boundary/confirmation validation.
- Busy save.
- Safe failure with values preserved according to security policy.
- Success confirmation and continuation to the role landing page.
- Expired/revoked session redirect to Login.

## 6. Requester screens

The Lab 2 Create Ticket, My Tickets, Ticket Detail, and Attachment design remains intact while the authenticated session replaces the Development Requester selector.

### My Tickets and Create Ticket

- Shell shows authenticated name and Requester role.
- No Development Requester dropdown, Change Requester action, requesterId control, or identity local-storage key.
- Existing search/filter/sort/pagination, field validation, idempotency, loading, empty/no-results, success, and failure states remain.
- Create Ticket uses the backend session identity.

### Requester Ticket Detail

- Read-only Ticket groups and Attachment continuity.
- Public Comments section with append-only composer.
- Problem Appears Resolved action with clear confirmation and status explanation.
- No IT Priority, assignment, Internal Notes, or formal status controls.
- Safe not-found/ownership state is indistinguishable from a missing protected Ticket.

## 7. IT Staff Ticket Queue

### Desktop information architecture

1. Page header with Ticket Queue title and short guidance.
2. Search field with explicit Search action.
3. Filter controls for status, Requested Priority, IT Priority, ownership, and documented optional fields.
4. Sort field and direction.
5. Clear Filters action.
6. Queue table with Ticket Number, Created/Updated, Summary, Requester, Category, Requested Priority, IT Priority, Status, Owner, and Open Detail.
7. Pagination metadata and Previous/Next controls.

### Smaller screens

At tablet width, preserve required fields while allowing comfortable wrapping. At mobile width, represent each row as a card with Ticket Number, Summary, Requester, priorities, status, owner, last update, and full-width Open Detail action. Do not create an unreadable mega-grid.

### Required states

- Loading queue.
- Realistic populated queue with assigned and unassigned rows.
- Empty queue.
- No-results after search/filter.
- Forbidden role.
- Safe API failure with Retry.
- Busy page changes with disabled paging controls.

## 8. IT Staff Ticket Detail

### Information architecture

- Back to Queue action.
- Header with Ticket Number, status badge, priority badges, owner, and last updated.
- Read-only Requester, category, related system, summary, description, timestamps, and existing Attachment groups.
- IT Staff and Administrator may download existing Attachments from the detail view; upload/remove controls remain available only on the owning Requester screens.
- Operational controls grouped separately:
  - Claim/assign/reassign owner.
  - IT Priority.
  - Status transition and required confirmation.
- Public Comments section with clear shared/public label.
- Internal Notes section with strong private/internal label, separated styling, and no accidental shared submit path.
- Requester resolution indication.

### Required behavior

- Only permitted fields are editable.
- Invalid transitions, unavailable owner, conflict, and API failure are visible and actionable.
- Status controls show the exact confirmation/reason prompts for Cancelled, Resolved, Closed, and Reopened, and assignment controls explain claim conflict and the New/Open-only unassignment rule.
- Notes render as text and never as HTML.
- Attachment controls follow the API authorization matrix.
- Administrator has the same operational Ticket controls as IT Staff under the approved matrix; User Management remains Administrator-only.

## 9. Administrator User Management

### Structure

- Page header and concise guidance.
- Search by name or email.
- Optional role filter.
- User list/table with Name, Email, Role, Status, and Edit.
- Create User action and edit form/dialog.
- Initial Password action in the edit experience.

### Create/edit fields

- Name.
- Email.
- Exactly one role.
- Active/inactive state.
- Initial password for create or reset.

### Required states and safety feedback

- Loading, populated, empty, no-results, forbidden, and safe failure.
- Duplicate email and invalid input field errors.
- Busy create/save/reset states.
- Success confirmation without exposing plaintext password after submission.
- Self-deactivation prevented with clear explanation.
- Last active Administrator protection explained before mutation.
- Deactivated user's status and session behavior are visible.

## 10. Responsive contract

| Viewport | Required behavior |
| --- | --- |
| Desktop, 1440px target | Centered max-width layout, multi-column forms, full queue table |
| Tablet, 820px target | Comfortable two-column forms where practical; no clipped queue actions |
| Mobile, 390px target | Single-column fields, stacked cards, mobile menu, full-width primary actions |

All widths must have no document-level horizontal scrolling, clipped labels, overlapping errors, hidden required actions, or unreadable filenames. Long text wraps safely.

## 11. Accessibility contract

- Use semantic header, nav, main, headings, table captions, and form labels.
- Every field has a programmatic label and associated helper/error content.
- Invalid fields use aria-invalid and aria-describedby.
- Busy/loading changes use suitable aria-live.
- Modal/dialog controls expose an accessible name and aria-modal behavior.
- Keyboard focus is visible and follows visual order.
- Focus returns to the initiating control after a dialog closes.
- Tables and mobile cards expose equivalent identifying information.
- Status and role are conveyed by text as well as color.
- Reduced-motion preferences are respected.

## 12. Visual inspection checklist

- [x] Zen Green tokens and shared shell are reused on Lab 3 screens.
- [x] Authenticated name and role are visible; direct unauthorized API access is tested.
- [x] Protected navigation is hidden from unauthorized roles; a forbidden route is handled safely.
- [x] Editable forms and read-only Ticket facts have distinct treatments.
- [x] Visible form labels and required-field messages align in inspected screens.
- [ ] Every loading, busy, success, empty, no-results, forbidden, conflict, and unexpected failure mode has been visually inspected; automated coverage is partial.
- [x] Status, priority, role, and ownership badges contain text.
- [x] Public Comments and Internal Notes are visibly separated and requester visibility is browser-tested.
- [x] Fresh 1440px, 820px, and 390px screenshots retain queue/detail/admin information.
- [x] Automated overflow checks pass at all three widths; inspected forms no longer clip or overlap.
- [ ] Full keyboard/focus/contrast audit across every modal and error state is complete.
