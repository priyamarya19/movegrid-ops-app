#!/usr/bin/env node
// Bump the app's display version by one MINOR (x.Y.z -> x.(Y+1).0). Run before an
// `eas build` so each build carries a distinct, climbing version (1.0.0, 1.1.0,
// 1.2.0 …). Does NOT touch runtimeVersion (pinned in app.json) so OTA compatibility
// is preserved, nor android.versionCode (EAS auto-increments that on production builds).
//
//   npm run bump      # 1.0.0 -> 1.1.0
//
// Commit app.json afterwards so the new version is the base for the next bump.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "app.json");
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
const cur = String(cfg.expo.version || "0.0.0");
const [major, minor] = cur.split(".").map((n) => parseInt(n, 10) || 0);
const next = `${major}.${minor + 1}.0`;

cfg.expo.version = next;
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
console.log(`app version: ${cur} -> ${next}`);
console.log("Now commit app.json, then run your eas build.");
