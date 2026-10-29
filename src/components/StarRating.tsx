import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExLibrisColors } from '@/constants/theme';

interface StarRatingProps {
  rating: number; // 1 a 5
  maxStars?: number;
  size?: number;
  onRate?: (rating: number) => void;
  interactive?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxStars = 5,
  size = 18,
  onRate,
  interactive = false,
}) => {
  const stars = [];

  for (let i = 1; i <= maxStars; i++) {
    let iconName: 'star' | 'star-half' | 'star-outline' = 'star-outline';
    if (rating >= i) {
      iconName = 'star';
    } else if (rating >= i - 0.5) {
      iconName = 'star-half';
    }

    const starIcon = (
      <Ionicons
        key={i}
        name={iconName}
        size={size}
        color={iconName !== 'star-outline' ? ExLibrisColors.gold : ExLibrisColors.borderDark}
        style={styles.star}
      />
    );

    if (interactive && onRate) {
      stars.push(
        <Pressable key={i} onPress={() => onRate(i)} hitSlop={6}>
          {starIcon}
        </Pressable>
      );
    } else {
      stars.push(starIcon);
    }
  }

  return <View style={styles.container}>{stars}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginRight: 2,
  },
});
