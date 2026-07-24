import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { colors, space } from '@/constants/theme';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useOutbox } from '@/lib/useOutbox';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={22} {...props} />;
}

function HeaderAddButton({ href }: { href: Href }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(href)} hitSlop={10} style={{ paddingHorizontal: space(4) }}>
      <FontAwesome name="plus" size={20} color={colors.accent} />
    </Pressable>
  );
}

// Add-button (when present) + the permission-gated ☰ dashboard-pages menu.
function HeaderRight({ addHref }: { addHref?: Href }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {addHref ? <HeaderAddButton href={addHref} /> : null}
      <HamburgerMenu />
    </View>
  );
}

export default function TabLayout() {
  const { count: pendingSync } = useOutbox();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
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
        name="riders"
        options={{
          title: 'Riders',
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
          headerRight: () => <HeaderRight addHref="/rider/new" />,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          title: 'Vehicles',
          tabBarIcon: ({ color }) => <TabBarIcon name="car" color={color} />,
          headerRight: () => <HeaderRight addHref="/vehicle/new" />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <TabBarIcon name="ellipsis-h" color={color} />,
          headerRight: () => <HeaderRight />,
          // Surface unsynced writes waiting in the outbound queue.
          tabBarBadge: pendingSync > 0 ? pendingSync : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.warning, color: '#fff' },
        }}
      />
    </Tabs>
  );
}
