import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/AppHeader';
import { StarRating } from '@/components/StarRating';
import { ProgressBar } from '@/components/ProgressBar';
import { useExLibris, Review } from '@/store/ExLibrisContext';
import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';

const MOTIVOS_REPORTE = [
  'Lenguaje ofensivo / Spoilers graves',
  'Spam comercial o enlaces sospechosos',
  'Contenido inapropiado / Fuera de tema',
  'Acoso o incitación al odio',
];

export default function ComunidadScreen() {
  const { resenas, publicarResena, reportarComentario, catalogo } = useExLibris();

  // Libro seleccionado para filtrar/publicar reseñas
  const [selectedIsbn, setSelectedIsbn] = useState<string>('9788408043645'); // La sombra del viento por defecto
  const [userRating, setUserRating] = useState<number>(5);
  const [userComment, setUserComment] = useState<string>('');

  // Modal para reportar
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReviewToReport, setSelectedReviewToReport] = useState<Review | null>(null);

  const selectedBook = catalogo.find(b => b.isbn === selectedIsbn) || catalogo[0];
  const activeReviews = resenas.filter(r => r.estado === 'publicado');

  const handlePublicar = () => {
    if (!userComment.trim()) {
      Alert.alert('Comentario vacío', 'Por favor escribe tu opinión literaria antes de publicar.');
      return;
    }

    publicarResena(selectedBook.isbn, userRating, userComment.trim());
    setUserComment('');
    Alert.alert('¡Reseña Publicada!', 'Tu valoración ya es visible para toda la comunidad lectora.');
  };

  const handleOpenReportModal = (review: Review) => {
    setSelectedReviewToReport(review);
    setReportModalVisible(true);
  };

  const handleConfirmReport = (motivo: string) => {
    if (!selectedReviewToReport) return;
    reportarComentario(selectedReviewToReport.id_resena, motivo);
    setReportModalVisible(false);
    Alert.alert(
      'Reporte Enviado',
      'Gracias por mantener la comunidad segura. El equipo de moderación revisará este comentario de inmediato.',
      [{ text: 'Entendido' }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader subtitle="Muro de Reseñas" />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Banner superior de libro activo */}
        <View style={styles.bookHeaderBanner}>
          <View style={styles.bookBannerInfo}>
            <Text style={styles.editionTag}>EDICIÓN CANÓNICA</Text>
            <Text style={styles.bannerBookTitle} numberOfLines={1}>
              {selectedBook.titulo}
            </Text>
            <Text style={styles.bannerBookAuthor}>
              {selectedBook.autor} · {selectedBook.anio || 2024}
            </Text>
          </View>
        </View>

        {/* Selector horizontal rápido de libros para ver reseñas */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookSelectorRow}>
          {catalogo.slice(0, 5).map(b => (
            <Pressable
              key={b.isbn}
              style={[
                styles.bookTabPill,
                selectedIsbn === b.isbn && styles.bookTabPillActive,
              ]}
              onPress={() => setSelectedIsbn(b.isbn)}
            >
              <Text
                style={[
                  styles.bookTabText,
                  selectedIsbn === b.isbn && styles.bookTabTextActive,
                ]}
                numberOfLines={1}
              >
                {b.titulo}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Calificación General y Desglose por Estrellas */}
        <View style={styles.ratingCard}>
          <View style={styles.ratingMainRow}>
            <View style={styles.ratingScoreCol}>
              <Text style={styles.bigScore}>4.8<Text style={styles.smallScore}> / 5.0</Text></Text>
              <StarRating rating={4.8} size={18} />
              <Text style={styles.ratingCountText}>
                {selectedBook.rating_count || 142} opiniones verificadas
              </Text>
            </View>

            {/* Barras de distribución horizontal */}
            <View style={styles.barsCol}>
              {[
                { star: 5, pct: 0.78, label: '78%' },
                { star: 4, pct: 0.15, label: '15%' },
                { star: 3, pct: 0.05, label: '5%' },
                { star: 2, pct: 0.01, label: '1%' },
                { star: 1, pct: 0.01, label: '1%' },
              ].map(item => (
                <View key={item.star} style={styles.barRow}>
                  <Text style={styles.starNum}>{item.star} ★</Text>
                  <View style={styles.barWrapper}>
                    <ProgressBar progress={item.pct} height={5} color={ExLibrisColors.primary} />
                  </View>
                  <Text style={styles.pctLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Caja de publicación: Tu valoración literaria */}
        <View style={styles.publishCard}>
          <View style={styles.publishHeader}>
            <Text style={styles.publishHeading}>Tu valoración literaria</Text>
            <Text style={styles.clubBadge}>ExLibris Club</Text>
          </View>

          <View style={styles.interactiveStarsRow}>
            <StarRating
              rating={userRating}
              size={26}
              interactive
              onRate={r => setUserRating(r)}
            />
            <Text style={styles.ratingLabel}>
              {userRating === 5
                ? 'Obra maestra (5/5)'
                : userRating === 4
                ? 'Muy bueno (4/5)'
                : userRating === 3
                ? 'Aceptable (3/5)'
                : 'Poco recomendable'}
            </Text>
          </View>

          <TextInput
            style={styles.commentInput}
            placeholder="Comparte tu opinión respetuosa sobre este libro..."
            placeholderTextColor={ExLibrisColors.textMuted}
            multiline
            numberOfLines={4}
            value={userComment}
            onChangeText={setUserComment}
          />

          <View style={styles.publishActionsRow}>
            <View style={styles.rulesHintRow}>
              <Ionicons name="shield-outline" size={14} color={ExLibrisColors.textSecondary} />
              <Text style={styles.rulesHintText}>Normas de respeto y exégesis</Text>
            </View>

            <Pressable style={styles.btnPublicar} onPress={handlePublicar}>
              <Text style={styles.btnPublicarText}>Publicar reseña</Text>
              <Ionicons name="send" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Sección: Críticas de lectores */}
        <View style={styles.reviewsListSection}>
          <View style={styles.reviewsListHeader}>
            <Text style={styles.reviewsListTitle}>Críticas de lectores</Text>
            <View style={styles.filterPill}>
              <Ionicons name="filter-outline" size={12} color={ExLibrisColors.textSecondary} />
              <Text style={styles.filterPillText}>Más relevantes</Text>
            </View>
          </View>

          {activeReviews.map(review => (
            <View key={review.id_resena} style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <View style={styles.reviewerInfo}>
                  <Ionicons name="person-circle-outline" size={32} color={ExLibrisColors.primary} />
                  <View>
                    <View style={styles.reviewerNameRow}>
                      <Text style={styles.reviewerName}>{review.nombre_usuario}</Text>
                      {review.avatar_badge && (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedBadgeText}>{review.avatar_badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.reviewDate}>{review.fecha}</Text>
                  </View>
                </View>

                {/* Botón Reportar para alertar al panel de moderador */}
                <Pressable
                  style={styles.btnReportar}
                  onPress={() => handleOpenReportModal(review)}
                >
                  <Ionicons name="alert-circle-outline" size={13} color={ExLibrisColors.textSecondary} />
                  <Text style={styles.btnReportarText}>Reportar</Text>
                </Pressable>
              </View>

              <View style={styles.reviewStarsRow}>
                <StarRating rating={review.calificacion} size={14} />
              </View>

              <Text style={styles.reviewBody}>{review.comentario}</Text>

              <View style={styles.reviewFooterRow}>
                <View style={styles.likesCountRow}>
                  <Ionicons name="thumbs-up-outline" size={13} color={ExLibrisColors.textSecondary} />
                  <Text style={styles.likesCountText}>{review.likes || 0}</Text>
                </View>
                <View style={styles.repliesCountRow}>
                  <Ionicons name="chatbubble-outline" size={13} color={ExLibrisColors.textSecondary} />
                  <Text style={styles.repliesCountText}>Respuestas</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal para enviar reporte a moderación */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.reportModalTitle}>Reportar Comentario</Text>
              <Pressable onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={22} color={ExLibrisColors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.reportModalSubtitle}>
              Selecciona la infracción cometida por {selectedReviewToReport?.nombre_usuario}:
            </Text>

            <View style={styles.motivosList}>
              {MOTIVOS_REPORTE.map((motivo, idx) => (
                <Pressable
                  key={idx}
                  style={styles.motivoItem}
                  onPress={() => handleConfirmReport(motivo)}
                >
                  <Ionicons name="alert-circle-outline" size={18} color={ExLibrisColors.danger} />
                  <Text style={styles.motivoItemText}>{motivo}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ExLibrisColors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: ExLibrisMetrics.spacingMd,
  },
  bookHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ExLibrisColors.surface,
    padding: 12,
    borderRadius: ExLibrisMetrics.radiusMd,
    marginTop: 10,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
  },
  bookBannerInfo: {
    flex: 1,
  },
  editionTag: {
    fontSize: 9,
    fontWeight: '800',
    color: ExLibrisColors.primary,
    letterSpacing: 0.5,
  },
  bannerBookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: ExLibrisColors.text,
    marginTop: 2,
  },
  bannerBookAuthor: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    marginTop: 2,
  },
  bookSelectorRow: {
    paddingVertical: 10,
  },
  bookTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: ExLibrisColors.surfaceVariant,
    marginRight: 8,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
  },
  bookTabPillActive: {
    backgroundColor: ExLibrisColors.primary,
    borderColor: ExLibrisColors.primary,
  },
  bookTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: ExLibrisColors.textSecondary,
    maxWidth: 140,
  },
  bookTabTextActive: {
    color: '#FFFFFF',
  },
  ratingCard: {
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: ExLibrisMetrics.spacingMd,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    marginBottom: 12,
  },
  ratingMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingScoreCol: {
    width: 130,
    alignItems: 'center',
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: ExLibrisColors.border,
  },
  bigScore: {
    fontSize: 32,
    fontWeight: '800',
    color: ExLibrisColors.text,
  },
  smallScore: {
    fontSize: 14,
    color: ExLibrisColors.textSecondary,
    fontWeight: '400',
  },
  ratingCountText: {
    fontSize: 9,
    color: ExLibrisColors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  barsCol: {
    flex: 1,
    paddingLeft: 12,
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starNum: {
    fontSize: 10,
    color: ExLibrisColors.textSecondary,
    width: 20,
  },
  barWrapper: {
    flex: 1,
  },
  pctLabel: {
    fontSize: 9,
    color: ExLibrisColors.textMuted,
    width: 24,
    textAlign: 'right',
  },
  publishCard: {
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: ExLibrisMetrics.spacingMd,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    marginBottom: 16,
  },
  publishHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  publishHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  clubBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  interactiveStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ratingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: ExLibrisColors.textSecondary,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: ExLibrisColors.borderDark,
    borderRadius: ExLibrisMetrics.radiusSm,
    padding: 10,
    fontSize: 12,
    color: ExLibrisColors.text,
    backgroundColor: ExLibrisColors.surfaceVariant,
    textAlignVertical: 'top',
    minHeight: 70,
    marginBottom: 10,
  },
  publishActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rulesHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rulesHintText: {
    fontSize: 10,
    color: ExLibrisColors.textSecondary,
  },
  btnPublicar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ExLibrisColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: ExLibrisMetrics.radiusSm,
    gap: 6,
  },
  btnPublicarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  reviewsListSection: {
    gap: 10,
  },
  reviewsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewsListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: ExLibrisColors.surfaceVariant,
  },
  filterPillText: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    fontWeight: '500',
  },
  reviewCard: {
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: 12,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarMiniPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ExLibrisColors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewerName: {
    fontSize: 12,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  verifiedBadge: {
    backgroundColor: ExLibrisColors.moderatorLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: ExLibrisColors.moderator,
  },
  reviewDate: {
    fontSize: 10,
    color: ExLibrisColors.textMuted,
  },
  btnReportar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: ExLibrisColors.surfaceVariant,
  },
  btnReportarText: {
    fontSize: 10,
    color: ExLibrisColors.textSecondary,
    fontWeight: '600',
  },
  reviewStarsRow: {
    marginBottom: 6,
  },
  reviewBody: {
    fontSize: 12,
    lineHeight: 17,
    color: ExLibrisColors.text,
  },
  reviewFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  likesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesCountText: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
  },
  repliesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  repliesCountText: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reportModalCard: {
    width: '100%',
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusLg,
    padding: ExLibrisMetrics.spacingLg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  reportModalSubtitle: {
    fontSize: 12,
    color: ExLibrisColors.textSecondary,
    marginBottom: 14,
  },
  motivosList: {
    gap: 10,
  },
  motivoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: ExLibrisColors.surfaceVariant,
    borderRadius: ExLibrisMetrics.radiusSm,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    gap: 10,
  },
  motivoItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: ExLibrisColors.text,
    flex: 1,
  },
});
