import { getThemeColors } from '@/constants/theme';
import type { ThemeColors, ThemeMode } from '@/constants/theme';
import React, { createContext, useContext } from 'react';

const ThemeColorsContext = createContext<ThemeColors | undefined>(undefined);

export const ThemeColorsProvider: React.FC<{
  mode: ThemeMode;
  children: React.ReactNode;
}> = ({ mode, children }) => (
  <ThemeColorsContext.Provider value={getThemeColors(mode)}>
    {children}
  </ThemeColorsContext.Provider>
);

export const useAppThemeColors = (): ThemeColors => {
  const colors = useContext(ThemeColorsContext);
  if (!colors) {
    throw new Error('useAppThemeColors debe usarse dentro de ThemeColorsProvider');
  }
  return colors;
};
