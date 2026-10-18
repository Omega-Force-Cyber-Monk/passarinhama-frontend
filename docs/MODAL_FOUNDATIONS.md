# Shared modal foundations — Phase 2

Phase 2 implements the approved shared foundations only. No feature call site opts into a new presentation yet. Phase 3 batches still need separate authorization. Existing repository tokens supply typography, slate/navy surfaces, yellow focus/accent, borders and shadows; no Figma replacement or brand changes were introduced.

## Modal API

`Modal` retains `isOpen`, `onClose`, `title`, `children`, `maxWidth` and `className`.

| New prop | Default | Purpose |
| --- | --- | --- |
| `layout` | `"legacy"` | Opt into `"compact"`, `"sectioned"` or `"drawer"`. |
| `footer` | absent | Persistent sibling of the scrolling body; no footer is injected into existing callers. |
| `description` | absent | Optional supporting text connected with `aria-describedby`. |
| `initialFocusRef` | absent | Prefer a specified enabled/visible control when opening. Existing React autofocus inside the panel is respected otherwise. |
| `closeDisabled` | `false` | Disable header, Escape and backdrop dismissal together. Existing caller guards still run unchanged. |
| `closeOnEscape` / `closeOnBackdrop` | `true` | Independently opt out of those dismissal requests. Dismissal never mutates caller state directly. |

Legacy width/spacing/classes remain the default, including supplied width/root classes and the existing children. Modern layouts use natural centered panel heights, bounded `dvh` scrolling and compact headers. Compact/sectioned defaults cap width at 46/56rem; drawers cap at 48rem and occupy viewport height, with full width on narrow screens. A supplied `maxWidth` overrides the default width cap. No large fixed form/body heights are imposed.

All generic dialogs are portaled to `document.body` to avoid clipping/stacking contexts from contained or transformed page ancestors. This preserves the modal's props and CSS class structure while correcting viewport positioning; visual placement still needs manual review for existing callers.

### Footer and form association

For an authorized migration, keep the existing form in the body and explicitly associate a footer submit with its ID:

```tsx
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title={existingTitle}
  layout="sectioned"
  footer={<ModalSubmitButton formId="article-editor" disabled={isSaving}>{existingSubmitLabel}</ModalSubmitButton>}
>
  <form id="article-editor" noValidate onSubmit={existingSubmitHandler}>
    {/* Existing fields and validation stay here. */}
  </form>
</Modal>
```

Import `ModalSubmitButton` from `src/components/ui/ModalLayout.tsx`, or use a native `<button type="submit" form="article-editor">`. The helper does not invent a form, submission callback, loading state or action styling. Use unique IDs for concurrently mounted forms. Keep required/optional, noValidate, Enter-key submission, disabled conditions and existing labels unchanged.

Other opt-in helpers in that file:

- `ModalFieldGrid`: one column; two at 32rem of modal body width.
- `ModalFullWidth`: a full grid row for rich editors, uploads or longer controls.
- `ModalSection`: accessible section heading, optional explanation and subtle separation.
- `ModalMediaSplit`: form/upload and preview slots; stacked until 38rem of modal body width.

None adds fields, a wizard, nested forms or feature state. Persistent footer space is reserved in the flex layout instead of overlaying the final field or validation error.

## ConfirmModal and accessibility

`ConfirmModal` keeps all existing props and synchronous `onConfirm` → optional `onClose` behavior. It deliberately does **not** start awaiting promises; callers using `closeOnConfirm={false}` retain their current mutation/error workflow. `isLoading` guards Cancel, Confirm, Escape and backdrop requests. Optional `presentation="compact"` changes spacing/sizing only; default is legacy.

Generic Modal/ConfirmModal now provide labelled `dialog`/`alertdialog` semantics, initial focus, Tab/Shift+Tab containment, programmatic focus containment, focus restoration, Escape dismissal and ref-counted body scroll locking. Only the top generic dialog handles dismissal. Lower generic layers are inert/hidden from assistive technology; registration uses explicit React ancestry so nested portals remain above parents even when child effects register first. Dynamic close callbacks/guards are read without re-registering on each field change. Exit layers become inert and ignore pointer interaction while animating out.

Confirmations initially prefer the Cancel button, or the panel if loading has disabled every control. Closing a child restores its connected, enabled parent trigger, otherwise a parent focus target. Removing a parent first does not unlock scrolling or steal focus from its child. Body overflow and listeners are restored after the last generic dialog leaves. Reduced-motion preferences suppress entry/exit movement.

`CategoryManagerDialog.tsx` is unchanged. Generic focus/Escape handling defers while a native modal dialog owns the top layer. Native categories retain their own focus restoration and document-element scroll lock; generic dialogs independently lock the body, so cleanup does not overwrite the native lock. Native/browser interaction requires manual confirmation; the event model tests cannot prove browser top-layer behavior.

## Opt-in attachment presentation

`FilePreviewCard`, `SelectedFilesPreview` and `FileUploadDropzone` each accept `presentation="compact"`; all default to legacy. Existing props and callback ownership remain intact. Existing fields, chooser acceptance, single/multiple flags, file filtering and append/replace/removal decisions are not changed by these components.

- Compact cards show a small thumbnail or type icon, wrapping filename, type/extension, known size, optional subtitle and accessible translated Open/Download/Remove controls.
- Optional `mimeType` and `fileSize` props display metadata already known to callers. No metadata fetch is made.
- New local images can open a larger local viewer. PDFs and supported audio/video/plain text use a local open action. Unsupported local types download instead; active HTML/SVG/XML documents are not opened under the application's origin.
- A local action retains the original `File` object held by the form and never uploads it for preview. A preview-only MIME fallback is used for recognized files with an empty MIME type.
- Local thumbnail URLs are released on replacement/unmount; failed thumbnail rendering uses the type-icon fallback. Viewer URLs have independent lifetimes and are revoked after a bounded 60 seconds, allowing the original modal to close without breaking the opened file. Download URLs are revoked after one second. Popup failures and viewer-navigation failures clean up any created URL and close failed reserved tabs.
- Remote Open/Download continue through the existing authenticated Blob helpers. Original references/names and removal callbacks are preserved; invalid references have no active file actions. Server headers/browser support still determine whether a file displays inline or downloads.
- Compact dropzones expose a keyboard-focusable native file input with visible focus-within styling; the legacy input/classes remain as before. Compact split previews respond to their own container, stacking below the upload below 38rem. Empty lists/placeholders are compact and translated.

An existing `onRemove` is the only authority to render Remove. No persisted-file removal action, upload endpoint, permission gate, accepted MIME change or file-size limit is introduced. Preview appearance does not imply that a format supports inline viewing. Callers should pass new compact presentation to both the dropzone and any preview cards/lists supplied in its slots when explicitly migrated.

## Compatibility and verification

No feature page, API service, CategoryManagerDialog, sidebar, dashboard layout or global color/font token was edited for Phase 2. Legacy modal/file-preview presentation remains default; shared accessibility improvements apply to generic dialogs as authorized. New presentation CSS uses dedicated opt-in classes and container names.

The new `tests/modal-foundations.test.mjs` execution path is server-free: Node assertions, isolated TypeScript evaluation, an event/focus model and local Blob/File objects. It does not import the app/store, start servers, open a browser, or issue network calls. Checks cover focus loops/restoration, nested registration/cleanup, native ownership, current close guards, legacy props/classes, open/closed rendering, ConfirmModal behavior, footer/form association, metadata, file callbacks and object-URL cleanup. Existing Admin regression assertions are retained and run alongside it.

Manual checks remain necessary for actual Tab order, screen readers, native top-layer/category interoperation, date/Tiptap popovers, iframe focus, backdrop behavior, reduced motion, mobile viewport/zoom, inherited styling after portaling, and browser viewers/downloads/popup restrictions. No browser-based or visual verification is claimed. These foundations do not authorize any Phase 3 migration.
