# movegrid-ops-app — Project Reference

A living reference for the MoveGrid ops field app. Read this first to get oriented;
it complements `AGENTS.md` (which defines the Shadow orchestrator + specialist routing).

_Last updated: 2026-07-04_

---

## 1. What this is

Expo mobile app for fleet/ops field work, talking to the **movegrid-dashboard**
Next.js + Postgres backend.

| | |
|---|---|
| **Framework** | Expo **SDK 54** (pinned so it runs in Expo Go) |
| **Runtime** | React Native 0.81.5, React 19.1.0 |
| **Navigation** | expo-router |
| **Auth storage** | expo-secure-store |
| **Docs** | https://docs.expo.dev/versions/v54.0.0/ |

> The SDK is pinned at 54 on purpose. An old note said "SDK 56" — that was stale.

## 2. Repository

- **GitHub:** https://github.com/priyamarya19/movegrid-ops-app (public)
- **Active branch:** `feat/ops-field-app`
- **Owner:** priyamarya19

## 3. Backend it talks to

- Repo: **movegrid-dashboard** (`~/movegrid-dashboard`), GitHub `priyamarya19/movegrid-dashboard`.
- API contract from the app:
  - `Authorization: Bearer <token>`
  - Header `X-Client-Type: mobile`
- Run the backend so a phone on the LAN can reach it:
  ```
  cd ~/movegrid-dashboard && npm run dev -- -H 0.0.0.0    # binds all interfaces, port 3000
  ```
- The app auto-derives the API base from the Metro host (e.g. `http://<mac-lan-ip>:3000`).

## 4. Running locally (Expo Go — for JS-only iteration)

```
cd ~/movegrid-ops-app && npm start        # expo start, Metro on :8081
```
Open in Expo Go via the QR, or `exp://<mac-lan-ip>:8081`. Phone must be on the same Wi-Fi.

Navigate: log in → **Vehicles** tab → filter chips (All / Assigned / Available / Maintenance).

## 5. Building the APK (real device, not Expo Go)

Uses EAS build profiles in `eas.json`:

| Profile | Output | Use |
|---|---|---|
| `development` | dev client | loads JS from Metro (`expo start --dev-client`) |
| `preview` | **.apk**, internal distribution | the "share an APK to a phone" build |
| `production` | .aab | store bundle |

Rebuild the shareable APK:
```
eas build --profile preview --platform android
eas build:list --platform android --limit 5   # see which profile made the last build
```

### ⚠️ No over-the-air updates yet
`expo-updates` is **not installed** and there is **no EAS Update config** (no `updates`
block in `app.json`, no channels in `eas.json`). Consequence: the JS bundle is **baked
into each APK**. A JS-only change does **not** appear on an installed APK via reload or
`eas update` — you must **rebuild**.

To change that (one-time): install `expo-updates`, add a `runtimeVersion` + an `updates`
block, and a per-profile `channel`. Rebuild once, then ship JS-only changes with
`eas update` — no rebuild.

## 6. Vehicle status vocabulary (source of truth = dashboard)

Canonical statuses live in `~/movegrid-dashboard/lib/vehicleStatus.ts`.
- Deployable value: **`ready_to_deploy`**.
- `available` is a **legacy input alias** the backend normalizes to `ready_to_deploy`;
  it is not a distinct stored/emitted status.
- Others: `assigned`, `under_maintenance`, `returned`, plus legacy `mechanically_ok`,
  `maintenance`, `retired`, `blocked`.

**Domain rule:** a `returned` vehicle is NOT available until a team member resets it to
`ready_to_deploy`. Only `ready_to_deploy` counts as "Available".

## 7. Recent work

- **Fix (committed `0e1a51f`, pushed):** "Available" filter now matches only
  `ready_to_deploy` — was over-broad (`available`, `mechanically_ok`, `returned`).
  - `app/(tabs)/vehicles.tsx` — Available filter predicate
  - `app/allotment/new.tsx` — `DEPLOYABLE` list
  - This also closed a UX hole: users could pick a `returned`/`mechanically_ok`
    vehicle that the backend would then reject at allotment time.

## 8. Open items / gotchas

- **See the fix on the phone:** requires a new `preview` APK build (no OTA — see §5).
- **git push HTTP 400:** Apple Git 2.37 vs GitHub HTTP/2 bug. Push with
  `git -c http.version=HTTP/1.1 push …`, or set it globally once:
  `git config --global http.version HTTP/1.1`.
- **git identity unset:** commits currently author as the machine hostname. Set
  `user.name` / `user.email` (priyamarya19 / priyamarya19@gmail.com) for correct history.
- **Latent backend bug:** the dashboard vehicle-creation POST hardcodes legacy
  `available` instead of `ready_to_deploy`. Harmless today (normalizes correctly) but
  untidy — a source-of-truth cleanup for `dashboard-agent`.
- **Security:** the dashboard git remote embeds a Personal Access Token that is flagged
  for rotation. Rotate it and switch to a credential helper / SSH.
