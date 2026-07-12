// Dynamic config so prod / UAT / dev are DISTINCT installable apps — different
// display name, Android package, iOS bundle id, deep-link scheme, AND icon — that
// can coexist on one device. Driven by APP_ENV, which eas.json sets per profile.
//
// Icon distinction:
//   - Square icon (iOS / store): a coloured bottom banner (icon.uat.png / .dev.png).
//   - Android adaptive: a coloured background (the logo's interior is transparent,
//     so the tint shows through and reads as a themed variant) — mask-safe.
//
// NOTE: name + package + icon are baked into the native binary, so new values only
// take effect on a fresh `eas build` — never via `eas update` (OTA). Prod keeps its
// original package/scheme/white icon so existing installs / the Play listing are
// untouched. app.json stays the base config; this overrides the per-env bits.
const VARIANTS = {
  production:  { name: "Movegrid",     package: "in.movegrid.ops",     scheme: "movegridopsapp",    icon: "./assets/images/icon.png",     adaptiveBg: "#FFFFFF" },
  uat:         { name: "Movegrid UAT", package: "in.movegrid.ops.uat", scheme: "movegridopsappuat", icon: "./assets/images/icon.uat.png", adaptiveBg: "#F97316" },
  development: { name: "Movegrid Dev", package: "in.movegrid.ops.dev", scheme: "movegridopsappdev", icon: "./assets/images/icon.dev.png", adaptiveBg: "#7C3AED" },
};

module.exports = ({ config }) => {
  const env = process.env.APP_ENV || "production";
  const v = VARIANTS[env] || VARIANTS.production;
  return {
    ...config,
    name: v.name,
    scheme: v.scheme,
    icon: v.icon,
    android: {
      ...config.android,
      package: v.package,
      adaptiveIcon: { ...config.android.adaptiveIcon, backgroundColor: v.adaptiveBg },
    },
    ios: { ...config.ios, bundleIdentifier: v.package },
  };
};
