# Frontend Requirements

Source document used as reference, not as instructions: `Archicopro_Specifications_Forums_News_Training_EN.pdf`

Project files checked:

- `src/layouts/DashboardLayout.tsx`
- `src/routes/index.tsx`
- `src/pages/Articles.tsx`
- `src/pages/Forums.tsx`
- `src/pages/Trainings.tsx`
- `src/pages/Agenda/Agenda.tsx`
- `src/redux/features/articles/articlesApi.ts`
- `src/redux/features/trainings/trainingsApi.ts`
- `src/redux/features/events/eventsApi.ts`
- `src/redux/features/events/eventTypes.ts`
- `src/i18n/locales/en.json`
- `src/i18n/locales/fr.json`

## Confirmed Current Project State

- The app uses `Articles`, not a separate `News` route. The source says: "News / Articles = actualités (French)".
- Current routes include `/dashboard`, `/forums`, `/articles`, `/agenda`, `/events`, `/trainings`, `/documents`, `/moderation`, `/admin`, and `/directory`.
- The current left navigation is built in `DashboardLayout.tsx`.
- Dashboard is currently added for superusers.
- Moderation is currently added when `canAccessModeration` is true.
- Current navigation order in code does not match the requested source order.
- Forum data is fetched dynamically through `useGetForumsQuery`.
- Article categories are fetched dynamically through `useGetArticleCategoriesQuery`.
- Training currently has no category type or category-fetching API in the frontend code.
- Agenda event types are currently hard-coded in the form as `general`, `training`, `commission`, and `board`.
- Agenda translations currently include labels for those four event types.
- The frontend already has event registration and unregistration API calls.
- The frontend shows a success toast after event registration, but no member/admin notification behavior is visible in the checked frontend code.

## Navigation Requirements

- Update the left-hand navigation to follow the source order:
  1. Home
  2. Calendar
  3. Articles
  4. Forums
  5. Training
  6. Technicopro
  7. Documents
  8. Members
  9. Administration
- Remove Dashboard from the visible left navigation.
- Remove Moderation from the visible left navigation.
- Do not remove routes unless that is separately requested; the source only says "Delete dashboad" and "Delete moderation", and the checked project shows both as visible navigation entries.
- Add or expose Technicopro in navigation only after confirming whether it should be a standalone route, a forum section, or another existing feature. The checked project only shows Technicopro as labels/roles, not as a standalone route.

## Forums Requirements

From the source:

- Forums are the reference behavior for the other sections.
- Keep an "All forums" section.
- Keep one dedicated section for each forum/category.
- Provide direct access to each section.
- Use the same left-hand navigation logic.

Confirmed in project:

- Forums already have dynamic API support via `getForums`.
- Forums have create, edit, delete, and permissions UI/API flows.
- Forum topics are fetched by `forumId`.

## Articles / News Requirements

From the source:

- Articles/News must use the same navigation logic as Forums.
- Show "All news".
- Show a clickable section for each News category.
- Clicking a category displays only articles in that category.
- "All news" displays all articles.
- Creating a category in Administration must automatically show it under News/Articles.
- Deleting a category must automatically remove it from the menu.
- No manual menu update should be required after category creation.
- The article/detail display should follow the same interaction and presentation logic as Forum topics.

Confirmed in project:

- Article categories already exist in the frontend API layer.
- Article category objects currently include `id`, `name`, optional `color_code`, and optional `created_at`.
- Article create/update forms use `category_id`.
- Article category create, update, and delete mutations already exist.

Implementation gap to verify before building:

- The checked `getArticles` query currently supports `page`, `pageSize`, and `status`; it does not show a category filter parameter in the TypeScript contract.
- The source says categories should appear in the left-hand menu, but the current `DashboardLayout.tsx` only renders top-level navigation items.

## Training Requirements

From the source:

- Training must follow the same logic as News/Articles and Forums.
- Show "All training".
- Show a clickable section for each Training category.
- Clicking a category displays only Training content in that category.
- "All training" displays all Training content.
- Creating a Training category in Administration must automatically show it under Training.
- Deleting a category must automatically remove it from the menu.

Source clarification:

- For this scope, Training means editorial/informational content.
- The following are not mandatory for this requested behavior:
  - Start date
  - End date
  - Training session management
  - Registration
  - Participant management
  - Attendance tracking
  - Calendar/session scheduling

Confirmed in project:

- Current Training frontend is implemented as a scheduled/session-like module.
- Current Training types include `training_date`, `end_date`, `duration_hours`, `max_attendees`, attendee counts, registration state, and attachments.
- Current Training API has create, update, delete, register, unregister, permissions, upcoming list, all list, and get-by-id.
- No Training category type, `category_id`, or category CRUD API was found in the checked frontend files.

Implementation gap to verify before building:

- Whether existing Training session fields should remain, become optional, or be hidden for this editorial use case.
- What backend contract will expose Training categories.

## Administration UI Requirements

From the source:

- Administrators must be able to create, edit, and delete categories.
- Administrators must be able to reorder categories if that functionality already exists for Forums.
- Administrators must manage content associated with each category.
- Category changes must automatically update the left-hand menu.

Confirmed in project:

- Article category create, edit, and delete UI exists in `Articles.tsx`.
- Forum create, edit, delete, and permissions UI exists in `Forums.tsx`.
- I did not find Training category management in the checked files.
- I did not confirm any existing category reorder UI.

## Calendar / Agenda Requirements

From the source:

- Add the requested Agenda categories with different colors.
- Add a "Category" button on the calendar view.
- The button opens a popup explaining categories and colors.
- The popup should use the new brand guidelines.
- In French language mode, use the 24-hour clock / French format.

Confirmed in project:

- Current Agenda event types are hard-coded in the create/edit form.
- Current event type values shown in code are `general`, `training`, `commission`, and `board`.
- The event time picker already uses 24-hour values from `00` to `23`.
- Stored locale is available as `localeCode`, with French using `fr-FR`.

Requested French labels from source:

- ApériCAC
- Assemblée générale
- Commissions
- Conférences, colloques, etc.
- Conseil d'administration
- Fête de la compagnie
- Formations Abaque "Abaque formation"
- Formations Abaque "Compagnie"
- Formations Abaque "Partenaire"
- Formations du vendredi après-midi
- Salons
- Sorties

Requested English labels from source:

- ApériCAC
- General Meeting
- Committees
- Conferences, symposia, etc.
- Board of Directors
- Company Party
- Abaque Training: "Abaque Training"
- Abaque Training: "Company"
- Abaque Training: "Partner"
- Friday Afternoon Training Sessions
- Trade Shows
- Outings

Descriptions from source:

| Category | Description |
| --- | --- |
| ApériCAC | rencontre apéro dans une agence |
| Assemblée générale | Réunion des commissions |
| Commissions | Réunion des commissions |
| Conférences, colloques, etc. | |
| Conseil d'administration | Réunion du Conseil d'administration |
| Fête de la compagnie | |
| Formations Abaque "Abaque formation" | contenus pour architecte et MOE oeuvrant en copropriété. Renseignements et inscriptions : abaque@archicopro.com |
| Formations Abaque "Compagnie" | contenus spécialement conçus pour la CAC. Les membres sont prioritaires pour les inscriptions. Renseignements et inscriptions : abaque@archicopro.com |
| Formations Abaque "Partenaire" | offre complémentaire avec tarifs négociés pour la CAC. Renseignements et inscriptions : abaque@archicopro.com |
| Formations du vendredi après-midi | Calendrier des formations |
| Salons | |
| Sorties | |

Open item:

- The source asks for colors but does not provide color values in extracted text. Colors need brand-guideline values or confirmation before implementation.

## Bug / Follow-Up Items From Source

- Clicking a document folder triggers a PDF download.
- Uploading a document to an article changes the filename and removes the extension.
- Event signup as a member did not send a notification to the member or administrator.
- The source says more bugs may be identified later.

## Acceptance Criteria From Source

- A News category created in Administration automatically appears under News.
- A Training category created in Administration automatically appears under Training.
- Clicking a category displays only the corresponding content.
- "All news" displays all News articles.
- "All training" displays all Training content.
- Deleting a category removes it automatically from the menu.
- The three modules use consistent navigation logic.
- No manual menu configuration is required after creating a category.
- Dashboard is removed from the visible navigation.
- Moderation is removed from the visible navigation.
