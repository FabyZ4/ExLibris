import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ExLibrisMetrics } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';

interface ProgressBarProps {
  progress: number; // 0 a 1
  style?: StyleProp<ViewStyle>;
  color?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  style,
  color,
  height = 5,
}) => {
  const { colors, styles } = useExLibrisStyles(createStyles);
  const clamped = Math.max(0, Math.min(1, progress || 0));

  return (
    <View style={[styles.track, { height }, style]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color || colors.progress }]} />
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.progressBg,
    borderRadius: ExLibrisMetrics.radiusPill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: ExLibrisMetrics.radiusPill,
  },
});
