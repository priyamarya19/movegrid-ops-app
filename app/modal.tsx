import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet } from 'react-native';

import { colors, space } from '@/constants/theme';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MoveGrid Ops</Text>
      <Text style={styles.body}>Fleet operations on the go.</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(5),
    backgroundColor: colors.bg,
    gap: space(2),
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
  },
});
