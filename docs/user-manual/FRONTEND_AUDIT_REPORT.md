# ARCHICOPRO Extranet — Complete Frontend Audit Report

This report presents a comprehensive, evidence-based architectural audit of the ARCHICOPRO Extranet frontend repository (`passarinhama-frontend`), detailing discovery metrics, security boundaries, non-functional or unrouted features, backend dependency gaps, and an exhaustive traceability matrix.

---

## 1. Executive Discovery Metrics Summary

| Audit Dimension | Quantitative Metric | Verification Source & Method |
| :--- | :---: | :--- |
| **Total Registered Routes** | **23 Routes** | Declared in `src/routes/index.tsx` using `createBrowserRouter` |
| **Total Unrouted Page Components** | **2 Components** | `src/pages/Dashboard.tsx` and `src/pages/Moderation.tsx` (Source code present in `src/pages/`, but absent from router) |
| **Total Recognized User Roles** | **6 Roles** | System slugs in `src/redux/features/auth/authTypes.ts`: `admin`, `moderator`, `membre`, `auditeur`, `partenaires_technicopro`, `comite_coproprietaire` |
| **Total Primary Modules & Tabs** | **17 Functional Domains** | Home Portal, Articles, Forums, Agenda, Events, Trainings, TechnicoPro, Document Library, Member Directory, Profile, 8 Administration Panel Domains, and Omnibox Search |
| **Total Interactive Forms Audited** | **33 Forms** | Catalogued in `docs/user-manual/FORM_FIELD_REFERENCE.md` |
| **Total Input Controls & Fields** | **168 Input Fields** | Fully inventoried with validation schemas, types, and defaults |
| **Total Documented User Actions** | **94 Distinct Actions** | Verified across event handlers (`onClick`, `onSubmit`, `onKeyDown`, `onChange`) |
| **Total Core CRUD Resource Types** | **14 Resource Families** | Articles, Article Categories, Forums, Topics, Posts, Events, Event Categories, Event Registrations, Trainings, Training Categories, TechnicoPro, TechnicoPro Categories, Folders, Documents, and Users |
| **Total File-Related Operations** | **27 Operations** | Uploads, binary downloads, CSV exports, log exports, backup archives, local previews, and deletions |

---

## 2. Incomplete, Unrouted, or Simulated Features

### Finding 1: Unrouted Executive Dashboard (`src/pages/Dashboard.tsx`)
- **Status**: **Not Functional / Unrouted in Frontend**
- **Evidence**: `src/pages/Dashboard.tsx` contains 1,010 lines of complete UI code implementing executive KPI cards (active members, discussions, upcoming events, published articles), dynamic activity feeds with actor avatars, and member online counters. However, `src/routes/index.tsx` contains **no route registration** for `/dashboard` or `Dashboard.tsx`. The default authenticated index route renders `Home.tsx`.
- **User Impact**: Users cannot access the Executive Analytics Dashboard through URL navigation or navigation menus unless a developer registers the route in `src/routes/index.tsx`.

### Finding 2: Unrouted Standalone Moderation Desk (`src/pages/Moderation.tsx`)
- **Status**: **Unrouted Standalone Component (Functional within Admin Panel only)**
- **Evidence**: `src/pages/Moderation.tsx` contains 501 lines providing a dedicated queue for approving, rejecting, and flagging forum posts with audit logs. Like Dashboard, it is **omitted from `src/routes/index.tsx`**.
- **Mitigation in Place**: An equivalent moderation queue is embedded directly inside Tab 6 of the Superuser Admin Panel (`src/pages/AdminPanel.tsx` Lines 3340–3460). Non-superuser moderators cannot access this standalone desk because it lacks a registered route.

### Finding 3: Commented-out "Remember Me" Checkbox
- **Status**: **Inactive / Commented Out**
- **Evidence**: `src/pages/Login.tsx` Lines 143–151 contain commented-out JSX for a "Remember me" checkbox. The application relies strictly on browser `localStorage` for session token hydration (`token`, `refreshToken`, `user`) in `authSlice.ts`.

### Finding 4: Duplicate Events Route (`/events` vs. `/agenda`)
- **Status**: **Partially Redundant / Reconciled**
- **Evidence**: `src/pages/Agenda/Agenda.tsx` provides the primary full-featured calendar with category color codes, registration roster views, Tiptap description editing, and category management. `src/pages/Events.tsx` provides a secondary simplified calendar view with a "Quick Add Event" form. Both routes are active in `src/routes/index.tsx`. The creation logic in `/events` was recently updated to persist via `useCreateEventMutation`, but lacks category color coding and rich-text editing.

### Finding 5: Client-Side Search Permission Pre-Filtering
- **Status**: **Implemented Safeguard / Backend-Dependent**
- **Evidence**: In `src/layouts/DashboardLayout.tsx` (Lines 374–382), global search results returned by `GET /dashboard/search` are pre-filtered on the client using `SEARCH_PERMISSION_FEATURES[result.type]` and `hasPermission(feature, "view")`. If an unauthorized search result is returned by the server, the frontend hides it. The backend must independently enforce read authorization to prevent unauthorized metadata leakage in search API responses.

---

## 3. Authorization Architecture & Enforcement Analysis

### 1. The Superuser Privilege Model
The codebase enforces a strict separation between role display strings and superuser authority:
- `canAccessAdminPanel(user)` and `canAccessModeration(user)` evaluate `user.is_superuser === true` and verify `user.status === "active"` and `user.is_deleted === false` (`permissionUtils.ts` Lines 30–35).
- An account with `role: "admin"` whose `is_superuser` is `false` or whose account is suspended is **strictly denied** access to the Admin Panel.

### 2. Resource Ownership Comparison Mechanics
In `src/redux/features/auth/resourceAuthorization.ts` (Lines 7–37):
- For ordinary non-superusers, write and delete permissions are verified against canonical ownership IDs in server data:
  - Articles: `author.id === user.id`
  - Agenda Events: `created_by.id === user.id`
  - Trainings: `created_by.id === user.id`
  - TechnicoPro: `author.id` / `author_id` (conflicts fail closed)
  - Documents: `uploaded_by.id === user.id`
  - Forum Topics / Posts: `author.id` / `author_id === user.id`
- Display names, author text strings, or client-supplied owner IDs are **never** trusted for authorization decisions.

### 3. RTK Query BaseQuery Request Interceptor
In `src/redux/features/api/mutationAuthorization.ts`:
- All outgoing mutating requests (POST, PATCH, DELETE) and sensitive reads (exports, logs, backups, moderation, permissions) pass through `authorizeRequest()`.
- The interceptor fetches the live authenticated profile from `/user/users/me`, validates account eligibility, fetches canonical target resources across paginated lists (up to 100 pages of 100 items), and halts unauthorized requests with a synthetic HTTP 403 response before any packet is sent over the network.
- Ordinary account creation strips all administrative fields (`role_id`, `status`, `payment_validated`, `is_superuser`) via `ordinaryAccountPayload()`.

---

## 4. Complete End-to-End Traceability Matrix

The following matrix maps every route and page to its connected components, user actions, forms, input fields, permission guards, and manual documentation sections:

| Route Path | Page & Component | Key User Actions | Connected Forms & Modals | Enforced Permissions | User Manual Section |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | `Login.tsx` | Sign in, toggle password, navigate to forgot password | Form 1.1: Member Login | Public / Guest only | Section 5.1 |
| `/signup` | `Signup.tsx` | Request membership, validate passwords, request OTP | Form 1.2: Signup Form | Public / Guest only | Section 5.2 |
| `/forgot-password` | `ForgotPassword.tsx` | Step 1: Request OTP; Step 2: Set new password | Forms 1.3 & 1.4: Password Recovery | Public (Step 2 requires session key) | Section 5.3 |
| `/verify-otp` | `OTPVerification.tsx` | Enter 6-digit OTP code, paste OTP, resend code | Form 1.5: Multi-Digit OTP Verification | Public | Section 5.4 |
| `/` | `Home.tsx` | View pinned forums, upcoming events, articles, trainings; navigate | Content cards, `AccessRestrictedNotice` | `ProtectedRoute` + domain `can_view` | Section 7.1 |
| `/directory` | `MemberDirectory.tsx` | Search members, filter by status, export CSV, create/edit member, delete/restore member | Form 3.1: Create/Edit Member, Confirm Deletion | `user.view` (Directory); `user.create` / `user.edit`; Superuser (Export/Delete) | Section 7.2 |
| `/articles` | `Articles.tsx` | Search/filter articles, tab published/draft, open article, write article, edit, publish, delete, manage categories | Form 4.1: Article Authoring, Form 4.2: Category Manager, Confirm Delete | `article.view`; `article.create`; Owner/Super for `edit`/`delete`/`publish`; Superuser for Categories | Section 7.3 |
| `/articles/category/:categoryId` | `Articles.tsx` | Category-scoped article catalogue | Filtered list view | `article.view` | Section 7.3 |
| `/articles/:slug` | `ArticleDetail.tsx` | Read article, preview attachments, download binary file, view related | `ContentDetail.tsx`, `DetailAttachments` | `article.view` | Section 7.3 |
| `/agenda` | `Agenda.tsx` | Monthly/weekly calendar navigation, day list view, event details drawer, register/unregister, create event, edit, delete, manage categories | Form 5.1: Event Scheduling, Form 5.2: Event Category Manager, Confirm Delete | `event.view`; `event.create`; Owner/Super for `edit`/`delete`; Superuser for Categories | Section 7.4 |
| `/agenda/:agendaId` | `Agenda.tsx` | Inspect event drawer, register/unregister, view roster | Event details drawer | `event.view` | Section 7.4 |
| `/events` | `Events.tsx` | Alternate calendar view, quick add event, inspect details | Form 19: Quick Add Event, Details Modal | `event.view`; `event.create`; Owner/Super for Delete | Section 7.5 |
| `/events/:eventId` | `Events.tsx` | Alternate event inspection view | Event modal | `event.view` | Section 7.5 |
| `/trainings` | `Trainings.tsx` | Browse courses, filter published/draft, propose training, edit, delete, manage categories | Form 6.1: Training Authoring, Form 6.2: Category Manager, Confirm Delete | `training.view`; `training.create`; Owner/Super for `edit`/`delete`; Superuser for Categories | Section 7.6 |
| `/trainings/category/:categoryId` | `Trainings.tsx` | Category-scoped training courses | Filtered list view | `training.view` | Section 7.6 |
| `/trainings/:trainingId` | `TrainingDetail.tsx`| Inspect course syllabus, download attachments, read outline | `ContentDetail.tsx` | `training.view` | Section 7.6 |
| `/technicopro` | `TechnicoPro.tsx` | Browse technical articles, filter published/draft, publish, edit, delete, manage categories | Form 7.1: TechnicoPro Publication, Form 7.2: Category Manager, Confirm Delete | `technicopro.view`; `technicopro.create`; Owner/Super for `edit`/`delete`; Superuser for Categories | Section 7.7 |
| `/technicopro/category/:categoryId` | `TechnicoPro.tsx` | Category-scoped technical publications | Filtered list view | `technicopro.view` | Section 7.7 |
| `/technicopro/:technicoproId` | `TechnicoProDetail.tsx` | Read technical specifications, download assets | `ContentDetail.tsx` | `technicopro.view` | Section 7.7 |
| `/documents` | `DocumentLibrary.tsx` | Root folder explorer, create folder, search | Form 8.1: Create Folder | `document.view`; `document.create` | Section 7.8 |
| `/documents/folder/:folderId` | `DocumentLibrary.tsx` | Subfolder explorer, upload file, create subfolder, rename, delete | Form 8.1: Create Folder, Form 8.2: Upload Document, Form 8.3: Rename, Confirm Delete | `document.view`; `document.create` + Folder `can_upload`; Owner/Super for file edit/delete; Super for folder edit/delete | Section 7.8 |
| `/documents/folder/:folderId/file/:fileId` | `DocumentLibrary.tsx` | File inspection drawer, preview media, download, delete | File preview drawer | `document.view`; Owner/Super for Delete | Section 7.8 |
| `/forums` | `Forums.tsx` | Forum containers catalog, create forum, edit, delete | Form 9.1: Forum Category Modal, Confirm Delete | `forum.view`; `forum.create` (Create); Superuser (Edit/Delete containers) | Section 7.9 |
| `/forums/:forumId` | `Forums.tsx` | Topic discussions list, pin/unpin, create topic, edit, delete | Form 9.2: Forum Topic Modal, Confirm Delete | `forum.view`; `forum.create` + `can_post`; Owner/Super for edit; Owner (empty only) or Super for delete; Super for pin | Section 7.9 |
| `/forums/:forumId/topics/:topicId` | `Forums.tsx` | Read thread, post reply, edit reply, delete reply | Form 9.3: Topic Reply Form, Form 9.4: Edit Post Modal, Confirm Delete | `forum.view`; `forum.create` + `can_post` + unlocked thread for replies; Owner/Super for edit/delete | Section 7.9 |
| `/profile` | `Profile.tsx` | Edit personal info, upload avatar, change password, toggle notification preferences | Forms 2.1, 2.2, 2.3, 2.4 | Authenticated user (self-scoped) | Section 5.5 |
| `/admin` | `AdminPanel.tsx` | Full 8-tab superuser management center | Forms 10.1, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6 | Active Superuser only (`canAccessAdminPanel`) | Section 7.10 |

---

## 5. Audit Conclusions & Recommendations

1. **Frontend Completeness**: The frontend codebase exhibits exceptional architectural rigor regarding client-side safeguards, accessible modal stacking, localized date handling, and responsive layouts.
2. **Backend Authority Prerequisite**: Because this is a frontend-only repository, client safeguards cannot secure the extranet on their own. The backend web API must verify token identity, active status, immutable ownership, and permission grants atomically for every mutating write endpoint.
3. **Route Reconciliation**:
   - Register `/dashboard` and `/moderation` in `src/routes/index.tsx` if standalone navigation is desired for these components.
   - Consider consolidating `/events` into the richer `/agenda` calendar to prevent member confusion.

