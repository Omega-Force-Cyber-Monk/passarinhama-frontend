# Home UI refactor

## Behavior

- The header uses a single search input with a clickable search icon inside its right edge. Enter and icon clicks use the same search handler. Existing 300 ms debouncing, clear action, Escape dismissal, permission filtering, result links, and translated messages remain in place. Explicit submission retries the current query, including after an error.
- Search reuses `getDashboardSearch` in `src/redux/features/dashboard/dashboardApi.ts`: `GET /home/?q=<query>&limit=10`. No new endpoints, local mock results, or live requests were introduced.
- The existing search response supports articles, forums, forum topics/posts, trainings, agenda, TechnicoPro, documents, and document folders. Actual coverage and ranking depend on the backend implementation.
- Each Home section requests four items and defensively displays only the first four returned items in API order. No carousel state, arrows, sliding, or horizontal scrolling remains.
- Forums, trainings, and articles share a compact card structure: 160px images, 16px content padding, 8px gaps, and two-line slots for titles, descriptions, and footer metadata (approximately 316px total at the default root font size). Overall card height is determined by these content slots, without a fixed card height or expanding body. Optional category/date badges sit over the image without reserving an empty content row. Missing or failed images use a neutral icon placeholder. Agenda keeps its date-box/event layout with fluid sizing.
- Content grids use the main content container width: one column below 30rem, two from 30rem, three from 46rem, and four from 60rem. Agenda retains its original 34rem/52rem/70rem thresholds. Sidebar width therefore affects the layout naturally. Section headers wrap and the unified search moves below header navigation on small screens.

## Backend dependencies and limits

The repository already defines a global search API contract; no backend extension can be established as necessary from frontend source alone. The deployed backend must implement that contract, enforce authentication and per-resource authorization, and supply accurate result types, IDs, and metadata. Frontend permission filtering is supplementary to server authorization.

Forum topic/post results need their parent forum/topic IDs. Document results need a folder ID to generate an existing application route. Results missing required route metadata retain the existing unavailable state. Backend availability, indexing completeness, ranking, and authorization were not verified through live requests.

Home query/loading/empty handling and permission gates remain in place. Existing Home queries have no separate error panel; their existing empty-state behavior on a failed request without cached data is retained.

## Verification

Static TypeScript checking: `node node_modules/typescript/bin/tsc --noEmit`.

Runtime and browser testing were not performed. No server, production build, test suite, automated UI test, package installation, or live API request was run. No reference screenshot was available in the supplied attachment.

Manual checks:

- Check narrow phones, tablets, laptop/desktop widths, and the mobile sidebar drawer for overflow and overlap.
- Check all four sections with zero, fewer than four, and more than four records; confirm API order and View all/card navigation.
- Check long titles, descriptions, creator names, category names, locations, and absent/broken images.
- Check Enter/icon submission, debounced search, clear, Escape, errors, and result navigation across supported resource types.
- Check EN/FR switching, different roles/permissions, loading and empty states, and Extranet navigation.
