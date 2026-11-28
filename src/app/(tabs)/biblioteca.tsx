import { AppHeader } from '@/components/AppHeader';
import { BookCard } from '@/components/BookCard';
import { ExLibrisMetrics } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';
import { BibliotecaItem, useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type EstadoFiltro = 'leyendo' | 'por_leer' | 'leido';

export default function BibliotecaScreen() {
  const { colors, styles } = useExLibrisStyles(createStyles);
  const router = useRouter();
  const { biblioteca, actualizarProgreso, currentUser, removerDeBiblioteca } = useExLibris();
  const [filtroActivo, setFiltroActivo] = useState<EstadoFiltro>('leyendo');
  const [vistaBiblioteca, setVistaBiblioteca] = useState<'tarjetas' | 'lista'>('tarjetas');

  // Modal para registrar lectura diaria rápida
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBookIsbn, setSelectedBookIsbn] = useState<string | null>(null);
  const [selectorLibrosVisible, setSelectorLibrosVisible] = useState(false);
  const [paginasLeidasHoy, setPaginasLeidasHoy] = useState('15');

  const enCursoCount = biblioteca.filter(b => b.estado === 'leyendo').length;
  const porLeerCount = biblioteca.filter(b => b.estado === 'por_leer').length;
  const leidosCount = biblioteca.filter(b => b.estado === 'leido').length;
  const librosDisponiblesLectura = biblioteca.filter(
    item => item.pagina_actual < item.libro.total_paginas
  );
  const selectedBookForUpdate = librosDisponiblesLectura.find(
    item => item.isbn === selectedBookIsbn
  ) || null;

  const itemsFiltrados = biblioteca.filter(b => b.estado === filtroActivo);

  const handleOpenRegistrar = () => {
    const primerLeyendo = librosDisponiblesLectura.find(b => b.estado === 'leyendo')
      || librosDisponiblesLectura[0];
    if (primerLeyendo) {
      setSelectedBookIsbn(primerLeyendo.isbn);
      setSelectorLibrosVisible(false);
      setModalVisible(true);
    } else {
      Alert.alert(
        'Sin libros pendientes',
        'Agrega un libro o elige uno que todavía tenga páginas por leer.'
      );
    }
  };

  const handleGuardarLectura = () => {
    if (!selectedBookForUpdate) return;
    const paginasSumar = parseInt(paginasLeidasHoy, 10);
    if (isNaN(paginasSumar) || paginasSumar <= 0) {
      Alert.alert('Error', 'Ingresa una cantidad válida de páginas leídas.');
      return;
    }

    const paginasPendientes = selectedBookForUpdate.libro.total_paginas
      - selectedBookForUpdate.pagina_actual;
    const paginasAplicadas = Math.min(paginasSumar, paginasPendientes);
    const nuevaPagina = selectedBookForUpdate.pagina_actual + paginasAplicadas;
    actualizarProgreso(selectedBookForUpdate.isbn, nuevaPagina);
    setModalVisible(false);
    setSelectorLibrosVisible(false);
    Alert.alert(
      '¡Gran avance!',
      `Has sumado ${paginasAplicadas} páginas a "${selectedBookForUpdate.libro.titulo}". Página actual: ${nuevaPagina}.`
    );
  };

  const handleRemoveBook = (item: BibliotecaItem) => {
    Alert.alert(
      'Sacar de la biblioteca',
      `¿Quitar "${item.libro.titulo}" de tu colección?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sacar',
          style: 'destructive',
          onPress: () => removerDeBiblioteca(item.isbn),
        },
      ]
    );
  };

  // Botón tarjeta vacía para añadir tomo
  const renderEmptySlot = () => vistaBiblioteca === 'lista' ? (
    <Pressable
      style={styles.addBookListRow}
      onPress={() => router.push('/(tabs)/escaner')}
    >
      <View style={styles.addBookListIconCircle}>
        <Ionicons name="barcode-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.addBookListText}>
        <Text style={styles.addBookTitle}>Añadir Tomo</Text>
        <Text style={[styles.addBookSubtitle, styles.addBookListSubtitle]}>
          Desde estantería o escaneo ISBN
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  ) : (
    <Pressable
      style={styles.addBookCard}
      onPress={() => router.push('/(tabs)/escaner')}
    >
      <View style={styles.addBookIconCircle}>
        <Ionicons name="barcode-outline" size={28} color={colors.primary} />
      </View>
      <Text style={styles.addBookTitle}>Añadir Tomo</Text>
      <Text style={styles.addBookSubtitle}>Desde estantería o escaneo ISBN</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader subtitle={`Colección de ${currentUser?.nombre?.split(' ')[0] || 'Lector'}`} />

      <View style={styles.container}>
        {/* Título de la colección y métricas anuales */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryTitleRow}>
            <Text style={styles.titleCollection} numberOfLines={1}>
              Mi Colección ExLibris
            </Text>
            <View style={styles.viewToggle}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver libros en tarjetas"
                accessibilityState={{ selected: vistaBiblioteca === 'tarjetas' }}
                style={[
                  styles.viewToggleButton,
                  vistaBiblioteca === 'tarjetas' && styles.viewToggleButtonActive,
                ]}
                onPress={() => setVistaBiblioteca('tarjetas')}
              >
                <Ionicons
                  name="grid-outline"
                  size={18}
                  color={vistaBiblioteca === 'tarjetas' ? colors.textLight : colors.textSecondary}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver libros en lista"
                accessibilityState={{ selected: vistaBiblioteca === 'lista' }}
                style={[
                  styles.viewToggleButton,
                  vistaBiblioteca === 'lista' && styles.viewToggleButtonActive,
                ]}
                onPress={() => setVistaBiblioteca('lista')}
              >
                <Ionicons
                  name="list-outline"
                  size={18}
                  color={vistaBiblioteca === 'lista' ? colors.textLight : colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>
          <View style={styles.statsBadgeRow}>
            <Ionicons name="book-outline" size={14} color={colors.primary} />
            <Text style={styles.statsText}>
              {enCursoCount} en curso · {leidosCount} leídos · {biblioteca.length} libros en total
            </Text>
          </View>
          <Text style={styles.hintText}>
            Mantén presionado un libro para sacarlo de tu colección
          </Text>
        </View>

        {/* Pestañas de filtro de estado (Segmented Buttons) */}
        <View style={styles.filterContainer}>
          <Pressable
            style={[styles.filterTab, filtroActivo === 'leyendo' && styles.filterTabActive]}
            onPress={() => setFiltroActivo('leyendo')}
          >
            <Ionicons
              name="book-outline"
              size={14}
              color={filtroActivo === 'leyendo' ? colors.textLight : colors.textSecondary}
            />
            <Text
              style={[styles.filterTabText, filtroActivo === 'leyendo' && styles.filterTabTextActive]}
            >
              Leyendo ({enCursoCount})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterTab, filtroActivo === 'por_leer' && styles.filterTabActive]}
            onPress={() => setFiltroActivo('por_leer')}
          >
            <Ionicons
              name="list"
              size={14}
              color={filtroActivo === 'por_leer' ? colors.textLight : colors.textSecondary}
            />
            <Text
              style={[styles.filterTabText, filtroActivo === 'por_leer' && styles.filterTabTextActive]}
            >
              Por leer ({porLeerCount})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterTab, filtroActivo === 'leido' && styles.filterTabActive]}
            onPress={() => setFiltroActivo('leido')}
          >
            <Ionicons
              name="checkmark-done"
              size={14}
              color={filtroActivo === 'leido' ? colors.textLight : colors.textSecondary}
            />
            <Text
              style={[styles.filterTabText, filtroActivo === 'leido' && styles.filterTabTextActive]}
            >
              Leídos ({leidosCount})
            </Text>
          </Pressable>
        </View>

        {/* Vista de libros en tarjetas o lista compacta */}
        <FlatList
          key={vistaBiblioteca === 'tarjetas' ? 'biblioteca-tarjetas' : 'biblioteca-lista'}
          data={itemsFiltrados}
          keyExtractor={item => `${item.id_biblioteca}-${item.isbn}`}
          numColumns={vistaBiblioteca === 'tarjetas' ? 2 : 1}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <BookCard
              item={item}
              onLongPress={() => handleRemoveBook(item)}
              layout={vistaBiblioteca === 'tarjetas' ? 'card' : 'list'}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyStateTitle}>No tienes libros en esta categoría</Text>
              <Text style={styles.emptyStateSubtitle}>
                Usa el escáner ISBN para añadir ejemplares físicos a tu biblioteca personal.
              </Text>
            </View>
          }
          ListFooterComponent={renderEmptySlot}
        />

        {/* Botón flotante inferior: Registrar lectura de hoy */}
        <View style={styles.bottomBar}>
          <Pressable style={styles.btnRegistrarLectura} onPress={handleOpenRegistrar}>
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.btnRegistrarText}>+ Registrar lectura de hoy</Text>
          </Pressable>
        </View>

        {/* Modal para Registrar Lectura Diaria */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setModalVisible(false);
            setSelectorLibrosVisible(false);
          }}
        >
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoiding}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, selectorLibrosVisible && styles.modalSelectorContent]}>
              {selectorLibrosVisible ? (
                <>
                  <View style={styles.modalHeader}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Volver al registro de lectura"
                      onPress={() => setSelectorLibrosVisible(false)}
                      style={styles.modalBackButton}
                    >
                      <Ionicons name="arrow-back" size={20} color={colors.text} />
                    </Pressable>
                    <Text style={styles.modalTitle}>Elige un libro</Text>
                    <View style={styles.modalBackButton} />
                  </View>
                  <Text style={styles.bookSelectorHint}>
                    Selecciona dónde registrar las páginas leídas.
                  </Text>
                  <FlatList
                    data={librosDisponiblesLectura}
                    keyExtractor={item => item.isbn}
                    style={styles.bookSelectorList}
                    contentContainerStyle={styles.bookSelectorListContent}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => {
                      const seleccionado = item.isbn === selectedBookIsbn;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Seleccionar ${item.libro.titulo}`}
                          accessibilityState={{ selected: seleccionado }}
                          style={[
                            styles.bookOption,
                            seleccionado && styles.bookOptionSelected,
                          ]}
                          onPress={() => {
                            setSelectedBookIsbn(item.isbn);
                            setSelectorLibrosVisible(false);
                          }}
                        >
                          <View style={styles.bookOptionDetails}>
                            <Text style={styles.bookOptionTitle} numberOfLines={1}>
                              {item.libro.titulo}
                            </Text>
                            <Text style={styles.bookOptionAuthor} numberOfLines={1}>
                              {item.libro.autor}
                            </Text>
                            <Text style={styles.bookOptionPages}>
                              Pág. {item.pagina_actual} / {item.libro.total_paginas}
                            </Text>
                          </View>
                          <Ionicons
                            name={seleccionado ? 'checkmark-circle' : 'ellipse-outline'}
                            size={21}
                            color={seleccionado ? colors.primary : colors.textMuted}
                          />
                        </Pressable>
                      );
                    }}
                  />
                </>
              ) : (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Registrar Lectura de Hoy</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cerrar registro de lectura"
                      onPress={() => setModalVisible(false)}
                    >
                      <Ionicons name="close" size={22} color={colors.textSecondary} />
                    </Pressable>
                  </View>

                  <Text style={styles.inputLabel}>¿A qué libro sumamos las páginas?</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Cambiar libro. Seleccionado: ${selectedBookForUpdate?.libro.titulo || 'ninguno'}`}
                    onPress={() => setSelectorLibrosVisible(true)}
                    style={styles.selectedBookInfo}
                  >
                    <View style={styles.selectedBookDetails}>
                      <Text style={styles.selectedBookTitle} numberOfLines={1}>
                        {selectedBookForUpdate?.libro.titulo || 'Selecciona un libro'}
                      </Text>
                      {selectedBookForUpdate && (
                        <Text style={styles.selectedBookPages}>
                          Página {selectedBookForUpdate.pagina_actual} de {selectedBookForUpdate.libro.total_paginas}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-down" size={20} color={colors.primary} />
                  </Pressable>

                  <Text style={styles.inputLabel}>¿Cuántas páginas leíste hoy?</Text>
                  <TextInput
                    style={styles.pageInput}
                    keyboardType="numeric"
                    value={paginasLeidasHoy}
                    onChangeText={setPaginasLeidasHoy}
                    placeholder="Ej. 20"
                  />

                  <View style={styles.quickAddRow}>
                    {[5, 10, 20, 30].map(n => (
                      <Pressable
                        key={n}
                        style={styles.quickAddBtn}
                        onPress={() => setPaginasLeidasHoy(n.toString())}
                      >
                        <Text style={styles.quickAddBtnText}>+{n}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable style={styles.saveProgressBtn} onPress={handleGuardarLectura}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.saveProgressBtnText}>Guardar sesión</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
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
  },
  summaryContainer: {
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingTop: ExLibrisMetrics.spacingSm,
    paddingBottom: ExLibrisMetrics.spacingXs,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleCollection: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  viewToggle: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewToggleButton: {
    width: 32,
    height: 30,
    borderRadius: ExLibrisMetrics.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: colors.primary,
  },
  statsBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  statsText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: ExLibrisMetrics.spacingSm,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: colors.surfaceVariant,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.textLight,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 85,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 260,
  },
  addBookCard: {
    flex: 1,
    minHeight: 220,
    backgroundColor: colors.surfaceVariant,
    borderRadius: ExLibrisMetrics.radiusMd,
    margin: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ExLibrisMetrics.spacingMd,
  },
  addBookListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    marginVertical: 4,
    padding: 10,
    gap: 10,
    borderRadius: ExLibrisMetrics.radiusMd,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderDark,
  },
  addBookListIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBookListText: {
    flex: 1,
  },
  addBookListSubtitle: {
    textAlign: 'left',
  },
  addBookIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addBookTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  addBookSubtitle: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
  },
  btnRegistrarLectura: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  btnRegistrarText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalKeyboardAvoiding: {
    flex: 1,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusLg,
    padding: ExLibrisMetrics.spacingLg,
  },
  modalSelectorContent: {
    height: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalBackButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  selectedBookInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    padding: 10,
    borderRadius: ExLibrisMetrics.radiusSm,
    marginBottom: 12,
  },
  selectedBookDetails: {
    flex: 1,
    marginRight: 8,
  },
  selectedBookTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  selectedBookPages: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bookSelectorHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
  },
  bookSelectorList: {
    flex: 1,
  },
  bookSelectorListContent: {
    gap: 8,
  },
  bookOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: ExLibrisMetrics.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceVariant,
  },
  bookOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  bookOptionDetails: {
    flex: 1,
    marginRight: 10,
  },
  bookOptionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  bookOptionAuthor: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  bookOptionPages: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  pageInput: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: ExLibrisMetrics.radiusSm,
    padding: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickAddBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: ExLibrisMetrics.radiusSm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  saveProgressBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: ExLibrisMetrics.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveProgressBtnText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
});
