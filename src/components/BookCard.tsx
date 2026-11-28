import type { ThemeColors } from '@/constants/theme';
import { ExLibrisMetrics } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';
import { BibliotecaItem } from '@/store/ExLibrisContext';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from './ProgressBar';

interface BookCardProps {
  item: BibliotecaItem;
  onLongPress?: () => void;
  layout?: 'card' | 'list';
}

export const BookCard: React.FC<BookCardProps> = ({ item, onLongPress, layout = 'card' }) => {
  const { styles } = useExLibrisStyles(createStyles);
  const router = useRouter();
  const { libro, pagina_actual } = item;
  const isList = layout === 'list';
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
      style={({ pressed }) => [
        isList ? styles.listContainer : styles.cardContainer,
        pressed && styles.cardPressed,
      ]}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={[styles.imageWrapper, isList && styles.listImageWrapper]}>
        <Image
          source={{ uri: libro.portada_url }}
          style={styles.coverImage}
          resizeMode="cover"
        />
        {item.estado === 'leido' && (
          <View style={[styles.completedBadge, isList && styles.listCompletedBadge]}>
            <Text style={[styles.completedText, isList && styles.listCompletedText]}>Leído</Text>
          </View>
        )}
      </View>

      <View style={[styles.infoContainer, isList && styles.listInfoContainer]}>
        <Text
          style={[styles.bookTitle, isList && styles.listBookTitle]}
          numberOfLines={isList ? 1 : 2}
        >
          {libro.titulo}
        </Text>
        <Text style={[styles.bookAuthor, isList && styles.listBookAuthor]} numberOfLines={1}>
          {libro.autor}
        </Text>

        <View style={[styles.progressSection, isList && styles.listProgressSection]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.pageText, isList && styles.listPageText]}>
              {isList ? `${pagina_actual} / ${total} págs.` : `Pág. ${pagina_actual} / ${total}`}
            </Text>
            <Text style={[styles.percentText, isList && styles.listPercentText]}>
              {progressPercent}%
            </Text>
          </View>
          <ProgressBar progress={progressRatio} height={isList ? 3 : 5} />
          <Text style={[styles.remainingText, isList && styles.listRemainingText]}>
            {remainingPages === 0
              ? 'Lectura completada ✓'
              : isList
                ? `Faltan ${remainingPages} págs.`
                : `Faltan ${remainingPages} págs · ~${remainingHours}h`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  cardContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    margin: 6,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  listContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    marginHorizontal: 6,
    marginVertical: 4,
    padding: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  imageWrapper: {
    width: '100%',
    height: 170,
    backgroundColor: colors.surfaceVariant,
    position: 'relative',
  },
  listImageWrapper: {
    width: 52,
    height: 72,
    borderRadius: 5,
    overflow: 'hidden',
    flexShrink: 0,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.moderator,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ExLibrisMetrics.radiusPill,
  },
  completedText: {
    color: colors.textLight,
    fontSize: 10,
    fontWeight: '700',
  },
  listCompletedBadge: {
    top: 3,
    right: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  listCompletedText: {
    fontSize: 12,
  },
  infoContainer: {
    padding: ExLibrisMetrics.spacingSm,
  },
  listInfoContainer: {
    flex: 1,
    padding: 0,
    minWidth: 0,
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 17,
    minHeight: 34,
  },
  listBookTitle: {
    fontSize: 14,
    lineHeight: 18,
    minHeight: 0,
  },
  bookAuthor: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listBookAuthor: {
    fontSize: 12,
  },
  progressSection: {
    marginTop: 8,
  },
  listProgressSection: {
    marginTop: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pageText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  listPageText: {
    fontSize: 11,
  },
  percentText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  listPercentText: {
    fontSize: 11,
  },
  remainingText: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
  },
  listRemainingText: {
    fontSize: 11,
    marginTop: 3,
  },
});
