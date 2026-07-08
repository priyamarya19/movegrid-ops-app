# Shadow Watchdog — cloud monitoring routine

A scheduled **cloud** routine (Claude Code "routine"/trigger) that runs daily in
a fresh session in the `anthropic_cloud` environment and pushes a morning
operations brief to the phone. Installed **paused** until the prerequisites below
are met.

## What each run does
1. Read `DATABASE_URL` from the environment (RDS Postgres, ap-south-1). If unset
   or unreachable → stop and report "watchdog not provisioned yet". Never embed
   credentials in the routine prompt or in this repo.
2. Fleet snapshot — count vehicles by status using the canonical vocabulary from
   the dashboard's `lib/vehicleStatus.ts` (`assigned`, `ready_to_deploy`,
   `under_maintenance`, `mechanically_ok`, `returned`).
3. Rent — total + count of overdue rows from the `rent_dues` ledger
   (dashboard `lib/rent.ts`).
4. Code health — pull `priyamarya19/movegrid-dashboard` (and the app repo when it
   has a remote); report latest commit, any failing typecheck/build, open PRs.
5. Compose a terse, Jarvis-toned brief (≤ 8 lines), action items first, and
   deliver it as the run's push notification.

## Prerequisites (you / one-time)
- [ ] **Rotate the leaked GitHub token** (`ghp_…` was embedded in the dashboard
      git remote). Then re-point the remote at a clean URL.
- [ ] Add `DATABASE_URL` (RDS connection string) to the cloud environment as a
      **secret**, not in any file.
- [ ] Allow the cloud environment's egress in the **RDS security group**.
- [ ] Confirm the dashboard repo is available as a **source** in the cloud env so
      the routine can clone it.

## Schedule
- Daily. Default cron `30 2 * * *` = **08:00 IST** (assumes the scheduler runs in
  UTC; adjust once confirmed).
- Push notifications: on. Email: off.

## Toggling
- Enable/disable in the routines UI, or ask Shadow to flip it.
- Manual test run: ask Shadow to fire it once after the prerequisites are met.
