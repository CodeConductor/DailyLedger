# SETUP — run this on a fresh machine

Follow these steps in order. Nothing here needs a paid plan.

Total time: ~15–20 minutes the first time.

---

## 0. Install the prerequisites

1. **Node.js 18 or newer** (includes `npm`).
   - Download from <https://nodejs.org> (LTS is fine).
   - Verify in a terminal:
     ```bash
     node --version
     npm --version
     ```
2. A code editor (VS Code recommended) — optional but handy.
3. A free **Supabase** account: <https://supabase.com>
4. A free **Vercel** account (only needed for deployment): <https://vercel.com>

---

## 1. Get the project onto the machine

Copy this whole `digitalLedger` folder to the new machine (USB, zip, or git).
Then open a terminal **inside the folder** and install dependencies:

```bash
npm install
```

> Windows PowerShell tip: `cd "C:\path\to\digitalLedger"` then `npm install`.

---

## 2. Create the Supabase project + database

1. Go to <https://supabase.com/dashboard> → **New project**.
   - Pick a name, a strong DB password, and the region nearest the plant.
   - Wait ~2 minutes for it to provision.
2. In the project, open **SQL Editor** (left sidebar) → **New query**.
3. Open `supabase/schema.sql` from this project, **copy the entire file**, paste
   it into the SQL editor, and click **Run**.
   - This one file creates **everything** — all tables (including the
     cement-reconciliation tables), indexes, Row Level Security policies, and
     some starter machines / sizes / contractors. There is **no separate
     migration** to run.
   - ✅ You should see "Success. No rows returned".
   - ⚠️ Run the file **once**. Re-running re-inserts the seed machines/sizes and
     will create duplicates (there is no unique constraint on names). If you need
     to re-run, delete the rows first or comment out the `SEED DATA` section.

---

## 3. Create the supervisor login

v1 has a single supervisor account (no self-signup screen). Create it once:

1. Supabase Dashboard → **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Enter the supervisor's **email** and a **password**.
3. ✅ Turn ON **"Auto Confirm User"** (or confirm the email) so they can log in
   immediately.

> To disable public sign-ups entirely: **Authentication → Providers → Email** and
> turn **off** "Allow new users to sign up". The app has no signup UI anyway.

---

## 4. Connect the app to Supabase (env vars)

1. Supabase Dashboard → **Project Settings** → **API**.
2. Copy two values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Project API keys → `anon` `public`** → `VITE_SUPABASE_ANON_KEY`
     (Use the **anon/public** key only. **Never** put the `service_role` key in a
     frontend app — it bypasses Row Level Security.)
3. In the project folder, copy `.env.example` to `.env`:
   ```bash
   # macOS / Linux
   cp .env.example .env
   # Windows PowerShell
   Copy-Item .env.example .env
   ```
4. Open `.env` and paste your two values:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi....
   ```

### Run it locally

```bash
npm run dev
```

- Open the URL it prints (usually <http://localhost:5173>).
- It also serves on your LAN (e.g. `http://192.168.x.x:5173`) so a **tablet on
  the same Wi-Fi** can open it for testing.
- Log in with the supervisor account from step 3.

If you see a **"Setup needed"** screen, the `.env` values are missing or the dev
server wasn't restarted after editing `.env` — stop it (Ctrl+C) and run
`npm run dev` again.

---

## 5. Deploy to Vercel (free Hobby tier)

> ⚠️ Do this only when you're ready. It stays entirely on the **free** tier: the
> app is a static build (`vite build` → `dist/`) with **no serverless functions**,
> so there is nothing that can incur paid usage under normal use.

**Option A — Vercel dashboard (easiest):**
1. Push this folder to a GitHub repo (private is fine), or use Vercel's drag-and-drop.
2. <https://vercel.com/new> → **Import** the repo.
3. Framework preset: **Vite** (auto-detected). Build command `npm run build`,
   output directory `dist` (already set in `vercel.json`).
4. **Environment Variables** → add the same two keys as in `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (Do **not** commit `.env`; set them here instead.)
5. **Deploy**. You get a free `*.vercel.app` URL — open it on the tablet.

**Option B — Vercel CLI:**
```bash
npm i -g vercel
vercel            # first run links/creates the project
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

### Stay on free tiers — checklist
- [ ] Supabase project is the **Free** plan (default).
- [ ] No Supabase **Storage** buckets used (this app stores no files).
- [ ] Vercel project is **Hobby** (personal) — no Pro upgrade.
- [ ] No custom paid domain required — the `*.vercel.app` URL works fine.
- [ ] Only the **anon** key is in the frontend env (never `service_role`).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Setup needed" screen | `.env` missing/incomplete, or dev server not restarted after editing it. |
| Login fails: "Invalid login credentials" | User not created/confirmed in Supabase Auth (step 3). |
| Empty dropdowns in the entry form | Seed didn't run, or everything was archived — add items in **Settings**. |
| Devanagari looks like boxes | Ensure internet access for Google Fonts (Noto Sans Devanagari) on first load. |
| Charts empty | No data in the selected range — pick a wider range or add a day's entry. |
| Reports feel slow after years | Archive old years to CSV then delete them (see README → Free-tier capacity). |
