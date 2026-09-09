# USAGE — daily guide for the supervisor

Bilingual quick guide (English + हिंदी) for using the app on the shop-floor
tablet. Screens are large and touch-friendly.

---

## Logging in · लॉगिन
Open the app URL, enter the email and password given to you, tap **Sign In**.
You stay logged in on that tablet until you tap **Logout**.

---

## 1. Daily Entry · दैनिक प्रविष्टि  (the home screen)

This is the digital version of the paper register page for one day.

### Step 1 — Day Setup · दिन
- **Date · तारीख:** defaults to today. Tap to pick another day.
- **Machines active today · मशीन:** tap the machines that ran today so they turn
  red (selected). Tap again to unselect.
- **Add contractor · ठेकेदार जोड़ें:** type a new contractor's name (Hindi is
  fine) and tap **+ Add**. New crews change often, so add them here as they come.

### Step 2 — Production · उत्पादन
Build the grid one row at a time:
- **+ Row** adds a blank row. Pick **Pipe** (shown as *Size · Type · Class*, e.g.
  `150mm S&S NP3`), **Machine**, **Contractor**, then type **Good** and **Reject**
  quantities.
- **+ All pipes** quickly adds one row for every pipe on the first selected
  machine (like filling a whole column of the paper sheet) — then just fill the
  numbers and set the contractor per row.
- The **same contractor can appear on many rows** (different pipes/machines) —
  that's expected.
- **Raw materials · कच्चा माल** (optional): tap the small ▶ under a row to open
  Cutting Oil / 20mm / 10mm / Jeera / Dust etc. Leave blank if not used.
- Tap **✕** on the right to delete a row.

> Numbers can't be negative. If you leave size/machine/contractor empty on a row,
> the app will ask you to complete it before saving.

### Step 3 — Fuel & Consumables · ईंधन (per machine)
For **each machine** you selected, enter for **Cement (सीमेंट)** and **Diesel
(डीजल)**:
- **Opening**, **Consumed**, and **Closing**.
- **Closing auto-fills** as `Opening − Consumed`. You can type over it if the
  measured closing differs — the app just shows a **CHECK** warning, it won't
  stop you saving.

### Step 4 — Save · सेव करें
Tap **Save Day ✓** (bottom of the screen). A green **Saved ✓** confirms it.

### Editing a day you already saved
Just pick that **date** again — the grid and fuel fill in with what was saved.
Make changes and tap **Update Day ✓**.

---

## 2. Reports · रिपोर्ट

Pick a range at the top: **Today / This Week / This Month / Custom**.

**Summary cards** show totals: pipes produced, rejects, diesel, cement, and how
many contractors worked in the range.

**Production Reports**
- Bar chart: total good/reject **by size**.
- Line chart: production **trend over time**.
- Tables: **reject rate %** by size and by machine.
- **Export CSV** button → downloads every production entry in the range (opens in
  Excel; Hindi names display correctly).

**Contractor Reports** (for pay-by-piece)
- Table of each contractor: **Good** pieces, Reject, Reject %, **Days worked**,
  distinct sizes and machines.
- Contractors with a **higher-than-average reject rate** get a red **HIGH** flag.
- Tap **View** on a contractor for a **detail** popup (totals + breakdown by
  size).
- **Export CSV** button → contractor summary for the range.

**Fuel Consumption**
- Line chart of diesel and cement consumed over time (combined across machines).
- Per-machine fuel numbers are in the production/daily data and CSVs.

---

## 3. Settings · सेटिंग

- **Machines:** add, rename, or archive a machine. Archived machines stop
  appearing in the entry form but old reports keep them.
- **Pipe Type & Class lists:** add or remove the values that appear in the Type
  (S&S / Plain / FlushJoint) and Class (NP3 / NP4) dropdowns, then **Save**.
- **Pipes:** add a pipe by choosing **Size (mm) + Type + Class**. Archive pipes
  you no longer run (kept for old reports), or **Delete** one that has never been
  used. (If a pipe is already in production entries, delete is blocked — archive
  it instead.)
- **Cement Standard · सीमेंट मानक:** enter **your plant's own** cement bags per
  pipe for each **Size + Class** (from your QC / mix-design staff — there is no
  universal number; Type is not used here). Set **"New values effective from"** to
  the date the standard applies,
  type the new value(s), and press **Save**. Changing a standard later does
  **not** alter past reports — they keep the value that was effective on their
  own date.
- **Contractors:** add, rename, or **deactivate** a contractor. They are **never
  deleted**, so past reports always show the correct name.
- **Raw Material Fields:** tick which optional fields (Cutting Oil, 20mm, …) show
  in the entry form. You can also add your own field. **Press Save** after
  changes.

---

## 4. Cement reconciliation · सीमेंट मिलान

**One-time / occasional setup:** in **Settings → Cement Standard**, enter bags of
cement per pipe for each Size + Class.

**Every day, in Daily Entry:** in the **Fuel** section, besides entering cement
Opening/Consumed/Closing per machine, use **"Contractors operating this machine
today"** to tag the crew(s) who drew that machine's cement. Tag more than one if
several worked the machine that day. Then Save as usual.

**To review, in Reports → Cement Reconciliation:**
- Pick the range at the top; optionally filter by **machine** and/or
  **contractor**.
- Three plain numbers side by side: **Actual cement** (drawn), **Expected
  cement** (for the pipes actually produced), and the **Difference**. No
  red/green — just the figures for you to judge.
- **Contractor breakdown** compares, per contractor, the cement associated with
  the machines/days they were tagged on vs. the expected cement for the pipes
  credited to them.
  > Note: if two contractors are tagged on the same cement draw, the full amount
  > shows against each (it is *associated*, not split), so that column can add up
  > to more than the actual cement drawn. This is intentional — it's for visual
  > comparison, not an exact per-person split.
- **Export CSV** for your records.

---

## Tips
- Works best on a tablet in **landscape**; the grids scroll sideways if needed.
- Enter the day's data before the tablet loses Wi-Fi — v1 needs connectivity
  (offline support is a planned future improvement).
- Do a quick **Reports → This Month** review at month-end and **Export CSV** for
  your records / payroll input.
