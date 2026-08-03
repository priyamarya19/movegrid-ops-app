// Never rendered — the tab bar's ＋ button intercepts the tap and opens the
// action sheet instead (see tabBarButton in app/(tabs)/_layout.tsx). The file
// only exists because expo-router needs a route behind every Tabs.Screen.
export default function PlusPlaceholder() {
  return null;
}
