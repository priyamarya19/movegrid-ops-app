import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { getRentWaivers } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

/**
 * Persistent indicator for pending rent waiver approvals — mirrors the dashboard's
 * RentWaiverBanner. Self-detects authorization: `can_approve_rent_waivers` is a
 * per-user permission independent of role, so there's no role check here — a
 * non-ok response (403 for unauthorized users) just renders nothing, same as the
 * web banner.
 */
export function RentWaiverBanner() {
  const { token } = useAuth();
  const { t } = useTheme();
  const router = useRouter();
  const [count, setCount] = useState(0);

  // Re-check on every visit to Home (not just mount), so approving/rejecting all
  // requests on the review screen and coming back makes the banner disappear.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let cancelled = false;
      getRentWaivers(token)
        .then((rows) => {
          if (!cancelled) setCount(rows.length);
        })
        .catch(() => {
          if (!cancelled) setCount(0);
        });
      return () => {
        cancelled = true;
      };
    }, [token])
  );

  if (count === 0) return null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: t.warningSoft, borderColor: t.warning },
        pressed && styles.pressed,
      ]}
      onPress={() => router.push('/rent-waivers')}>
      <FontAwesome name="exclamation-circle" size={16} color={t.warningText} />
      <Text style={[styles.text, { color: t.warningText }]}>
        {count} rent waiver request{count === 1 ? '' : 's'} awaiting your approval
      </Text>
      <FontAwesome name="angle-right" size={16} color={t.warningText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});
