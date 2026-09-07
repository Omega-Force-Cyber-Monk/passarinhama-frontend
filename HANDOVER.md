# ARCHICOPRO Extranet — Technical Handover & Architecture Guide

Welcome to the **ARCHICOPRO Extranet** (`archicopro-frontend` / `passarinhama-frontend`) repository. This document serves as the comprehensive developer handover and system architecture guide for engineers maintaining, developing, or deploying this application.

---

## 1. Executive Summary & Domain Overview

**ARCHICOPRO** is a private, multi-tenant digital hub designed for a professional association of co-ownership architects (*architectes de copropriété*). It serves as an all-in-one collaborative extranet facilitating professional governance, knowledge sharing, community discussions, training certifications, document archival, and administrative controls.

### Key User Personas & Roles
The application supports a fine-grained role hierarchy configured via system role slugs and direct per-user permission overrides:

| Role Key | Name | Access Scope |
| :--- | :--- | :--- |
| `admin` | **Administrator** | Superuser access (`is_superuser: true`). Unrestricted access to the 8-tab Admin Panel, Executive Analytics Dashboard, Member Directory, Roles & Permissions configurator, SMTP & Backup settings, and all content domains. |
| `moderator` | **Moderator** | Content governance access. Access to the Moderation Center (`/moderation`) to approve, reject, or flag community forum topics and posts, view moderation logs, and author/manage articles. |
| `membre` | **Standard Member** | Registered architect. Access to public member portal, forums, articles, calendar/agenda, training registrations, and permitted document folders. |
| `auditeur` | **Auditor** | Read/inspect access to association records, documents, and trainings according to granted permissions. |
| `partenaires_technicopro` | **Partner** | Technical partner role with scoped access to specific commissions, forum discussions, and technical articles. |
| `comite_coproprietaire` | **Co-ownership Committee** | Advisory board access to governance forums, committee folders, and agenda assemblies. |

---

## 2. Technology Stack & Architecture

### Core Technologies
- **Runtime & UI Library**: [React 19](https://react.dev/) (`^19.0.0`) with [TypeScript](https://www.typescriptlang.org/) (`~5.8.2`)
- **Build Tool & Bundler**: [Vite 6](https://vitejs.dev/) (`^6.2.0`) with `@vitejs/plugin-react` (`^5.0.4`)
- **State Management & Network Layer**: [Redux Toolkit (RTK)](https://redux-toolkit.js.org/) (`^2.11.2`) with **RTK Query** for caching, optimistic updates, and background re-fetching
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (`^4.1.14`) via `@tailwindcss/vite` and `@tailwindcss/typography`
- **Routing**: [React Router v7](https://reactrouter.com/) (`^7.14.2`) using `createBrowserRouter` with lazy loading & Suspense
- **Rich Text Editor**: [Tiptap 3](https://tiptap.dev/) (`^3.23.4`) StarterKit, Table, Link, Image, Underline, and custom YouTube embed extension
- **Animation & Motion**: [Motion](https://motion.dev/) (`^12.23.24`, formerly framer-motion)
- **Icons**: [Lucide React](https://lucide.dev/) (`^0.546.0`)
- **Date & Calendar Calculations**: [date-fns v4](https://date-fns.org/) (`^4.1.0`)
- **Internationalization (i18n)**: Custom context-based i18n provider supporting English (`en`) and French (`fr`) with dynamic date formatting

---

## 3. Project Structure

```
passarinhama-frontend/
├── Dockerfile                     # Multi-stage production container build (Node 22 -> Alpine static)
├── index.html                     # HTML root entry point with meta viewport
├── package.json                   # Project dependencies and npm scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── vite.config.ts                 # Vite bundler config with Tailwind & React plugins
├── public/                        # Public static assets & favicon
└── src/
    ├── App.tsx                    # Root component wrapping RouterProvider & AppToastProvider
    ├── main.tsx                   # ReactDOM entry point mounting Redux Provider & I18nProvider
    ├── index.css                  # Global Tailwind v4 @theme, design tokens, and typography
    ├── constants.ts               # Default mock/initial articles & fallbacks
    ├── components/                # Reusable UI & routing components
    │   ├── LanguageSwitcher.tsx   # Header locale toggle (FR / EN)
    │   ├── PermissionRoute.tsx    # Declarative granular permission & role gate
    │   ├── ProtectedRoute.tsx     # Authentication token verification gate
    │   ├── PublicRoute.tsx        # Guest-only route gate (redirects authenticated users)
    │   ├── RouteError.tsx         # Route-level error boundary with recovery action
    │   └── ui/                    # Atom & Molecule UI elements
    │       ├── AccessRestrictedNotice.tsx # Non-validated member callout
    │       ├── AppToastProvider.tsx       # Global toast notification context
    │       ├── ConfirmModal.tsx           # Reusable destructive action confirmation modal
    │       ├── FeedbackToast.tsx          # Animated status toast
    │       ├── FileUploadPreview.tsx      # Dropzone & file upload preview widget
    │       ├── Modal.tsx                  # Base backdrop modal dialog
    │       ├── TiptapEditor.tsx           # Full-featured WYSIWYG editor with table/embed support
    │       └── extensions/
    │           └── YouTubeEmbed.ts        # Custom Tiptap YouTube iframe node extension
    ├── hooks/
    │   ├── usePermissions.ts          # Merged role + direct user permission evaluation hook
    │   └── useDirectUserPermissions.ts # Direct user permission overrides hook
    ├── i18n/
    │   ├── index.tsx              # I18nProvider, language switcher hook, date-fns locale binding
    │   └── locales/
    │       ├── en.json            # English translations dictionary
    │       └── fr.json            # French translations dictionary (primary association language)
    ├── layouts/
    │   └── DashboardLayout.tsx    # Primary authenticated shell (Sidebar, TopNav, Search, Online Members)
    ├── pages/                     # Routed view components
    │   ├── AdminPanel.tsx         # 8-tab superuser management center (7,000+ lines)
    │   ├── Agenda/
    │   │   ├── Agenda.tsx         # Interactive monthly/weekly calendar & event registrations
    │   │   └── index.tsx          # Export barrel
    │   ├── ArticleDetail.tsx      # Published article view with rich typography & metadata
    │   ├── Articles.tsx           # Article catalogue, category filters, and draft/publish modal
    │   ├── Dashboard.tsx          # Executive KPI metrics, activity feeds, and statistics
    │   ├── DocumentLibrary.tsx    # Hierarchical folder explorer & file storage manager
    │   ├── Events.tsx             # Upcoming events list & registration cards
    │   ├── ForgotPassword.tsx     # Password recovery with OTP challenge
    │   ├── Forums.tsx             # 3-tier forum (Catalog -> Topic List -> Thread & Post Replies)
    │   ├── Home.tsx               # Member portal feed (pinned posts, events, articles)
    │   ├── Login.tsx              # User authentication form
    │   ├── MemberDirectory.tsx    # Member search, filter, CSV export, and profile editor
    │   ├── Moderation.tsx         # Moderation queue (Pending/Flagged posts) & Audit logs
    │   ├── OTPVerification.tsx    # OTP verification code input
    │   ├── Profile.tsx            # Personal account settings, avatar upload & notification prefs
    │   ├── Signup.tsx             # Member registration request
    │   └── Trainings.tsx          # Professional training catalog, syllabus, and registrations
    ├── redux/
    │   ├── store.ts               # Configured store with listener middleware for state resets
    │   └── features/              # Modular RTK Query slices & feature reducers
    │       ├── admin/             # Admin backups, SMTP, activity logs, system logs
    │       ├── api/               # Base RTK Query slice (`apiSlice.ts`), JWT re-auth interceptor
    │       ├── articles/          # Articles CRUD, categories, permissions, file upload
    │       ├── auth/              # Auth credentials slice, login/signup/OTP, permission utils
    │       ├── dashboard/         # Dashboard metrics, search, activity feeds
    │       ├── documents/         # Document folders, file uploads, permissions, download
    │       ├── events/            # Events CRUD, calendar stats, registrations
    │       ├── forum/             # Forums, topics, posts, pins, forum permissions
    │       ├── members/           # User profiles, online users, member permissions, CSV export
    │       ├── moderation/        # Moderation queue, approve/reject/flag actions, audit logs
    │       ├── notifications/     # User email notification preferences
    │       └── trainings/         # Training courses, attendee limits, registrations
    ├── types/                     # Shared TypeScript interfaces & types
    │   ├── content.ts             # Articles, Events, Trainings
    │   ├── document.ts            # Folders and Files
    │   ├── forum.ts               # Forums, Topics, Posts, Permissions
    │   ├── index.ts               # Types barrel
    │   └── user.ts                # User status and profile definitions
    └── utils/
        ├── apiErrorMessages.ts    # Centralized HTTP & validation error parser
        └── youtube.ts             # YouTube URL sanitizer & embed ID parser
```

---

## 4. Authentication & Security Architecture

### 1. Token Lifecycle & Storage
- Tokens are persisted in browser `localStorage`:
  - `token`: Bearer access token sent in HTTP `Authorization: Bearer <token>`
  - `refreshToken`: Refresh token for obtaining new access tokens
  - `user`: Cached serialized `UserProfile` object
- Initial auth state is hydrated synchronously from `localStorage` in `src/redux/features/auth/authSlice.ts`.

### 2. Silent JWT Rotation (`baseQueryWithReauth`)
In `src/redux/features/api/apiSlice.ts`:
- Every outgoing request is intercepted and injected with `Authorization: Bearer ${token}`.
- If any authenticated request receives an **HTTP 401 Unauthorized**:
  1. The interceptor verifies whether `refreshToken` exists in Redux state.
  2. A POST request is dispatched to `/auth/refresh` with `{ refresh_token: refreshToken }`.
  3. Upon success, the new credentials are saved via `setCredentials`, and the original failed request is automatically retried.
  4. If the refresh request fails or no refresh token exists, `logout()` is dispatched, wiping tokens and resetting API state.

### 3. State Reset on Logout
`src/redux/store.ts` registers a `listenerMiddleware` listening for the `logout` action:
```typescript
listenerMiddleware.startListening({
  actionCreator: logout,
  effect: async (_, api) => {
    api.dispatch(apiSlice.util.resetApiState());
  },
});
```
This guarantees that cached member records, private documents, or admin logs are immediately evicted from client memory upon logout.

---

## 5. Granular RBAC & Permission Matrix

The application implements a two-tier access control model: **Role-Based Access Control (RBAC)** supplemented by **Direct Per-User Overrides** (`user_permissions`).

### Permission Features & Actions
The system evaluates permissions across 6 core domain features and 4 actions (`src/redux/features/auth/permissionUtils.ts`):
- **Features**: `article`, `document`, `event`, `forum`, `training`, `user`
- **Actions**: `can_view` (`view`), `can_create` (`create`), `can_edit` (`edit`), `can_delete` (`delete`)

### Merged Permissions Resolution
```typescript
// Role base permissions are combined with direct user-level overrides:
const merged = getMergedPermissions(user);
```
1. Base role permissions (`user.permissions`) establish default access.
2. User-specific permissions (`user.user_permissions`) can grant or revoke specific privileges.
3. Superuser check (`user.is_superuser`) grants unrestricted administrative access.

### Route Protection Utilities
- `ProtectedRoute.tsx`: Guarantees user is authenticated; redirects unauthenticated visitors to `/login`.
- `PublicRoute.tsx`: Prevents logged-in users from accessing `/login`, `/signup`, or `/forgot-password`.
- `PermissionRoute.tsx`: Evaluates either a custom predicate `allow(user)` or a feature/action requirement:
  ```tsx
  <PermissionRoute feature="forum" action="view">
    <Forums />
  </PermissionRoute>
  ```
- Navigation Guard in `DashboardLayout.tsx`: Dynamically filters sidebar and header nav items based on `canAccessFeature(feature)`, `canAccessAdminPanel`, and `canAccessModeration`.

---

## 6. Routing Hierarchy & Page Map

All routes are declared in `src/routes/index.tsx` using `createBrowserRouter`:

| Route Path | Component | Route Guard | Purpose |
| :--- | :--- | :--- | :--- |
| `/login` | `Login.tsx` | `PublicRoute` | Member email + password sign-in |
| `/signup` | `Signup.tsx` | `PublicRoute` | Account registration request with OTP |
| `/forgot-password` | `ForgotPassword.tsx` | `PublicRoute` | Password reset flow with OTP challenge |
| `/verify-otp` | `OTPVerification.tsx` | Public | OTP code entry view |
| `/` | `Home.tsx` | `ProtectedRoute` | Member home portal & community activity feed |
| `/dashboard` | `Dashboard.tsx` | `allow={isSuperuser}` | Executive association analytics & KPIs |
| `/directory` | `MemberDirectory.tsx` | `allow={isSuperuser}` | Member roster, profile editor, CSV export |
| `/forums` | `Forums.tsx` | `feature="forum"` | Forums directory |
| `/forums/:forumId` | `Forums.tsx` | `feature="forum"` | Topics list within specific forum |
| `/forums/:forumId/topics/:topicId` | `Forums.tsx` | `feature="forum"` | Discussion thread & comment replies |
| `/articles` | `Articles.tsx` | `feature="article"` | Articles library & category filtering |
| `/articles/:slug` | `ArticleDetail.tsx` | `feature="article"` | Article reader with rich Tiptap formatting |
| `/agenda` | `Agenda.tsx` | `feature="event"` | Monthly / weekly interactive calendar |
| `/agenda/:agendaId` | `Agenda.tsx` | `feature="event"` | Calendar event detail modal |
| `/events` | `Events.tsx` | `feature="event"` | Event cards & registration view |
| `/events/:eventId` | `Events.tsx` | `feature="event"` | Event detail view |
| `/trainings` | `Trainings.tsx` | `feature="training"` | Professional training courses & registrations |
| `/trainings/:trainingId` | `Trainings.tsx` | `feature="training"` | Training syllabus & video preview |
| `/documents` | `DocumentLibrary.tsx` | `feature="document"` | Root document folders explorer |
| `/documents/folder/:folderId` | `DocumentLibrary.tsx` | `feature="document"` | Subfolder files & upload view |
| `/documents/folder/:folderId/file/:fileId` | `DocumentLibrary.tsx` | `feature="document"` | Document inspection & download |
| `/moderation` | `Moderation.tsx` | `allow={canAccessModeration}` | Pending/Flagged posts queue & logs |
| `/admin` | `AdminPanel.tsx` | `allow={canAccessAdminPanel}` | 8-tab superuser administration center |
| `/profile` | `Profile.tsx` | `ProtectedRoute` | User profile, photo upload, password, notifications |
| `*` | `Navigate to="/"` | Public | Wildcard fallback redirecting to home |

---

## 7. Feature Domain Breakdown

### 1. Member Home (`/`) & Dashboard (`/dashboard`)
- **Home Portal**: Quick greetings, pending payment warnings (`AccessRestrictedNotice`), pinned topics from all forums, latest published articles, and upcoming events/trainings.
- **Analytics Dashboard**: Real-time counters for members, active forums, upcoming events, published articles, and trainings; dynamic activity stream with actor avatars and entity links; online users list.

### 2. Forums & Discussions (`/forums`)
- **Three-Level Navigation**:
  1. Forum catalog grouped by category (`general`, `professionnel`, `commission`).
  2. Topics listing inside selected forum with pin indicators, reply/view counters, and author badges.
  3. Discussion thread with original topic content, attachments, and replies timeline.
- **Rich Editor Integration**: Replies and topics use `TiptapEditor` supporting bold, italic, lists, tables, links, and YouTube video embeds.
- **Moderation Integration**: Topics/posts have moderation status flags (`pending`, `approved`, `rejected`, `flagged`). Pinned topics appear across the portal feed.
- **Permissions**: Admins can set read/post permissions per role for individual forums.

### 3. Articles & Knowledge Base (`/articles`)
- **Categorization**: Articles organized by categories (Legal, Technical, Association, etc.).
- **Editorial Workflow**: Articles have lifecycle states: `draft` ➔ `published` ➔ `archived`.
- **Authoring**: Rich Tiptap authoring modal with thumbnail cover image and document attachments.
- **Role Permissions**: Granular per-article read permissions configurable per role.

### 4. Agenda & Events (`/agenda`, `/events`)
- **Interactive Calendar**: Custom calendar grid built with `date-fns` supporting monthly and weekly navigation, current day highlighting, and event dots.
- **Event Lifecycle**: Title, date range, time, location, description, attachments, attendee limits, and public/private flags.
- **Registration**: Members can register/unregister with real-time attendee counter tracking and registration roster views.

### 5. Training Courses (`/trainings`)
- **Training Formats**: Webinars, in-person workshops, hybrid courses, and e-learning.
- **Course Metadata**: Instructor details, duration in hours, max attendee capacity, and downloadable syllabus attachments.
- **Registration**: Self-service member enrollment with status updates (`open`, `full`, `completed`).

### 6. Document Library (`/documents`)
- **Hierarchical Storage**: Folders and subfolders with customizable color codes and document counters.
- **File Management**: Drag-and-drop file upload with preview, file renaming, deletion, and direct download via binary blob handling (`useDownloadDocumentQuery`).
- **Access Control**: Role permissions per folder can be updated in bulk.

### 7. Moderation Center (`/moderation`)
- **Moderation Queue**: Displays all user-generated forum topics and posts awaiting approval or reported by users.
- **Moderator Actions**: One-click actions to Approve, Reject, or Flag with a required moderator explanation note.
- **Audit Trail**: Paginated moderation log tracking moderator identity, action taken, target entity, timestamp, and review notes.

### 8. Administration Panel (`/admin`)
A unified control center for superusers organized into 8 tabs:
1. **Members**: Full member table, status switches (active/pending/suspended), payment validation toggle, role assignment, user creation/editing/restoration, and CSV export.
2. **Forums**: Forum creation, editing, category configuration, and role permission matrices.
3. **Articles**: Article approval, category CRUD, publishing, and access restrictions.
4. **Events**: Calendar event creation, attendance limits, and registration lists.
5. **Trainings**: Course scheduling, attendee management, and syllabus uploads.
6. **Moderation**: Embedded moderation queue and action desk.
7. **Roles & Permissions**: Matrix editor for system roles (`admin`, `moderator`, `membre`, etc.) across all 6 features and 4 CRUD actions, plus direct per-member override management.
8. **Settings & Backups**:
   - **SMTP Settings**: Server host, port, username, password, encryption (TLS/SSL), default sender, and live test email trigger.
   - **System Logs**: Real-time log inspector, log file download (`.log`), and log clearing.
   - **Database & Media Backups**: Scheduled backup intervals, manual backup trigger, permission check, backup download, and deletion.

---

## 8. State Management & API Contract Reference

The application uses **RTK Query** with endpoints split across domain files and injected into `apiSlice`:

```
apiSlice (src/redux/features/api/apiSlice.ts)
├── authApi (src/redux/features/auth/authApi.ts)
├── adminApi (src/redux/features/admin/adminApi.ts)
├── articlesApi (src/redux/features/articles/articlesApi.ts)
├── dashboardApi (src/redux/features/dashboard/dashboardApi.ts)
├── documentsApi (src/redux/features/documents/documentsApi.ts)
├── eventsApi (src/redux/features/events/eventsApi.ts)
├── forumApi (src/redux/features/forum/forumApi.ts)
├── membersApi (src/redux/features/members/membersApi.ts)
├── moderationApi (src/redux/features/moderation/moderationApi.ts)
├── notificationsApi (src/redux/features/notifications/notificationsApi.ts)
└── trainingsApi (src/redux/features/trainings/trainingsApi.ts)
```

### Complete Endpoints Inventory

#### Authentication (`authApi`)
- `POST /auth/login` — Member login (Form URL encoded)
- `POST /auth/signup` — Member registration
- `POST /auth/send_otp` — Request verification OTP
- `POST /auth/verify_otp` — Verify OTP and receive `session_key`
- `POST /auth/refresh` — Refresh access token using `refresh_token`
- `POST /auth/forgot_password` — Reset password using verified session key
- `POST /auth/reset_password` — Change password using current password
- `GET /user/users/me` — Retrieve current authenticated user profile and permissions

#### Members & Roles (`membersApi`)
- `GET /user/users` — Paginated user directory with search and role filters
- `POST /user/users` — Create new member account
- `GET /user/users/online` — List currently online members
- `GET /user/users/{id}` — Get single member profile
- `PATCH /user/users/{id}` — Update member details
- `DELETE /user/users/{id}` — Delete user account
- `PATCH /user/users/{id}/restore` — Restore soft-deleted member
- `PATCH /user/users/{id}/validate` — Validate annual membership payment
- `POST /user/users/photo` — Upload user avatar image
- `GET /user/users/export/csv` — Export member directory to CSV
- `GET /user/roles` — List system user roles
- `POST /user/roles` — Create new user role
- `PATCH /user/roles/{id}` — Update user role
- `DELETE /user/roles/{id}` — Delete user role
- `GET /user/permissions` — List all permissions
- `POST /user/permissions` — Create permission entry
- `PATCH /user/permissions/{id}` — Update permission entry
- `GET /user/member-permissions` — Get specific member permission overrides
- `PATCH /user/member-permissions` — Update direct member permission overrides

#### Forums & Topics (`forumApi`)
- `GET /forums/forums` — List all active forums
- `POST /forums/forums` — Create new forum category
- `GET /forums/forums/{id}` — Get forum details
- `PATCH /forums/forums/{id}` — Update forum name/type/thumbnail
- `DELETE /forums/forums/{id}` — Delete forum
- `GET /forums/forums/{id}/topics` — Paginated topics inside a forum
- `POST /forums/forums/{id}/topics` — Create topic with attachments
- `PATCH /forums/topics/{id}/update` — Update topic content/title
- `DELETE /forums/topics/{id}/delete` — Delete topic
- `PATCH /forums/topics/{id}/pin` — Pin/unpin topic
- `GET /forums/topics/pinned` — Get all pinned topics across forums
- `GET /forums/topics/{id}/posts` — Paginated discussion posts/replies
- `POST /forums/topics/{id}/posts` — Post reply with file attachments
- `PATCH /forums/posts/{id}` — Edit reply post
- `DELETE /forums/posts/{id}` — Delete reply post
- `GET /forums/forums/{id}/permissions` — Get role permissions for forum
- `PATCH /forums/forums/permissions/bulk` — Set role permissions for forums in bulk

#### Articles (`articlesApi`)
- `GET /articles/articles` — Paginated articles catalogue
- `POST /articles/articles` — Create article with thumbnail & files
- `GET /articles/articles/{id}` — Article detail
- `PATCH /articles/articles/{id}` — Update article
- `DELETE /articles/articles/{id}` — Delete article
- `POST /articles/articles/{id}/publish` — Publish draft article
- `GET /articles/my-articles` — Get articles authored by current user
- `GET /articles/article-categories` — List article categories
- `POST /articles/article-categories` — Create category
- `PATCH /articles/article-categories/{id}` — Update category
- `DELETE /articles/article-categories/{id}` — Delete category
- `GET /articles/articles/{id}/permissions` — Article role permissions
- `PATCH /articles/article/permissions/bulk` — Update article permissions in bulk
- `POST /articles/file-upload` — Upload article asset
- `POST /articles/file-delete` — Delete article asset

#### Events & Agenda (`eventsApi`)
- `GET /events/events` — Get events filtered by year and month
- `GET /events/events/upcoming` — Get upcoming events list
- `GET /events/events/calendar-stats` — Get calendar statistics
- `GET /events/events/{id}` — Get event details
- `POST /events/events` — Create new event
- `PATCH /events/events/{id}` — Update event details
- `DELETE /events/events/{id}` — Delete event
- `POST /events/events/{id}/register` — Register member for event
- `DELETE /events/events/{id}/register` — Unregister member from event
- `GET /events/events/{id}/registrations` — Get attendee registration roster

#### Professional Trainings (`trainingsApi`)
- `GET /trainings/trainings` — List all courses
- `GET /trainings/trainings/upcoming` — Paginated upcoming trainings
- `GET /trainings/trainings/{id}` — Training course details
- `POST /trainings/trainings` — Create training course
- `PATCH /trainings/trainings/{id}` — Update training details
- `DELETE /trainings/trainings/{id}` — Delete training course
- `POST /trainings/trainings/{id}/register` — Register for training
- `DELETE /trainings/trainings/{id}/register` — Cancel training registration
- `GET /trainings/trainings/{id}/permissions` — Course permissions
- `PATCH /trainings/training/permissions/bulk` — Bulk update training permissions

#### Document Library (`documentsApi`)
- `GET /documents/documents/folders` — Get folder hierarchy
- `POST /documents/documents/folders` — Create document folder
- `PATCH /documents/documents/folders/{id}` — Update folder name/color
- `DELETE /documents/documents/folders/{id}` — Delete folder
- `GET /documents/documents/folders/{id}/permissions` — Folder permissions
- `PATCH /documents/folder/permissions/bulk` — Update folder permissions in bulk
- `GET /documents/documents` — Get files inside folder
- `POST /documents/documents/upload` — Upload file to folder
- `PATCH /documents/documents/{id}` — Rename document
- `DELETE /documents/documents/{id}` — Delete document
- `GET /documents/documents/{id}/download` — Download document binary file

#### Moderation Desk (`moderationApi`)
- `GET /admin&modarator/moderation/queue` — Paginated moderation queue
- `GET /admin&modarator/moderation/logs` — Paginated moderation action logs
- `POST /admin&modarator/moderation/moderate` — Submit moderation decision (`approve` / `reject` / `flag`)

#### Administration & Operations (`adminApi`)
- `GET /admin&modarator/admin/activity-log` — Activity audit logs
- `GET /settings/admin/smtp` — Fetch SMTP email settings
- `PUT /settings/admin/smtp` — Update SMTP configuration
- `POST /settings/admin/smtp/test` — Trigger test email dispatch
- `GET /settings/admin/logs` — Retrieve system logs
- `GET /settings/admin/logs/download` — Download log file (.log blob)
- `DELETE /settings/admin/logs` — Clear system logs
- `GET /settings/admin/backups` — List database & asset backups
- `POST /settings/admin/backups/run` — Run manual backup immediately
- `PUT /settings/admin/backups/configuration` — Update backup schedule
- `POST /settings/admin/backups/test-permissions` — Test backup storage permissions
- `GET /settings/admin/backups/{id}/download` — Download backup archive
- `DELETE /settings/admin/backups/{id}` — Delete backup archive

#### Dashboard & Search (`dashboardApi`)
- `GET /dashboard/stats` — Executive metric cards
- `GET /dashboard/activity` — Real-time activity feed
- `GET /dashboard/upcoming-events` — Dashboard events widget
- `GET /dashboard/search` — Global search across articles, topics, events, trainings

#### Notifications (`notificationsApi`)
- `GET /notifications/preferences` — Get member email notification settings
- `PATCH /notifications/preferences` — Toggle notification categories

---

## 9. Configuration & Environment Variables

The project reads environment variables via Vite's `import.meta.env`.

Create a `.env` file in the root directory:

```env
# Backend API Base URL (without trailing slash)
VITE_API_BASE_URL=https://api.archicopro.example.com
```

> [!NOTE]
> During Docker container build, `VITE_API_BASE_URL` is passed as a build argument:
> `docker build --build-arg VITE_API_BASE_URL=https://api.example.com -t archicopro-frontend .`

---

## 10. Local Development & Build Scripts

### Prerequisites
- **Node.js**: v18+ (Node 20 or 22 recommended)
- **npm**: v9+

### Available Scripts

| Command | Action |
| :--- | :--- |
| `npm install` | Install all dependencies |
| `npm run dev` | Start local Vite dev server at `http://localhost:5173` |
| `npm run build` | Type-check and compile optimized production bundle in `dist/` |
| `npm run preview` | Run local web server previewing the compiled `dist/` bundle |
| `npm run lint` | Execute TypeScript strict type checking (`tsc --noEmit`) |

---

## 11. Production Docker Deployment

The repository includes a production multi-stage `Dockerfile`:

```dockerfile
# Stage 1: Build static assets
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Stage 2: Export static artifact
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/dist ./dist
```

### Deployment Options:
1. **Nginx Reverse Proxy**: Serve the `dist/` directory via Nginx with single-page application (SPA) routing fallback:
   ```nginx
   server {
       listen 80;
       server_name extranet.archicopro.com;
       root /var/www/archicopro/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```
2. **Docker / Kubernetes**: Use an Nginx Alpine container image copying `/app/dist` into `/usr/share/nginx/html`.

---

## 12. Important Developer Notes & Gotchas

1. **French Language Primary**: Although the extranet is fully bilingual (`en` / `fr`), ARCHICOPRO is a French professional association. All new mock data, email templates, and standard role slugs (`admin`, `moderator`, `membre`, `auditeur`, `partenaires_technicopro`, `comite_coproprietaire`) reflect French terminology.
2. **Admin Panel Monolith (`AdminPanel.tsx`)**: At ~7,000 lines, `src/pages/AdminPanel.tsx` contains extensive UI logic for all 8 administrative domains. Future architectural refactoring should modularize each tab into subcomponents under `src/pages/admin/tabs/`.
3. **Form-Data vs JSON Payloads**:
   - Authentication endpoints (`/auth/login`, `/auth/signup`, `/auth/verify_otp`, etc.) use `application/x-www-form-urlencoded`.
   - Content authoring endpoints (Articles, Forums, Trainings, Events) use `multipart/form-data` via `FormData` to support image covers, PDF syllabus files, and multiple attachments simultaneously.
   - Bulk permission updates use standard `application/json`.
4. **User Payment Validation Requirement**: Unvalidated members (`is_payment_validated: false`) will see an `AccessRestrictedNotice` banner on their home screen reminding them that their annual association dues require administrator validation.
5. **Direct User Permission Precedence**: When checking whether a user can perform an action, always use `usePermissions()` or `useDirectUserPermissions()`. Do not rely solely on `user.role`, because administrators can grant custom capabilities to individual members independently of their role.
