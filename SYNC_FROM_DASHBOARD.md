# App sync prompt — reflect the dashboard/backend changes

Paste everything below into a fresh Claude Code session started **in this repo** (`movegrid-ops-app`).

---

You are working in the **MoveGrid ops mobile app** (`movegrid-ops-app`), which calls the MoveGrid dashboard's Next.js API. The dashboard/backend was just updated with several changes. Update this app to match. Explore the app first (screens, `lib/api.ts`, the rent-collection / vehicle-return / rider-profile flows) and apply each change idiomatically. The API base is the same; UAT data is live.

## 0. CRITICAL breaking change — rent collection now requires payment proof
`POST /api/riders/{id}/rent-received` now **rejects with 400** unless the body includes `payment_mode` **and** `payment_screenshot_url`. Any existing "mark rent received / collect rent" flow in the app will break until updated. New body shape:
```json
{ "amount": 1820, "period_start": "2026-07-01", "period_end": "2026-07-07",
  "vehicle_id": "<optional>",
  "payment_mode": "Cash" | "Online" | "Cash + Online",
  "payment_utr": "<optional, only for online>",
  "payment_screenshot_url": "<S3 key from /api/upload — REQUIRED>" }
```

## 1. Payment-proof UX (used in 3 places)
Build a reusable component matching the dashboard's `PaymentProof`:
- **Payment mode** select: `Cash` / `Online` / `Cash + Online` (required).
- **UTR / Ref no.** text input — shown **only when mode is Online or Cash + Online** (optional).
- **Proof image** — **mandatory always**. Label "Payment screenshot" for online, "Photo of cash" for cash. Upload via `POST /api/upload` (multipart: `file`, `folder`) → returns `{ key }`. Store the `key`. View with `GET /api/file?key=<key>`.
- Validation: a mode must be picked AND a proof image uploaded before submit is allowed.

Apply it to: (a) rent collection, (b) penalty "mark paid", (c) vehicle-return rent settlement (below).

## 2. Rider penalties (new feature)
New `rider_penalties` concept — per-rider, each frozen to a vehicle.
- **GET** `/api/riders/{id}/penalties` → `{ penalties: [{ id, amount, detail, status, created_by, created_at, ev_number, payment_mode, payment_utr, payment_proof_url }] }`. `status` ∈ `pending|paid|waived`.
- **POST** `/api/riders/{id}/penalties` body `{ detail, amount }` — add an ad-hoc penalty (backend snapshots the rider's current vehicle).
- **PATCH** `/api/riders/{id}/penalties` body `{ penalty_id, action: "pay"|"waive", payment_mode, payment_utr, payment_proof_url }`. For `action:"pay"`, `payment_mode` + `payment_proof_url` are **required**.
- On the rider profile: show a Penalties list + outstanding total (sum of `pending` amounts), an "Add penalty" action, and per pending row "Mark paid" (opens PaymentProof) + "Waive". `detail` is a free string (may be text like "Front fender, handle T band" with no numeric amount).

## 3. Vehicle return / submission flow
`PATCH /api/allotments/{id}/return` now also accepts:
- `penalty_detail` (string) — if present (or `penalty_amount`), backend creates a `rider_penalties` row against the submitted vehicle.
- `rent_settlement_mode`, `rent_settlement_utr`, `rent_settlement_proof_url` — the **settlement payment proof**, required when `rent_cleared` is true (rider paid all dues at return). Use the PaymentProof component.
- (existing: `returned_date`, `rent_cleared`, `penalty_amount`, `condition_on_return` [array], `return_photos` [array], `return_remarks`.)

## 4. Fix the "Rent due" badge on the riders list
The list currently shows "Rent due / Rent paid this month" from `rent_received_this_month` **without checking if the rider has a vehicle** — so new/unallotted riders wrongly show "Rent due". The riders API (`GET /api/riders`) now returns **`has_active_assignment`** (boolean). Gate the badge: if `!item.has_active_assignment`, render nothing (or "—") instead of a rent status. (A rider with no vehicle owes no rent.)

## 5. Rent cycle semantics (mostly API-driven, verify display)
- Rent is **paid one week in advance**: rental week 1 is prepaid at onboarding (always Collected).
- A rent week is **Overdue only after it has started** — the week that starts *today* is **Pending**, not Overdue.
- `GET /api/riders/{id}/rent` returns per-week `status` already computed this way. Render the API's `status` directly; do **not** recompute overdue from join-date. If the app has its own due-date math, align it to "overdue ⇔ period_start < today".

## 6. Rider status = vehicle possession
Invariant: a rider is `active` **iff** they hold an active vehicle; `pending` = new/never allotted; `inactive` = returned. This is data-driven — just make sure any status labels/colors match (`pending`, `active`, `inactive`).

## 7. Vehicle status label change
The legacy vehicle status string `available` is gone; the canonical allottable status is **`ready_to_deploy`** (displayed as "Available"/"Ready to Deploy"). If the app maps vehicle statuses, use `ready_to_deploy` (not `available`). Full set: `assigned`, `ready_to_deploy`, `under_maintenance`, `mechanically_ok`, `returned`, plus legacy `maintenance`/`retired`/`blocked`.

## 8. Auth response handling
Guards now return structured codes:
- **401** with `{ code: "token_expired" }` → session expired; force a re-login / token refresh.
- **401** with `{ code: "unauthorized" }` → no/invalid session → login.
- **403** with `{ code: "forbidden" }` → valid session, insufficient role → show a permission error, **do NOT log out**.

Update the app's fetch/error handling to distinguish these (don't treat a 403 as a logout).

---

**Approach:** explore the app, implement each section, and test against the live UAT API. Keep changes on a branch. Flag anything where the app's structure doesn't map cleanly before diverging.
