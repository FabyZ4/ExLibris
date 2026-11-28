import { useAppThemeColors } from '@/store/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import { useMemo } from 'react';

export const useExLibrisStyles = <T>(
  createStyles: (colors: ThemeColors) => T
): { colors: ThemeColors; styles: T } => {
  const colors = useAppThemeColors();
  const styles = useMemo(() => createStyles(colors), [createStyles, colors]);
  return { colors, styles };
};
