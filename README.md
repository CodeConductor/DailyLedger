# Daily Ledger · पाइप रजिस्टर

A mobile-first web app that digitizes the **daily production register** of an
RCC (spun) concrete pipe plant — replacing the handwritten paper log. Built for
a shop-floor supervisor on a tablet/computer.

- **Frontend:** React + Vite
- **Backend:** Supabase (Postgres + Auth) — **free tier only**
- **Deploy:** Vercel (Hobby / free tier)
- **Language:** English + Hindi/Devanagari labels throughout

> New here? Read the docs in this order:
> 1. **README.md** (this file) — what it is, how it's built.
> 2. **[SETUP.md](./SETUP.md)** — get it running on a fresh machine (step by step).
> 3. **[USAGE.md](./USAGE.md)** — how the supervisor uses it every day.
> 4. **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** — full deep-dive for anyone who
>    will maintain or extend the code (architecture, data model, key logic, how to
>    extend). **Start here if you're taking over development.**

---

## What it does

### 1. Daily entry (landing page)
- Pick the date (defaults to today).
- Choose which **machines** ran that day.
- Add **contractors** working that day inline (names change often — quick add).
- A **production grid**: each row = *Pipe (Size · Type · Class) + Machine +
  Contractor + Good Qty + Reject Qty*. A contractor can appear many times across
  different pipe/machine combinations in the same day (they "float").
- Optional, collapsed **raw-materials** section per row (Cutting Oil, 20mm, 10mm,
  Jeera, Dust, …) — which fields show is configurable in Settings.
- A **fuel log per machine** (not per contractor): Opening / Consumed / Closing
  for **Cement (सीमेंट)** and **Diesel (डीजल)**. Closing auto-suggests
  `Opening − Consumed` and can be overridden.
- Validation: no negative numbers; a soft warning when Closing ≠ Opening −
  Consumed (override allowed).
- **Editing a saved day** is supported — reopen the date and re-save.

### 2. Dashboard / reports
- Range filter: Today / This Week / This Month / Custom.
- **Production:** total by pipe (bar), trend over time (line), reject rate % by
  pipe and by machine.
- **Contractors:** pieces per contractor (pay-by-piece) with per-pipe detail,
  reject rate with **above-average flagging**, days worked, and a per-contractor
  detail view.
- **Fuel:** diesel & cement consumption trend over time.
- **Summary cards:** total pipes, rejects, diesel, cement, active contractors.
- **CSV export** for both production and contractor reports (no paid reporting
  tool needed).

### 3. Settings
- Manage **machines** (add / rename / archive).
- Manage the editable **Type** (S&S / Plain / FlushJoint) and **Class**
  (NP3 / NP4) lists.
- Manage **pipes** — add a full spec (Size mm + Type + Class), archive, or delete
  an unused one.
- Manage **contractors** (add / rename / deactivate — **never hard-deleted**, so
  old reports keep the name).
- Toggle which **raw-material fields** are tracked in the entry form.
- **Cement standard** — your plant's own bags-per-pipe figure per Size + Class,
  used by the reconciliation report (below).

### 4. Cement-yield reconciliation
- **Cement standard table** (Settings): bags of cement required per pipe, per
  **Size + Class**. **Blank/0 by default** — you enter your own mix-design figure;
  nothing is hardcoded from any external standard. Every edit is stored with an
  **effective_date**, so changing the standard never rewrites past reports.
- **Contractor tagging on cement draws** (Entry Form): under each machine's fuel
  section you tag which contractor(s) operated that machine when its cement was
  drawn — many-to-many, multiple contractors allowed per machine/day.
- **Reconciliation report** (Dashboard): for a date range (+ optional machine /
  contractor filters) it shows **actual cement consumed** vs. **expected cement**
  (good qty × the standard effective on each day) with the plain **difference**,
  plus a per-contractor breakdown. No colour-coding or auto-flagging — just the
  numbers, and CSV export.

---

## Tech / project structure

```
digitalLedger/
├── index.html                 # Vite entry + Google Fonts
├── package.json               # deps & scripts
├── vite.config.js
├── vercel.json                # Vercel (free) config + SPA rewrite
├── .env.example               # copy to .env and fill in Supabase keys
├── supabase/
│   └── schema.sql             # ← run this in Supabase SQL editor FIRST
├── src/
│   ├── main.jsx               # React root + router
│   ├── App.jsx                # auth gate, top nav, routes
│   ├── index.css              # industrial design system (all styling)
│   ├── components/
│   │   ├── Login.jsx          # supervisor email/password login
│   │   └── Toast.jsx          # tiny toast notifications
│   ├── lib/
│   │   ├── supabaseClient.js  # Supabase client + config guard
│   │   ├── useMasters.js      # loads machines/pipes/contractors/settings
│   │   ├── constants.js       # org id, fuel types, pipe label + tag helpers
│   │   ├── cementStandards.js # effective-dated standard resolver (size+class)
│   │   ├── dates.js           # ISO date helpers, range presets
│   │   ├── fetchAll.js        # paginated range fetch (>1000 rows safe)
│   │   └── csv.js             # dependency-free CSV export
│   └── pages/
│       ├── EntryForm.jsx      # daily entry (production + fuel)
│       ├── Dashboard.jsx      # reports + charts + CSV
│       └── Settings.jsx       # manage masters + RM field toggles
├── README.md
├── SETUP.md
└── USAGE.md
```

---

## Data model (Supabase / Postgres)

Full DDL is in [`supabase/schema.sql`](./supabase/schema.sql). Summary:

| Table                | Purpose |
|----------------------|---------|
| `machines`           | Production lines. `active` for soft-archive. |
| `pipes`              | One full pipe spec: `size_mm` + `type` + `class` + `active`. Type/Class values come from editable lists in `app_settings`. |
| `contractors`        | Crews/persons. `name` editable, `active` (never deleted). Devanagari names. |
| `production_entries` | One grid cell: `date, machine_id, pipe_id, contractor_id, good_qty, reject_qty, raw_materials jsonb`. |
| `fuel_logs`          | Per machine/day/fuel: `opening, consumed, closing`; enum `fuel_type ('cement','diesel')`. |
| `app_settings`       | Single row: tracked raw-material fields + editable `pipe_types` / `pipe_classes` lists. |
| `cement_standards`   | `size_mm, class, bags_per_pipe, effective_date` — versioned bags-per-pipe standard (per Size + Class); edits add a new effective-dated row. |
| `fuel_log_contractors` | Many-to-many `fuel_log_id ↔ contractor_id` — who operated a machine when its cement was drawn. |

> Everything is in the **single** [`supabase/schema.sql`](./supabase/schema.sql) —
> run it once and the whole app (including cement reconciliation) is ready. No
> separate migration step.

- A **pipe** = Size (mm) + Type (S&S/Plain/FlushJoint) + Class (NP3/NP4). The
  Type/Class option lists are editable in Settings; each `pipes` row stores the
  chosen text, so removing a list value never orphans an existing pipe.
- All three of `machine_id`, `pipe_id`, `contractor_id` are **independent** FKs on
  `production_entries`.
- Indexes: `(date)`, `(contractor_id, date)`, plus `(pipe_id, date)` and
  `(machine_id, date)` for report performance.
- **Row Level Security** is on. v1 policy: any authenticated user may read/write.
  Every table also carries an `org_id` (defaulted to one fixed org) so a real
  multi-tenant policy can be added **without a schema rewrite**.

---

## Free-tier capacity (important as data grows)

Supabase free tier: **500 MB database**, 5 GB bandwidth, 50k MAU. This app stores
only small scalar values — **no files, blobs, or attachments** — so it stays tiny.

**Rough growth math** (see comments at the top of `schema.sql`):

- ~3 machines × ~15 sizes = ~45 production rows/day + ~6 fuel rows/day ≈ **51
  rows/day** ≈ **~18,600 rows/year**.
- At well under 1 KB/row that is **< 20 MB of table data per year** (indexes add
  a little). **Many years fit inside the free 500 MB database.**

⚠️ **Flag:** the only thing that grows unbounded is `production_entries` /
`fuel_logs` over *years*. If you ever approach the limit, **do not upgrade** —
use one of these lightweight, free mitigations:

1. **Archive old years.** Export finished years to CSV (the dashboard already
   exports CSV), then `DELETE FROM production_entries WHERE date < 'YYYY-01-01'`.
   Keep the CSVs as your cold archive.
2. **Pagination is already handled** — reports page through results in blocks of
   1000 (`src/lib/fetchAll.js`), so large ranges never break.
3. Prefer **narrow date ranges** on the dashboard for day-to-day use; run wide
   custom ranges only when needed for year-end reporting.

Vercel Hobby: this is a **static SPA build** (`vite build` → `dist/`). No
serverless functions are used, so there is nothing that can exceed the free
function/bandwidth limits under normal shop-floor use.

---

## Scripts

```bash
npm install     # install dependencies
npm run dev     # local dev server (http://localhost:5173, also on your LAN)
npm run build   # production build into dist/
npm run preview # preview the production build locally
```

## Non-goals for v1 (by design)
- No multi-company/multi-tenant yet (structure is ready for it via `org_id`).
- No offline/PWA sync (assumes the tablet has connectivity) — future improvement.
- No user roles beyond a single supervisor login.
- No payroll calculation (only the per-piece data payroll would need).
- No paid Supabase/Vercel add-ons (no Storage uploads, no paid functions, no
  paid custom domain).

---

## Before deploying
Deployment to Vercel is **not** done automatically. See **[SETUP.md →
Deploy to Vercel](./SETUP.md#5-deploy-to-vercel-free-hobby-tier)**. Everything
described stays on the **free tiers** of both Supabase and Vercel.
