# Developer Guide — Daily Ledger

> Read this if you're new to the project and will maintain or extend it. It
> explains **what** the app is, **how** it's built, **why** the key decisions
> were made, and **where** to change things. Pair it with:
> - [README.md](./README.md) — feature overview & data model summary
> - [SETUP.md](./SETUP.md) — get it running on a fresh machine
> - [USAGE.md](./USAGE.md) — how the shop-floor supervisor uses it

---

## 1. What this project is (domain context)

A small factory that makes **RCC spun concrete pipes** keeps a **handwritten
daily production register**. This app digitizes that register.

The paper register, per day, has three parts:

1. **Production table** — rows are pipe sizes/categories (`150/3`, `200/3`, …
   `1000/3`, plus `PILLAR`, `F.J.`), columns are machines. Each filled cell also
   names the **contractor** (a crew/person, written in Hindi) who made that batch.
2. **Raw materials** per size — optional numbers (Cutting Oil, 20mm, 10mm, Jeera,
   Dust, …).
3. **Fuel/consumables** per machine per day — Opening / Consumed / Closing for
   **cement (सीमेंट)** and **diesel (डीजल)**.

Two domain facts drive the whole design:

- **Contractors are not permanent staff.** Their names change over time and they
  "float" — the same contractor can work different machines and different pipe
  sizes on the same day. So a contractor is its **own entity**, and each
  production record links independently to a contractor, a machine, and a pipe
  size.
- **There is no universal "cement per pipe" number.** It depends on the plant's
  own mix design and pipe wall volume. So the cement standard is **entered by the
  plant**, never hardcoded — and it's **versioned by date** so historical reports
  stay correct when the standard changes.

The later-added **cement-yield reconciliation** feature answers: *per machine /
contractor, did the cement actually drawn from the godown match what the pipes
that were actually produced should have needed?* — to catch waste or miscounting.

---

## 2. Tech stack (and why)

| Layer | Choice | Why |
|---|---|---|
| UI | **React 18 + Vite** | Fast dev, simple SPA build, no framework server needed. |
| Data/Auth | **Supabase** (hosted Postgres + Auth + PostgREST) | Free tier, SQL you control, an auto-generated REST API and JS client — **no backend code to write or host**. |
| Charts | **Recharts** | Lightweight, declarative, readable plain charts. |
| Routing | **react-router-dom** | Three pages, client-side. |
| Hosting | **Vercel Hobby (free)** | Serves the static `dist/` build. No serverless functions used. |

**Mental model:** this is a **client-only SPA**. There is no custom server. The
browser talks directly to Supabase's REST API using the JS client, and Postgres
**Row Level Security (RLS)** is what keeps that safe. "Backend logic" lives in two
places only: the **SQL schema** (constraints, the fuel-log unique key, triggers)
and the **React data-access code**.

---

## 3. High-level architecture

```
                Browser (React SPA, built by Vite, hosted on Vercel)
                │
                │  @supabase/supabase-js  (HTTPS + anon key + user JWT)
                ▼
       ┌───────────────────────────────────────────────┐
       │                  Supabase                       │
       │  Auth (email/password, one supervisor user)     │
       │  Postgres + PostgREST  ── RLS policies ──▶ tables│
       └───────────────────────────────────────────────┘
```

- The app authenticates the supervisor; Supabase issues a JWT; every query
  carries it. RLS policies allow any **authenticated** user to read/write (v1 is
  single-tenant — see §7).
- All aggregation for reports happens **client-side** in the browser (see
  `Dashboard.jsx`) over rows fetched for the selected date range. This keeps the
  DB simple and stays within free limits; the datasets per range are small.

---

## 4. Repository map (file by file)

```
digitalLedger/
├── index.html                # Vite HTML entry; loads Google Fonts; sets <title>
├── package.json              # deps + scripts (name slug: "daily-ledger")
├── vite.config.js            # React plugin; dev server on 0.0.0.0:5173 (LAN)
├── vercel.json               # Vite preset + SPA rewrite (all routes -> index.html)
├── .env.example              # copy to .env; holds Supabase URL + anon key
├── .gitignore
│
├── supabase/
│   └── schema.sql            # ← THE database. One file. Run once. (see §5)
│
├── src/
│   ├── main.jsx              # React root; wraps <App/> in <BrowserRouter>
│   ├── App.jsx               # config check, auth gate, top nav, route table
│   ├── index.css             # the ENTIRE design system (no CSS framework)
│   │
│   ├── components/
│   │   ├── Login.jsx         # email/password sign-in (supabase.auth)
│   │   └── Toast.jsx         # ToastProvider + useToast() — tiny notifications
│   │
│   ├── lib/
│   │   ├── supabaseClient.js # creates the client; exports `supabase`, `isConfigured`
│   │   ├── useMasters.js     # hook: load machines/sizes/contractors/app_settings
│   │   ├── constants.js      # DEFAULT_ORG_ID, FUEL_TYPES, CATEGORIES, tag helper
│   │   ├── dates.js          # ISO date helpers + range presets (timezone-safe)
│   │   ├── fetchAll.js       # paginated range fetch (>1000 rows safe)
│   │   ├── csv.js            # dependency-free CSV builder + browser download
│   │   └── cementStandards.js# effective-dated standard resolver
│   │
│   └── pages/
│       ├── EntryForm.jsx     # the daily entry screen (production + fuel + tags)
│       ├── Dashboard.jsx     # reports + charts + CSV + reconciliation
│       └── Settings.jsx      # manage masters + cement standard + RM toggles
│
├── README.md  SETUP.md  USAGE.md  DEVELOPER_GUIDE.md (this file)
```

If you're trying to find where something happens:

| I want to change… | Look in |
|---|---|
| A database table/column/index/policy | [supabase/schema.sql](./supabase/schema.sql) |
| Colors, fonts, spacing, table/grid styling | [src/index.css](./src/index.css) |
| Top nav, routes, auth gate | [src/App.jsx](./src/App.jsx) |
| The daily entry grid / fuel / save logic | [src/pages/EntryForm.jsx](./src/pages/EntryForm.jsx) |
| Any report, chart, CSV, or reconciliation math | [src/pages/Dashboard.jsx](./src/pages/Dashboard.jsx) |
| Master-data management + cement standards UI | [src/pages/Settings.jsx](./src/pages/Settings.jsx) |
| How reference data is loaded everywhere | [src/lib/useMasters.js](./src/lib/useMasters.js) |

---

## 5. The database (`supabase/schema.sql`)

**One file, run once** in the Supabase SQL Editor. It is idempotent except the
seed rows for machines/sizes/contractors (documented at the bottom of the file).
There are **no migrations** — if you change the schema, edit this file and
apply the change to your Supabase project.

### Tables

| Table | Key columns | Notes |
|---|---|---|
| `machines` | `id, org_id, name, active` | `active=false` = archived (soft delete). |
| `pipe_sizes` | `id, label, category, sort_order, active` | `category` ∈ `S&S`/`PILLAR`/`F.J.`; `sort_order` controls grid order. |
| `contractors` | `id, name, active, created_at` | **Never hard-deleted** — only `active=false`. Devanagari names. |
| `production_entries` | `date, machine_id, pipe_size_id, contractor_id, good_qty, reject_qty, raw_materials(jsonb)` | One grid cell. All three FKs **independent**. `raw_materials` is optional JSONB. |
| `fuel_logs` | `date, machine_id, fuel_type, opening, consumed, closing` | `fuel_type` is enum `('cement','diesel')`. **`unique(org_id,date,machine_id,fuel_type)`** enables upsert-on-edit. |
| `cement_standards` | `pipe_size_id, bags_per_pipe, effective_date` | **Effective-dated** standard (see §6.3). Editing = insert new row. |
| `fuel_log_contractors` | `fuel_log_id, contractor_id` | Many-to-many tag: who operated a machine when its cement was drawn. `ON DELETE CASCADE`. |
| `app_settings` | `org_id, raw_material_fields(jsonb)` | Single row. Which optional raw-material fields show in the entry form. |

### Design decisions worth understanding

- **`org_id` everywhere, defaulted to one fixed UUID**
  (`00000000-0000-0000-0000-000000000001`). v1 is single-tenant and the UI never
  shows it, but its presence means multi-tenant can be added later **without a
  schema rewrite** — you'd only swap the RLS policies and start setting a real
  `org_id`.
- **Soft delete / archive, never hard delete** for masters, so old reports keep
  the exact name/label that was in use.
- **Indexes** on `production_entries` cover the report access patterns:
  `(date)`, `(contractor_id,date)`, `(pipe_size_id,date)`, `(machine_id,date)`.
- **`updated_at` triggers** on `production_entries` and `fuel_logs`.
- **RLS**: every table has RLS enabled and a single policy created in a `DO`
  loop — `for all to authenticated using (true) with check (true)`. See §7.

---

## 6. Key domain logic (the non-obvious parts)

These are the things most likely to confuse a newcomer. Read this section before
editing `EntryForm.jsx` or `Dashboard.jsx`.

### 6.1 Bilingual / Devanagari
Labels are English + Hindi (e.g. `Cement · सीमेंट`). Free-text fields
(contractor names) accept Devanagari. Fonts are loaded in `index.html`
(Roboto Slab for headings, Inter for data, **Noto Sans Devanagari** fallback).
CSV export prepends a **UTF-8 BOM** (`csv.js`) so Excel renders Hindi correctly.

### 6.2 How a day is saved (`EntryForm.jsx → save()`)
A "day" spans three tables. The save uses different strategies per table:

- **Production** → **delete-all-then-insert** for that `date`. Simple and correct
  for a single-supervisor register; avoids fiddly row diffing. (Trade-off: not
  safe for concurrent editors — fine for v1's single login.)
- **Fuel** → **upsert** on the unique key `(org_id,date,machine_id,fuel_type)`.
  Upsert (not delete/insert) is deliberate: it **keeps the `fuel_logs.id` stable**
  across edits, which matters because `fuel_log_contractors` references it.
- **Contractor tags** → after upserting fuel, the code **re-selects** the cement
  fuel-log ids for the day (upsert doesn't reliably return them), deletes their
  existing `fuel_log_contractors`, and inserts the current tags.

`loadDay()` is the inverse: it fetches the day's production, fuel, and the
cement logs' contractor tags, and rehydrates the form. Editing an existing day
and re-saving just repeats this cycle.

Other entry-form details:
- **Closing auto-suggest**: `setFuelField` computes `closing = opening − consumed`
  unless the user has manually edited closing (`closingTouched`).
- **Validation** (`validation` memo): blocks negatives and incomplete rows
  (errors); warns—but allows—inconsistent closing (manual override is a feature).
- **`optionsFor(list, selectedId)`**: dropdowns show only `active` items **plus**
  the currently-selected one even if it was since archived, so editing an old day
  never silently drops a value.

### 6.3 Effective-dated cement standards (`cementStandards.js`)
The plant's "bags per pipe" changes over time, and **changing it must not rewrite
past reports.** So instead of a single editable value per size, we store a
**history**: each edit inserts a new `cement_standards` row with an
`effective_date`.

`buildStandardResolver(rows)` returns a function `resolve(pipeSizeId, dateISO)`
that picks the row with the **latest `effective_date ≤ dateISO`**. A report for
1 March uses the standard that was effective on 1 March, even if it was changed
in April. The schema seeds a baseline `0` effective `2000-01-01` so every size
has a defined value for all of history until real numbers are entered.

The Settings UI (`CementStandardSettings`) shows the currently-effective value,
lets you type new values and pick an "effective from" date, and **only inserts
rows for sizes that actually changed.**

### 6.4 Contractor tagging on cement draws
Reconciliation needs to associate cement with people. Cement is logged per
machine/day, but multiple contractors may have run a machine that day — hence the
`fuel_log_contractors` **many-to-many** table. Tags are attached to the **cement**
`fuel_log` row (that's what reconciliation reads). If a machine has tags but no
cement row yet, `save()` force-creates a zero cement row so the tags have a target.

### 6.5 Reconciliation math (`Dashboard.jsx → recon` memo)
For the selected range (+ optional machine/contractor filters):

- **Expected cement** = Σ over matching `production_entries` of
  `good_qty × resolve(pipe_size_id, entry.date)`. (Uses **good_qty only**, per
  the spec.)
- **Actual cement** = Σ `consumed` of matching **cement** `fuel_logs`. With a
  contractor filter, only cement logs **tagged** with that contractor count.
- **Difference** = actual − expected, shown as a plain number — **no
  color-coding, no flagging** (a deliberate product decision; the supervisor
  judges it).
- **Contractor breakdown**: per contractor, "cement associated" (full amount of
  every cement draw they were tagged on) vs. "expected" (pipes credited to them
  via `production_entries.contractor_id`).
  ⚠️ **Important nuance**: when several contractors are tagged on the same draw,
  the **full** amount is counted for **each** (associated, *not* split), so that
  column can exceed the actual cement drawn. This is intentional and is called
  out in the UI and USAGE.md. If a future requirement wants an exact split,
  that's a real logic change here.

### 6.6 Pagination (`fetchAll.js`)
Supabase/PostgREST returns at most **1000 rows per request**. A wide custom date
range can exceed that, so `fetchAllInRange` pages with `.range()` until a short
page returns. Always use it for range reads instead of a bare `select`.

---

## 7. Auth & security model

- **One supervisor**, email/password, created once in the Supabase dashboard
  (see SETUP.md §3). There is no signup UI.
- **RLS** is the real security boundary. Current policy: any **authenticated**
  user can read/write everything. The **anon key** in the frontend is safe to
  ship *because* RLS gates access — but the **`service_role` key must never** be
  put in the frontend (it bypasses RLS).
- **To add multi-tenant / roles later**: give users an `org_id` (e.g. via a
  `profiles` table or JWT claim), then change each policy from `using (true)` to
  `using (org_id = auth.jwt() ->> 'org_id')` (or similar). Because every table
  already has `org_id`, no table shape changes.

---

## 8. Design system (`index.css`)

No CSS framework — one hand-written stylesheet with an **industrial / concrete-
plant** aesthetic (looks like factory signage, not a SaaS dashboard).

- **Palette (CSS variables):** `--concrete #EDEBE6` (bg), `--ink #1F2420`
  (text), `--rust #B5432E` (accent), `--tan #C9BCA3` (secondary). Chart colors
  are constants at the top of `Dashboard.jsx` (`RUST`, `INK`, `OK`, …).
- **Type:** Roboto Slab (headings/labels), Inter (data/tables), Noto Sans
  Devanagari (Hindi fallback).
- **Conventions:** `.panel` + `.panel-head`/`.panel-body` is the card unit;
  `table.register` is the dense grid used for both entry and reports; `.stat` is
  a summary card; `.btn`/`.btn.primary`/`.btn.sm`/`.btn.ghost` for buttons;
  `--tap: 48px` keeps touch targets tablet-friendly. Reuse these rather than
  adding new component styles.

---

## 9. Running it locally

```bash
npm install
cp .env.example .env      # then paste your Supabase URL + anon key
npm run dev               # http://localhost:5173 (also on your LAN IP)
```

If the app shows a **"Setup needed"** screen, `.env` is missing/incomplete or the
dev server wasn't restarted after editing it (Vite only reads env at startup).
Full first-time steps (create Supabase project, run `schema.sql`, create the
supervisor user) are in **SETUP.md**.

Scripts: `npm run dev` / `npm run build` (→ `dist/`) / `npm run preview`.

---

## 10. Deploying (stays on free tiers)

The build is a **static SPA** (`dist/`) — no serverless functions. Deploy to
Vercel Hobby: import the repo, framework preset **Vite**, and set the two env
vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel dashboard.
`vercel.json` already sets the build and the SPA rewrite. Step-by-step + a
"stay on free tier" checklist are in **SETUP.md §5**.

---

## 11. Free-tier capacity (know this before scaling)

Supabase free = **500 MB DB**, 5 GB bandwidth, 50k MAU. This app stores only
small scalar rows (no files/blobs). Estimate: ~51 rows/day ≈ ~18,600 rows/year ≈
**< 20 MB/year**. Years fit comfortably.

The only unbounded growth is years of `production_entries`/`fuel_logs`. **Do not
upgrade to a paid plan** — instead:
1. Export finished years to CSV (dashboard already exports), then
   `DELETE FROM production_entries WHERE date < 'YYYY-01-01';`
2. Reports already paginate (`fetchAll.js`), so wide ranges won't break.
3. Prefer narrow ranges for daily use.

---

## 12. How to extend — common tasks

- **Add a raw-material field** → no code needed: Settings → Raw Material Fields
  (stored in `app_settings.raw_material_fields`). The entry form reads it live.
- **Add a new master field (e.g. machine location)** → add the column in
  `schema.sql`, load it in `useMasters.js`, surface it in `Settings.jsx`.
- **Add a new report/chart** → add a `useMemo` aggregation in `Dashboard.jsx`
  over the already-fetched `prod`/`fuel`, then render with a `ChartBox` +
  Recharts, or a `RateTable`. Add a CSV button using `downloadCSV`.
- **Add a new page** → create `src/pages/Foo.jsx`, add a `<Route>` in `App.jsx`
  and a `<NavLink>` in the `.tabs` nav.
- **Change reconciliation to split cement across tagged contractors** → edit the
  `recon` memo in `Dashboard.jsx` (§6.5) — divide each draw by the number of
  tags instead of counting it fully per contractor.
- **Multi-tenant / user roles** → see §7 (RLS policy change; tables already ready).

---

## 13. Known limitations & v1 non-goals

- **No offline/PWA sync** — assumes the tablet has connectivity. (Future.)
- **Single supervisor login; no roles.**
- **Concurrent editing of the same day is not safe** because production uses
  delete-then-insert. Fine for one supervisor; revisit if multiple editors.
- **No payroll calculation** — the app only produces the per-piece data payroll
  would consume.
- **No file uploads / Supabase Storage** (would risk free-tier limits).
- **Reconciliation "associated cement" is not a split** (§6.5) — by design.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| **RCC / spun pipe** | Reinforced Cement Concrete pipe made by spinning; the plant's product. |
| **Contractor** | A crew/person who makes batches (paid per piece). Not permanent staff; names change; floats across machines/sizes. |
| **S&S / PILLAR / F.J.** | Pipe-size categories used in the register (S&S = socket & spigot; F.J. = flush joint). |
| **Good / Reject qty** | Pipes that passed / failed for a size+machine+contractor on a day. |
| **Cement (सीमेंट) / Diesel (डीजल)** | The two consumables tracked per machine/day via opening/consumed/closing. |
| **Bags per pipe** | The plant's own cement standard per size; entered by QC/mix-design staff, effective-dated. |
| **Reconciliation** | Comparing cement actually drawn vs. cement expected for the pipes actually produced. |
| **org_id** | Fixed single-tenant id today; the hook for future multi-company support. |

---

*Questions this guide didn't answer? The code is small and commented — start from
the file map in §4 and the "where to change things" table, and read the inline
comments in `schema.sql`, `EntryForm.jsx`, and `Dashboard.jsx`.*
