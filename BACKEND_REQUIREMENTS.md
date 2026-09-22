# Backend Requirements

Source document used as reference, not as instructions: `Archicopro_Specifications_Forums_News_Training_EN.pdf`

Frontend files checked for current API contracts:

- `src/redux/features/forum/forumApi.ts`
- `src/types/forum.ts`
- `src/redux/features/articles/articlesApi.ts`
- `src/redux/features/articles/articleTypes.ts`
- `src/redux/features/trainings/trainingsApi.ts`
- `src/redux/features/trainings/trainingTypes.ts`
- `src/redux/features/events/eventsApi.ts`
- `src/redux/features/events/eventTypes.ts`
- `src/redux/features/notifications/notificationsApi.ts`
- `src/redux/features/notifications/notificationTypes.ts`

This repository appears to be the frontend project. Backend requirements below are derived only from the attachment plus the frontend API contracts currently referenced by this project.

## Confirmed Current Frontend API Contracts

Forums:

- `GET /forums/forums`
- `POST /forums/forums`
- `PATCH /forums/forums/{forum_id}`
- `DELETE /forums/forums/{forum_id}`
- `GET /forums/forums/{forumId}`
- `GET /forums/forums/{forumId}/topics`

Articles:

- `GET /articles/articles`
- `GET /articles/article-categories`
- `POST /articles/article-categories?name={name}`
- `PATCH /articles/article-categories/{id}?name={name}`
- `DELETE /articles/article-categories/{id}`
- `POST /articles/articles`
- `PATCH /articles/articles/{id}`
- `DELETE /articles/articles/{id}`
- `POST /articles/articles/{id}/publish`
- `POST /articles/file-upload`
- `POST /articles/file-delete`

Training:

- `GET /trainings/trainings/upcoming`
- `GET /trainings/trainings`
- `GET /trainings/trainings/{id}`
- `POST /trainings/trainings`
- `PATCH /trainings/trainings/{id}`
- `DELETE /trainings/trainings/{id}`
- `POST /trainings/trainings/{id}/register`
- `DELETE /trainings/trainings/{id}/register`

Events:

- `GET /events/events/upcoming`
- `GET /events/events/calendar-stats`
- `GET /events/events`
- `GET /events/events/{id}`
- `POST /events/events`
- `PATCH /events/events/{id}`
- `DELETE /events/events/{id}`
- `POST /events/events/{id}/register`
- `DELETE /events/events/{id}/register`
- `GET /events/events/{id}/registrations`

Notifications:

- `GET /settings/notifications/preferences`
- `PATCH /settings/notifications/preferences`

## Common Category Requirement

From the source:

- Forums, News/Articles, and Training must use a consistent navigation model.
- Creating an element/category in Administration must automatically create/display the corresponding section in the left-hand menu.
- Editing or deleting the element/category must automatically update the left-hand menu.
- No manual menu configuration should be required.

Source table:

| Module | Element Created | Content Displayed |
| --- | --- | --- |
| Forums | Forum | Topics / messages |
| News | Category | Articles |
| Training | Category | Content |

## Forums Backend Requirements

From the source:

- Keep Forums as the reference behavior.
- Support "All forums".
- Support dedicated sections for each forum/category.
- Support direct access to each section.

Confirmed from current frontend contract:

- Forums are already represented as backend resources through `/forums/forums`.
- Forum list items include fields currently consumed by the frontend: `id`, `name`, `slug`, `author_name`, `description`, `forum_type`, `thumbnail_url`, `topic_count`, `post_count`, `last_activity_at`, and `can_post`.
- Forum topics are fetched by forum ID.

## Articles / News Backend Requirements

From the source:

- Administrators must be able to create, edit, and delete News categories.
- A created News category must automatically appear under News/Articles.
- Deleting a category must remove it from the menu.
- Clicking a category must display only the articles belonging to that category.
- "All news" must display all articles.

Confirmed from current frontend contract:

- Article categories currently exist at `/articles/article-categories`.
- The current frontend `ArticleCategory` type includes `id`, `name`, optional `color_code`, and optional `created_at`.
- Articles currently include `category_id` and optional `category`.
- The current frontend article list query supports `page`, `page_size`, and `status`.

Backend gap to resolve:

- The frontend contract checked here does not include a category filter parameter for `GET /articles/articles`. If category filtering is already supported by the backend, the frontend type/query needs to be updated to use it. If not, backend support is required.

## Training Backend Requirements

From the source:

- Administrators must be able to create, edit, and delete Training categories.
- A created Training category must automatically appear under Training.
- Deleting a category must remove it from the menu.
- Clicking a category must display only Training content belonging to that category.
- "All training" must display all Training content.
- Training should be understood as editorial/informational content for this requested scope.

Source says these Training features are not mandatory:

- Start date
- End date
- Training session management
- Registration
- Participant management
- Attendance tracking
- Calendar/session scheduling

Confirmed from current frontend contract:

- Current Training data is session-like and includes `training_date`, `end_date`, `duration_hours`, `max_attendees`, registration state, attendee counts, and attachments.
- Current Training API contract has no category endpoint and no `category_id` field in `Training` or `TrainingRequest`.

Backend gap to resolve:

- Add or confirm a Training category contract before frontend implementation.
- Confirm whether the existing Training session fields should remain required, become optional, or be replaced for editorial/informational content.

## Administration Backend Requirements

From the source:

- Support category creation.
- Support category editing.
- Support category deletion.
- Support category reordering if already available for Forums.
- Support management of content associated with each category.
- Category create/edit/delete operations must be reflected automatically in data used by the left-hand menu.

Confirmed from current frontend contract:

- Article category create/edit/delete APIs exist in the frontend contract.
- Forum create/edit/delete APIs exist in the frontend contract.
- Training category APIs were not found in the frontend contract.
- Category reorder APIs were not found in the checked frontend files.

## Calendar / Agenda Backend Requirements

From the source:

- Add the requested event categories with different colors.
- Support data needed for a frontend popup explaining categories and colors.
- Support French and English labels.

Confirmed from current frontend contract:

- Event type is currently sent as `event_type`.
- Current frontend event type values are `general`, `training`, `commission`, and `board`.
- Current `Event.event_type` type allows the four known values or any string.
- No event-category list endpoint was found in the checked frontend files.

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

Backend gap to resolve:

- The source asks for different colors but does not provide actual color values in the extracted text. Color values must come from brand guidelines or user confirmation.
- Confirm whether event categories should remain as static `event_type` strings or become backend-managed category records.

## Notifications Requirement

From the source:

- When a member signs up for an event on the calendar, the member should receive a notification.
- The administrator should also receive a notification.

Confirmed from current frontend contract:

- Event registration exists at `POST /events/events/{id}/register`.
- Notification preference APIs exist.
- Notification preference types include `new_event`, but the checked frontend code does not confirm delivery of event registration notifications.

Backend gap to resolve:

- Confirm or implement notification creation/delivery for event registration, for both the registering member and administrator.

## Document / Upload Bug Requirements

From the source:

- Clicking a document folder currently triggers a PDF download.
- Uploading a document to an article changes the filename and removes the extension.

Backend/frontend boundary to verify:

- The folder-click issue may be frontend routing/click handling, backend file metadata, or both.
- The article filename/extension issue may be caused by upload response data, storage naming, or frontend display logic.

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
