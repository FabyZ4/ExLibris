import { ProgressBar } from '@/components/ProgressBar';
import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';
import { BibliotecaItem, Book, useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DetalleLibroScreen() {
  const router = useRouter();
  const { isbn } = useLocalSearchParams<{ isbn: string }>();
  const {
    catalogo,
    getBibliotecaItem,
    actualizarProgreso,
    actualizarBitacora,
    agregarALaBiblioteca,
    removerDeBiblioteca,
    obtenerMetricasLibro,
  } = useExLibris();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/biblioteca');
    }
  };

  // Obtener información del libro y su bitácora
  const libro: Book | undefined = catalogo.find(b => b.isbn === isbn);
  const bibItem: BibliotecaItem | undefined = isbn ? getBibliotecaItem(isbn) : undefined;

  // Estado local para avance de páginas
  const totalPaginas = libro?.total_paginas || 300;
  const [paginaActual, setPaginaActual] = useState(() => bibItem?.pagina_actual || 0);
  const [sliderWidth, setSliderWidth] = useState(0);
  const [sliderLeft, setSliderLeft] = useState(0);
  const sliderRef = useRef<React.ComponentRef<typeof View>>(null);
  const updatePageFromPosition = (position: number) => {
    if (!sliderWidth) return;
    setPaginaActual(Math.min(totalPaginas, Math.max(0, Math.round((position / sliderWidth) * totalPaginas))));
  };
  const [sinopsisExpandida, setSinopsisExpandida] = useState(false);

  // Modal de edición de Cédula Bibliófila
  const [modalBitacoraVisible, setModalBitacoraVisible] = useState(false);
  const [tiendaInput, setTiendaInput] = useState(bibItem?.lugar_compra || 'Librería Antártica - Santiago, Chile');
  const [precioInput, setPrecioInput] = useState(bibItem?.precio_compra ? bibItem.precio_compra.toString() : '15990');
  const [fechaInput, setFechaInput] = useState(bibItem?.fecha_compra || '12 de Octubre, 2024');
  const [formatoInput, setFormatoInput] = useState(bibItem?.formato_edicion || 'Tapa dura · Con sobrecubierta mate');

  if (!libro) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={ExLibrisColors.danger} />
        <Text style={styles.errorText}>No se encontró el ejemplar solicitado.</Text>
        <Pressable style={styles.backBtnError} onPress={handleBack}>
          <Text style={styles.backBtnErrorText}>Regresar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const progresoRatio = paginaActual / totalPaginas;
  const progresoPorcentaje = Math.min(100, Math.round(progresoRatio * 100));
  const paginasRestantes = Math.max(0, totalPaginas - paginaActual);

  const handleGuardarSesion = () => {
    if (!bibItem) {
      // Si el libro aún no estaba en la biblioteca, lo agregamos primero
      agregarALaBiblioteca(libro, paginaActual >= totalPaginas ? 'leido' : 'leyendo', {
        pagina_actual: paginaActual,
        lugar_compra: tiendaInput,
        precio_compra: parseInt(precioInput, 10) || 0,
        fecha_compra: fechaInput,
        formato_edicion: formatoInput,
      });
    } else {
      actualizarProgreso(libro.isbn, paginaActual);
    }
    Alert.alert(
      'Sesión guardada',
      `Tu progreso ha quedado registrado en la página ${paginaActual} (${progresoPorcentaje}%).`
    );
  };

  const handleGuardarBitacora = () => {
    const precioNumerico = parseInt(precioInput, 10) || 0;
    if (bibItem) {
      actualizarBitacora(libro.isbn, {
        lugar_compra: tiendaInput,
        precio_compra: precioNumerico,
        fecha_compra: fechaInput,
        formato_edicion: formatoInput,
      });
    } else {
      agregarALaBiblioteca(libro, 'por_leer', {
        pagina_actual: paginaActual,
        lugar_compra: tiendaInput,
        precio_compra: precioNumerico,
        fecha_compra: fechaInput,
        formato_edicion: formatoInput,
      });
    }
    setModalBitacoraVisible(false);
    Alert.alert('Cédula Actualizada', 'Los datos de adquisición se han guardado con éxito.');
  };

  const estadoLegible = paginaActual >= totalPaginas || bibItem?.estado === 'leido'
      ? 'COMPLETADO / LEÍDO'
      : !bibItem
        ? 'DISPONIBLE EN CATÁLOGO'
        : paginaActual > 0 || bibItem.estado === 'leyendo'
        ? 'LEYENDO ACTUALMENTE'
        : 'POR LEER';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Barra de navegación superior */}
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={ExLibrisColors.text} />
        </Pressable>
        <View style={styles.titleRow}>
          <View style={styles.brandIconMini}>
            <Ionicons name="book-outline" size={14} color="#FFFFFF" />
          </View>
          <Text style={styles.navTitle}>Detalle Del Libro</Text>
        </View>
        <Ionicons name="person-circle-outline" size={28} color={ExLibrisColors.primary} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Portada y Ficha Técnica Central */}
        <View style={styles.heroSection}>
          <View style={styles.coverShadowBox}>
            <Image
              source={{ uri: libro.portada_url }}
              style={styles.bookCover}
              resizeMode="cover"
            />
          </View>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusPillText}>{estadoLegible}</Text>
          </View>

          <Text style={styles.bookMainTitle}>{libro.titulo}</Text>
          <Text style={styles.bookMainAuthor}>{libro.autor}</Text>
          <Text style={styles.bookEditionInfo}>
            {libro.editorial || 'Editorial Planeta'} · {libro.anio || 2024} · ISBN: {libro.isbn}
          </Text>
        </View>

        {/* Sección: Avance de Lectura */}
        <View style={styles.cardSection}>
          <View style={styles.progressHeaderRow}>
            <View style={styles.progressTitleWithIcon}>
              <Ionicons name="bookmarks-outline" size={16} color={ExLibrisColors.primary} />
              <Text style={styles.sectionHeading}>Avance de Lectura</Text>
            </View>
            <View style={styles.percentageBadge}>
              <Text style={styles.percentageBadgeText}>{progresoPorcentaje}%</Text>
            </View>
          </View>

          <View style={styles.pageStatsRow}>
            <Text style={styles.pageCurrentText}>
              Página <Text style={{ fontWeight: '800' }}>{paginaActual}</Text> de {totalPaginas}
            </Text>
            <Text style={styles.pageRemainingText}>Faltan {paginasRestantes} págs</Text>
          </View>

          <ProgressBar progress={progresoRatio} height={7} style={{ marginVertical: 10 }} />

          <View
            ref={sliderRef}
            style={styles.pageSliderTouchArea}
            onLayout={event => {
              setSliderWidth(event.nativeEvent.layout.width);
              sliderRef.current?.measureInWindow(x => setSliderLeft(x));
            }}
            onStartShouldSetResponderCapture={() => true}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={event => updatePageFromPosition(event.nativeEvent.pageX - sliderLeft)}
            onResponderMove={event => updatePageFromPosition(event.nativeEvent.pageX - sliderLeft)}
            onResponderTerminationRequest={() => false}
            onAccessibilityAction={event => {
              if (event.nativeEvent.actionName === 'increment') {
                setPaginaActual(page => Math.min(totalPaginas, page + 1));
              } else if (event.nativeEvent.actionName === 'decrement') {
                setPaginaActual(page => Math.max(0, page - 1));
              }
            }}
            accessibilityRole="adjustable"
            accessibilityLabel="Página actual"
            accessibilityValue={{ min: 0, max: totalPaginas, now: paginaActual }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          >
            <View style={styles.pageSliderTrack}>
              <View style={[styles.pageSliderFill, { width: `${progresoRatio * 100}%` }]} />
              <View style={[styles.pageSliderThumb, { left: `${progresoRatio * 100}%` }]} />
            </View>
          </View>

          <View style={styles.pageControlsRow}>
            <Pressable style={styles.saveSessionBtn} onPress={handleGuardarSesion}>
              <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
              <Text style={styles.saveSessionBtnText}>Guardar sesión</Text>
            </Pressable>
          </View>
        </View>

        {/* Sección: CÉDULA BIBLIÓFILA (Bitácora de Compra) */}
        <View style={styles.cedulaCard}>
          <View style={styles.cedulaHeader}>
            <View style={styles.cedulaTitleRow}>
              <Ionicons name="receipt-outline" size={18} color={ExLibrisColors.primary} />
              <View>
                <Text style={styles.cedulaTag}>CÉDULA BIBLIÓFILA</Text>
                <Text style={styles.cedulaSubtitle}>Ex Libris Personalis</Text>
              </View>
            </View>
          </View>

          <View style={styles.cedulaGrid}>
            <View style={styles.cedulaCol}>
              <View style={styles.cedulaField}>
                <Text style={styles.fieldLabel}>Tienda / Origen</Text>
                <Text style={styles.fieldValue}>
                  {bibItem?.lugar_compra}
                </Text>
              </View>

              <View style={styles.cedulaField}>
                <Text style={styles.fieldLabel}>Fecha de compra</Text>
                <Text style={styles.fieldValue}>
                  {bibItem?.fecha_compra}
                </Text>
              </View>
            </View>

            <View style={styles.cedulaCol}>
              <View style={styles.cedulaField}>
                <Text style={styles.fieldLabel}>Inversión</Text>
                <Text style={[styles.fieldValue, { color: ExLibrisColors.primary, fontWeight: '800' }]}>
                  ${(bibItem?.precio_compra || 0).toLocaleString('es-CL')} CLP
                </Text>
              </View>

              <View style={styles.cedulaField}>
                <Text style={styles.fieldLabel}>Formato & Edición</Text>
                <Text style={styles.fieldValue}>
                  {bibItem?.formato_edicion}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            style={styles.btnEditarBitacora}
            onPress={() => setModalBitacoraVisible(true)}
          >
            <Ionicons name="pencil" size={14} color={ExLibrisColors.textSecondary} />
            <Text style={styles.btnEditarBitacoraText}>Editar datos de compra</Text>
          </Pressable>
        </View>

        {/* Botón para sacar de la biblioteca */}
        {bibItem && (
          <Pressable
            style={styles.btnRemover}
            onPress={() => {
              Alert.alert(
                'Sacar de la biblioteca',
                `¿Quitar "${libro.titulo}" de tu colección?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Sacar',
                    style: 'destructive',
                    onPress: () => {
                      removerDeBiblioteca(libro.isbn);
                      handleBack();
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={15} color={ExLibrisColors.danger} />
            <Text style={styles.btnRemoverText}>Sacar de mi biblioteca</Text>
          </Pressable>
        )}

        {/* Sección: Sinopsis Editorial con colapsable */}
        <View style={styles.cardSection}>
          <View style={styles.sinopsisHeader}>
            <Text style={styles.sectionHeading}>Sinopsis Editorial</Text>
            <Text style={styles.sinopsisCategory}>{libro.categorias.join(' · ')}</Text>
          </View>

          <Text
            style={styles.sinopsisText}
            numberOfLines={sinopsisExpandida ? undefined : 4}
          >
            {libro.sinopsis}
          </Text>

          <Pressable
            style={styles.expandSinopsisBtn}
            onPress={() => setSinopsisExpandida(!sinopsisExpandida)}
          >
            <Text style={styles.expandSinopsisText}>
              {sinopsisExpandida ? 'Leer menos ▲' : 'Leer más... ▼'}
            </Text>
          </Pressable>
        </View>

        {/* Botón inferior: Acceso a Reseñas Comunitarias */}
        {(() => {
          const metricas = obtenerMetricasLibro(libro.isbn);
          return (
            <Pressable
              style={styles.btnComunidad}
              onPress={() => router.push({
                pathname: '/(tabs)/comunidad',
                params: { isbn: libro.isbn },
              })}
            >
              <View style={styles.btnComunidadLeft}>
                <View style={styles.comunidadIconBadge}>
                  <Ionicons name="people-outline" size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.comunidadHeading}>Reseñas de la comunidad</Text>
                  <Text style={styles.comunidadSubheading}>
                    {metricas.totalVotos === 1
                      ? '1 opinión de la comunidad'
                      : metricas.totalVotos > 1
                      ? `${metricas.totalVotos} opiniones de lectores`
                      : 'Sin reseñas aún · ¡Sé el primero en opinar!'}
                  </Text>
                </View>
              </View>
              <View style={styles.ratingBox}>
                <Ionicons name="star" size={14} color={ExLibrisColors.gold} />
                <Text style={styles.ratingBoxText}>
                  {metricas.totalVotos > 0 && metricas.promedio !== null ? metricas.promedio.toFixed(1) : '—'}
                </Text>
              </View>
            </Pressable>
          );
        })()}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal para Editar Cédula Bibliófila */}
      <Modal
        visible={modalBitacoraVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalBitacoraVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Cédula Bibliófila</Text>
              <Pressable onPress={() => setModalBitacoraVisible(false)}>
                <Ionicons name="close" size={22} color={ExLibrisColors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.inputFieldLabel}>Tienda / Lugar de adquisición:</Text>
            <TextInput
              style={styles.modalInput}
              value={tiendaInput}
              onChangeText={setTiendaInput}
              placeholder="Ej. Feria del Libro, Librería Antártica"
            />

            <Text style={styles.inputFieldLabel}>Precio de inversión (CLP):</Text>
            <TextInput
              style={styles.modalInput}
              value={precioInput}
              onChangeText={setPrecioInput}
              keyboardType="numeric"
              placeholder="Ej. 15990"
            />

            <Text style={styles.inputFieldLabel}>Fecha de compra:</Text>
            <TextInput
              style={styles.modalInput}
              value={fechaInput}
              onChangeText={setFechaInput}
              placeholder="Ej. 12 de Octubre, 2024"
            />

            <Text style={styles.inputFieldLabel}>Formato & Edición:</Text>
            <TextInput
              style={styles.modalInput}
              value={formatoInput}
              onChangeText={setFormatoInput}
              placeholder="Ej. Tapa dura, Bolsillo, Conmemorativa"
            />

            <Pressable style={styles.btnGuardarModal} onPress={handleGuardarBitacora}>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.btnGuardarModalText}>Guardar Cédula</Text>
            </Pressable>
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
  scroll: {
    flex: 1,
    paddingHorizontal: ExLibrisMetrics.spacingMd,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ExLibrisColors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: ExLibrisColors.text,
    marginTop: 10,
    marginBottom: 20,
  },
  backBtnError: {
    backgroundColor: ExLibrisColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: ExLibrisMetrics.radiusSm,
  },
  backBtnErrorText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: 10,
    backgroundColor: ExLibrisColors.background,
    borderBottomWidth: 1,
    borderBottomColor: ExLibrisColors.border,
  },
  backButton: {
    padding: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIconMini: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: ExLibrisColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  avatarMini: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: ExLibrisColors.primary,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  coverShadowBox: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderRadius: ExLibrisMetrics.radiusMd,
    marginBottom: 14,
  },
  bookCover: {
    width: 140,
    height: 210,
    borderRadius: ExLibrisMetrics.radiusMd,
    backgroundColor: ExLibrisColors.surfaceVariant,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ExLibrisColors.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 6,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    marginBottom: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ExLibrisColors.progress,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: ExLibrisColors.primary,
    letterSpacing: 0.5,
  },
  bookMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: ExLibrisColors.text,
    textAlign: 'center',
  },
  bookMainAuthor: {
    fontSize: 14,
    color: ExLibrisColors.textSecondary,
    marginTop: 4,
  },
  bookEditionInfo: {
    fontSize: 11,
    color: ExLibrisColors.textMuted,
    marginTop: 4,
  },
  cardSection: {
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: ExLibrisMetrics.spacingMd,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    marginBottom: 14,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  percentageBadge: {
    backgroundColor: ExLibrisColors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: ExLibrisMetrics.radiusPill,
  },
  percentageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  pageStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pageCurrentText: {
    fontSize: 12,
    color: ExLibrisColors.text,
  },
  pageRemainingText: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
  },
  pageControlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  pageSliderTouchArea: {
    width: '100%',
    minHeight: 44,
    justifyContent: 'center',
  },
  pageSliderTrack: {
    height: 8,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: ExLibrisColors.progressBg,
    justifyContent: 'center',
  },
  pageSliderFill: {
    height: '100%',
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: ExLibrisColors.progress,
  },
  pageSliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: ExLibrisColors.primary,
    borderWidth: 3,
    borderColor: ExLibrisColors.surface,
    elevation: 2,
  },
  saveSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ExLibrisColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: ExLibrisMetrics.radiusSm,
    gap: 6,
  },
  saveSessionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  cedulaCard: {
    backgroundColor: '#F7F3EE',
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: ExLibrisMetrics.spacingMd,
    borderWidth: 1,
    borderColor: '#E2D9CE',
    marginBottom: 14,
  },
  cedulaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2D9CE',
    paddingBottom: 8,
    marginBottom: 10,
  },
  cedulaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cedulaTag: {
    fontSize: 11,
    fontWeight: '800',
    color: ExLibrisColors.primary,
    letterSpacing: 0.5,
  },
  cedulaSubtitle: {
    fontSize: 10,
    color: ExLibrisColors.textSecondary,
    fontStyle: 'italic',
  },
  cedulaGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  cedulaCol: {
    flex: 1,
    gap: 8,
  },
  cedulaField: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: ExLibrisMetrics.radiusSm,
    borderWidth: 1,
    borderColor: '#ECE5DB',
  },
  fieldLabel: {
    fontSize: 9,
    color: ExLibrisColors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  fieldValue: {
    fontSize: 11,
    fontWeight: '600',
    color: ExLibrisColors.text,
    marginTop: 2,
  },
  btnEditarBitacora: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
    paddingVertical: 4,
  },
  btnEditarBitacoraText: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    fontWeight: '600',
  },
  btnRemover: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: ExLibrisColors.danger,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: ExLibrisColors.dangerLight,
  },
  btnRemoverText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExLibrisColors.danger,
  },
  sinopsisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sinopsisCategory: {
    fontSize: 10,
    color: ExLibrisColors.textMuted,
  },
  sinopsisText: {
    fontSize: 12,
    lineHeight: 18,
    color: ExLibrisColors.textSecondary,
  },
  expandSinopsisBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  expandSinopsisText: {
    fontSize: 11,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  btnComunidad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ExLibrisColors.surface,
    padding: ExLibrisMetrics.spacingMd,
    borderRadius: ExLibrisMetrics.radiusMd,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  btnComunidadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  comunidadIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ExLibrisColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comunidadHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  comunidadSubheading: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    marginTop: 2,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ExLibrisColors.goldMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 4,
  },
  ratingBoxText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusLg,
    padding: ExLibrisMetrics.spacingLg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: ExLibrisColors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: ExLibrisColors.borderDark,
    borderRadius: ExLibrisMetrics.radiusSm,
    padding: 9,
    fontSize: 13,
    color: ExLibrisColors.text,
    backgroundColor: ExLibrisColors.surfaceVariant,
  },
  btnGuardarModal: {
    flexDirection: 'row',
    backgroundColor: ExLibrisColors.primary,
    paddingVertical: 12,
    borderRadius: ExLibrisMetrics.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  btnGuardarModalText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
