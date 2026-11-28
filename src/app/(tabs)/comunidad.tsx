import { AppHeader } from '@/components/AppHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StarRating } from '@/components/StarRating';
import { ExLibrisMetrics } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';
import { CommentReply, Review, useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOTIVOS_REPORTE = [
  'Lenguaje ofensivo / Spoilers graves',
  'Spam comercial o enlaces sospechosos',
  'Contenido inapropiado / Fuera de tema',
  'Acoso o incitación al odio',
];

type CriterioOrden = 'populares' | 'recientes' | 'calificacion';

interface SelectedReportTarget {
  id_resena: string;
  id_respuesta?: string;
  nombre_usuario: string;
  titulo_libro: string;
}

export default function ComunidadScreen() {
  const { colors, styles } = useExLibrisStyles(createStyles);
  const params = useLocalSearchParams<{ isbn?: string }>();
  const {
    resenas,
    publicarResena,
    eliminarResenaPropia,
    darLikeResena,
    responderResena,
    darLikeRespuesta,
    eliminarRespuestaPropia,
    obtenerMetricasLibro,
    reportarComentario,
    catalogo,
    currentUser,
  } = useExLibris();

  // Control de selección de libro: si viene por parámetro de ruta (ej. desde detalle_libro) se utiliza directamente;
  // si el usuario navega dentro de la pantalla, selectedIsbnOverride toma prioridad sin necesidad de un useEffect.
  const [selectedIsbnOverride, setSelectedIsbnOverride] = useState<string | null | undefined>(undefined);
  const selectedIsbn = selectedIsbnOverride !== undefined ? selectedIsbnOverride : (params.isbn || null);
  const setSelectedIsbn = (isbn: string | null) => setSelectedIsbnOverride(isbn);
  const [criterioOrden, setCriterioOrden] = useState<CriterioOrden>('populares');

  // Estado para nueva reseña de libro
  const [userRating, setUserRating] = useState<number>(5);
  const [userComment, setUserComment] = useState<string>('');

  // Estado para responder a comentarios específicos
  const [respuestasAbiertas, setRespuestasAbiertas] = useState<Record<string, boolean>>({});
  const [replyInputText, setReplyInputText] = useState<Record<string, string>>({});
  const [replyComposerOpen, setReplyComposerOpen] = useState<Record<string, boolean>>({});

  // Modal para reportar
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReportTarget, setSelectedReportTarget] = useState<SelectedReportTarget | null>(null);

  const currentUserId = currentUser?.id || 'demo-lector-id';
  const selectedBook = selectedIsbn ? catalogo.find(b => b.isbn === selectedIsbn) : null;

  // Filtrado de reseñas:
  // Si hay un libro seleccionado, ONLY reseñas de ese libro.
  // Si no hay libro seleccionado, todas las reseñas publicadas (muro sugerido).
  const baseReviews = resenas.filter(r => {
    if (r.estado !== 'publicado') return false;
    if (selectedIsbn) {
      return r.isbn === selectedIsbn;
    }
    return true;
  });

  // Ordenamiento funcional
  const activeReviews = [...baseReviews].sort((a, b) => {
    if (criterioOrden === 'populares') {
      return (b.likes || 0) - (a.likes || 0);
    }
    if (criterioOrden === 'calificacion') {
      return b.calificacion - a.calificacion;
    }
    // 'recientes': por orden de ID / fecha
    return b.id_resena.localeCompare(a.id_resena);
  });

  // Métricas reales y funcionales del libro actual (si hay uno seleccionado)
  const metricasLibroActual = selectedBook ? obtenerMetricasLibro(selectedBook.isbn) : null;

  const handlePublicar = () => {
    if (!selectedBook) return;
    if (!userComment.trim()) {
      Alert.alert('Comentario requerido', 'Por favor escribe tu opinión literaria antes de publicar.');
      return;
    }

    publicarResena(selectedBook.isbn, userRating, userComment.trim());
    setUserComment('');
    Alert.alert(
      '¡Reseña Publicada!',
      `Tu valoración de ${userRating} estrellas para "${selectedBook.titulo}" ya es visible para toda la comunidad.`
    );
  };

  const handleToggleRespuestas = (id_resena: string) => {
    setRespuestasAbiertas(prev => ({
      ...prev,
      [id_resena]: !prev[id_resena],
    }));
  };

  const handleEnviarRespuesta = (id_resena: string, id_respuesta_padre?: string) => {
    const inputKey = id_respuesta_padre || id_resena;
    const texto = replyInputText[inputKey]?.trim();
    if (!texto) {
      Alert.alert('Respuesta vacía', 'Escribe un mensaje antes de responder.');
      return;
    }

    responderResena(id_resena, texto, id_respuesta_padre).then(() => {
      setReplyInputText(prev => ({ ...prev, [inputKey]: '' }));
      setRespuestasAbiertas(prev => ({ ...prev, [id_resena]: true }));
      if (id_respuesta_padre) {
        setReplyComposerOpen(prev => ({ ...prev, [id_respuesta_padre]: false }));
      }
    }).catch(error => {
      console.error('No se pudo publicar la respuesta:', error);
      Alert.alert(
        'No se pudo responder',
        error instanceof Error ? error.message : 'Comprueba tu conexión e inténtalo de nuevo.'
      );
    });
  };

  const handleDeleteReview = (review: Review) => {
    Alert.alert('Eliminar comentario', '¿Quieres eliminar tu comentario? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          eliminarResenaPropia(review.id_resena).catch(error => {
            console.error('No se pudo eliminar el comentario:', error);
            Alert.alert('No se pudo eliminar', 'Comprueba tu conexión e inténtalo de nuevo.');
          });
        },
      },
    ]);
  };

  const handleLikeReply = (review: Review, reply: CommentReply) => {
    darLikeRespuesta(review.id_resena, reply.id_respuesta).catch(error => {
      console.error('No se pudo actualizar el me gusta de la respuesta:', error);
      Alert.alert('No se pudo actualizar', 'Comprueba tu conexión e inténtalo de nuevo.');
    });
  };

  const handleDeleteReply = (review: Review, reply: CommentReply) => {
    Alert.alert('Eliminar respuesta', '¿Quieres eliminar esta respuesta y sus respuestas anidadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          eliminarRespuestaPropia(review.id_resena, reply.id_respuesta).catch(error => {
            console.error('No se pudo eliminar la respuesta:', error);
            Alert.alert('No se pudo eliminar', 'Comprueba tu conexión e inténtalo de nuevo.');
          });
        },
      },
    ]);
  };

  const countReplies = (replies: CommentReply[]): number =>
    replies.reduce((count, reply) => count + 1 + countReplies(reply.respuestas || []), 0);

  const renderReply = (review: Review, reply: CommentReply, depth = 0): React.ReactNode => {
    const replyLiked = reply.likedBy?.includes(currentUserId);
    const isOwnReply = reply.id_usuario === currentUser?.id;

    return (
      <View
        key={reply.id_respuesta}
        style={[styles.replyThread, { marginLeft: Math.min(depth, 4) * 8 }]}
      >
        <View style={styles.replyItem}>
          <View style={styles.replyHeader}>
            <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.replyAuthor}>{reply.nombre_usuario}</Text>
            <Text style={styles.replyDate}>{reply.fecha}</Text>
          </View>
          <Text style={styles.replyContent}>{reply.comentario}</Text>
          <View style={styles.replyActionsRow}>
            <Pressable
              style={styles.replyAction}
              onPress={() => handleLikeReply(review, reply)}
              accessibilityRole="button"
              accessibilityLabel={`${replyLiked ? 'Quitar me gusta' : 'Me gusta'} de ${reply.nombre_usuario}`}
            >
              <Ionicons
                name={replyLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                size={13}
                color={replyLiked ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.replyActionText, replyLiked && styles.replyActionTextActive]}>
                {reply.likes} Me gusta
              </Text>
            </Pressable>
            <Pressable
              style={styles.replyAction}
              onPress={() => setReplyComposerOpen(prev => ({
                ...prev,
                [reply.id_respuesta]: !prev[reply.id_respuesta],
              }))}
            >
              <Ionicons name="chatbubble-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.replyActionText}>Responder</Text>
            </Pressable>
            {isOwnReply && (
              <Pressable
                style={styles.replyAction}
                onPress={() => handleDeleteReply(review, reply)}
                accessibilityRole="button"
                accessibilityLabel="Eliminar mi respuesta"
              >
                <Ionicons name="trash-outline" size={13} color={colors.danger} />
              </Pressable>
            )}
            {!isOwnReply && (
              <Pressable
                style={styles.replyAction}
                onPress={() => handleOpenReportModal(review, reply)}
                accessibilityRole="button"
                accessibilityLabel={`Reportar respuesta de ${reply.nombre_usuario}`}
              >
                <Ionicons name="alert-circle-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.replyActionText}>Reportar</Text>
              </Pressable>
            )}
          </View>

          {replyComposerOpen[reply.id_respuesta] && (
            <View style={styles.replyInputBox}>
              <TextInput
                style={styles.replyTextInput}
                placeholder={`Responder a ${reply.nombre_usuario}...`}
                placeholderTextColor={colors.textMuted}
                value={replyInputText[reply.id_respuesta] || ''}
                onChangeText={text => setReplyInputText(prev => ({
                  ...prev,
                  [reply.id_respuesta]: text,
                }))}
                accessibilityLabel={`Respuesta para ${reply.nombre_usuario}`}
              />
              <Pressable
                style={styles.btnEnviarReply}
                onPress={() => handleEnviarRespuesta(review.id_resena, reply.id_respuesta)}
                accessibilityRole="button"
                accessibilityLabel="Enviar respuesta"
              >
                <Ionicons name="send" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </View>
        {(reply.respuestas || []).map(nestedReply => renderReply(review, nestedReply, depth + 1))}
      </View>
    );
  };

  const handleOpenReportModal = (review: Review, reply?: CommentReply) => {
    setSelectedReportTarget({
      id_resena: review.id_resena,
      id_respuesta: reply?.id_respuesta,
      nombre_usuario: reply?.nombre_usuario || review.nombre_usuario,
      titulo_libro: review.titulo_libro,
    });
    setReportModalVisible(true);
  };

  const handleConfirmReport = async (motivo: string) => {
    if (!selectedReportTarget) return;
    try {
      await reportarComentario(
        selectedReportTarget.id_resena,
        motivo,
        selectedReportTarget.id_respuesta
      );
      setReportModalVisible(false);
      setSelectedReportTarget(null);
      Alert.alert(
        'Reporte Enviado',
        `Gracias por mantener la comunidad segura. El equipo de moderación revisará el comentario de ${selectedReportTarget.nombre_usuario}.`,
        [{ text: 'Entendido' }]
      );
    } catch (error) {
      let errorMessage = 'Comprueba tu conexión e inténtalo de nuevo.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (
        typeof error === 'object'
        && error !== null
        && 'message' in error
        && typeof error.message === 'string'
      ) {
        errorMessage = error.message;
      }
      Alert.alert(
        'No se pudo enviar el reporte',
        errorMessage
      );
    }
  };

  const handleCloseReportModal = () => {
    setReportModalVisible(false);
    setSelectedReportTarget(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader
        subtitle={selectedBook ? `Reseñas: ${selectedBook.titulo}` : 'Muro de la Comunidad'}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {/* ============================================================== */}
        {/* MODO 1: LIBRO ESPECÍFICO SELECCIONADO                          */}
        {/* ============================================================== */}
        {selectedBook && metricasLibroActual ? (
          <View style={styles.specificBookSection}>
            {/* Botón de retorno al muro sugerido general */}
            <Pressable
              style={styles.btnVolverMuro}
              onPress={() => setSelectedIsbn(null)}
            >
              <Ionicons name="arrow-back" size={16} color={colors.primary} />
              <Text style={styles.btnVolverMuroText}>Ver muro sugerido (todos los libros)</Text>
            </Pressable>

            {/* Banner del libro seleccionado */}
            <View style={styles.bookHeaderBanner}>
              <Image
                source={{ uri: selectedBook.portada_url }}
                style={styles.bannerCover}
                resizeMode="cover"
              />
              <View style={styles.bookBannerInfo}>
                <View style={styles.badgeSpecificRow}>
                  <Text style={styles.editionTag}>DEBATE LITERARIO</Text>
                  <View style={styles.votosChip}>
                    <Text style={styles.votosChipText}>
                      {metricasLibroActual.totalVotos}{' '}
                      {metricasLibroActual.totalVotos === 1 ? 'opinión' : 'opiniones'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bannerBookTitle} numberOfLines={2}>
                  {selectedBook.titulo}
                </Text>
                <Text style={styles.bannerBookAuthor}>
                  {selectedBook.autor} · {selectedBook.editorial || 'Editorial canónica'}
                </Text>
              </View>
            </View>

            {/* Calificación General y Desglose Funcional por Estrellas */}
            <View style={styles.ratingCard}>
              <View style={styles.ratingMainRow}>
                <View style={styles.ratingScoreCol}>
                  <Text style={styles.bigScore}>
                    {metricasLibroActual.totalVotos > 0 && metricasLibroActual.promedio !== null
                      ? metricasLibroActual.promedio.toFixed(1)
                      : '—'}
                    <Text style={styles.smallScore}> / 5.0</Text>
                  </Text>
                  <StarRating
                    rating={metricasLibroActual.totalVotos > 0 && metricasLibroActual.promedio !== null ? metricasLibroActual.promedio : 0}
                    size={18}
                  />
                  <Text style={styles.ratingCountText}>
                    {metricasLibroActual.totalVotos === 0
                      ? 'Sin calificaciones aún'
                      : metricasLibroActual.totalVotos === 1
                      ? '1 opinión real registrada'
                      : `${metricasLibroActual.totalVotos} opiniones registradas`}
                  </Text>
                </View>

                {/* Barras de distribución funcionales calculadas con reseñas reales */}
                <View style={styles.barsCol}>
                  {metricasLibroActual.distribucion.map(item => (
                    <View key={item.star} style={styles.barRow}>
                      <Text style={styles.starNum}>{item.star} ★</Text>
                      <View style={styles.barWrapper}>
                        <ProgressBar progress={item.pct} height={5} color={colors.primary} />
                      </View>
                      <Text style={styles.pctLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Caja de publicación: Tu valoración para este libro */}
            <View style={styles.publishCard}>
              <View style={styles.publishHeader}>
                <Text style={styles.publishHeading}>Tu valoración para esta obra</Text>
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
                    : userRating === 2
                    ? 'Regular (2/5)'
                    : 'Poco recomendable (1/5)'}
                </Text>
              </View>

              <TextInput
                style={styles.commentInput}
                placeholder={`Comparte tu crítica sobre "${selectedBook.titulo}"...`}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={userComment}
                onChangeText={setUserComment}
              />

              <View style={styles.publishActionsRow}>
                <View style={styles.rulesHintRow}>
                  <Ionicons name="shield-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.rulesHintText}>Comunidad respetuosa</Text>
                </View>

                <Pressable style={styles.btnPublicar} onPress={handlePublicar}>
                  <Text style={styles.btnPublicarText}>Publicar reseña</Text>
                  <Ionicons name="send" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          /* ============================================================== */
          /* MODO 2: MURO SUGERIDO GENERAL (ACCESO DESDE BOTTOM TABS)       */
          /* ============================================================== */
          <View style={styles.generalFeedSection}>
            {/* Banner de bienvenida al muro */}
            <View style={styles.welcomeBanner}>
              <View style={styles.welcomeBannerIcon}>
                <Ionicons name="people-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.welcomeBannerTextWrap}>
                <Text style={styles.welcomeBannerTitle}>Comunidad de Lectores</Text>
                <Text style={styles.welcomeBannerSub}>
                  Comentarios sugeridos y debates literarios de toda la red.
                </Text>
              </View>
            </View>

            {/* Selector horizontal de libros para filtrar a uno específico */}
            <View style={styles.carouselHeader}>
              <Ionicons name="book-outline" size={16} color={colors.primary} />
              <Text style={styles.carouselTitle}>Explorar críticas por libro:</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bookSelectorRow}
            >
              {catalogo.map(b => {
                const bookMetrics = obtenerMetricasLibro(b.isbn);
                return (
                  <Pressable
                    key={b.isbn}
                    style={styles.bookCardPill}
                    onPress={() => setSelectedIsbn(b.isbn)}
                  >
                    <Image
                      source={{ uri: b.portada_url }}
                      style={styles.bookCardPillCover}
                      resizeMode="cover"
                    />
                    <View style={styles.bookCardPillInfo}>
                      <Text style={styles.bookCardPillTitle} numberOfLines={1}>
                        {b.titulo}
                      </Text>
                      <View style={styles.bookCardPillRating}>
                        <Ionicons name="star" size={11} color={colors.gold} />
                        <Text style={styles.bookCardPillScore}>
                          {bookMetrics.totalVotos > 0 && bookMetrics.promedio !== null ? bookMetrics.promedio.toFixed(1) : '—'}
                        </Text>
                        <Text style={styles.bookCardPillCount}>
                          ({bookMetrics.totalVotos})
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ============================================================== */}
        {/* BARRA DE ORDENAMIENTO (FILTRAR POR POPULARES, RECIENTES, ETC)   */}
        {/* ============================================================== */}
        <View style={styles.reviewsListSection}>
          <View style={styles.reviewsListHeader}>
            <View>
              <Text style={styles.reviewsListTitle}>
                {selectedBook ? `Opiniones sobre la obra (${activeReviews.length})` : `Comentarios sugeridos (${activeReviews.length})`}
              </Text>
              <Text style={styles.reviewsListSubtitle}>
                {criterioOrden === 'populares'
                  ? 'Ordenados por número de likes de la comunidad'
                  : criterioOrden === 'recientes'
                  ? 'Comentarios más recientes primero'
                  : 'Ordenados por mayor calificación dada'}
              </Text>
            </View>
          </View>

          {/* Chips de ordenamiento */}
          <View style={styles.sortFilterChipsRow}>
            <Pressable
              style={[
                styles.sortChip,
                criterioOrden === 'populares' && styles.sortChipActive,
              ]}
              onPress={() => setCriterioOrden('populares')}
            >
              <Ionicons
                name="thumbs-up-outline"
                size={13}
                color={criterioOrden === 'populares' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.sortChipText,
                  criterioOrden === 'populares' && styles.sortChipTextActive,
                ]}
              >
                Populares
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.sortChip,
                criterioOrden === 'recientes' && styles.sortChipActive,
              ]}
              onPress={() => setCriterioOrden('recientes')}
            >
              <Ionicons
                name="time-outline"
                size={13}
                color={criterioOrden === 'recientes' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.sortChipText,
                  criterioOrden === 'recientes' && styles.sortChipTextActive,
                ]}
              >
                Más recientes
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.sortChip,
                criterioOrden === 'calificacion' && styles.sortChipActive,
              ]}
              onPress={() => setCriterioOrden('calificacion')}
            >
              <Ionicons
                name="star-outline"
                size={13}
                color={criterioOrden === 'calificacion' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.sortChipText,
                  criterioOrden === 'calificacion' && styles.sortChipTextActive,
                ]}
              >
                Mejor calificados
              </Text>
            </Pressable>
          </View>

          {/* Lista de Reseñas */}
          {activeReviews.length === 0 ? (
            <View style={styles.emptyReviewsCard}>
              <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyReviewsTitle}>
                {selectedBook
                  ? `Aún no hay reseñas para "${selectedBook.titulo}"`
                  : 'No se encontraron comentarios'}
              </Text>
              <Text style={styles.emptyReviewsSub}>
                {selectedBook
                  ? '¡Sé la primera persona en calificar esta obra utilizando la caja de arriba!'
                  : 'Explora nuestros libros y comparte tu opinión.'}
              </Text>
            </View>
          ) : (
            activeReviews.map(review => {
              const yaDioLike = review.likedBy?.includes(currentUserId);
              const respuestasVisibles = respuestasAbiertas[review.id_resena];
              const totalRespuestas = countReplies(review.respuestas || []);

              return (
                <View key={review.id_resena} style={styles.reviewCard}>
                  {/* Etiqueta del libro cuando estamos en el muro general */}
                  {!selectedIsbn && (
                    <Pressable
                      style={styles.reviewBookTag}
                      onPress={() => setSelectedIsbn(review.isbn)}
                    >
                      <Ionicons name="book-outline" size={13} color={colors.primary} />
                      <Text style={styles.reviewBookTagText} numberOfLines={1}>
                        {review.titulo_libro} · <Text style={{ fontStyle: 'italic' }}>{review.autor_libro}</Text>
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                    </Pressable>
                  )}

                  {/* Cabecera del revisor */}
                  <View style={styles.reviewCardHeader}>
                    <View style={styles.reviewerInfo}>
                      <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
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

                    {review.id_usuario === currentUser?.id ? (
                      <Pressable
                        style={styles.btnReportar}
                        onPress={() => handleDeleteReview(review)}
                        accessibilityRole="button"
                        accessibilityLabel="Eliminar mi comentario"
                      >
                        <Ionicons name="trash-outline" size={13} color={colors.danger} />
                        <Text style={[styles.btnReportarText, { color: colors.danger }]}>Eliminar</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.btnReportar}
                        onPress={() => handleOpenReportModal(review)}
                      >
                        <Ionicons name="alert-circle-outline" size={13} color={colors.textSecondary} />
                        <Text style={styles.btnReportarText}>Reportar</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Estrellas reales dadas por este usuario */}
                  <View style={styles.reviewStarsRow}>
                    <StarRating rating={review.calificacion} size={15} />
                    <Text style={styles.reviewRatingNumber}>({review.calificacion}.0)</Text>
                  </View>

                  {/* Cuerpo del comentario */}
                  <Text style={styles.reviewBody}>{review.comentario}</Text>

                  {/* Barra inferior: Likes funcionales y botón para comentar/responder */}
                  <View style={styles.reviewFooterRow}>
                    {/* Botón de Like funcional */}
                    <Pressable
                      style={[styles.btnLike, yaDioLike && styles.btnLikeActive]}
                      onPress={() => darLikeResena(review.id_resena)}
                    >
                      <Ionicons
                        name={yaDioLike ? 'thumbs-up' : 'thumbs-up-outline'}
                        size={15}
                        color={yaDioLike ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[styles.likeCountText, yaDioLike && styles.likeCountTextActive]}>
                        {review.likes || 0} {review.likes === 1 ? 'Me gusta' : 'Me gusta'}
                      </Text>
                    </Pressable>

                    {/* Botón para expandir/ver respuestas y comentar */}
                    <Pressable
                      style={styles.btnRespuestasToggle}
                      onPress={() => handleToggleRespuestas(review.id_resena)}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.repliesCountText}>
                        {totalRespuestas > 0 ? `${totalRespuestas} respuestas` : 'Comentar / Responder'}
                      </Text>
                      <Ionicons
                        name={respuestasVisibles ? 'chevron-up' : 'chevron-down'}
                        size={13}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  </View>

                  {/* ============================================================== */}
                  {/* SECCIÓN DE RESPUESTAS Y COMENTARIOS AL COMENTARIO              */}
                  {/* ============================================================== */}
                  {respuestasVisibles && (
                    <View style={styles.repliesContainer}>
                      {/* Listado de respuestas existentes */}
                      {review.respuestas && review.respuestas.length > 0 ? (
                        review.respuestas.map(rep => renderReply(review, rep))
                      ) : (
                        <Text style={styles.noRepliesText}>
                          Aún no hay respuestas a esta opinión. Sé el primero en comentar:
                        </Text>
                      )}

                      {/* Campo de entrada para agregar comentario propio a la reseña */}
                      <View style={styles.replyInputBox}>
                        <TextInput
                          style={styles.replyTextInput}
                          placeholder={`Responder a ${review.nombre_usuario}...`}
                          placeholderTextColor={colors.textMuted}
                          value={replyInputText[review.id_resena] || ''}
                          onChangeText={text =>
                            setReplyInputText(prev => ({ ...prev, [review.id_resena]: text }))
                          }
                          accessibilityLabel={`Respuesta para ${review.nombre_usuario}`}
                        />
                        <Pressable
                          style={styles.btnEnviarReply}
                          onPress={() => handleEnviarRespuesta(review.id_resena)}
                          accessibilityRole="button"
                          accessibilityLabel="Enviar respuesta"
                        >
                          <Ionicons name="send" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal para enviar reporte a moderación */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseReportModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.reportModalTitle}>Reportar Comentario</Text>
              <Pressable onPress={handleCloseReportModal}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.reportModalSubtitle}>
              Selecciona la infracción cometida por {selectedReportTarget?.nombre_usuario}:
            </Text>

            <View style={styles.motivosList}>
              {MOTIVOS_REPORTE.map((motivo, idx) => (
                <Pressable
                  key={idx}
                  style={styles.motivoItem}
                  onPress={() => handleConfirmReport(motivo)}
                >
                  <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: ExLibrisMetrics.spacingMd,
  },
  keyboardContainer: {
    flex: 1,
  },
  specificBookSection: {
    marginTop: 8,
  },
  btnVolverMuro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 6,
  },
  btnVolverMuroText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  generalFeedSection: {
    marginTop: 10,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: 12,
    gap: 12,
    marginBottom: 14,
  },
  welcomeBannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBannerTextWrap: {
    flex: 1,
  },
  welcomeBannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  welcomeBannerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  carouselTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  bookSelectorRow: {
    paddingBottom: 10,
    gap: 10,
  },
  bookCardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: ExLibrisMetrics.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    width: 170,
    gap: 8,
  },
  bookCardPillCover: {
    width: 38,
    height: 52,
    borderRadius: 4,
    backgroundColor: colors.surfaceVariant,
  },
  bookCardPillInfo: {
    flex: 1,
  },
  bookCardPillTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  bookCardPillRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  bookCardPillScore: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  bookCardPillCount: {
    fontSize: 10,
    color: colors.textMuted,
  },
  bookHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: ExLibrisMetrics.radiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 12,
  },
  bannerCover: {
    width: 50,
    height: 72,
    borderRadius: 6,
    backgroundColor: colors.surfaceVariant,
  },
  bookBannerInfo: {
    flex: 1,
  },
  badgeSpecificRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  editionTag: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  votosChip: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  votosChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  bannerBookTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  bannerBookAuthor: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingCard: {
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: ExLibrisMetrics.spacingMd,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderRightColor: colors.border,
  },
  bigScore: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
  },
  smallScore: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  ratingCountText: {
    fontSize: 9,
    color: colors.textMuted,
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
    color: colors.textSecondary,
    width: 20,
  },
  barWrapper: {
    flex: 1,
  },
  pctLabel: {
    fontSize: 9,
    color: colors.textMuted,
    width: 28,
    textAlign: 'right',
  },
  publishCard: {
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: ExLibrisMetrics.spacingMd,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
  },
  clubBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
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
    color: colors.textSecondary,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: ExLibrisMetrics.radiusSm,
    padding: 10,
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.surfaceVariant,
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
    color: colors.textSecondary,
  },
  btnPublicar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
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
    marginBottom: 2,
  },
  reviewsListTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  reviewsListSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sortFilterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
  emptyReviewsCard: {
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyReviewsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyReviewsSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 260,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewBookTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 5,
    marginBottom: 10,
  },
  reviewBookTagText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
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
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewerName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  verifiedBadge: {
    backgroundColor: colors.moderatorLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.moderator,
  },
  reviewDate: {
    fontSize: 10,
    color: colors.textMuted,
  },
  btnReportar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surfaceVariant,
  },
  btnReportarText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  reviewRatingNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  reviewBody: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.text,
  },
  reviewFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  btnLike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: colors.surfaceVariant,
  },
  btnLikeActive: {
    backgroundColor: colors.primaryMuted,
  },
  likeCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  likeCountTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  btnRespuestasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  repliesCountText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: ExLibrisMetrics.radiusSm,
    padding: 8,
  },
  replyItem: {
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: ExLibrisMetrics.radiusSm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replyThread: {
    marginBottom: 4,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  replyAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  replyDate: {
    fontSize: 9,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  replyContent: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 15,
  },
  replyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  replyAction: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  replyActionText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  replyActionTextActive: {
    color: colors.primary,
  },
  noRepliesText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  replyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  replyTextInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: ExLibrisMetrics.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
    color: colors.text,
  },
  btnEnviarReply: {
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: ExLibrisMetrics.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.surface,
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
    color: colors.text,
  },
  reportModalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  motivosList: {
    gap: 10,
  },
  motivoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surfaceVariant,
    borderRadius: ExLibrisMetrics.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  motivoItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
});
