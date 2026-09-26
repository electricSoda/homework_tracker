# Homework Tracker

A deliberately small, one-page React tracker designed to work as a normal website **or inside an iframe**. The current app is single-user and local-first: no account, no backend, no vendor lock-in.

## Run it

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## What is implemented

- One-page master view sorted by urgency.
- Spreadsheet-inspired priority ratio: `hours until deadline / hours of unfinished work`.
- Progress slider changes the denominator, so a mostly-finished assignment naturally drops in urgency.
- Inline editing for task title, deadline, estimated minutes, and progress.
- Add/delete tasks without navigating away.
- Deadline precision down to the minute.
- Daily/weekly recurring tasks, with next-occurrence advancement after completion.
- A small study planner that allocates a chosen block (30/60/90 minutes) to unfinished work using urgency + remaining workload.
- Color-coded urgency states: overdue, critical, urgent, soon, later.
- Local persistence in `localStorage`.
- JSON backup export/import so the local-first version is still portable.
- Responsive layout using CSS container queries, so it collapses cleanly when embedded in a narrow iframe/sidebar.
- Integration seam for a future Google Calendar provider.

## Architecture

The project intentionally avoids a large component/UI framework.

- `src/domain/` contains task math, recurrence, and scheduling logic. These files do not know anything about React or storage.
- `src/storage/` contains the persistence adapter. Today this is localStorage; a Supabase adapter can replace it later.
- `src/integrations/` contains future external-service adapters such as Google Calendar.
- `src/components/` is the presentation layer.

That separation is the main future-proofing mechanism: adding Google Calendar, smarter scheduling, accounts, or a cloud database should not require rewriting the core task model.

## Priority model

For an unfinished task:

`priorityRatio = hoursUntilDeadline / (estimatedHours * remainingFraction)`

Lower values are more urgent. An overdue task is always surfaced first. Completed work is sorted to the bottom.

The study planner uses the same signal plus remaining workload, then greedily allocates 10–45 minute chunks inside the amount of time you say you have. It is intentionally deterministic rather than pretending it can perfectly optimize your life. A future Calendar adapter can supply actual free windows without changing the scoring code.

## Free deployment plan

## Integrating with Supabase (optional)

This app includes a Supabase-capable storage adapter. To enable Supabase syncing, set the following Vite environment variables in your local environment or CI (for local development add them to a .env file with VITE_ prefix):

- VITE_SUPABASE_URL — your Supabase project URL
- VITE_SUPABASE_ANON_KEY — your Supabase anon/public API key

The adapter expects a table named `tasks` with at least these columns:

- id (primary key text or uuid)
- data (jsonb) — the task object will be stored here
- updated_at (timestamptz) — used to order rows when loading

If the Supabase environment is not configured or the remote table is unavailable, the app continues to work in a local-first mode and keeps timestamped local JSON backups under localStorage keys starting with `cmu-homework-tracker:v1:backup:`.

When enabled, saves are persisted locally immediately and synced to Supabase in the background. At startup the app will return the local data synchronously and will then attempt to pull remote data: if the remote data differs, it will overwrite localStorage with a backup created first.

This approach is intentionally conservative to avoid data loss while providing a simple sync path.

## Free deployment plan

### Phase 1 — now

Deploy the Vite build as a static site on **Cloudflare Pages**. The Free plan currently allows static Pages assets with no request charge, supports Git-based deployments, and allows up to 500 builds/month. See Cloudflare's current Pages limits/pricing docs.

The app can stay completely client-side. Your tasks live in your browser's localStorage, so there is no database bill and no auth system to maintain.

Because localStorage is device/browser-specific, use the built-in JSON backup when moving machines or reinstalling a browser.

### Phase 2 — when you want multi-device sync

Keep the same UI and domain code, but replace the storage adapter with Supabase Postgres. Supabase's current Free plan includes a Postgres database, with 500 MB database size per project and 5 GB egress; free projects can pause after inactivity, so this is better treated as a free personal sync backend than as an uptime guarantee.

A future synced schema can be as small as:

```text
tasks
  id uuid primary key
  title text
  course text
  due_at timestamptz
  estimate_minutes integer
  progress integer
  recurrence jsonb
  created_at timestamptz
  updated_at timestamptz
```

Do not add authentication until it is actually needed. For one person, an anonymous per-device install is simpler. If you later add Google sign-in, the repository boundary means the rest of the app can stay mostly unchanged.

## Google Calendar / iframe direction

The app itself is iframe-friendly: it does not assume a fixed viewport, uses container queries, and has no page-to-page routing. You can host it at a stable HTTPS URL and embed that URL from another app or browser extension.

For **Google Calendar specifically**, the current Google Workspace documentation says Google Workspace add-ons that extend Calendar use the Card framework rather than arbitrary iframe UI. Google's broader Workspace extension docs distinguish iframe-capable integrations from Calendar add-ons. So the clean future path is:

1. Keep this app as the canonical task UI.
2. Add a thin Google Calendar integration layer that reads busy windows and creates study blocks.
3. For a Calendar sidebar, build the appropriate Workspace extension/Calendar add-on shell around the same domain logic, or use a browser-extension shell if you specifically need the existing React UI rendered as an iframe.

The React code is intentionally separated so that integration layer can be added later.
