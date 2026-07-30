# SnakTrack

A single-page snack-request approval dashboard. Plain JavaScript (no framework), built with Vite. There is no backend: it renders from a local JSON seed file and keeps changes in memory, so a page refresh resets everything.

## Run it

```bash
npm install
npm run dev      # start the dev server, then open the URL it prints
npm test         # run the approval-rule tests (Node's built-in test runner)
npm run build    # validate the seed data, then produce a production build
```

Requires a recent Node.js (built and tested on Node 22). No Python, VPN, or database is involved, despite what older notes may have claimed.

## How it works

- **Entry point:** `index.html` → `app/app.module.js`.
- **The one active controller:** `app/controllers/snack-dashboard.controller.js` — renders the whole dashboard; no virtual DOM, no framework.
- **Business logic (no DOM):** `app/services/`
  - `approval-rules.service.js` — the snack-approval policy (spelled out below).
  - `snack-requests.service.js` — the in-memory request store, seeded from `data/snack-requests.json`.
- **All user-facing text and branding:** `app/config/identity.config.js`.
- **Tests:** `test/approval-rules.test.js`.

The dashboard has two modes, toggled by an in-page control (a dev convenience, not real authentication): **Administrator** (the review / approve / reject queue) and **Sample Employee** (file a request and see your own history).

## Snack policy

The approval rule, in plain language. It lives in `app/services/approval-rules.service.js`, so you don't need to read code to know the rules:

1. **$5 limit.** A snack may cost up to $5.00.
2. **One per week.** Each person may have one *approved* snack per calendar week.
3. **Gratitude Alignment Day.** On the third Thursday of the month, the limit rises to $7.50 — but only if the request includes a note.

The rule takes the evaluation date as an argument, so it can be pointed at any day. In the running app, the Administrator **Effective snack date** control (in the dev panel) sets that date — set it to a third Thursday to see the $7.50 uplift.

## Open questions

Genuinely undecided — recorded here rather than guessed at:

- **What is a "week"?** The code uses the ISO week (Monday–Sunday). The memo doesn't specify, so this is an assumption.
- **What counts as a note?** The rule accepts any non-blank note for the Gratitude uplift; it does not check that the note is genuine or on-topic. Whether to enforce that is open.
- **Which date is authoritative in production?** Today the date comes from the dev-only "Effective snack date" control; there is no real clock or auth wiring.
- **Legacy code.** `components/*.jsx`, `legacy/`, and `app/controllers/old-dashboard.*` are not wired into the app. They're kept for history; whether to delete them is undecided.

Historical documents under `docs/` describe an earlier tenure-based budget policy that is no longer in effect.
