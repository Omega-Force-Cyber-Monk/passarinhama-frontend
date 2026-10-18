# Forums UI refactor

## Changes

- The three existing routes continue to use `src/pages/Forums.tsx`. The page-local Permission button, management dialog, role query, mutation consumer, and associated UI state were removed. Shared permission endpoints/types and all existing dynamic/ownership checks remain unchanged.
- The header uses the same title/button styles as the content listing modules. Back navigation and wrapping breadcrumbs use accessible controls. New Forum and New Topic keep their existing permission gates and handlers.
- The layout responds to the actual page width: the panels stack below the main content until 64rem is available; beyond that, the main column shares space with a 16–19rem panel column. Forum row actions move alongside the content when the main column reaches 36rem. Forum cards remain content-sized, with compact thumbnails and no fixed card height.
- Forum lists retain names, rich descriptions, responsible persons, topic/post counts, color accents, edit/delete controls, and navigation. Missing/failed thumbnails use a consistent fallback. Attachment image previews also handle failures without broken image icons.
- Topic rows retain authors, dates, reply/view counts, pinning, edit/delete actions, ordering, and pagination. Metadata/pagination can wrap. Icon actions have accessible labels, and navigation cards accept Enter without intercepting child action events.
- Topic discussions use aligned compact avatars and wrapping post headers. Rich content is width-bounded; wide tables and preformatted code scroll within the post, while media scales to the available width. Replies, attachments, and all toolbar capabilities remain available.
- Pinned Discussions and Latest Activity remain shared across the routes. Activity actions remain visible on touch devices. Existing loading behavior is retained, with explicit empty/error messages added where the page previously rendered blank content.

## Exact create type and edit behavior

The create request explicitly supplies `forum_type: "general"`. This is the exact field/value already used by the existing DTO, create form default/options, and API serializer, also reflected in HANDOVER.md. The RTK Query endpoint serializes it as `forum_type=general` in the POST query string and sends the thumbnail through its existing FormData body. No backend request contract was changed, and no live API verification was performed.

The create form no longer has a Type control or type UI state. Edit state retains `forum.forum_type`, and the update request continues sending `editForumData.forum_type`. Nonstandard stored values are displayed as an existing option, so opening/saving an edit does not silently replace them with General.

## Modal sizing

Create/edit forum dialogs use a 42rem maximum width, bounded viewport height, and a scrollable body. The create form aligns name/responsible fields in two columns only when the form itself is wide enough. Rich editors use their existing compact variant and a bounded scrollable editing area, preserving the full toolbar and extensions. Thumbnail upload/preview layouts scale to the form width. Create/Cancel actions use a sticky action row within the form. Shared Modal and Tiptap defaults used by other modules were not changed.

## Limits and manual verification

Only static source, JSX/JSON syntax, TypeScript (`tsc --noEmit`), and whitespace inspection were performed. No application, server, production build, unit/UI/integration/E2E test, browser, screenshot, live API request, or dependency installation was run. No reference screenshots were attached with the task text.

Existing API/data limitations remain: the forum query requests 100 forums; Latest Activity uses the existing active forum's topics; direct topic selection relies on the currently loaded topics page/local topic data. A topic outside that loaded page now shows a clear unavailable notice rather than a blank main column. No new data-fetching contract or routing behavior was introduced to address these existing limits. Rich HTML handling and backend validation/authorization remain as before; the changes bound its visual layout.

Manually verify all three routes at phone, tablet, laptop, and desktop widths, including sidebar effects; long names/usernames/links; rich images/tables/code; missing thumbnails; attachment previews/downloads; header actions and breadcrumbs; both pagers and disabled states; pin/unpin; role/ownership controls; forum/topic/reply CRUD and validation failures; create payload General type; unchanged stored types during edits; modal scrolling/toolbars/actions; EN/FR; and loading/error/empty states.
