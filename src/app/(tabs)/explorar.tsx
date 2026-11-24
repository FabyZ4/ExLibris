import { AppHeader } from '@/components/AppHeader';
import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';
import { Book, useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExplorarScreen() {
  const router = useRouter();
  const {
    catalogo,
    categorias,
    recargarCatalogo,
    buscarEnCatalogo,
    agregarALaBiblioteca,
    biblioteca,
    obtenerMetricasLibro,
  } = useExLibris();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('Todos');
  const [refreshing, setRefreshing] = useState(false);

  const librosFiltrados = buscarEnCatalogo(searchTerm, selectedCategoria);
  const recomendados = catalogo.slice(0, 4);

  const isInLibrary = (isbn: string) => {
    return biblioteca.some(b => b.isbn === isbn);
  };

  const handleAgregarAEstante = (book: Book) => {
    if (isInLibrary(book.isbn)) {
      Alert.alert('Ya en tu colección', `"${book.titulo}" ya forma parte de tus estantes.`);
      return;
    }

    agregarALaBiblioteca(book, 'por_leer', {
      lugar_compra: 'Librería Recomendada',
      precio_compra: 14990,
      fecha_compra: 'Hoy',
      formato_edicion: 'Edición en catálogo',
    });

    Alert.alert('¡Añadido con éxito!', `"${book.titulo}" fue agregado a tu sección "Por leer".`);
  };

  const handleAbrirDetalle = (isbn: string) => {
    router.push({
      pathname: '/detalle_libro',
      params: { isbn },
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await recargarCatalogo();
    } catch (error) {
      console.warn('No se pudo actualizar el catálogo desde Supabase:', error);
      Alert.alert('No se pudo actualizar', 'Verifica tu conexión e inténtalo nuevamente.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader subtitle="Explorar y Descubrir" />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Barra superior de búsqueda reactiva */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={ExLibrisColors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por título, autor o ISBN..."
              placeholderTextColor={ExLibrisColors.textMuted}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm.length > 0 && (
              <Pressable onPress={() => setSearchTerm('')}>
                <Ionicons name="close-circle" size={18} color={ExLibrisColors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Fila deslizable de filtros rápidos con Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {['Todos', ...categorias].map(cat => (
            <Pressable
              key={cat}
              style={[
                styles.chip,
                selectedCategoria === cat && styles.chipActive,
              ]}
              onPress={() => setSelectedCategoria(cat)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategoria === cat && styles.chipTextActive,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Sección 1: Obras Recomendadas (Carrusel Horizontal) */}
        {!searchTerm && selectedCategoria === 'Todos' && (
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Obras recomendadas</Text>
              <Text style={styles.sectionSubtitle}>
              </Text>
            </View>
          </View>
        )}

        {!searchTerm && selectedCategoria === 'Todos' && (
          <FlatList
            horizontal
            data={recomendados}
            keyExtractor={item => `rec-${item.isbn}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalCarousel}
            renderItem={({ item }) => (
              <Pressable
                style={styles.carouselCard}
                onPress={() => handleAbrirDetalle(item.isbn)}
              >
                <Image
                  source={{ uri: item.portada_url }}
                  style={styles.carouselCover}
                  resizeMode="cover"
                />
                <Text style={styles.carouselTitle} numberOfLines={1}>
                  {item.titulo}
                </Text>
                <Text style={styles.carouselAuthor} numberOfLines={1}>
                  {item.autor}
                </Text>
                {(() => {
                  const metricas = obtenerMetricasLibro(item.isbn);
                  return (
                    <View style={styles.carouselRating}>
                      <Ionicons
                        name={metricas.promedio !== null ? 'star' : 'star-outline'}
                        size={12}
                        color={metricas.promedio !== null ? ExLibrisColors.gold : ExLibrisColors.textSecondary}
                      />
                      <Text style={styles.ratingValue}>
                        {metricas.promedio !== null ? metricas.promedio.toFixed(1) : '—'}
                      </Text>
                      <Text style={styles.ratingCount}>({metricas.totalVotos})</Text>
                    </View>
                  );
                })()}
              </Pressable>
            )}
          />
        )}

        {/* Sección 2: Novedades en Catálogo (Lista Vertical) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {searchTerm || selectedCategoria !== 'Todos'
              ? `Resultados (${librosFiltrados.length})`
              : 'Novedades en Catálogo'}
          </Text>
        </View>

        <View style={styles.verticalList}>
          {librosFiltrados.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={40} color={ExLibrisColors.textMuted} />
              <Text style={styles.emptyText}>No encontramos libros con ese criterio.</Text>
            </View>
          ) : (
            librosFiltrados.map(libro => {
              const agregado = isInLibrary(libro.isbn);
              return (
                <Pressable
                  key={libro.isbn}
                  style={styles.verticalCard}
                  onPress={() => handleAbrirDetalle(libro.isbn)}
                >
                  <Image
                    source={{ uri: libro.portada_url }}
                    style={styles.verticalCover}
                    resizeMode="cover"
                  />
                  <View style={styles.verticalInfo}>
                    <View style={styles.tagRow}>
                      <Text style={styles.categoryBadge}>{libro.categorias.join(' · ')}</Text>
                      <Text style={styles.yearBadge}>{libro.anio || 2024}</Text>
                    </View>

                    <Text style={styles.verticalTitle} numberOfLines={1}>
                      {libro.titulo}
                    </Text>
                    <Text style={styles.verticalAuthor} numberOfLines={1}>
                      {libro.autor}
                    </Text>
                    <Text style={styles.isbnText}>ISBN: {libro.isbn}</Text>

                    <Pressable
                      style={[
                        styles.btnAddShelf,
                        agregado && styles.btnAddShelfDone,
                      ]}
                      onPress={() => handleAgregarAEstante(libro)}
                    >
                      <Ionicons
                        name={agregado ? 'checkmark' : 'add'}
                        size={14}
                        color={agregado ? ExLibrisColors.moderator : ExLibrisColors.primary}
                      />
                      <Text
                        style={[
                          styles.btnAddShelfText,
                          agregado && styles.btnAddShelfTextDone,
                        ]}
                      >
                        {agregado ? 'En tu estante' : '+ Añadir a mi estante'}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  searchSection: {
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingTop: ExLibrisMetrics.spacingSm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ExLibrisColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: ExLibrisMetrics.radiusPill,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: ExLibrisColors.text,
    padding: 0,
  },
  chipsContainer: {
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: ExLibrisColors.surfaceVariant,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
  },
  chipActive: {
    backgroundColor: ExLibrisColors.primary,
    borderColor: ExLibrisColors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ExLibrisColors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: ExLibrisColors.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    marginTop: 2,
  },
  horizontalCarousel: {
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    gap: 14,
    paddingBottom: 8,
  },
  carouselCard: {
    width: 135,
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: 8,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  carouselCover: {
    width: '100%',
    height: 160,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: ExLibrisColors.surfaceVariant,
    marginBottom: 8,
  },
  carouselTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  carouselAuthor: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    marginTop: 2,
  },
  carouselRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  ratingValue: {
    fontSize: 11,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  ratingCount: {
    fontSize: 10,
    color: ExLibrisColors.textMuted,
  },
  verticalList: {
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    gap: 12,
  },
  verticalCard: {
    flexDirection: 'row',
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: 10,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  verticalCover: {
    width: 75,
    height: 105,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: ExLibrisColors.surfaceVariant,
    marginRight: 12,
  },
  verticalInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  categoryBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: ExLibrisColors.primary,
    backgroundColor: ExLibrisColors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  yearBadge: {
    fontSize: 9,
    color: ExLibrisColors.textMuted,
    paddingVertical: 2,
  },
  verticalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ExLibrisColors.text,
  },
  verticalAuthor: {
    fontSize: 12,
    color: ExLibrisColors.textSecondary,
    marginTop: 2,
  },
  isbnText: {
    fontSize: 10,
    color: ExLibrisColors.textMuted,
    marginTop: 3,
    marginBottom: 8,
  },
  btnAddShelf: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: ExLibrisColors.surfaceVariant,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 4,
    borderWidth: 1,
    borderColor: ExLibrisColors.borderDark,
  },
  btnAddShelfDone: {
    backgroundColor: ExLibrisColors.moderatorLight,
    borderColor: ExLibrisColors.moderator,
  },
  btnAddShelfText: {
    fontSize: 11,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  btnAddShelfTextDone: {
    color: ExLibrisColors.moderator,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: ExLibrisColors.textSecondary,
    marginTop: 8,
  },
});
