import { Link, Stack } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';

import { space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

export default function NotFoundScreen() {
  const { t } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <Text style={[styles.title, { color: t.text }]}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: t.accentText }]}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(5),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  link: {
    marginTop: space(4),
    paddingVertical: space(4),
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
