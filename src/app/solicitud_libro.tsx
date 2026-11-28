import { ExLibrisMetrics } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';
import { DbCategoria, getCategoriasFromDb, getLibroPorIsbnDb } from '@/services/database.service';
import { Book, useExLibris } from '@/store/ExLibrisContext';
import { BookProposalData } from '@/types/moderation.types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const isValidIsbn = (value: string) => {
  if (/^(?:978|979)\d{10}$/.test(value)) {
    const sum = [...value].reduce(
      (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
      0
    );
    return sum % 10 === 0;
  }

  if (/^\d{9}[\dX]$/i.test(value)) {
    const sum = [...value].reduce(
      (total, digit, index) => total + (digit.toUpperCase() === 'X' ? 10 : Number(digit)) * (10 - index),
      0
    );
    return sum % 11 === 0;
  }

  return false;
};

const normalizarIsbn = (value: string) => value.replace(/[-\s]/g, '').trim().toUpperCase();
const normalizarNombreCategoria = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'url';
}) => {
  const { colors, styles } = useExLibrisStyles(createStyles);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
};

export default function SolicitudLibroScreen() {
  const { colors, styles } = useExLibrisStyles(createStyles);
  const router = useRouter();
  const { isbn: isbnParam } = useLocalSearchParams<{ isbn?: string }>();
  const {
    currentUser,
    catalogo,
    solicitudesLibroPropias,
    cargandoSolicitudesLibro,
    errorSolicitudesLibro,
    recargarSolicitudesLibro,
    enviarSolicitudLibro,
  } = useExLibris();

  const [isbn, setIsbn] = useState(isbnParam || '');
  const [categoriasDb, setCategoriasDb] = useState<DbCategoria[]>([]);
  const [busquedaLibroDb, setBusquedaLibroDb] = useState<{
    isbn: string;
    libro: Book | null;
    error: string;
  }>({ isbn: '', libro: null, error: '' });
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>([]);
  const [titulo, setTitulo] = useState('');
  const [autor, setAutor] = useState('');
  const [editorial, setEditorial] = useState('');
  const [anio, setAnio] = useState('');
  const [paginas, setPaginas] = useState('');
  const [sinopsis, setSinopsis] = useState('');
  const [portadaUrl, setPortadaUrl] = useState('');
  const [cargando, setCargando] = useState(false);
  const categoriasPreseleccionadasIsbn = useRef<string | null>(null);

  const isbnNormalizado = useMemo(() => normalizarIsbn(isbn), [isbn]);
  const libroCatalogo = catalogo.find(book => book.isbn === isbnNormalizado) || null;

  useEffect(() => {
    let active = true;
    getCategoriasFromDb()
      .then(data => {
        if (active) setCategoriasDb(data);
      })
      .catch(error => {
        console.warn('No se pudieron cargar categorías para la solicitud:', error);
        Alert.alert('Error', 'No se pudieron cargar las categorías disponibles.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!isValidIsbn(isbnNormalizado) || libroCatalogo) {
      return () => {
        active = false;
      };
    }

    getLibroPorIsbnDb(isbnNormalizado)
      .then(book => {
        if (active) setBusquedaLibroDb({ isbn: isbnNormalizado, libro: book, error: '' });
      })
      .catch(error => {
        if (active) {
          setBusquedaLibroDb({
            isbn: isbnNormalizado,
            libro: null,
            error: 'No se pudo verificar si el ISBN ya está en el catálogo.',
          });
          console.warn('No se pudo buscar el libro antes de crear la solicitud:', error);
        }
      });

    return () => {
      active = false;
    };
  }, [isbnNormalizado, libroCatalogo]);

  const lookupIsCurrent = busquedaLibroDb.isbn === isbnNormalizado;
  const libroActual = libroCatalogo || (lookupIsCurrent ? busquedaLibroDb.libro : null);
  const esLibroExistente = libroActual?.isbn === isbnNormalizado;
  const verificandoIsbn = isValidIsbn(isbnNormalizado) && !libroCatalogo && !lookupIsCurrent;
  const errorIsbn = lookupIsCurrent ? busquedaLibroDb.error : '';
  const categoriasActualesIds = useMemo(() => {
    if (!esLibroExistente || !libroActual) return [];
    const nombresActuales = new Set(
      (libroActual.categorias || []).map(normalizarNombreCategoria)
    );
    return categoriasDb
      .filter(category => nombresActuales.has(normalizarNombreCategoria(category.nombre_categoria)))
      .map(category => category.id_categoria);
  }, [categoriasDb, esLibroExistente, libroActual]);

  useEffect(() => {
    if (!esLibroExistente) {
      categoriasPreseleccionadasIsbn.current = null;
      return;
    }
    if (
      categoriasDb.length === 0
      || categoriasPreseleccionadasIsbn.current === isbnNormalizado
    ) {
      return;
    }

    setCategoriasSeleccionadas(prev =>
      Array.from(new Set([...categoriasActualesIds, ...prev]))
    );
    categoriasPreseleccionadasIsbn.current = isbnNormalizado;
  }, [categoriasActualesIds, categoriasDb.length, esLibroExistente, isbnNormalizado]);

  const toggleCategoria = (idCategoria: string) => {
    setCategoriasSeleccionadas(prev =>
      prev.includes(idCategoria)
        ? prev.filter(id => id !== idCategoria)
        : [...prev, idCategoria]
    );
  };

  const handleChangeIsbn = (value: string) => {
    setIsbn(value);
    setTitulo('');
    setAutor('');
    setEditorial('');
    setAnio('');
    setPaginas('');
    setSinopsis('');
    setPortadaUrl('');
    setCategoriasSeleccionadas([]);
    categoriasPreseleccionadasIsbn.current = null;
  };

  const crearDatosPropuestos = (): BookProposalData => {
    const propuesta: BookProposalData = {};
    const cambio = (value: string, current?: string) =>
      Boolean(value.trim()) && (!esLibroExistente || value.trim() !== current);

    if (cambio(titulo, libroActual?.titulo)) propuesta.titulo = titulo.trim();
    if (cambio(autor, libroActual?.autor)) propuesta.autor = autor.trim();
    if (cambio(editorial, libroActual?.editorial)) propuesta.editorial = editorial.trim();
    if (anio.trim() && (!esLibroExistente || Number(anio) !== libroActual?.anio)) {
      propuesta.anio = Number(anio);
    }
    if (paginas.trim() && (!esLibroExistente || Number(paginas) !== libroActual?.total_paginas)) {
      propuesta.total_paginas = Number(paginas);
    }
    if (cambio(sinopsis, libroActual?.sinopsis)) propuesta.sinopsis = sinopsis.trim();
    if (cambio(portadaUrl, libroActual?.portada_url)) propuesta.portada_url = portadaUrl.trim();
    const categoriasActualesSet = new Set(categoriasActualesIds);
    const categoriasSeleccionadasSet = new Set(categoriasSeleccionadas);
    const categoriasCambiaron = esLibroExistente && (
      categoriasActualesSet.size !== categoriasSeleccionadasSet.size
      || [...categoriasSeleccionadasSet].some(id => !categoriasActualesSet.has(id))
    );
    const debeProponerCategorias = esLibroExistente
      ? categoriasCambiaron
      : categoriasSeleccionadas.length > 0;
    if (debeProponerCategorias) {
      propuesta.id_categorias = categoriasSeleccionadas;
      propuesta.categorias = categoriasDb
        .filter(category => categoriasSeleccionadas.includes(category.id_categoria))
        .map(category => category.nombre_categoria);
    }
    return propuesta;
  };

  const handleEnviar = async () => {
    if (!currentUser) {
      Alert.alert('Inicia sesión', 'Debes iniciar sesión para enviar una solicitud.');
      return;
    }
    if (!isValidIsbn(isbnNormalizado)) {
      Alert.alert('ISBN inválido', 'Ingresa un ISBN-10 o ISBN-13 válido.');
      return;
    }
    if (errorIsbn) {
      Alert.alert('No se pudo verificar el ISBN', 'Vuelve a intentarlo antes de enviar la solicitud.');
      return;
    }
    if (!esLibroExistente && (!titulo.trim() || !autor.trim())) {
      Alert.alert('Datos requeridos', 'Para registrar un libro nuevo, el título y el autor son obligatorios.');
      return;
    }
    if (anio.trim() && (!/^\d{4}$/.test(anio) || Number(anio) < 1)) {
      Alert.alert('Año inválido', 'Ingresa un año de cuatro dígitos.');
      return;
    }
    if (paginas.trim() && (!/^\d+$/.test(paginas) || Number(paginas) < 1)) {
      Alert.alert('Páginas inválidas', 'Ingresa una cantidad de páginas mayor que cero.');
      return;
    }
    if (portadaUrl.trim() && !/^https:\/\/\S+$/i.test(portadaUrl.trim())) {
      Alert.alert('URL inválida', 'La portada debe tener una URL válida que comience con https://.');
      return;
    }

    const datosPropuestos = crearDatosPropuestos();
    if (Object.keys(datosPropuestos).length === 0) {
      Alert.alert('Sin cambios', 'Completa al menos un dato distinto o selecciona una categoría para sugerir.');
      return;
    }

    setCargando(true);
    try {
      await enviarSolicitudLibro({
        id_libro: esLibroExistente ? isbnNormalizado : null,
        isbn: isbnNormalizado,
        tipo: esLibroExistente ? 'actualizacion' : 'nuevo',
        datos_propuestos: datosPropuestos,
      });
      Alert.alert('Solicitud enviada', 'Un moderador revisará la información antes de publicarla.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo enviar la solicitud.';
      Alert.alert('Error al enviar', message);
    } finally {
      setCargando(false);
    }
  };

  const handleRefreshRequests = async () => {
    try {
      await recargarSolicitudesLibro();
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar',
        error instanceof Error ? error.message : 'Intenta nuevamente.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={23} color={colors.text} />
          </Pressable>
          <View style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>Aportar al catálogo</Text>
            <Text style={styles.topSubtitle}>La comunidad completa ExLibris</Text>
          </View>
          <Ionicons name="book-outline" size={24} color={colors.primary} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
            <Text style={styles.introText}>
              {esLibroExistente
                ? 'Sugiere datos o correcciones. Un moderador decidirá qué campos aplicar.'
                : '¿No encontramos el libro? Propón sus datos y un moderador los revisará antes de incorporarlo.'}
            </Text>
          </View>

          {!currentUser && (
            <View style={styles.loginCard}>
              <Text style={styles.loginText}>Inicia sesión para enviar y consultar tus solicitudes.</Text>
              <Pressable style={styles.loginButton} onPress={() => router.push('/')}>
                <Text style={styles.loginButtonText}>Iniciar sesión</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Identificación del libro</Text>
            <Field
              label="ISBN *"
              value={isbn}
              onChangeText={handleChangeIsbn}
              placeholder="ISBN-10 o ISBN-13"
            />
            {verificandoIsbn && (
              <View style={styles.inlineStatus}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.helperText}>Verificando el catálogo…</Text>
              </View>
            )}
            {esLibroExistente && (
              <View style={styles.inlineStatus}>
                <Ionicons name="checkmark-circle" size={16} color={colors.progress} />
                <Text style={styles.helperText}>Libro existente: sugerencia de actualización</Text>
              </View>
            )}
            {!!errorIsbn && <Text style={styles.errorText}>{errorIsbn}</Text>}

            <Text style={styles.sectionTitle}>Datos propuestos</Text>
            <Text style={styles.helperText}>
              {esLibroExistente
                ? 'Los valores actuales aparecen como referencia. Escribe solo los datos que deseas proponer.'
                : 'Título y autor son obligatorios.'}
            </Text>
            <Field
              label={esLibroExistente ? 'Título' : 'Título *'}
              value={titulo}
              onChangeText={setTitulo}
              placeholder={libroActual?.titulo || 'Título del libro'}
            />
            <Field
              label={esLibroExistente ? 'Autor' : 'Autor *'}
              value={autor}
              onChangeText={setAutor}
              placeholder={libroActual?.autor || 'Nombre del autor'}
            />
            <Field
              label="Editorial"
              value={editorial}
              onChangeText={setEditorial}
              placeholder={libroActual?.editorial || 'Editorial'}
            />
            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <Field
                  label="Año"
                  value={anio}
                  onChangeText={setAnio}
                  placeholder={libroActual?.anio ? String(libroActual.anio) : '2024'}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.column}>
                <Field
                  label="Páginas"
                  value={paginas}
                  onChangeText={setPaginas}
                  placeholder={libroActual?.total_paginas ? String(libroActual.total_paginas) : '300'}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Field
              label="Sinopsis"
              value={sinopsis}
              onChangeText={setSinopsis}
              placeholder={libroActual?.sinopsis || 'Descripción o sinopsis editorial'}
              multiline
            />
            <Field
              label="URL de portada (HTTPS)"
              value={portadaUrl}
              onChangeText={setPortadaUrl}
              placeholder={libroActual?.portada_url || 'https://...'}
              keyboardType="url"
            />

            <Text style={styles.fieldLabel}>Categorías registradas</Text>
            <Text style={styles.helperText}>
              {esLibroExistente
                ? 'Las categorías actuales aparecen marcadas. Puedes desmarcar las incorrectas y marcar otras; moderación aplicará la selección aprobada.'
                : 'Solo se pueden sugerir categorías que ya existen en el catálogo.'}
            </Text>
            {categoriasDb.length === 0 ? (
              <Text style={styles.helperText}>No hay categorías disponibles para seleccionar.</Text>
            ) : (
              <View style={styles.categories}>
                {categoriasDb.map(category => {
                  const selected = categoriasSeleccionadas.includes(category.id_categoria);
                  return (
                    <Pressable
                      key={category.id_categoria}
                      style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                      onPress={() => toggleCategoria(category.id_categoria)}
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                        {category.nombre_categoria}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Text style={styles.helperText}>
              Los cambios de categorías se aplicarán solo si el moderador los aprueba.
            </Text>

            <Pressable
              style={[styles.submitButton, (!currentUser || cargando || verificandoIsbn) && styles.disabledButton]}
              onPress={handleEnviar}
              disabled={!currentUser || cargando || verificandoIsbn}
            >
              {cargando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Enviar a moderación</Text>
                </>
              )}
            </Pressable>
          </View>

          {currentUser && (
            <View style={styles.card}>
              <View style={styles.historyHeader}>
                <Text style={styles.sectionTitle}>Mis solicitudes</Text>
                <Pressable onPress={handleRefreshRequests}>
                  <Ionicons name="refresh-outline" size={19} color={colors.primary} />
                </Pressable>
              </View>
              {cargandoSolicitudesLibro ? (
                <ActivityIndicator color={colors.primary} />
              ) : errorSolicitudesLibro ? (
                <Text style={styles.errorText}>
                  No se pudo cargar el historial: {errorSolicitudesLibro}
                </Text>
              ) : solicitudesLibroPropias.length === 0 ? (
                <Text style={styles.helperText}>Todavía no has enviado solicitudes.</Text>
              ) : (
                solicitudesLibroPropias.map(solicitud => (
                  <View key={solicitud.id_solicitud} style={styles.requestRow}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestTitle}>
                        {solicitud.datos_propuestos.titulo || solicitud.libro_actual?.titulo || `ISBN ${solicitud.isbn}`}
                      </Text>
                      <Text style={styles.requestMeta}>
                        {solicitud.tipo === 'nuevo' ? 'Libro nuevo' : 'Corrección de datos'} · {new Date(solicitud.creado_el).toLocaleDateString('es-CL')}
                      </Text>
                      {!!solicitud.nota_moderador && (
                        <Text style={styles.moderatorNote}>Nota: {solicitud.nota_moderador}</Text>
                      )}
                    </View>
                    <View style={[
                      styles.statusBadge,
                      solicitud.estado === 'aprobada' && styles.statusApproved,
                      solicitud.estado === 'rechazada' && styles.statusRejected,
                    ]}>
                      <Text style={styles.statusText}>
                        {solicitud.estado === 'pendiente' ? 'Pendiente' : solicitud.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: 5, marginRight: 10 },
  topTitleWrap: { flex: 1 },
  topTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  topSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  content: { padding: ExLibrisMetrics.spacingMd, gap: 12 },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: ExLibrisMetrics.radiusMd,
    backgroundColor: colors.primaryMuted,
  },
  introText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18 },
  loginCard: {
    padding: 14,
    borderRadius: ExLibrisMetrics.radiusMd,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  loginText: { color: colors.textSecondary, fontSize: 12 },
  loginButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: colors.primary,
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: ExLibrisMetrics.spacingMd,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  fieldGroup: { gap: 5, marginBottom: 4 },
  fieldLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 13,
  },
  multilineInput: { minHeight: 100, paddingTop: 10 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  helperText: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  errorText: { color: colors.danger, fontSize: 11 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  categoryChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: ExLibrisMetrics.radiusPill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  categoryChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  categoryTextSelected: { color: '#FFFFFF' },
  submitButton: {
    minHeight: 48,
    marginTop: 6,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: { opacity: 0.55 },
  submitButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  requestInfo: { flex: 1, gap: 3 },
  requestTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  requestMeta: { color: colors.textSecondary, fontSize: 10 },
  moderatorNote: { color: colors.textSecondary, fontSize: 10, fontStyle: 'italic' },
  statusBadge: { backgroundColor: colors.primaryMuted, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  statusApproved: { backgroundColor: colors.moderatorLight },
  statusRejected: { backgroundColor: colors.dangerLight },
  statusText: { color: colors.text, fontSize: 9, fontWeight: '700' },
  bottomSpace: { height: 24 },
});
