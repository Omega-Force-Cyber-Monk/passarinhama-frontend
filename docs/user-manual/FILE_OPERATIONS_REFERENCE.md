# ARCHICOPRO Extranet — Complete File Operations Reference

This document provides a comprehensive technical audit of **every file-related operation** supported by the ARCHICOPRO frontend codebase (`passarinhama-frontend`), covering uploads, downloads, imports, exports, local/remote previews, replacements, and deletions.

---

## Technical Overview & Implementation Architecture

File handling across the repository is centralized in:
- **`src/utils/attachments.ts`**: URL normalization, MIME-type and extension categorization, authenticated Blob fetching (`fetchUrlAsObjectUrl`), and binary file downloads (`downloadUrlAsFile`).
- **`src/components/ui/FileUploadPreview.tsx`**: Dropzone UI (`FileUploadDropzone`), preview cards (`FilePreviewCard`), multi-file list previews (`SelectedFilesPreview`), and thumbnail rendering.
- **`src/components/ui/localFilePreview.ts`**: Browser memory leases (`createObjectUrlLease`), local file viewer launchers (`openLocalFile`), and local downloads (`downloadLocalFile`).
- **`src/redux/features/api/mutationAuthorization.ts`**: Scoped security authorization preflights for file uploads and URL deletions.

### File Category & Preview Capability Engine

In `src/utils/attachments.ts` (Lines 36–97), file extensions and MIME types are mapped into nine discrete categories:

| Category | Verified Extensions | MIME Type Patterns | Preview Capability (`canPreview`) | Default Display Mechanism |
| :--- | :--- | :--- | :---: | :--- |
| **Image** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.avif` | `image/*` | **Yes** | Inline `<img>` element or full modal image preview |
| **PDF** | `.pdf` | `application/pdf` | **Yes** | Dedicated PDF viewer or authenticated Blob in new tab |
| **Video** | `.mp4`, `.webm`, `.ogg`, `.mov`, `.m4v` | `video/*` | **Yes** | HTML5 `<video controls>` player |
| **Audio** | `.mp3`, `.wav`, `.aac`, `.m4a`, `.oga`, `.flac` | `audio/*` | **Yes** | HTML5 `<audio controls>` player |
| **Text** | `.txt`, `.csv`, `.md`, `.json`, `.xml` | `text/*`, `application/json`, `application/xml` | **Yes** | Monospace text preview container |
| **Office** | `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx` | `*word*`, `*excel*`, `*powerpoint*`, `*officedocument*` | No | File type icon + direct download button |
| **Design** | `.ai`, `.eps`, `.psd`, `.sketch`, `.fig` | Custom binary types | No | Design file icon + direct download button |
| **Archive**| `.zip`, `.rar`, `.7z`, `.tar`, `.gz` | `application/zip`, `application/x-tar`, etc. | No | Archive icon + direct download button |
| **Generic**| Any unclassified extension | `application/octet-stream` or empty | No | Generic document icon + download button |

---

## 1. Master File Operations Inventory

| Module | Action | Allowed Extensions | Accepted MIME Types | Max Size Limits | Multiple Files | Generated / Source Filename Rules | Authorized Roles | Endpoint & Method |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **Member Profile** (`/profile`) | Upload Avatar | `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`, `.gif` | `image/*` | Unrestricted on client; server-enforced | Single | Retains original client filename; server maps to CDN URL | Authenticated User (Self only) | `PATCH /user/users/{userId}/photo_upload` |
| **Member Directory** (`/directory`) | Member Avatar | `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`, `.gif` | `image/*` | Unrestricted on client | Single | Client filename preserved in FormData `avatar` | `user.create` / `user.edit` | `POST /user/users` or `PATCH /user/users/{id}` |
| **Member Directory** | Export Member CSV | `.csv` | `text/csv`, `application/octet-stream` | Server-generated dynamic stream | Single | `members.csv` or dynamic server-supplied filename | Active Superuser only | `GET /user/users/export/csv` |
| **Articles** (`/articles`) | Upload Thumbnail | `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`, `.gif`, `.avif` | `image/*` | Unrestricted on client | Single | Client filename preserved in FormData `thumbnail` | `article.create` / `article.edit` (Owner/Super) | `POST /articles/articles` or `PATCH /articles/articles/{id}` |
| **Articles** | Upload Attachments | Unrestricted (All formats) | Any | Unrestricted on client | **Yes** (Multiple) | Retains original filename; appended to `files` array | `article.create` / `article.edit` (Owner/Super) | `POST /articles/articles` or `PATCH /articles/articles/{id}` |
| **Articles** | Inline Editor Image | `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`, `.gif` | `image/*` | Unrestricted on client | Single | Server generates permanent asset URL returned in JSON `{ url }` | `article.create` / `article.edit` | `POST /articles/file-upload` |
| **Articles** | Delete Attachment | N/A (URL target) | N/A | N/A | N/A | Targeted by exact URL string | Active Superuser only | `POST /articles/file-delete` |
| **Article Detail** (`/articles/:slug`)| Download Attachment| Any attachment format | Any | N/A | Single | Derived from `attachment.original_name` or URL basename | `article.view` | Authenticated Blob download |
| **Trainings** (`/trainings`) | Upload Thumbnail | Images | `image/*` | Unrestricted on client | Single | Sent as FormData `thumbnail` | `training.create` / `training.edit` | `POST /trainings/trainings` or `PATCH /trainings/trainings/{id}` |
| **Trainings** | Upload Syllabus / Files | Unrestricted (PDF, Docs, Slides) | Any | Unrestricted on client | **Yes** (Multiple) | Sent as `attachments` on create; `new_attachments` on update | `training.create` / `training.edit` | `POST /trainings/trainings` or `PATCH /trainings/trainings/{id}` |
| **Training Detail** (`/trainings/:id`)| Download Syllabus | Any attachment format | Any | N/A | Single | Derived from `attachment.original_name` or URL basename | `training.view` | Authenticated Blob download |
| **TechnicoPro** (`/technicopro`) | Upload Thumbnail | Images | `image/*` | Unrestricted on client | Single | Sent as FormData `thumbnail` | `technicopro.create` / `technicopro.edit` | `POST /technicopro/technicopros` |
| **TechnicoPro** | Upload Specs / Docs | Unrestricted | Any | Unrestricted on client | **Yes** (Multiple) | Sent as FormData `files` | `technicopro.create` / `technicopro.edit` | `POST /technicopro/technicopros` |
| **Agenda Events** (`/agenda`) | Upload Event Files | Unrestricted | Any | Unrestricted on client | **Yes** (Multiple) | Sent as `attachments` on create; `new_attachments` on update | `event.create` / `event.edit` | `POST /events/events` or `PATCH /events/events/{id}` |
| **Documents** (`/documents`) | Upload Document File | Unrestricted (PDF, DWG, Office, Images) | Any | Unrestricted on client | Single | Sent as FormData `file` with `folder_id` | `document.create` + Folder `can_upload` | `POST /documents/documents/upload` |
| **Documents** | Download Document | Any stored format | Any | N/A | Single | Server supplies `{ download_url, filename }` | `document.view` | `GET /documents/documents/{id}/download` |
| **Documents** | Inspect / Local Preview | `.png`, `.jpg`, `.pdf`, `.mp4`, `.mp3`, `.txt` | Categorized preview types | N/A | Single | Displayed in inspection modal drawer | `document.view` | Browser Blob viewer |
| **Documents** | Rename Document | N/A (Text update) | N/A | N/A | N/A | Modifies `original_name` string property | `document.edit` (Owner/Super) | `PATCH /documents/documents/{id}` |
| **Documents** | Delete Document | N/A | N/A | N/A | N/A | Removes document record and physical asset | `document.delete` (Owner/Super) | `DELETE /documents/documents/{id}` |
| **Forums** (`/forums`) | Forum Thumbnail | Images | `image/*` | Unrestricted on client | Single | Sent as FormData `thumbnail` | Superuser only | `POST /forums/forums` or `PATCH /forums/forums/{id}` |
| **Forums** | Topic Attachments | Unrestricted | Any | Unrestricted on client | **Yes** (Multiple) | Sent as FormData `attachments` | `forum.create` + Forum `can_post` | `POST /forums/forums/{forumId}/topics` |
| **Forums** | Reply Post Attachments | Unrestricted | Any | Unrestricted on client | **Yes** (Multiple) | Sent as FormData `attachments` | `forum.create` + Topic unlocked | `POST /forums/topics/{topicId}/posts` |
| **System Settings** (`/admin`) | Download System Logs | `.log` | `text/plain`, `application/octet-stream` | Server-generated log file | Single | `system_logs.log` | Active Superuser only | `GET /settings/admin/logs/download` |
| **System Settings** | Clear System Logs | N/A | N/A | N/A | N/A | Purges system log file contents | Active Superuser only | `DELETE /settings/admin/logs` |
| **Backups** (`/admin`) | Run Manual Backup | N/A (Trigger) | N/A | N/A | N/A | Triggers immediate archive generation | Active Superuser only | `POST /settings/admin/backups/run` |
| **Backups** | Download Backup Archive | `.zip`, `.tar.gz`, `.sql` | `application/zip`, `application/gzip` | Dynamic archive size | Single | Dynamic server filename (e.g. `backup_2026-11-04.zip`) | Active Superuser only | `GET /settings/admin/backups/{id}/download` |
| **Backups** | Delete Backup Archive | N/A | N/A | N/A | N/A | Permanently deletes backup archive on server | Active Superuser only | `DELETE /settings/admin/backups/{id}` |

---

## 2. File Download & Preview Mechanics

### 1. Authenticated Binary Blob Downloads
In `src/utils/attachments.ts` (Lines 184–252):
- When a user clicks a download button, the application verifies whether the URL targets the application's origin or configured API base (`usesAuthenticatedFileRequest`).
- If target is within the authenticated origin, the request fetches the file using `fetch()` injected with `Authorization: Bearer <token>`.
- The binary response is converted to an in-memory `Blob` object:
  ```typescript
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  ```
- This ensures that private document files stored behind authentication headers can be downloaded securely without leaking bearer tokens in URL query strings.

### 2. External vs. Internal Previews
- **Internal / Same-Origin Files**: Opened via a temporary reserved browser tab (`window.open("", "_blank")`), fetching the authenticated Blob and pointing the tab's location to the generated object URL. The opener is cleared (`window.opener = null`) to prevent reverse tabnabbing.
- **External Signed URLs** (e.g. Amazon S3 or Google Cloud Storage pre-signed links): Opened directly through standard `<a target="_blank" rel="noopener noreferrer">` anchors without forwarding the extranet's authorization headers.

### 3. Local In-Memory File Leases
In `src/components/ui/localFilePreview.ts`:
- When a user selects a file from their local hard drive inside a modal dialog before uploading, a local object URL is leased via `URL.createObjectURL(file)`.
- If the user clicks **Preview**, the local file is rendered in an in-memory viewer tab without triggering a server network request.
- Image thumbnail object URLs are bound to the component lifecycle and immediately revoked via `URL.revokeObjectURL()` upon replacement or dialog dismissal.
- Full viewer tabs receive an independent bounded lease of **60 seconds**, allowing the user to close the upload modal while continuing to inspect the opened file in their browser.

---

## 3. File Limitations & Technical Constraints

1. **Client-Side File Size Enforcement**: The frontend does not currently specify hardcoded maximum file size limits (e.g. `maxFileSize = 25MB`). Upload limits are enforced exclusively by the backend web server / reverse proxy (e.g. Nginx `client_max_body_size`). If an uploaded file exceeds the server ceiling, the frontend catches HTTP 413 (Payload Too Large) and displays a generalized upload failure toast.
2. **Accepted MIME Types**:
   - Thumbnails and profile avatars enforce `accept="image/*"`.
   - General attachments (Articles, Events, Trainings, Forums, and Document Library) do not restrict file extensions in the file chooser dialog (`accept` is omitted or unconstrained).
3. **Standalone URL Deletion Security**: The endpoint `POST /articles/file-delete` accepts an arbitrary URL string payload. Because the frontend cannot verify whether a URL belongs to the active user's content, this operation is strictly locked to **active superusers** in `mutationAuthorization.ts` (Line 29). Ordinary authors delete attachments by removing them from their article's `structured_fields.file_urls` array or event's `remove_attachment_urls` list during standard resource update requests.
4. **Active HTML / SVG File Preview Restrictions**: To protect against cross-site scripting (XSS), active HTML, SVG, or XML documents uploaded by users are prevented from opening in privileged application frames and are routed to direct binary download instead (`docs/MODAL_FOUNDATIONS.md` Line 67).

