// Shake-gesture detection via expo-sensors Accelerometer.
//
// Unlike React Native's DevSettings shake listener (which is DEV-only), this
// works in a standalone EAS preview APK because it reads the raw accelerometer.
// expo-sensors is part of Expo SDK 54, pure-managed (no custom prebuild), so it
// stays Expo Go compatible.
//
// The accelerometer reports acceleration in g-units. At rest one axis reads ~1
// (gravity); a deliberate shake spikes the total magnitude well past that. We
// fire when the magnitude exceeds SHAKE_THRESHOLD, then hold off for
// SHAKE_COOLDOWN_MS so a single shake doesn't fire the callback repeatedly.
import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';

// Total g-force magnitude that counts as a shake. Rest ≈ 1g; normal handling
// stays under ~1.5g, so ~1.8 triggers on a deliberate shake without false fires.
const SHAKE_THRESHOLD = 1.8;
// Ignore further shakes for this long after one fires (debounce repeat spikes).
const SHAKE_COOLDOWN_MS = 1000;
// Sample rate (~10Hz) — responsive enough for a shake, light on the sensor.
const UPDATE_INTERVAL_MS = 100;

/**
 * Subscribe to the accelerometer and invoke `onShake` when a shake is detected.
 * Unsubscribes on unmount. `onShake` is held in a ref so the subscription is set
 * up once and never resubscribes when the callback identity changes.
 */
export function useShake(onShake: () => void) {
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  const lastShakeRef = useRef(0);

  useEffect(() => {
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude < SHAKE_THRESHOLD) return;

      const now = Date.now();
      if (now - lastShakeRef.current < SHAKE_COOLDOWN_MS) return;

      lastShakeRef.current = now;
      onShakeRef.current();
    });

    return () => subscription.remove();
  }, []);
}
