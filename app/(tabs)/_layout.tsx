import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';
import { useOutbox } from '@/lib/useOutbox';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={22} {...props} />;
}

// v2 tab bar: Home · Money · ＋ (raised action sheet) · Riders · Menu.
// Frequent money work lives under the thumb; everything infrequent is in Menu.
export default function TabLayout() {
  const { count: pendingSync } = useOutbox();
  const { t } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: t.accentText,
          tabBarInactiveTintColor: t.textFaint,
          tabBarStyle: {
            backgroundColor: t.tabBar,
            borderTopColor: t.border,
          },
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontWeight: '700' },
          headerShadowVisible: false,
          // Disable the static render of the header on web
          // to prevent a hydration error in React Navigation v6.
          headerShown: useClientOnlyValue(false, true),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabBarIcon name="th-large" color={color} />,
          }}
        />
        <Tabs.Screen
          name="money"
          options={{
            title: 'Money',
            tabBarIcon: ({ color }) => <TabBarIcon name="inr" color={color} />,
          }}
        />
        <Tabs.Screen
          name="plus"
          options={{
            title: '',
            tabBarButton: () => (
              <Pressable
                onPress={() => setSheetOpen(true)}
                style={styles.fabWrap}
                accessibilityRole="button"
                accessibilityLabel="Record something new">
                <View style={[styles.fab, { backgroundColor: t.accent, shadowColor: t.shadow }]}>
                  <FontAwesome name="plus" size={22} color={t.onAccent} />
                </View>
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="riders"
          options={{
            title: 'Riders',
            tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: 'Menu',
            tabBarIcon: ({ color }) => <TabBarIcon name="ellipsis-h" color={color} />,
            // Surface unsynced writes waiting in the outbound queue.
            tabBarBadge: pendingSync > 0 ? pendingSync : undefined,
            tabBarBadgeStyle: { backgroundColor: t.warning, color: '#fff' },
          }}
        />
      </Tabs>
      <ActionSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -space(5),
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
