# Detail page standardization and field inventory

## Shared presentation

`src/components/ui/ContentDetail.tsx` provides composable layout, breadcrumbs/back navigation, header/metadata, rich-content renderer, attachment section, additional sections and last-updated footer. Each page still uses its original query hooks, route parameter and field mapping. There were no Edit/Delete controls on these inspected detail pages, so no new mutation workflow or permission-management UI was introduced. Existing listing-page management and route/backend authorization remain unchanged.

## Field-preservation audit

This inventory was taken from the existing rendered JSX before changing the presentation. Every existing supported field/action has a display location below.

| Module | Previously displayed field/action | New location |
| --- | --- | --- |
| Articles | Full title, category name, actual status | DetailHeader; title is never clamped |
| Articles | structured_fields.author (existing fallback), author initials, Publisher label | Header author group; canonical author.name is an additional fallback |
| Articles | created_at | Header Created metadata |
| Articles | estimated_read_time_minutes | Header reading-time metadata; the existing five-minute fallback is retained |
| Articles | excerpt and complete body HTML | RichContentRenderer, without text truncation |
| Articles | structured_fields.file_urls | DetailAttachments, with original filename/MIME/size/category metadata and existing open/download handlers |
| Articles | Last updated text, formerly repeating created_at | DetailUpdated now uses updated_at, falling back to created_at; creation date remains visible in the header |
| Articles | Continue Reading: up to two other articles, category, full title, created date and route link | Article-specific related section using the same five-record query and exclusion/order/slice behavior |
| Articles | Back, loading, forbidden notice and not-found/error states | Existing list destination and state branches retained; shared state sizing |
| Training | Full title, category name/fallback, actual status | DetailHeader |
| Training | created_by first/last names and default creator fallback | Header creator group |
| Training | created_at | Header Created metadata |
| Training | excerpt and full description HTML | RichContentRenderer |
| Training | All training.attachments and filename/MIME/size/category metadata | DetailAttachments; existing file handlers retained |
| Training | Last updated text | DetailUpdated uses updated_at when supplied, otherwise the previously displayed created_at |
| Training | Back, loading, forbidden and error/missing states | Original guards/destination retained; missing-content labels now correctly say Training |
| TechnicoPro | Full title, category/fallback, actual status | DetailHeader |
| TechnicoPro | author.name, structured author fallback, default author fallback | Header author group, in the same preference order |
| TechnicoPro | created_at | Header Created metadata |
| TechnicoPro | excerpt and full body HTML | RichContentRenderer |
| TechnicoPro | All structured_fields.file_urls with filename/MIME/size/category metadata | DetailAttachments with the same file handlers |
| TechnicoPro | Last updated text | DetailUpdated uses updated_at when supplied, otherwise created_at |
| TechnicoPro | Back, loading, forbidden and error/missing states | Original guards/destination retained; missing-content labels now correctly say TechnicoPro |

Detail pages intentionally omit thumbnail_url covers, placeholders and cover spacing; API cover data, listing/Home covers and inline rich-content images remain unchanged. Article attachments and pdf_url are included when available, preserving structured-file order and merging duplicate URLs without losing existing filename/metadata. published_at is displayed when supplied. No date, image, tag or resource is fabricated to fill an empty section. Training scheduling/registration fields and optional structured metadata that were not previously displayed are not given invented workflows.

## Responsiveness and media

All pages use the same fluid padding, 64rem maximum outer width, and approximately 74-character body reading width. Detail content grows naturally with no fixed body height. Titles, author names, breadcrumbs and metadata wrap fully. Inline images retain their own proportions. There is no top cover section.

Attachments and related articles use one or two columns based on available page container width. Attachment rows have wrapping filenames, file icons, MIME/size/category metadata, visible focus/hover states and a separate 44px download control. Valid API references retain their original link URL and filename. Relative URLs resolve against document.baseURI, matching the previous fetch behavior; unsafe protocols, credentials and placeholder references have no active link. Same-origin/configured API files use the existing token-aware Blob mechanism with a tab reserved synchronously during the click, opener cleared, failure cleanup and temporary object URL revocation. Other HTTP(S) references, including external signed URLs, open through standard target=_blank / rel=noopener noreferrer anchors without forwarding the application bearer token. Downloads retain the existing Blob download mechanism. Fetch failures and blocked popups produce localized inline errors; externally navigated server errors are displayed by the new tab. Missing references remain safely omitted by the existing normalizer. Browser support, server Content-Disposition/CSP and external download CORS determine preview/download behavior. Tables, code and oversized rich content scroll within their content region instead of widening the page.

## HTML handling

The old detail pages inserted response HTML directly without a client sanitizer. `src/utils/richContent.ts` now applies an allowlist before insertion. It retains the existing editor's paragraphs/headings, formatting, lists, blockquotes, links, tables, images, code and YouTube blocks, along with ordinary HTML media. It removes active document elements, event handlers, unsafe URL protocols and arbitrary styling/application classes. Safe editor alignment/colors/dimensions remain. YouTube and youtube-nocookie embed frames retain their content; other safe frame sources are exposed as links. Backend HTML is never modified or saved by this renderer.

External non-YouTube frames are therefore links rather than embedded documents. Custom HTML outside the inspected editor capabilities needs manual review against this allowlist; server-side content validation and authorization remain authoritative.

## Verification

Only static TypeScript checking, source/field mapping review, syntax inspection and whitespace checks were performed. No application, local server, browser, screenshots, production build, automated tests, live API requests or package installations were run. No screenshots accompanied the text attachment.

Manually verify each route at mobile/tablet/laptop/desktop widths, including sidebar changes; long titles/authors/filenames; absence of top covers and preservation of inline images; all rich formatting, tables/code, links and YouTube embeds; attachment metadata, authenticated open/download and failures; dates/statuses; related Article links; EN/FR; and loading/403/not-found/network-error states. Rich HTML security behavior has only received static inspection, not runtime validation.
