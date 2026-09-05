# Lab 2 Zen Green UI Specification

**Contract status:** Approved by Wachirawit Photchamnian (67070505206) on 2026-09-03.

This document defines the reusable visual, responsive, state, and accessibility contract for the Lab 2 Requester experience.

## 1. Design Principles

1. Calm and clear: use green for identity/action, quiet neutral surfaces, and restrained emphasis.
2. State is explicit: never communicate validation, ownership, loading, success, warning, or removal by color alone.
3. Read-only is visibly different from editable while remaining legible.
4. Small screens are first-class: no required action or filename becomes hidden or clipped.
5. Reuse one component/state language across selection, creation, list, detail, and attachments.

## 2. Design Tokens

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#006B3C` | Header, primary action, strong emphasis |
| `--color-primary-hover` | `#005631` | Primary hover/pressed |
| `--color-secondary` | `#0B7A46` | Active navigation, focus accent, links |
| `--color-pale-green` | `#EAF6EF` | Selected rows/cards, success background, subtle sections |
| `--color-page` | `#F5F7F6` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, forms, menus |
| `--color-text` | `#17362A` | Primary text; never pure black |
| `--color-text-muted` | `#52685F` | Supporting text |
| `--color-border` | `#C8D5CF` | Neutral borders/dividers |
| `--color-readonly` | `#F0F4F1` | Read-only fields |
| `--color-error` | `#9B1C1C` | Error text/border/icon |
| `--color-error-bg` | `#FDECEC` | Error callout background |
| `--color-warning` | `#8A4B08` | Warning text/border |
| `--color-warning-bg` | `#FFF4D6` | Warning callout/badge |
| `--color-success` | `#176B3A` | Success text/border |
| `--color-success-bg` | `#EAF6EF` | Success confirmation |
| `--color-focus` | `#0B7A46` | 3 px keyboard focus ring |

Every status callout includes an icon/title or textual label in addition to color. Contrast targets are WCAG AA: 4.5:1 for ordinary text and 3:1 for large text/UI boundaries.

### Typography

- Font stack: `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`.
- Base: 16 px, line-height 1.5.
- Small/supporting: 14 px, line-height 1.45; never below 12 px.
- Page title: 30 px desktop, 26 px tablet, 24 px mobile; weight 700.
- Section title: 20 px; weight 650-700.
- Labels/buttons/navigation: 14-16 px; weight 600.
- Body text wraps naturally; filenames may break at safe characters or use `overflow-wrap:anywhere`.

### Spacing, shape, and elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px.
- Form row gap: 16 px; section gap: 24-32 px.
- Card padding: 24 px desktop/tablet, 16 px mobile.
- Control minimum height: 44 px; touch target minimum: 44 x 44 px.
- Border radius: 8 px controls, 12 px cards/callouts.
- Surface border: 1 px solid `--color-border`; shadow no stronger than `0 4px 16px rgba(23,54,42,.08)`.
- Main content maximum width: 1200 px; form maximum width: 960 px.

## 3. Application Shell and Navigation

### Desktop/tablet

- Green header contains TokTickIT wordmark/identity, My Tickets, Create Ticket, current Requester, and Change Requester.
- Active route has both a pale/contrast background or underline and `aria-current="page"`.
- Main content is centered with 24-32 px side padding.

### Mobile

- Header shows TokTickIT, current Requester (truncated visually only when necessary), and a labeled Menu button.
- Menu expands/collapses with `aria-expanded`; focus returns to the trigger when closed.
- My Tickets, Create Ticket, and Change Requester remain visible inside the menu and keyboard reachable.
- No horizontal page scrolling.

## 4. Shared Component Rules

### Form controls

- Labels are above controls with consistent 8 px label-to-control spacing.
- Required labels include a visible red `*` plus accessible text such as `aria-required="true"`; the marker never replaces a validation message.
- Editable fields use white background and neutral border.
- Read-only fields use `--color-readonly`, a Read only hint where ambiguity exists, and remain selectable/readable.
- Focus uses a persistent 3 px `--color-focus` ring with offset; it is not removed.
- Invalid controls use error border, `aria-invalid="true"`, and `aria-describedby` pointing to the message immediately below.
- Disabled controls have reduced contrast plus a disabled cursor and cannot activate.
- Description is taller (minimum 140 px) and vertically resizable only.

### Buttons

- Primary: solid primary green, white text; one dominant primary action per local workflow.
- Secondary: white/pale surface, green border/text.
- Tertiary: text/link style with adequate target area.
- Destructive: dark red border/text; solid red only in the final confirmation action.
- Disabled: visibly muted and noninteractive.
- Busy: disabled, spinner plus stable action text such as `Submitting...`; width does not collapse.
- Buttons include visible text. Icon-only controls require an accessible label and tooltip.

### Messages and states

- Field errors appear directly below their field.
- Page/API callouts appear near the affected section and include title, message, and Retry/next action where meaningful.
- Loading uses a labeled skeleton or spinner with `aria-live="polite"`.
- Success confirmation shows the official Ticket Number and a clear next action.
- Empty-list and no-results use different headings and actions.
- Unexpected errors display a correlation ID only when provided, never raw technical detail.

### Badges

- Every badge contains readable text and uses color plus border/icon/shape.
- Requested Priority: Low neutral green, Medium blue-green, High amber, Urgent red.
- IT Priority: Not assigned neutral gray in Lab 2; no edit control.
- Current Status: New uses pale green with dark green text.
- Attachment: Active uses success treatment; Uploading uses progress treatment; Invalid uses error; Removed uses neutral/struck-file icon plus Removed; Unavailable uses warning.

## 5. Development Requester Selection

### Structure

- Centered selection card, maximum width 560 px.
- TokTickIT title and concise explanation: the selector is for Lab 2 testing and is not login; authentication arrives in Lab 3.
- Labeled Development Requester dropdown populated from PostgreSQL.
- Primary Continue button disabled until a valid option is selected.

### States

- Initial/loading: dropdown and Continue disabled; labeled loading indicator.
- Ready: active options in predictable order.
- Empty: `No active Development Requesters are available.` plus guidance; Continue disabled.
- Failure: safe error plus Retry; no stale options presented as current.
- Continue/busy: controls disabled and button says `Continuing...`.

### After selection

- Shell shows `Requester: <name>`.
- Change Requester is visible and requires confirmation only when unsaved Create Ticket changes would be lost.
- Selection change clears old requester-specific content before loading the new context.

## 6. Create Ticket Screen

### Information architecture

1. Page header: title and short guidance.
2. System information section: read-only Ticket Number (`Generated after submission`), Ticket Date (`Set on submission`), Requester.
3. Classification section: Category, Related System, Requested Priority.
4. Request details: Summary and Description.
5. Attachments: selected-file list, per-file validation/status, add/remove-before-submit.
6. Actions: primary Submit Ticket and secondary Reset/Cancel.

### Layout

- Desktop: two-column form grid. System/classification fields may share rows; Summary and Description span both columns.
- Tablet: two columns where labels/content fit; Summary/Description span full width.
- Mobile: every field and action stacks; primary action is full width; selected filenames wrap.

### Required states

- Initial reference-data loading.
- Ready with loaded database values.
- Validation failure with field-level messages.
- Submitting: all mutation controls disabled, stable busy button.
- Ticket success: official Ticket Number, saved summary, View Ticket and My Tickets actions.
- API failure: values/files preserved, safe message, retry possible.
- Invalid attachment: per-file type/size/count message; valid selections remain.
- Partial attachment failure after Ticket creation: success identifies created Ticket and separates successful/failed uploads with Retry failed uploads.

## 7. My Tickets Screen

### Controls

- Header with page title and primary Create Ticket action.
- Search input with explicit Search action or 300-500 ms debounce; accessible label.
- Filters: Category, Related System, Requested Priority, Current Status.
- Sort field and direction.
- Clear Filters resets search/filters/page but retains documented default sort.
- Page-size selector and Previous/Next plus current-page/total information.

### Desktop representation

Table columns: Ticket Number, Summary, Category, Related System, Requested Priority, Current Status, Last Updated, and an Open action. Header cells communicate current sort. Long Summary truncates visually with full accessible/title text.

### Mobile representation

One card per Ticket: Ticket Number and Current Status at top, Summary, Category/System, Requested Priority, Last Updated, and full-width View Details action. Cards preserve the same information needed to identify/open a Ticket.

### States

- Loading: table/card skeleton and disabled paging.
- Empty list: `You have not created any tickets yet.` plus Create Ticket.
- No results: `No tickets match these filters.` plus Clear Filters.
- Failure: safe callout and Retry.
- Page beyond end after a filter change resets to page 1.

## 8. Requester Ticket Detail

### Structure

- Back to My Tickets link.
- Header: Ticket Number, Current Status, Requested Priority, Ticket Date.
- Read-only grouped sections: Requester, classification, Summary, Description, timestamps, and optional unassigned IT Priority.
- Separate Attachments section below Ticket information.
- No comments, notes, Actions Taken, status controls, IT Staff controls, or lifecycle actions.

### States

- Loading detail skeleton.
- Owned detail success.
- Safe not-found/ownership state with Back to My Tickets.
- API failure with Retry.
- Layout never implies editable Ticket fields.

## 9. Attachment Section

- Add Attachment input/action remains clear and keyboard accessible.
- Active row/card: filename, type, formatted size, upload timestamp, Download, and Remove.
- Uploading: filename, progress/busy indicator, actions disabled.
- Invalid: filename, reason, Remove from selection/retry guidance.
- Removed: metadata, Removed badge, removal timestamp/reason; no preview/download action.
- Unavailable: warning state; no download action.
- Remove opens a focus-trapped confirmation dialog with filename, required reason field, Cancel, and destructive Remove Attachment.
- Closing the dialog restores focus to the initiating control.
- Desktop may use rows; mobile uses stacked cards with wrapping filenames and full-width actions.

## 10. Responsive Contract

| Viewport | Required behavior |
| --- | --- |
| Desktop `>= 992px` | Centered sensible max width; multi-column forms; full Ticket table |
| Tablet `768-991px` | Two columns where practical; full-width Summary/Description; table may reduce spacing but not hide required actions |
| Mobile `< 768px` | Single-column fields; ticket/attachment cards; touch-friendly buttons; mobile navigation; no horizontal page scroll |
| All | No clipped labels, overlapping messages, hidden buttons, unreadable filenames, or state conveyed by color alone |

Target screenshot widths are 1440 px desktop, 820 px tablet, and 390 px mobile. Height may vary to capture complete state.

## 11. Accessibility Contract

- Use semantic headings in order and landmarks for header/navigation/main.
- Every control has a programmatic label; helper/error text is linked with `aria-describedby`.
- Focus order follows visual order; no keyboard trap except a modal with managed focus.
- Dynamic status uses suitable `aria-live`; errors use `role="alert"` only when immediate interruption is appropriate.
- Tables use captions/headers; mobile cards expose equivalent names/values.
- Menu/dialog disclose state (`aria-expanded`, `aria-modal`).
- Icons never carry meaning without text or an accessible name.
- Motion respects `prefers-reduced-motion`.

## 12. Automated UI Style Assertions

Tests shall verify:

- required token values and reusable state classes/attributes;
- label position, required markers, `aria-invalid`, and nearby error association;
- read-only/editable visual classes;
- disabled and busy submit behavior;
- active navigation and current Requester display;
- badge text/state classes;
- loading, empty, no-results, success, warning, failure, removed, and unavailable states;
- desktop table and mobile card representation;
- modal accessible name/focus behavior;
- no document-level horizontal overflow at required viewport widths.

## 13. Visual Inspection Checklist

- [ ] Primary/secondary/pale greens and quiet page/surface colors match tokens.
- [ ] Text contrast and focus rings remain readable.
- [ ] Editable and read-only fields are immediately distinguishable.
- [ ] Required markers and messages sit with the correct field.
- [ ] Primary, secondary, tertiary, destructive, disabled, and busy buttons follow hierarchy.
- [ ] Loading, empty, no-results, success, warning, and failure states are visually distinct.
- [ ] Priority/status/attachment badges are consistent and include text.
- [ ] Desktop tables and mobile cards contain equivalent identifying information.
- [ ] No clipped labels, overlaps, hidden actions, unreadable filenames, or horizontal page scrolling.
- [ ] Mobile navigation is operable and the current page is clear.
- [ ] Removal dialog is clear, focused, and not mistaken for permanent metadata deletion.
- [ ] Screens match this specification rather than memory or ad-hoc styling.

## 14. Screenshot Evidence Paths

```text
artifacts/lab-02/screenshots/
├── requester-selection/
├── create-ticket/
│   ├── desktop/
│   ├── tablet/
│   └── mobile/
├── my-tickets/
│   ├── desktop/
│   ├── tablet/
│   └── mobile/
└── ticket-detail/
    ├── desktop/
    ├── tablet/
    └── mobile/
```

Create Ticket evidence includes initial, validation, submitting, success, API failure, invalid attachment, and partial upload failure. My Tickets evidence includes Requester A/B, search, filters, sort, pagination, empty, no-results, and failure. Ticket Detail includes owned, unauthorized/not-found, active attachment, upload, download, removal confirmation, removed metadata, blocked download, and failure.
