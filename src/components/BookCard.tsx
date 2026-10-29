import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';
import { BibliotecaItem } from '@/store/ExLibrisContext';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from './ProgressBar';

interface BookCardProps {
  item: BibliotecaItem;
  onLongPress?: () => void;
}

export const BookCard: React.FC<BookCardProps> = ({ item, onLongPress }) => {
  const router = useRouter();
  const { libro, pagina_actual } = item;
  const total = libro.total_paginas || 1;
  const progressRatio = pagina_actual / total;
  const progressPercent = Math.min(100, Math.round(progressRatio * 100));
  const remainingPages = Math.max(0, total - pagina_actual);

  // Estimación simple: 1 minuto por página leída
  const remainingHours = Math.ceil(remainingPages / 60);

  const handlePress = () => {
    router.push({
      pathname: '/detalle_libro',
      params: { isbn: item.isbn },
    });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.cardContainer, pressed && styles.cardPressed]}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: libro.portada_url }}
          style={styles.coverImage}
          resizeMode="cover"
        />
        {item.estado === 'leido' && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Leído</Text>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {libro.titulo}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          {libro.autor}
        </Text>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.pageText}>
              Pág. {pagina_actual} / {total}
            </Text>
            <Text style={styles.percentText}>{progressPercent}%</Text>
          </View>
          <ProgressBar progress={progressRatio} height={5} />
          <Text style={styles.remainingText}>
            {remainingPages === 0
              ? 'Lectura completada ✓'
              : `Faltan ${remainingPages} págs · ~${remainingHours}h`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    margin: 6,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  imageWrapper: {
    width: '100%',
    height: 170,
    backgroundColor: ExLibrisColors.surfaceVariant,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: ExLibrisColors.moderator,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ExLibrisMetrics.radiusPill,
  },
  completedText: {
    color: ExLibrisColors.textLight,
    fontSize: 10,
    fontWeight: '700',
  },
  infoContainer: {
    padding: ExLibrisMetrics.spacingSm,
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ExLibrisColors.text,
    lineHeight: 17,
    minHeight: 34,
  },
  bookAuthor: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    marginTop: 2,
  },
  progressSection: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pageText: {
    fontSize: 10,
    color: ExLibrisColors.textSecondary,
    fontWeight: '500',
  },
  percentText: {
    fontSize: 10,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  remainingText: {
    fontSize: 9,
    color: ExLibrisColors.textMuted,
    marginTop: 4,
  },
});
