import LottieView from 'lottie-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space } from '@/constants/theme';

/**
 * Full-screen branded loading state. Renders the route-loading Lottie
 * (waypoints + vehicle animating along a route) on the app background.
 * Used while the persisted auth session is resolving.
 */
export function LoadingScreen({ caption = 'Loading…' }: { caption?: string }) {
  return (
    <View style={styles.container}>
      <LottieView
        source={require('@/assets/lottie/route-loading.json')}
        autoPlay
        loop
        style={styles.lottie}
      />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  lottie: {
    width: 200,
    height: 200,
  },
  caption: {
    marginTop: space(2),
    fontSize: 14,
    color: colors.textMuted,
  },
});

export default LoadingScreen;
