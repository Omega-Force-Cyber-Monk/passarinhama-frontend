# ARCHICOPRO Extranet — Complete Form and Input Field Reference

This document provides a comprehensive, code-verified technical inventory of **every form, modal dialog, drawer, inline input set, and interactive control** implemented in the ARCHICOPRO frontend codebase (`passarinhama-frontend`).

---

## Technical Overview & Methodology

Every field documented in this specification was audited directly against:
1. **Component JSX / TSX source code** (attributes like `required`, `type`, `placeholder`, `disabled`, `readOnly`).
2. **Form submission validation handlers** (`onSubmit`, `handleSubmit`, explicit conditional checks like `!field.trim()`).
3. **TypeScript DTO definitions and interfaces** in `src/types/` and `src/redux/features/*/`.
4. **Error handling and toast notifications** dispatched via `useAppToast` or inline error banners.
5. **Payload serializers** (FormData `multipart/form-data`, URL encoded `application/x-www-form-urlencoded`, and JSON payloads).

### Required vs. Optional Classification Rule:
- **Enforced Required**: The frontend explicitly blocks submission and displays a localized validation error or HTML5 required trigger if this field is empty.
- **UI Label Required Only**: The UI label indicates a required status or renders an asterisk, but client-side logic does not strictly halt form submission.
- **Backend-Dependent / Unverified**: The field is marked optional or unconstrained on the frontend, but the remote API may reject empty submissions.
- **Optional**: Field may be omitted or submitted as empty/null without client-side error.

---

## 1. Authentication & Identity Management

### Form 1.1: Member Login
- **File Reference**: `src/pages/Login.tsx` (Lines 14–178)
- **Route**: `/login`
- **Submission Endpoint**: `POST /auth/login` (Content-Type: `application/x-www-form-urlencoded`)
- **Access**: Public / Unauthenticated visitors only (`PublicRoute`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Email** (`login.email`) | `<input type="email">` | **Enforced Required** | `"admin@gmail.com"` | `!email.trim()`. Must be valid email string. | Any valid email address | Pre-filled default in development. Submits as form-urlencoded `email`. |
| **Password** (`login.password`) | `<input type="password">` / `<input type="text">` | **Enforced Required** | `"admin"` | `!password.trim()`. Non-empty string. | Any non-empty string | Password visibility toggle button switches input type between `password` and `text`. |
| **Remember Me** | `<input type="checkbox">` | **Inactive (Commented Out)** | `false` | None | N/A | Code lines 143–151 contain commented-out checkbox markup. |

---

### Form 1.2: Public Membership Request (Signup)
- **File Reference**: `src/pages/Signup.tsx` (Lines 12–256)
- **Route**: `/signup`
- **Submission Endpoint**: `POST /auth/send_otp` (dispatches OTP code), followed by `POST /auth/signup` upon OTP verification
- **Access**: Public / Unauthenticated visitors (`PublicRoute`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **First Name** (`signup.firstName`) | `<input type="text">` | **Enforced Required** | `""` | `!formData.firstName.trim()`. Non-empty text. | Free text (placeholder: "Jean") | Trimmed prior to submission. |
| **Last Name** (`signup.lastName`) | `<input type="text">` | **Enforced Required** | `""` | `!formData.lastName.trim()`. Non-empty text. | Free text (placeholder: "Dupont") | Trimmed prior to submission. |
| **Professional Email** (`signup.professionalEmail`) | `<input type="email">` | **Enforced Required** | `""` | `!formData.email.trim()`. Valid email format. | Professional email address (placeholder: `architect@cabinet.fr`) | Target recipient for verification OTP challenge. |
| **Password** (`signup.password`) | `<input type="password">` | **Enforced Required** | `""` | `!formData.password.trim()`. Non-empty text. | Text (placeholder: `••••••••`) | Evaluated against `confirmPassword`. |
| **Confirm Password** (`signup.confirmPassword`) | `<input type="password">` | **Enforced Required** | `""` | `password === confirmPassword`. | Must match `password` exactly | Client-side equality check halts submission on mismatch with `signup.passwordsDoNotMatch`. |
| **Role Assignment** | *Implicit Payload Property* | **Enforced System Constant** | `"membre"` | Hardcoded string literal | `"membre"` | Explicitly sent by the client; ordinary registrants cannot choose roles. |

---

### Form 1.3: Forgot Password — Step 1: OTP Challenge
- **File Reference**: `src/pages/ForgotPassword.tsx` (Lines 20–165)
- **Route**: `/forgot-password`
- **Submission Endpoint**: `POST /auth/send_otp`
- **Access**: Public / Unauthenticated visitors

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Email Address** (`forgotPassword.emailAddress`) | `<input type="email">` | **Enforced Required** | `routeState.email \|\| ""` | `!email.trim()`. Non-empty email. | Registered account email | Sends `{ email, purpose: 'forgot_password' }` and redirects to `/verify-otp`. |

---

### Form 1.4: Forgot Password — Step 2: Password Reset
- **File Reference**: `src/pages/ForgotPassword.tsx` (Lines 166–247)
- **Route**: `/forgot-password` (conditional render when `sessionKey` and `email` exist in React Router state)
- **Submission Endpoint**: `POST /auth/forgot_password`
- **Access**: Public, gated by temporary verification session token

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Email Address** (`forgotPassword.emailAddress`) | `<input type="email">` | **Read-Only / Disabled** | Injected from verification state | Disabled attribute | Preserved user email | User cannot edit email during password reset step. |
| **New Password** (`forgotPassword.newPassword`) | `<input type="password">` / `<input type="text">` | **Enforced Required** | `""` | `!newPassword.trim()`. Non-empty text. | Text | Has visibility toggle button (`Eye` / `EyeOff`). |
| **Confirm New Password** (`forgotPassword.confirmNewPassword`) | `<input type="password">` / `<input type="text">` | **Enforced Required** | `""` | Must match `newPassword` exactly. | Text matching `newPassword` | Has visibility toggle button. Error toast shown if mismatch. |
| **Session Key** | *Implicit State Payload* | **Enforced Required** | `routeState.sessionKey` | Must be non-empty string | Server-generated UUID/hex string | Sent in form-urlencoded body as `session_key`. |

---

### Form 1.5: Multi-Digit OTP Verification
- **File Reference**: `src/pages/OTPVerification.tsx` (Lines 30–288)
- **Route**: `/verify-otp`
- **Submission Endpoint**: `POST /auth/signup` (if completing registration) OR `POST /auth/verify_otp` (if recovering password)
- **Access**: Public

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Digit Boxes 1 through 6** (`otp[0]` to `otp[5]`) | 6 separate `<input type="text">` controls | **Enforced Required** | `['','','','','','']` | Single numeric digit per cell (`0–9`). `maxLength={1}`. `otp.some(d => !d.trim())` fails. | Digits `0` through `9` | Automatically shifts focus forward on keystroke; backspace returns focus to previous input. Supports 6-digit clipboard paste. |
| **Resend Code** | `<button type="button">` | Optional Trigger | Cooldown: 59s | Active when timer reaches 0 | Action trigger | Re-dispatches `sendOtp` with active email and purpose. |

---

## 2. User Profile & Account Settings

### Form 2.1: Personal Profile Information
- **File Reference**: `src/pages/Profile.tsx` (Lines 122–260)
- **Route**: `/profile`
- **Submission Endpoint**: `PATCH /user/users/me` (Content-Type: `application/json`)
- **Access**: Any active authenticated user

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **First Name** (`profilePage.firstName`) | `<input type="text">` | **Enforced Required** | `apiUser.first_name \|\| ""` | `!formData.first_name.trim()`. | Free text | Blocked if blank. |
| **Last Name** (`profilePage.lastName`) | `<input type="text">` | **Enforced Required** | `apiUser.last_name \|\| ""` | `!formData.last_name.trim()`. | Free text | Blocked if blank. |
| **Email Address** (`profilePage.emailAddress`) | `<input type="email">` | **Enforced Required** | `apiUser.email \|\| ""` | `!formData.email.trim()`. Valid email. | Email format | Profile update sends email; server derives uniqueness. |
| **Phone** (`profilePage.phone`) | `<input type="tel">` | Optional | `apiUser.phone \|\| ""` | Trimmed string | Phone number string | Telephone landline. |
| **Mobile** (`profilePage.mobile`) | `<input type="tel">` | Optional | `apiUser.mobile \|\| ""` | Trimmed string | Mobile phone string | Cellular contact. |
| **Company / Society** (`profilePage.society`) | `<input type="text">` | Optional | `apiUser.society \|\| ""` | Trimmed string | Free text | Architectural firm or organization name. |
| **Department** (`profilePage.department`) | `<input type="text">` | Optional | `apiUser.department \|\| ""` | Trimmed string | Free text | Administrative district or department code. |
| **City** (`profilePage.city`) | `<input type="text">` | Optional | `apiUser.city \|\| ""` | Trimmed string | Free text | Municipality / City name. |
| **Address** (`profilePage.address`) | `<input type="text">` | Optional | `apiUser.address \|\| ""` | Trimmed string | Free text | Physical street address. |

---

### Form 2.2: Password Change Form
- **File Reference**: `src/pages/Profile.tsx` (Lines 267–340)
- **Route**: `/profile`
- **Submission Endpoint**: `POST /auth/reset_password` (Form URL encoded)
- **Access**: Authenticated user

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Current Password** (`profilePage.currentPassword`) | `<input type="password">` / `<input type="text">` | **Enforced Required** | `""` | `!passwordData.currentPassword.trim()` | Text | Visibility toggle available. |
| **New Password** (`profilePage.newPassword`) | `<input type="password">` / `<input type="text">` | **Enforced Required** | `""` | `!passwordData.newPassword.trim()` | Text | Visibility toggle available. |
| **Confirm New Password** (`profilePage.confirmNewPassword`) | `<input type="password">` / `<input type="text">` | **Enforced Required** | `""` | Must match `newPassword` exactly | Text | Visibility toggle available. |

---

### Form 2.3: Profile Avatar Photo Upload
- **File Reference**: `src/pages/Profile.tsx` (Lines 242–265)
- **Route**: `/profile`
- **Submission Endpoint**: `PATCH /user/users/{userId}/photo_upload` (Multipart `FormData`, field: `photo`)
- **Access**: Current authenticated user (scoped to self ID in `mutationAuthorization.ts`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Profile Photo Input** (`#profile-photo-input`) | `<input type="file">` | Optional | None | `accept="image/*"` | Image files (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif`) | Dispatched immediately upon file selection via `onChange`. |

---

### Form 2.4: Email Notification Preferences
- **File Reference**: `src/pages/Profile.tsx` (Lines 630–675)
- **Route**: `/profile`
- **Submission Endpoint**: `PATCH /settings/notifications/preferences`
- **Access**: Authenticated user

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Notification Category Toggle** | `<button role="switch">` | Optional Toggle | Loaded from API `is_active` | Boolean toggle | `true` (Active) / `false` (Disabled) | Immediate asynchronous dispatch upon toggle click. |

---

## 3. Member Directory & Administration

### Form 3.1: Member Create / Edit Modal (MemberDirectory)
- **File Reference**: `src/pages/MemberDirectory.tsx` (Lines 310–418, 700–1080)
- **Route**: `/directory`
- **Submission Endpoints**: `POST /user/users` (Create) / `PATCH /user/users/{id}` (Update) (Multipart `FormData`)
- **Access**: `canCreateMembers` (`user.create`) / `canEditMembers` (`user.edit`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **First Name** (`memberDirectory.firstName`) | `<input type="text">` | **Enforced Required** | Empty or Member Value | `!formData.first_name.trim()` | Free text | Trimmed before payload creation. |
| **Last Name** (`memberDirectory.lastName`) | `<input type="text">` | **Enforced Required** | Empty or Member Value | `!formData.last_name.trim()` | Free text | Trimmed before payload creation. |
| **Email** (`memberDirectory.email`) | `<input type="email">` | **Enforced Required** | Empty or Member Value | `!formData.email.trim()` | Email string | Must be unique across directory. |
| **Password** (`memberDirectory.password`) | `<input type="password">` / `<input type="text">` | **Enforced Required on Create**; Optional on Edit | `""` | On create: non-empty and `>= 8 characters`. | Min 8 chars on create | Toggle visibility button with accessible ARIA label. |
| **Phone** (`memberDirectory.phone`) | `<input type="tel">` | Optional | `""` | Trimmed string | Phone number string | Telephone landline. |
| **Mobile** (`memberDirectory.mobile`) | `<input type="tel">` | Optional | `""` | Trimmed string | Mobile phone string | Cellular line. |
| **Society / Company** (`memberDirectory.society`) | `<input type="text">` | Optional | `""` | Trimmed string | Free text | Architecture practice / studio name. |
| **Department** (`memberDirectory.department`) | `<input type="text">` | Optional | `""` | Trimmed string | Free text | Region / Department code. |
| **City** (`memberDirectory.city`) | `<input type="text">` | Optional | `""` | Trimmed string | Free text | Municipality name. |
| **Address** (`memberDirectory.address`) | `<textarea>` | Optional | `""` | Trimmed string | Multi-line text | Postal address. |
| **Avatar Image** | `FileUploadDropzone` / file input | Optional | `null` | `accept="image/*"` | Single image file | Uploaded as FormData `avatar`. |
| **Role** (`memberDirectory.role`) | `<select>` dropdown | **Enforced Required for Superuser on Create** | Default member role ID | Must be selected if Superuser | Fetched from `GET /user/roles` | **Privileged Field**: Hidden from non-superusers. Stripped by `ordinaryAccountPayload`. |
| **Account Status** (`memberDirectory.status`) | `<select>` dropdown | Optional | `"active"` | Enum values | `"active"`, `"pending"`, `"suspended"` | **Privileged Field**: Hidden from non-superusers. Stripped for ordinary users. |
| **Payment Validated** (`memberDirectory.paymentValidated`) | `<input type="checkbox">` | Optional | `true` (create) | Boolean | Checked (`true`) / Unchecked (`false`) | **Privileged Field**: Hidden from non-superusers. Stripped for ordinary users. |
| **Superuser Privileges** (`memberDirectory.isSuperuser`) | `<input type="checkbox">` | Optional | `false` | Boolean | Checked (`true`) / Unchecked (`false`) | **Privileged Field**: Hidden from non-superusers. Stripped for ordinary users. |

---

## 4. Articles & Knowledge Base

### Form 4.1: Article Authoring & Editing Modal
- **File Reference**: `src/pages/Articles.tsx` (Lines 353–418, 652–886)
- **Route**: `/articles`
- **Submission Endpoints**: `POST /articles/articles` (Create) / `PATCH /articles/articles/{id}` (Update) (Multipart `FormData`)
- **Access**: `article.create` / `article.edit` (Requires ownership comparison `resourceAuthorization.ts` unless Superuser)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Article Title** (`articlesPage.articleTitle`) | `<input type="text">` | **Enforced Required** | `""` | `!formData.title.trim()`. Non-empty text. | Free text | Blocked with toast if blank. |
| **Category** (`articlesPage.category`) | `<select>` dropdown | **Enforced Required** | `""` | `!formData.category_id`. Valid category ID. | Populated dynamically from `useGetArticleCategoriesQuery` | Must select a valid category from list. |
| **Publication Status** (`ContentStatusField`) | `<select>` or custom radio | Optional | `"draft"` | Enum values | `"published"`, `"draft"` | Only Published and Draft selectable. Unchanged status preserved if existing record has legacy status. |
| **Excerpt** (`articlesPage.excerptOptional`) | `<textarea rows={2}>` | Optional | `""` | Plain text | Free text | Summarized preview on listing cards. |
| **Article Body Content** (`articlesPage.contentEditor`) | `TiptapEditor` (WYSIWYG) | **Enforced Required** | `""` | `!stripRichText(body)`. Rich text must contain non-whitespace text. | HTML generated by Tiptap Editor | Full toolbar: Bold, Italic, Underline, Bullet/Numbered Lists, Table, Links, YouTube embed, Inline Image upload. |
| **Cover Thumbnail** (`articlesPage.thumbnailLabel`) | `FileUploadDropzone` | **Enforced Required** | `null` | Single image file. `accept="image/*"`. Validated by `formData.thumbnail \|\| formData.thumbnail_url`. | Image file (`.jpg`, `.png`, `.webp`, `.svg`, etc.) | Dropzone with compact preview card. Replacement allowed; remove clears local selection. |
| **Attachments** (`articlesPage.attachmentsOptional`) | `FileUploadDropzone` (multiple) | Optional | `[]` | Multi-file dropzone | Any document format | Appended to `selectedFiles: File[]`. Sent as `files` in FormData payload. |
| **Existing Attachments List** | Interactive `FilePreviewCard` list | Optional | `article.structured_fields.file_urls` | String URLs | URL strings | Clicking remove button filters URL out of `structured_fields.file_urls`. |

---

### Form 4.2: Article Category Management Dialog
- **File Reference**: `src/components/ui/CategoryManagerDialog.tsx` (Lines 1–210)
- **Modal Trigger**: Categories button on `/articles`
- **Submission Endpoints**: `POST /articles/article-categories`, `PATCH /articles/article-categories/{id}`, `DELETE /articles/article-categories/{id}`
- **Access**: Superuser only (`isSuperuser === true`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Category Name** (`common.name`) | `<input type="text">` | **Enforced Required** | `""` | `!name.trim()` | Free text | Managed inside child native `<dialog>`. |
| **Category Description** (`common.description`) | `<textarea>` | Optional | `""` | Free text | Multi-line text | Optional summary of the category. |

---

## 5. Agenda & Calendar Events

### Form 5.1: Event Scheduling Modal
- **File Reference**: `src/pages/Agenda/Agenda.tsx` (Lines 556–630, 1150–1353)
- **Route**: `/agenda`
- **Submission Endpoints**: `POST /events/events` (Create) / `PATCH /events/events/{id}` (Update) (Multipart `FormData`)
- **Access**: `event.create` / `event.edit` (Requires ownership comparison `created_by.id === user.id` unless Superuser)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Event Title** (`agendaPage.eventTitle`) | `<input type="text">` | **Enforced Required** | `""` | `!formData.title.trim()` | Free text | Checked on submit. |
| **Start Date** (`agendaPage.startDate`) | `BeautifulDateTimePicker` / date picker | **Enforced Required** | Today (`yyyy-MM-dd`) | Format `yyyy-MM-dd` | Valid date string | Interactive month/day picker dialog. |
| **End Date** (`agendaPage.endDate`) | `BeautifulDateTimePicker` / date picker | **Enforced Required** | Today (`yyyy-MM-dd`) | Format `yyyy-MM-dd`. Cannot precede start date (`isEndDateBeforeStartDate`). | Valid date string `>= event_date` | Date picker automatically adjusts if earlier than start date. |
| **Time** (`agendaPage.time`) | `BeautifulDateTimePicker` / time picker | **Enforced Required** | `"14:00"` | Format `HH:mm` | 24-hour time format | Time picker selector. |
| **Event Category** (`agendaPage.eventType`) | `<select>` dropdown | Optional | `""` | Category ID | Dynamic list from `useGetEventCategoriesQuery` | Selectable event categorization. |
| **Max Attendees** (`agendaPage.maxAttendees`) | `<input type="number">` | Optional | `50` | Numeric integer `>= 0` | Positive integer | Default capacity is 50 members. |
| **Location** (`agendaPage.location`) | `<input type="text">` | **Enforced Required** | `"Zoom"` | `!formData.location.trim()` | Physical address, venue, or webinar link | Physical room or online platform. |
| **Description** (`agendaPage.descriptionLabel`) | `TiptapEditor` (WYSIWYG) | Optional | `""` | Rich text HTML | Formatted HTML with optional image/YouTube embeds | Full rich text formatting. |
| **New Attachments** | `FileUploadDropzone` | Optional | `[]` | Multiple files | Any file format | Sent as `attachments` on create, or `new_attachments` on update. |
| **Existing Attachments** | `FilePreviewCard` list | Optional | `event.attachments` | Array of URL strings | URL strings | Removing an item appends URL to `remove_attachment_urls`. |
| **Public Event** (`agendaPage.publicEvent`) | `<input type="checkbox">` | Optional | `false` | Boolean | Checked (`true`) / Unchecked (`false`) | Flag to determine visibility scope. |

---

### Form 5.2: Event Category Management Dialog
- **File Reference**: `src/components/ui/CategoryManagerDialog.tsx` & `Agenda.tsx` (Lines 1754–1768)
- **Modal Trigger**: Categories manager button in Agenda toolbar
- **Submission Endpoints**: `POST /events/event-categories`, `PATCH /events/event-categories/{id}`, `DELETE /events/event-categories/{id}`
- **Access**: Superuser only (`isSuperuser === true`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Category Name** (`common.name`) | `<input type="text">` | **Enforced Required** | `""` | `!name.trim()` | Free text | Required name string. |
| **Category Description** (`common.description`) | `<textarea>` | Optional | `""` | Free text | Multi-line text | Descriptive category text. |
| **Color Code** (`agendaPage.categoryColor`) | `<input type="color">` / hex input | Optional | Neutral yellow | Valid hex color `#RRGGBB` | Hex color code | Supported only in Agenda category dialog (`supportsColor={true}`). Used for calendar event chip accents. |

---

## 6. Training Courses & Syllabus

### Form 6.1: Professional Training Authoring Modal
- **File Reference**: `src/pages/Trainings.tsx` (Lines 153–228, 330–477)
- **Route**: `/trainings`
- **Submission Endpoints**: `POST /trainings/trainings` (Create) / `PATCH /trainings/trainings/{id}` (Update) (Multipart `FormData`)
- **Access**: `training.create` / `training.edit` (Requires ownership comparison `created_by.id === user.id` unless Superuser)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Training Title** (`trainingsPage.trainingTitle`) | `<input type="text">` | **Enforced Required** | `""` | `!formData.title.trim()` | Free text | Validated by `canSubmitForm`. |
| **Category** (`articlesPage.category`) | `<select>` dropdown | **Enforced Required** | `""` | `!formData.category_id` | Populated from `useGetTrainingCategoriesQuery` | Validated by `canSubmitForm`. |
| **Status** (`ContentStatusField`) | `<select>` dropdown | Optional | `"draft"` | Enum values | `"published"`, `"draft"` | Lifecycle state. |
| **Excerpt** (`articlesPage.excerpt`) | `<textarea>` | Optional | `""` | Free text | Multi-line summary | Displayed on course listing cards. |
| **Course Syllabus / Description** (`trainingsPage.descriptionLabel`) | `TiptapEditor` (WYSIWYG) | **Enforced Required** | `""` | `!stripRichText(description)`. Must have non-empty text. | Formatted HTML content | Supports full rich text, tables, syllabus layout, inline images, links. |
| **Course Thumbnail** (`trainingsPage.thumbnailLabel`) | `<input type="file">` | Optional | `null` | `accept="image/*"`. Single file. | Image file | Sent in FormData as `thumbnail`. |
| **Syllabus & Course Files** (`articlesPage.attachmentsOptional`) | `<input type="file" multiple>` | Optional | `[]` | Multiple file input | Any file type (PDF syllabus, docs, presentations) | Sent as `attachments` on create, or `new_attachments` on update. |
| **Existing Attachments** | `FilePreviewCard` list | Optional | Existing course attachments | URL strings | URL strings | Removal appends URL to `remove_attachment_urls`. |

---

### Form 6.2: Training Category Manager Dialog
- **File Reference**: `src/pages/Trainings.tsx` (Lines 479–493)
- **Submission Endpoints**: `POST /trainings/training-categories`, `PATCH /trainings/training-categories/{id}`, `DELETE /trainings/training-categories/{id}`
- **Access**: Superuser only (`isSuperuser === true`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Category Name** (`common.name`) | `<input type="text">` | **Enforced Required** | `""` | `!name.trim()` | Free text | Category identifier. |
| **Description** (`common.description`) | `<textarea>` | Optional | `""` | Free text | Description text | Category scope note. |

---

## 7. TechnicoPro (Technical Knowledge Base)

### Form 7.1: TechnicoPro Publication Modal
- **File Reference**: `src/pages/TechnicoPro.tsx` (Lines 148–218, 330–440)
- **Route**: `/technicopro`
- **Submission Endpoints**: `POST /technicopro/technicopros` (Create) / `PATCH /technicopro/technicopros/{id}` (Update) (Multipart `FormData`)
- **Access**: `technicopro.create` / `technicopro.edit` (Requires ownership comparison `author.id` / `author_id` unless Superuser)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Title** (`technicoproPage.title`) | `<input type="text">` | **Enforced Required** | `""` | `!formData.title.trim()` | Free text | Validated by `canSubmitForm`. |
| **Category** (`articlesPage.category`) | `<select>` dropdown | **Enforced Required** | `""` | `!formData.category_id` | Populated from `useGetTechnicoProCategoriesQuery` | Validated by `canSubmitForm`. |
| **Status** (`ContentStatusField`) | `<select>` dropdown | Optional | `"draft"` | Enum values | `"published"`, `"draft"` | Lifecycle state. |
| **Excerpt** (`articlesPage.excerpt`) | `<textarea>` | Optional | `""` | Free text | Short summary text | Preview excerpt. |
| **Technical Body Content** | `TiptapEditor` (WYSIWYG) | **Enforced Required** | `""` | `!stripRichText(body)`. Must contain text. | Formatted HTML | Detailed technical documentation, specifications, standards. |
| **Thumbnail** | `<input type="file">` | Optional | `null` | `accept="image/*"`. Single file. | Image file | Sent in FormData as `thumbnail`. |
| **Attachments & Specifications** | `<input type="file" multiple>` | Optional | `[]` | Multiple file input | Document and technical asset files | Sent as `files` on create/update. |
| **Existing Attachments** | `FilePreviewCard` list | Optional | Existing file URLs | URL strings | URL strings | Removal tracked in comma-delimited `remove_file_urls`. |

---

## 8. Document Library & Cloud Storage

### Form 8.1: Create Folder Modal
- **File Reference**: `src/pages/DocumentLibrary.tsx` (Lines 502–525, 1200–1260)
- **Route**: `/documents` or `/documents/folder/:folderId`
- **Submission Endpoint**: `POST /documents/documents/folders` (JSON: `{ name, parent_id }`)
- **Access**: `document.create` (For nested subfolders, additionally requires parent `folder.can_upload === true` unless Superuser)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Folder Name** (`documentLibraryPage.folderName`) | `<input id="folder-name-input" type="text">` | **Enforced Required** | `""` | `!newFolderName.trim()` | Free text (placeholder: `"e.g. Legal, Projects, Templates..."`) | Trimmed. Submits with active `currentFolder.id` as `parent_id`. |

---

### Form 8.2: Upload Document File Modal
- **File Reference**: `src/pages/DocumentLibrary.tsx` (Lines 527–580, 1265–1350)
- **Route**: `/documents/folder/:folderId` (inside an active folder)
- **Submission Endpoint**: `POST /documents/documents/upload` (Multipart `FormData`: `file: File`, `folder_id: string`)
- **Access**: `document.create` plus active folder capability `folder.can_upload === true` unless Superuser

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **File Chooser / Dropzone** (`#document-file-upload`) | Drag-and-drop zone and native `<input type="file">` | **Enforced Required** | `null` | Single file. `selectedFile !== null`. | Any document or asset file | Supports native file selection or drag-and-drop. Drag state highlights UI. |

---

### Form 8.3: Rename Folder or File Modal
- **File Reference**: `src/pages/DocumentLibrary.tsx` (Lines 633–664, 1355–1420)
- **Route**: `/documents` / `/documents/folder/:folderId`
- **Submission Endpoints**: `PATCH /documents/documents/folders/{id}` (Folder) / `PATCH /documents/documents/{id}` (Document)
- **Access**: For folders: Superuser only; For files: `document.edit` and `uploaded_by.id === user.id` unless Superuser

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **New Name** (`documentLibraryPage.newName`) | `<input id="rename-input" type="text">` | **Enforced Required** | Target's current name | `!renamingName.trim()` | Free text | Sends `{ name: trimmed }` for folders, or `{ original_name: trimmed }` for documents. |

---

## 9. Forums & Community Discussions

### Form 9.1: Forum Category Container Modal
- **File Reference**: `src/pages/Forums.tsx` (Lines 100–107, 1150–1280)
- **Route**: `/forums`
- **Submission Endpoints**: `POST /forums/forums` (Create) / `PATCH /forums/forums/{id}` (Update) (Multipart `FormData`)
- **Access**: `forum.create` (Create) / Superuser only for container modification/deletion (`mutationAuthorization.ts`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Forum Name** (`forumsPage.forumTitle`) | `<input type="text">` | **Enforced Required** | `""` | `!formData.name.trim()` | Free text | Forum header name. |
| **Responsible Person / Author** (`forumsPage.authorLabel`) | `<input type="text">` | **Enforced Required** | `""` | `!formData.author_name.trim()` | Free text | Display name of moderator or commission head. |
| **Description** (`forumsPage.descriptionLabel`) | `TiptapEditor` (compact) | **Enforced Required** | `""` | `!stripRichText(description)` | Formatted HTML | Scoped charter or guidelines of the forum. |
| **Forum Thumbnail Image** | `FileUploadDropzone` / file input | Optional | `null` | `accept="image/*"`. Single file. | Image file | Sent in FormData as `thumbnail`. |
| **Forum Type** | *Implicit State Payload* | **Enforced System Constant** | `"general"` | Preserved on edit | `"general"`, `"professionnel"`, `"commission"` | Create request explicitly sends `forum_type: "general"`. Existing non-general values preserved on edit. |

---

### Form 9.2: Create / Edit Forum Discussion Topic Modal
- **File Reference**: `src/pages/Forums.tsx` (Lines 1040–1140, 1300–1450)
- **Route**: `/forums/:forumId`
- **Submission Endpoints**: `POST /forums/forums/{forumId}/topics` (Create) / `PATCH /forums/topics/{topicId}/update` (Update)
- **Access**: `forum.create` plus forum write capability `forum.can_post === true` unless Superuser

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Topic Title** (`forumsPage.topicTitle`) | `<input type="text">` | **Enforced Required** | `""` | `!title.trim()` | Free text | Subject line of discussion thread. |
| **Topic Body Content** (`forumsPage.topicContent`) | `TiptapEditor` (WYSIWYG) | **Enforced Required** | `""` | `!stripRichText(content)` | Formatted HTML | Full initial message with rich text, code, tables, embeds. |
| **File Attachments** (`forumsPage.attachmentsOptional`) | `FileUploadDropzone` (multiple) | Optional | `[]` | Multiple files | Any format | Uploaded as `attachments` or `new_attachments`. |
| **Existing Attachments** | `FilePreviewCard` list | Optional | Existing topic attachments | URL strings | URL strings | Removal tracked for server update. |

---

### Form 9.3: Topic Reply / Inline Discussion Post Form
- **File Reference**: `src/pages/Forums.tsx` (Lines 1050–1110, 2040–2150)
- **Route**: `/forums/:forumId/topics/:topicId`
- **Submission Endpoint**: `POST /forums/topics/{topicId}/posts` (Multipart `FormData`)
- **Access**: `forum.create` AND `forum.can_post === true` AND `topic.is_locked === false` (`canReplyToTopic`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Reply Message** | `TiptapEditor` | **Enforced Required** | `""` | `!stripRichText(replyContent)` | Formatted HTML | Inline rich text editor at the bottom of the topic thread. Blocked if topic is locked. |
| **Reply Attachments** | `FileUploadDropzone` | Optional | `[]` | Multiple files | Any file format | Sent as `attachments` in reply payload. |
| **Submit Button** | `<button type="submit">` | Action Trigger | N/A | Active when text is present and thread is unlocked | Action trigger | Label: `forumsPage.postReply` ("Post Reply"). |

---

### Form 9.4: Edit Post Reply Modal
- **File Reference**: `src/pages/Forums.tsx` (Lines 1120–1145, 1460–1520)
- **Route**: `/forums/:forumId/topics/:topicId`
- **Submission Endpoint**: `PATCH /forums/posts/{postId}`
- **Access**: `forum.edit` AND `post.author.id === user.id` unless Superuser

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Post Content** | `TiptapEditor` | **Enforced Required** | Existing post content | `!stripRichText(content)` | Formatted HTML | Modifies reply text. |
| **Attachments** | `FileUploadDropzone` | Optional | Existing post attachments | Multiple files | Any file format | Allows uploading replacement or additional attachments. |

---

## 10. Moderation Desk

### Form 10.1: Moderation Review & Decision Modal
- **File Reference**: `src/pages/Moderation.tsx` (Lines 60–120) & `src/pages/AdminPanel.tsx` (Lines 3340–3460)
- **Route**: `/admin` (Moderation tab) or `/moderation` (unrouted standalone component)
- **Submission Endpoint**: `POST /admin&modarator/moderation/moderate` (JSON: `{ post_id, action, reason }`)
- **Access**: Active Superuser (`canAccessModeration`)

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Moderation Action** | Radio buttons or action button triggers | **Enforced Required** | `"approve"` | Enum value | `"approve"`, `"reject"`, `"flag"` | Selects governance outcome. |
| **Moderator Explanation / Reason** (`moderation.reasonLabel`) | `<textarea>` | **Enforced Required on Reject / Flag** | `""` | `action !== 'approve' && !reason.trim()` | Free text | Stored in moderation audit logs (`/admin&modarator/moderation/logs`). |

---

## 11. Superuser System Configuration (Admin Panel)

### Form 11.1: System User Role Configuration Modal
- **File Reference**: `src/pages/AdminPanel.tsx` (Lines 2650–2750)
- **Route**: `/admin` (Roles & Permissions tab)
- **Submission Endpoints**: `POST /user/roles` (Create) / `PATCH /user/roles/{id}` (Update)
- **Access**: Active Superuser only

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Role Name** (`adminPanelPage.roleName`) | `<input type="text">` | **Enforced Required** | `""` | `!name.trim()` | Free text (e.g., "Commission President") | Human-readable role label. |
| **Role Slug** (`adminPanelPage.roleSlug`) | `<input type="text">` | **Enforced Required** | `""` | `!slug.trim()`. System slug format. | Lowercase alphanumeric string with underscores | Machine identifier (e.g. `president_commission`). |
| **Role Description** (`adminPanelPage.roleDescription`) | `<textarea>` | Optional | `""` | Free text | Multi-line text | Explanation of role scope. |

---

### Form 11.2: Role Permissions Matrix Editor
- **File Reference**: `src/pages/admin/AdminPermissionsEditor.tsx` (Lines 22–94)
- **Route**: `/admin` (Roles & Permissions tab, role sub-view)
- **Submission Endpoints**: `POST /user/permissions` (Create) / `PATCH /user/permissions/{id}` (Update)
- **Access**: Active Superuser only

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Feature Grants per Domain** (7 Features: `article`, `document`, `event`, `forum`, `training`, `technicopro`, `user`) | 4 Checkboxes per Feature: `can_view`, `can_create`, `can_edit`, `can_delete` | Optional Booleans | Current persisted values or `false` | Boolean flags | Checked (`true`) / Unchecked (`false`) | Each feature block has an independent "Save Permission" button. Disables while saving or querying. Refetches cache on save. |

---

### Form 11.3: Direct Member Permission Overrides Editor
- **File Reference**: `src/pages/admin/AdminPermissionsEditor.tsx` (Lines 22–94)
- **Route**: `/admin` (Roles & Permissions tab, member overrides sub-view)
- **Submission Endpoint**: `PATCH /user/user-permissions/{id}` for changed booleans on existing rows. POST creation is blocked pending an inheritance-safe backend contract; saved reset-to-inherit is unsupported.
- **Access**: Active Superuser only

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Per-User Overrides per Domain** (7 Features x 4 Actions) | Select controls with inherited and effective summaries | Optional explicit booleans on existing rows | Persisted action or Inherit | Changed booleans only; target profile must be resolved | Allow / Deny / Inherit | Null/omitted actions inherit. New rows are disabled. Saved explicit booleans cannot reset to Inherit until supported by the backend; unsaved changes can revert to their original inherited state. |

---

### Form 11.4: SMTP Email Server Settings Form
- **File Reference**: `src/pages/AdminPanel.tsx` (Lines 2280–2370)
- **Route**: `/admin` (Settings & Backups tab)
- **Submission Endpoint**: `PUT /settings/admin/smtp` (Content-Type: `application/json`)
- **Access**: Active Superuser only

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SMTP Host** (`adminPanelPage.smtpHost`) | `<input type="text">` | **Enforced Required** | Loaded from API | Hostname or IP string | Domain/IP (e.g. `smtp.example.com`) | SMTP server endpoint. |
| **SMTP Port** (`adminPanelPage.smtpPort`) | `<input type="number">` | **Enforced Required** | `587` | Integer `1–65535` | Standard ports: `25`, `465`, `587`, `2525` | Port number. |
| **SMTP Username** (`adminPanelPage.smtpUsername`) | `<input type="text">` | **Enforced Required** | Loaded from API | Non-empty string | Account username / API key | SMTP login identity. |
| **SMTP Password** (`adminPanelPage.smtpPassword`) | `<AdminPasswordField>` | **Enforced Required** | Loaded from API | Non-empty string | Secret key string | Password field with accessible toggle button. |
| **Encryption Protocol** (`adminPanelPage.smtpEncryption`) | `<select>` dropdown | **Enforced Required** | `"tls"` | Enum values | `"tls"`, `"ssl"`, `"none"` | Security transport layer. |
| **Default Sender Email** (`adminPanelPage.smtpFromEmail`) | `<input type="email">` | **Enforced Required** | Loaded from API | Valid email address | Valid email string | Default `From:` header for extranet notifications. |
| **Default Sender Name** (`adminPanelPage.smtpFromName`) | `<input type="text">` | Optional | `"ARCHICOPRO"` | Free text | Text string | Display name on outgoing emails. |

---

### Form 11.5: SMTP Live Test Dispatch Form
- **File Reference**: `src/pages/AdminPanel.tsx` (Lines 2375–2410)
- **Route**: `/admin` (Settings & Backups tab)
- **Submission Endpoint**: `POST /settings/admin/smtp/test`
- **Access**: Active Superuser only

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Recipient Test Email** (`adminPanelPage.testEmailInput`) | `<input type="email">` | **Enforced Required** | `""` | Non-empty valid email string | Any deliverable email address | Sends a live diagnostic test message through the configured SMTP server. |

---

### Form 11.6: Database & Asset Backup Configuration Modal
- **File Reference**: `src/pages/AdminPanel.tsx` (Lines 2520–2610)
- **Route**: `/admin` (Settings & Backups tab)
- **Submission Endpoint**: `PUT /settings/admin/backups/configuration`
- **Access**: Active Superuser only

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Backup Frequency** (`adminPanelPage.backupSchedule`) | `<select>` dropdown | **Enforced Required** | `"daily"` | Enum values | `"daily"`, `"weekly"`, `"monthly"` | Cron schedule frequency for automatic backups. |
| **Retention Count** (`adminPanelPage.backupRetention`) | `<input type="number">` | **Enforced Required** | `7` | Positive integer `>= 1` | `1` to `365` | Maximum number of historic archives to retain before purging. |
| **Include Media Files** (`adminPanelPage.backupMedia`) | `<input type="checkbox">` | Optional | `true` | Boolean flag | Checked (`true`) / Unchecked (`false`) | When checked, archives user avatars, documents, and content images in addition to database dumps. |

---

## 12. Global Search Component

### Form 12.1: Omnibox Global Header Search
- **File Reference**: `src/layouts/DashboardLayout.tsx` (Lines 799–846)
- **Component**: Top navigation bar header search box
- **Submission Endpoint**: `GET /dashboard/search?q={query}&limit=10`
- **Access**: All authenticated members

| Field Name / Label | Input Component Type | Required / Optional | Default Value | Validation & Format | Allowed Values / Options | Notes & Source Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Search Query** (`layout.searchPlaceholder`) | `<input type="text">` | Optional Trigger | `""` | 300ms automatic debouncing; Enter key triggers immediate search; Escape closes popover | Free search string | Queries articles, forum topics, posts, calendar events, training courses, and document files. Filters results by user's viewing permissions. |

