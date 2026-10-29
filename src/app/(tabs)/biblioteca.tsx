import { AppHeader } from '@/components/AppHeader';
import { BookCard } from '@/components/BookCard';
import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';
import { BibliotecaItem, useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type EstadoFiltro = 'leyendo' | 'por_leer' | 'leido';

export default function BibliotecaScreen() {
  const router = useRouter();
  const { biblioteca, actualizarProgreso, currentUser, removerDeBiblioteca } = useExLibris();
  const [filtroActivo, setFiltroActivo] = useState<EstadoFiltro>('leyendo');

  // Modal para registrar lectura diaria rápida
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBookForUpdate, setSelectedBookForUpdate] = useState<BibliotecaItem | null>(null);
  const [paginasLeidasHoy, setPaginasLeidasHoy] = useState('15');

  const enCursoCount = biblioteca.filter(b => b.estado === 'leyendo').length;
  const porLeerCount = biblioteca.filter(b => b.estado === 'por_leer').length;
  const leidosCount = biblioteca.filter(b => b.estado === 'leido').length;

  const itemsFiltrados = biblioteca.filter(b => b.estado === filtroActivo);

  const handleOpenRegistrar = () => {
    const primerLeyendo = biblioteca.find(b => b.estado === 'leyendo') || biblioteca[0];
    if (primerLeyendo) {
      setSelectedBookForUpdate(primerLeyendo);
      setModalVisible(true);
    } else {
      Alert.alert('Sin libros activos', 'Primero agrega libros a tu biblioteca para registrar avances.');
    }
  };

  const handleGuardarLectura = () => {
    if (!selectedBookForUpdate) return;
    const paginasSumar = parseInt(paginasLeidasHoy, 10);
    if (isNaN(paginasSumar) || paginasSumar <= 0) {
      Alert.alert('Error', 'Ingresa una cantidad válida de páginas leídas.');
      return;
    }

    const nuevaPagina = selectedBookForUpdate.pagina_actual + paginasSumar;
    actualizarProgreso(selectedBookForUpdate.isbn, nuevaPagina);
    setModalVisible(false);
    Alert.alert(
      '¡Gran avance!',
      `Has sumado ${paginasSumar} páginas a "${selectedBookForUpdate.libro.titulo}". Página actual: ${Math.min(
        nuevaPagina,
        selectedBookForUpdate.libro.total_paginas
      )}.`
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
  const renderEmptySlot = () => (
    <Pressable
      style={styles.addBookCard}
      onPress={() => router.push('/(tabs)/escaner')}
    >
      <View style={styles.addBookIconCircle}>
        <Ionicons name="barcode-outline" size={28} color={ExLibrisColors.primary} />
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
          <Text style={styles.titleCollection}>Mi Colección ExLibris</Text>
          <View style={styles.statsBadgeRow}>
            <Ionicons name="book-outline" size={14} color={ExLibrisColors.primary} />
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
              color={filtroActivo === 'leyendo' ? ExLibrisColors.textLight : ExLibrisColors.textSecondary}
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
              color={filtroActivo === 'por_leer' ? ExLibrisColors.textLight : ExLibrisColors.textSecondary}
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
              color={filtroActivo === 'leido' ? ExLibrisColors.textLight : ExLibrisColors.textSecondary}
            />
            <Text
              style={[styles.filterTabText, filtroActivo === 'leido' && styles.filterTabTextActive]}
            >
              Leídos ({leidosCount})
            </Text>
          </Pressable>
        </View>

        {/* Grilla de libros (2 columnas) */}
        <FlatList
          data={itemsFiltrados}
          keyExtractor={item => `${item.id_biblioteca}-${item.isbn}`}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <BookCard
              item={item}
              onLongPress={() => handleRemoveBook(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={44} color={ExLibrisColors.textMuted} />
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
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Registrar Lectura de Hoy</Text>
                <Pressable onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={22} color={ExLibrisColors.textSecondary} />
                </Pressable>
              </View>

              {selectedBookForUpdate && (
                <View style={styles.selectedBookInfo}>
                  <Text style={styles.selectedBookTitle} numberOfLines={1}>
                    {selectedBookForUpdate.libro.titulo}
                  </Text>
                  <Text style={styles.selectedBookPages}>
                    Página actual: {selectedBookForUpdate.pagina_actual} / {selectedBookForUpdate.libro.total_paginas}
                  </Text>
                </View>
              )}

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
            </View>
          </View>
        </Modal>
      </View>
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
  },
  summaryContainer: {
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingTop: ExLibrisMetrics.spacingSm,
    paddingBottom: ExLibrisMetrics.spacingXs,
  },
  titleCollection: {
    fontSize: 22,
    fontWeight: '800',
    color: ExLibrisColors.text,
    letterSpacing: -0.3,
  },
  statsBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  statsText: {
    fontSize: 12,
    color: ExLibrisColors.textSecondary,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 10,
    color: ExLibrisColors.textMuted,
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
    backgroundColor: ExLibrisColors.surfaceVariant,
    gap: 6,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
  },
  filterTabActive: {
    backgroundColor: ExLibrisColors.primary,
    borderColor: ExLibrisColors.primary,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: ExLibrisColors.textSecondary,
  },
  filterTabTextActive: {
    color: ExLibrisColors.textLight,
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
    color: ExLibrisColors.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: ExLibrisColors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 260,
  },
  addBookCard: {
    flex: 1,
    minHeight: 220,
    backgroundColor: ExLibrisColors.surfaceVariant,
    borderRadius: ExLibrisMetrics.radiusMd,
    margin: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: ExLibrisColors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ExLibrisMetrics.spacingMd,
  },
  addBookIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ExLibrisColors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addBookTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  addBookSubtitle: {
    fontSize: 10,
    color: ExLibrisColors.textSecondary,
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
    backgroundColor: ExLibrisColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 8,
    shadowColor: ExLibrisColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  btnRegistrarText: {
    color: ExLibrisColors.textLight,
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
  modalContent: {
    width: '100%',
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusLg,
    padding: ExLibrisMetrics.spacingLg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  selectedBookInfo: {
    backgroundColor: ExLibrisColors.surfaceVariant,
    padding: 10,
    borderRadius: ExLibrisMetrics.radiusSm,
    marginBottom: 12,
  },
  selectedBookTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  selectedBookPages: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ExLibrisColors.text,
    marginBottom: 6,
  },
  pageInput: {
    borderWidth: 1,
    borderColor: ExLibrisColors.borderDark,
    borderRadius: ExLibrisMetrics.radiusSm,
    padding: 10,
    fontSize: 16,
    color: ExLibrisColors.text,
    backgroundColor: ExLibrisColors.surface,
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
    backgroundColor: ExLibrisColors.surfaceVariant,
    borderRadius: ExLibrisMetrics.radiusSm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
  },
  quickAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  saveProgressBtn: {
    flexDirection: 'row',
    backgroundColor: ExLibrisColors.primary,
    paddingVertical: 12,
    borderRadius: ExLibrisMetrics.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveProgressBtnText: {
    color: ExLibrisColors.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
});
