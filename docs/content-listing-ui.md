# Articles, Training and TechnicoPro listing UI

## Shared UI

`src/components/ui/ContentListing.tsx` provides the page header, Published/Draft controls, status form field, compact content cards and matching loading cards. Each module passes its own data, navigation callbacks and existing permission decisions. Shared cards reuse Home's image/body/title/description/footer styles, with a category/status row and consistently placed image actions. Navigation and management actions are separate sibling buttons.

Cards use 152–160px images, 16px content padding and 8px gaps. Two-line title, description and footer slots keep the overall dimensions approximately 332–340px at the default root font size, without a fixed total card height or growing content area. Broken/missing images use the same neutral placeholder dimensions. Long category labels, titles and metadata are bounded.

Grids follow the available page container width: one column below 30rem, two from 30rem, three from 46rem and four from 60rem. Fewer records keep the normal grid column widths. All records on the current API page remain available; the grid does not impose Home's four-item total limit. Headers and action buttons wrap, and pagination controls remain usable on narrow screens.

## Status and permissions

- Published is the default. Explicit Draft query/navigation state is honored only under the page's existing lifecycle-content permission gate.
- The shared filter recognizes `status` and legacy `statusFilter` query/navigation values. Pending/unknown requests resolve to Published before any listing query runs; invalid URL filters are replaced without changing other query parameters.
- Only Published and Draft appear in tabs and selectable status choices. Article Pending queries and pagination state were removed. API result rows are also checked against the requested status, preventing unexpected Pending records from appearing in these listings.
- Form state retains the backend status enum. If an existing Pending (or other nonselectable-status) record reaches an editor, the actual status is displayed as a notice. The placeholder retains that status; only an explicit Published/Draft selection changes it. Saving without a selection submits the original status.
- Articles' page-local permission-management button/dialog, roles query, UI state and mutation consumer were removed. Shared permission endpoints/types, dynamic permissions, and ownership-based article edit/delete checks remain intact. Training and TechnicoPro had no equivalent permission-management buttons in these pages.
- Category management still uses the existing shared CategoryManagerDialog and each module's original hooks and permission policy. Create/edit/publish/delete APIs and backend contracts were not changed.

## Verification and limitations

Only source review, TypeScript static checking (`tsc --noEmit`), JSON/TSX syntax inspection and whitespace review were performed. No application, server, build, unit/integration/UI test, browser, screenshot, live API request or dependency installation was run. No screenshots accompanied the request attachment.

Manual verification is required for responsive layouts at phone/tablet/laptop/desktop widths, sidebar sizing, long text, missing/broken images, page navigation, category filters, query/back-button status navigation, loading/error/empty states, EN/FR switching, role/ownership restrictions, and create/edit/publish/delete flows. Check legacy Pending filter fallback and unchanged-status saves on any existing nonselectable-status record reachable through an editor. Backend totals/pagination remain authoritative; unexpected records filtered defensively may leave a partially filled page if the backend does not honor its status filter.
