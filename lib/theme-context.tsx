import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { darkTheme, lightTheme, type ThemeTokens } from '@/constants/theme';

const THEME_KEY = 'mg_theme_mode';

export type ThemeMode = 'light' | 'dark';

type ThemeState = {
  mode: ThemeMode;
  /** Active token set — the only thing screens should read colors from. */
  t: ThemeTokens;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default LIGHT: this is a daytime field job. Dark is an explicit opt-in.
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light') setModeState(saved);
      })
      .catch(() => {}); // unreadable preference → stay on the light default
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  };

  const value = useMemo<ThemeState>(
    () => ({ mode, t: mode === 'dark' ? darkTheme : lightTheme, setMode }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
