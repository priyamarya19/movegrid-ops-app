import { Link, Stack } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';

import { colors, space } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen</Text>
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
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  link: {
    marginTop: space(4),
    paddingVertical: space(4),
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
});
