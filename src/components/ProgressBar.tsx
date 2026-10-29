import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';

interface ProgressBarProps {
  progress: number; // 0 a 1
  style?: StyleProp<ViewStyle>;
  color?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  style,
  color = ExLibrisColors.progress,
  height = 5,
}) => {
  const clamped = Math.max(0, Math.min(1, progress || 0));

  return (
    <View style={[styles.track, { height }, style]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: ExLibrisColors.progressBg,
    borderRadius: ExLibrisMetrics.radiusPill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: ExLibrisMetrics.radiusPill,
  },
});
