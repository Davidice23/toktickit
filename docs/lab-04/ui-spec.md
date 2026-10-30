# Lab 4 UI Specification: Zen Green Actions Taken and Dashboards

> **Status: Approved Contract baseline (PR #75); implementation is tracked by Issues #67-#68.** This specification describes expected behavior before implementation. It does not claim that a screen, responsive layout, or accessibility behavior has already been built or tested.

## 1. Design intent and navigation

Lab 4 extends the existing Zen Green application rather than replacing it. It reuses the established ticket, badge, button, form, table/card, loading, empty, error, and authenticated-session patterns. The shell has one clear primary heading, visible active navigation, a persistent session identity/role, and a safe Log out action.

| Authenticated role | Default landing page | Available primary navigation |
| --- | --- | --- |
| Requester | Requester Dashboard | Dashboard, My Tickets, Create Ticket, Log out |
| IT Staff | Staff Dashboard | Dashboard, Staff Queue, Log out |
| Administrator | Staff Dashboard | Dashboard, Staff Queue, User Management, Log out |

A required password change remains the only screen before a normal workspace. Logout, account change, and direct hash/deep-link navigation clear stale prior-user data and re-evaluate the session/role. The application continues to use its current state/hash navigation model; it does not introduce a router merely for Lab 4. Refresh, Back/Forward, and invalid/unauthorized workspace links have defined safe fallbacks.

## 2. Shared visual and interaction rules

- Use semantic `main`, `nav`, headings in order, labelled controls, buttons for actions, and links for navigation.
- Every selected navigation item uses text/`aria-current="page"` plus the Zen Green visual state; colour is not the only indicator.
- Status and priority badges include readable text. Private Internal Notes remain visibly distinct from shared Public Comments and shared Actions Taken.
- Buttons communicate intent: create/assign/save/start/complete/cancel; destructive-looking cancellation requires a confirmation explanation but does not delete an Action.
- A loading state uses labelled text/appropriate busy semantics; an empty state explains what is absent and offers only an authorized next action; a safe error has a retry path where retry is safe.
- Server validation appears adjacent to its field, uses `aria-invalid` and `aria-describedby`, and keeps entered data. A summary/alert is used for request-level failures without duplicating field errors excessively.
- A stale conflict never overwrites user input silently. The UI keeps the draft, explains that newer data exists, offers reload/review, and only retries after the user chooses.
- API data is rendered as text; no description/result/comment/note is injected as executable HTML.

## 3. Staff Ticket Detail: Actions Taken area

### 3.1 Screen placement and list

The existing Staff Ticket Detail keeps Ticket summary, owner, priority, status, attachments, Public Comments, and Internal Notes. It gains an `Actions Taken` section after the shared Ticket summary and before/alongside operational history in a layout that remains readable on narrow screens.

Each Action row/card shows:

- status text/badge, description, assignee, Performed by, Action Date/Time, Result;
- Follow-Up Required state and safe Follow-up Note;
- Attachment Notes;
- created/updated context when useful without replacing the formal history;
- action controls only when permitted by role and lifecycle.

Actions use deterministic order. The default work list is chronological by creation; the completed-work subview may order by Action Date/Time descending. Canceled Actions are retained, labelled, and not disguised as missing data.

### 3.2 Create mode

The `Add Action` control is visible only to authenticated IT Staff/Admin with access to the operational Ticket. It opens a clearly titled form with:

| Field/control | Behavior |
| --- | --- |
| Assignee | Required searchable/selectable active IT Staff/Admin. An inactive user is absent or disabled and a server rejection remains visible if data changes after load. |
| Action Description | Required; field-level length/blank error. |
| Follow-Up Required? | Accessible checkbox/switch with explicit Yes/No meaning. |
| Follow-up Note | Hidden or disabled until follow-up is selected; becomes required when selected. |
| Attachment Notes | Optional text describing an existing attachment; no new file-upload control is added here. |
| Save Action | Disabled only during the active submission; sends a one-time retry key and shows progress. |
| Cancel form | Returns focus to `Add Action`, does not mutate server data, and warns only if entered data would be discarded. |

The form does not ask the user to type Performed by, lifecycle/audit IDs, versions, or timestamps. A newly created Action is visibly `Planned` and its Performed by/Action Date/Time display `Pending completion` until it is completed.

### 3.3 View/edit/lifecycle mode

Staff/Admin may use a row's `Edit`, `Assign`, `Start`, `Complete`, or `Cancel Action` controls only when its lifecycle permits them. A Requester sees the same safe Action information in read-only form with no hidden-but-focusable mutation controls.

| Action state | Visible allowed controls |
| --- | --- |
| Planned | Edit, Assign, Start, Complete, Cancel |
| In progress | Edit, Assign, Complete, Cancel |
| Completed | View history only; no edit/assignment/cancel control |
| Cancelled | View history only; no edit/assignment/complete control |

Completion opens an accessible confirmation form requiring Result and, if selected, Follow-up Note. Cancellation requires a reason. The confirmation modal/dialog has a programmatic label, traps focus while open, closes with Escape when no irreversible submission is pending, and restores focus to the triggering control after close/success/failure. On success the Action list, Ticket summary, workflow history, and affected dashboard cache/state refresh.

### 3.4 Staff feedback states

- **Loading:** section skeleton/text indicates Actions are loading; no fake zero count is shown.
- **Empty:** “No Actions Taken have been recorded for this Ticket.” Staff sees `Add Action`; Requester sees no unauthorized call-to-action.
- **Validation:** each invalid field is labelled with corrective text; values survive.
- **Forbidden/not found:** a safe page/section message avoids revealing another Requester's resource.
- **Conflict:** show the stale version explanation, preserve form data, provide reload/reconcile action.
- **Network/server failure:** show safe non-technical error, retry when safe, and preserve form data.

## 4. Requester Ticket Detail: read-only Actions

An owned Requester Ticket Detail shows an `Actions Taken` section with all safe Action records, including planned, completed, and cancelled state. It exposes description, status, Action Date/Time or pending state, Result, Performed by when completed, Follow-up state/note, and Attachment Notes. It never exposes an Action's internal audit payload, session data, private system information, or Internal Notes.

The section has loading, empty, not-found, and safe-failure states but no action form, assignment selector, lifecycle button, or edit shortcut. A direct UI or API attempt to mutate remains blocked server-side.

## 5. Ticket workflow controls

Staff Ticket Detail renders only transitions permitted from the loaded Ticket status and the current role. The control explains needed preconditions before submit, but the API remains authoritative. The status form includes confirmation or reason only when the selected transition requires it.

For a resolution-gate rejection, the UI identifies safe actionable facts such as “assign an active owner,” “complete at least one Action with a result,” or “finish/cancel active Actions,” without exposing another user's data. A successful transition refreshes the Ticket summary and records a visible, role-appropriate history entry. A Requester's advisory “problem appears resolved” remains separate, clearly labelled advisory, and does not change the formal status in the screen.

## 6. Requester Dashboard

The Requester Dashboard is concise and only summarizes the authenticated Requester's Tickets. It is not a duplicate of My Tickets.

| Element | Content | Drill-down |
| --- | --- | --- |
| Open Tickets card | Count defined by BR-19 | My Tickets filtered to `scope=open` |
| Waiting for You card | Owned Tickets in `WAITING_FOR_REQUESTER` | My Tickets filtered by that status |
| Recently Updated card | 14-day bounded summary | My Tickets `scope=recently-updated` |
| Recently Resolved card | Resolved/closed within 14-day semantics | My Tickets `scope=recently-resolved` |
| Attention list | Bounded tickets waiting for this requester | Ticket Detail |
| Recent lists | Bounded updated/resolved Ticket rows | Ticket Detail or matching filtered view |

Cards have accessible labels that include the metric name and count. Zero cards remain visible with `0`; lists show a useful empty state. A Requester cannot make the dashboard return another Requester's metric by changing URL/hash/query state.

## 7. Staff and Administrator Dashboard

The Staff Dashboard is an operational starting point, not a full Staff Queue. It contains:

| Element | Content | Drill-down |
| --- | --- | --- |
| Unassigned Open | Backend count of open Tickets with no owner | Staff Queue `scope=unassigned-open` |
| My Owned Open | Backend count of open Tickets owned by current user | Staff Queue `scope=my-owned-open` |
| My Active Actions | Actions assigned to current user that are planned/in-progress | Relevant Ticket Detail with selected Action or Action filter |
| My Recently Completed Actions | Completed Actions performed by current user in the documented window | Relevant Ticket Detail/Action history |
| Urgent Open | Open urgent Tickets | Staff Queue `scope=urgent-open` |
| Recent or Urgent Tickets | Bounded rows with Ticket number, status, priority, owner, updated time | Staff Ticket Detail |

Administrator sees this operational dashboard and, if implemented, a clearly separate concise active-user account summary. It does not expose passwords, sessions, or a full user export.

Cards/lists cover loading, empty, forbidden, stale/deleted drill-down, and safe failure. A metric always comes from the dashboard API, never by counting the currently displayed browser page. The dashboard marks the current user and refresh timestamp without displaying sensitive session details.

## 8. Responsive specification

The team will inspect three reference widths: desktop 1440px, tablet 820px, and mobile 390px. These are review/test viewports selected by this Contract; they are not a claim that the Lab 4 handout prescribes exact pixels.

| Area | Desktop 1440px | Tablet 820px | Mobile 390px |
| --- | --- | --- | --- |
| Navigation | Full labelled nav | Collapses only if space requires; menu remains labelled | Menu button with labelled, keyboard-operable menu and active page context |
| Metric cards | Multi-column grid | Two-column or auto-fit grid | One column, no clipped label/value |
| Ticket/Action details | Key/value/table layout when readable | Cards/stacked rows if table becomes dense | Stacked labelled fields; horizontal data table replaced/reflowed rather than page overflow |
| Action form | Related controls may share rows | Inputs wrap with preserved labels | One control per row; full-width buttons with adequate spacing |
| Dialog | Centered with readable width | Adaptive width | Safe viewport margins, scrollable content, no controls behind browser chrome |

At all sizes there is no body-level horizontal scrolling, overlapping controls, clipped error text, lost focus outline, unreadable badge-only meaning, or inaccessible hidden interactive element. Screenshots/test evidence cover all major Lab 4 screens, not only the dashboard happy path.

## 9. Accessibility and visual checklist

- [ ] One logical heading hierarchy and descriptive page titles/section headings.
- [ ] Every input/select/checkbox has an associated visible label; required state is text/programmatic, not colour alone.
- [ ] Validation uses `aria-invalid`, associated descriptions, and a focus strategy that does not trap users at a summary.
- [ ] All functionality works by keyboard; focus order is meaningful and remains visible.
- [ ] Dialog focus trap, Escape, close button, and focus return are tested.
- [ ] Status/priority/action state have readable text or icon labels besides colour.
- [ ] Public/shared Actions and Internal Notes are visually and semantically distinct.
- [ ] Loading, success, alert, error, and empty feedback are announced appropriately without excessive interruption.
- [ ] Cards, tables, forms, action controls, error messages, and long text have no clipping, overlap, or horizontal page overflow at 1440/820/390px.
- [ ] Contrast and text sizing follow the existing Zen Green system; a manual visual check accompanies automated checks.

## 10. Non-goals and cleanup

The dashboard does not create a report builder, notification centre, inventory UI, or new attachment storage. Temporary, duplicate, obsolete, placeholder, and inconsistent Lab 1-3 controls are removed or relocated only after regression tests confirm the supported behavior remains available. In particular, the existing visible `Check System` control is reviewed for removal from the final authenticated shell; the health endpoint remains available for diagnostics/tests.

## 11. Evidence obligations

Implementation evidence must show read-only versus editable Action states, validation, inactive-assignee rejection, completion/cancellation, conflict recovery, current-user Actions, dashboard metric/drill-down correctness, three viewports, keyboard/focus behavior, and safe failure. Historical specification/review screenshots are labelled with their historical commit; final product screenshots are captured from exact final `main`.
