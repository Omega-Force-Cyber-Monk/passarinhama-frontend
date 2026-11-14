# Agenda and category management UI

## Shared category workflow

`src/components/ui/CategoryManagerDialog.tsx` owns the list, form, and delete-confirmation workflow. The parent contains only category rows, loading/error/empty states, and management actions. Add/edit/delete open a child native modal dialog; the parent stays open and inert behind the active child. Native modal stacking handles focus containment and Escape. The component restores trigger focus, falls back to a parent action after a row disappears, locks document scrolling with a dialog count, and blocks dismissal while a request is pending.

Forms reset when Add/Edit is opened, retain values on failure, and display backend validation details inline. A synchronous pending guard prevents duplicate submissions. Only successful requests close the child. Fields remain module-specific: the three content modules submit name/description only, while Agenda also supports color_code. Categories without a color field use a neutral yellow list indicator.

Each page supplies its existing RTK Query callbacks and query state. Existing tag invalidation refreshes categories; no extra success refetch or new endpoint was added. Displayed row ordering is retained across edits/refetches, with newly discovered IDs appended.

| Module | Existing hooks | Existing category permission gate retained |
| --- | --- | --- |
| Agenda | Event category query/create/update/delete | Active superuser for mutations; event view for category reads |
| Articles | Article category query/create/update/delete | Superuser |
| Trainings | Training category query/create/update/delete | Existing canManageCategories policy |
| TechnicoPro | TechnicoPro category query/create/update/delete | Existing canManageCategories policy |

Deletion keeps existing module-specific selection behavior. Server authorization and related-resource deletion rules remain authoritative; no cascade logic was introduced. Existing category queries still request 100 records, matching the previous implementation.

## Agenda layout

The main layout uses the actual page container width, with a stacked layout below 64rem and a calendar plus 16–19rem upcoming panel above it. Header actions and calendar controls wrap. The calendar is a seven-column semantic table without a fixed minimum width or horizontal scrolling. At calendar widths below 36rem, abbreviated weekdays and event counts replace title chips; selecting a count opens the existing day list with every event and its original details navigation. Larger calendars retain title chips and a More action. Today styling and category colors remain in place.

Upcoming rows use keyboard-accessible buttons, compact date badges, and bounded title/location text. Calendar/upcoming loading and error states remain accessible. EN/FR strings are included for the shared workflow and new calendar labels.

## Manual verification

No application, server, build, unit/UI test, browser, screenshot, live API request, or package installation was run. Only source inspection, static syntax inspection, and whitespace review were performed. No reference screenshots were present in the provided attachment.

Verify the following manually:

- All four category managers: list loading/errors/empty states; add/edit/delete success and backend validation failures; retained inputs; duplicate-submit protection; updated lists; preserved ordering.
- Stacked dialog keyboard focus, Shift+Tab/Tab, Escape, backdrop dismissal, disabled dismissal while saving, focus restoration, and scroll locking in the supported browsers (native HTML dialog support is required).
- Existing role restrictions and related-content deletion errors.
- Agenda at 320px phones through desktop, including the sidebar reducing available width; long names/locations; month/year and previous/next navigation; today and category colors; multiple/multiday events and compact day-list access.
- Event creation/editing/details/registration, category selection, and EN/FR language changes.
