// Dynamic config so prod / UAT / dev are DISTINCT installable apps — different
// display name, Android package, iOS bundle id, and deep-link scheme — that can
// coexist on one device. Driven by APP_ENV, which eas.json sets per build profile.
//
// NOTE: name + package are baked into the native binary, so a new value only
// takes effect on a fresh `eas build` — never via `eas update` (OTA). Prod keeps
// its original package (in.movegrid.ops) and scheme so existing installs / the
// Play listing are untouched.
//
// app.json stays the base config; this only overrides the per-environment bits.
const VARIANTS = {
  production:  { name: "Movegrid",     package: "in.movegrid.ops",     scheme: "movegridopsapp" },
  uat:         { name: "Movegrid UAT", package: "in.movegrid.ops.uat", scheme: "movegridopsappuat" },
  development: { name: "Movegrid Dev", package: "in.movegrid.ops.dev", scheme: "movegridopsappdev" },
};

module.exports = ({ config }) => {
  const env = process.env.APP_ENV || "production";
  const v = VARIANTS[env] || VARIANTS.production;
  return {
    ...config,
    name: v.name,
    scheme: v.scheme,
    android: { ...config.android, package: v.package },
    ios: { ...config.ios, bundleIdentifier: v.package },
  };
};
