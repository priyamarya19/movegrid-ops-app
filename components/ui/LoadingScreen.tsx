import LottieView from 'lottie-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

/**
 * Full-screen branded loading state. Renders the route-loading Lottie
 * (waypoints + vehicle animating along a route) on the app background.
 * Used while the persisted auth session is resolving.
 */
export function LoadingScreen({ caption = 'Loading…' }: { caption?: string }) {
  const { t } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <LottieView
        source={require('@/assets/lottie/route-loading.json')}
        autoPlay
        loop
        style={styles.lottie}
      />
      {caption ? <Text style={[styles.caption, { color: t.textMuted }]}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 200,
    height: 200,
  },
  caption: {
    marginTop: space(2),
    fontSize: 14,
  },
});

export default LoadingScreen;
