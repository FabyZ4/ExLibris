import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useExLibris, Book } from '@/store/ExLibrisContext';
import { ExLibrisMetrics } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';

export default function EscanerScreen() {
  const { colors, styles } = useExLibrisStyles(createStyles);
  const router = useRouter();
  const { buscarObrasPorIsbn, agregarALaBiblioteca } = useExLibris();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [detectedBook, setDetectedBook] = useState<Book | null>(null);
  const [detectedIsbn, setDetectedIsbn] = useState<string>('');
  const [selectedEstado, setSelectedEstado] = useState<'por_leer' | 'leyendo' | 'leido'>('leyendo');
  const [buscando, setBuscando] = useState(false);

  // Control de cooldown y debounce del escáner (mínimo 3 segundos entre lecturas)
  const ultimoEscaneoRef = useRef<number>(0);
  const procesandoRef = useRef<boolean>(false);

  // Modal para ingreso manual
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [inputIsbnManual, setInputIsbnManual] = useState('');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/biblioteca');
    }
  };

  // Solicitar permiso automáticamente
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const procesarIsbn = async (isbn: string) => {
    const clean = isbn.replace(/[-\s]/g, '').trim();
    if (!clean) return;

    procesandoRef.current = true;
    setDetectedIsbn(clean);
    setBuscando(true);

    try {
      const libro = await buscarObrasPorIsbn(clean);
      if (libro) {
        setDetectedBook(libro);
        setScanned(true);
      } else {
        Alert.alert(
          'ISBN no encontrado',
          `No se encontró el código "${clean}". Puedes ingresar los datos manualmente o intentar nuevamente.`,
          [
            { text: 'Entendido', style: 'cancel' },
            {
              text: 'Proponer libro',
              onPress: () => router.push({
                pathname: '/solicitud_libro',
                params: { isbn: clean },
              }),
            },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Ocurrió un error al consultar el catálogo.');
    } finally {
      setBuscando(false);
      // Retardo de 3 segundos antes de permitir que la cámara vuelva a capturar
      setTimeout(() => {
        procesandoRef.current = false;
      }, 3000);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    const ahora = Date.now();
    // Bloquear si ya hay un libro escaneado, si se está buscando o si no han pasado 3 segundos
    if (scanned || buscando || procesandoRef.current || ahora - ultimoEscaneoRef.current < 3000) {
      return;
    }
    ultimoEscaneoRef.current = ahora;
    procesandoRef.current = true;
    procesarIsbn(data);
  };

  const handleManualSubmit = () => {
    if (!inputIsbnManual) {
      Alert.alert('Atención', 'Ingresa un código ISBN.');
      return;
    }
    setManualModalVisible(false);
    procesarIsbn(inputIsbnManual);
  };

  const handleConfirmarYGuardar = () => {
    if (!detectedBook) return;

    agregarALaBiblioteca(detectedBook, selectedEstado, {
      lugar_compra: 'Adquirido vía Escáner ISBN',
      precio_compra: 15990,
      fecha_compra: 'Hoy',
      formato_edicion: 'Edición física estándar',
    });

    Alert.alert(
      '¡Libro Agregado!',
      `"${detectedBook.titulo}" se ha guardado en tu biblioteca con estado "${selectedEstado}".`,
      [
        {
          text: 'Ver en Biblioteca',
          onPress: () => {
            setScanned(false);
            setDetectedBook(null);
            router.push('/biblioteca');
          },
        },
        {
          text: 'Escanear otro',
          onPress: () => {
            setScanned(false);
            setDetectedBook(null);
          },
        },
      ]
    );
  };

  const handleReintentar = () => {
    setScanned(false);
    setDetectedBook(null);
    setDetectedIsbn('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Barra superior del Escáner */}
      <View style={styles.topBar}>
        <Pressable style={styles.navButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.topTitleRow}>
          <View style={styles.brandBadge}>
            <Ionicons name="book-outline" size={14} color="#FFFFFF" />
          </View>
          <Text style={styles.topTitle}>Escanear Isbn</Text>
        </View>
        <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
      </View>

      {/* Vista de Cámara o Fallback si no hay permisos */}
      <View style={styles.cameraContainer}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
        ) : (
          <View style={styles.permissionFallback}>
            <Ionicons name="camera-reverse-outline" size={54} color={colors.primary} />
            <Text style={styles.permissionTitle}>Permiso de Cámara Requerido</Text>
            <Text style={styles.permissionText}>
              Para escanear códigos de barras físicos, activa la cámara de tu dispositivo.
            </Text>
            <Pressable style={styles.btnPermiso} onPress={requestPermission}>
              <Text style={styles.btnPermisoText}>Conceder Permiso</Text>
            </Pressable>
          </View>
        )}

        {/* Capa de interfaz sobre la cámara */}
        <View style={styles.overlay}>
          {/* Botón superior de ingreso manual */}
          <Pressable
            style={styles.btnIngresoManual}
            onPress={() => setManualModalVisible(true)}
          >
            <Ionicons name="keypad-outline" size={16} color="#FFFFFF" />
            <Text style={styles.btnIngresoManualText}>Ingreso manual de código</Text>
          </Pressable>

          {/* Marco delimitador y mira láser */}
          <View style={styles.scanReticle}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Línea láser central */}
            <View style={styles.laserLine} />
            <View style={styles.isbnBadge}>
              <Text style={styles.isbnBadgeText}>• ISBN-13</Text>
            </View>
          </View>

          <Text style={styles.scannerPrompt}>
            Apunta al código de barras ISBN del libro físico
          </Text>

          {buscando && (
            <View style={styles.searchingCard}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.searchingText}>Consultando Google Books API...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Sheet / Modal de Libro Detectado */}
      {detectedBook && scanned && (
        <View style={styles.bottomSheetCard}>
          <View style={styles.dragIndicator} />

          <View style={styles.detectedHeader}>
            <View style={styles.detectedCheckRow}>
              <Ionicons name="alert-circle-outline" size={20} color="#D97706" />
              <Text style={styles.detectedTitle}>Verifica si es tu libro</Text>
            </View>
            <Text style={styles.detectedCode}>ISBN: {detectedIsbn}</Text>
          </View>

          {/* Ficha técnica resumida */}
          <View style={styles.bookSummaryRow}>
            <Image
              source={{ uri: detectedBook.portada_url }}
              style={styles.detectedCover}
              resizeMode="cover"
            />
            <View style={styles.detectedInfo}>
              <Text style={styles.detectedCategory}>
                {detectedBook.categorias.join(' · ').toUpperCase()}
              </Text>
              <Text style={styles.detectedBookTitle} numberOfLines={2}>
                {detectedBook.titulo}
              </Text>
              <Text style={styles.detectedBookAuthor}>{detectedBook.autor}</Text>
              <Text style={styles.detectedEditorial}>
                {detectedBook.editorial} · {detectedBook.total_paginas} págs. · {detectedBook.anio || 2024}
              </Text>
            </View>
          </View>

          {/* Selector de estado en biblioteca */}
          <Text style={styles.estadoSectionTitle}>Estado en tu biblioteca personal</Text>
          <View style={styles.estadoSelectorRow}>
            {(['por_leer', 'leyendo', 'leido'] as const).map(est => (
              <Pressable
                key={est}
                style={[
                  styles.estadoBtn,
                  selectedEstado === est && styles.estadoBtnActive,
                ]}
                onPress={() => setSelectedEstado(est)}
              >
                <Text
                  style={[
                    styles.estadoBtnText,
                    selectedEstado === est && styles.estadoBtnTextActive,
                  ]}
                >
                  {est === 'por_leer' ? 'Por leer' : est === 'leyendo' ? 'Leyendo' : 'Leído'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Botón principal Confirmar y Guardar */}
          <Pressable
            style={styles.btnConfirmar}
            onPress={handleConfirmarYGuardar}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.btnConfirmarText}>Sí, es este libro (Guardar)</Text>
          </Pressable>

          <Pressable style={styles.btnReintentar} onPress={handleReintentar}>
            <Ionicons name="close-circle-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={[styles.btnReintentarText, { color: '#DC2626' }]}>
              No es este libro (Descartar y volver a escanear)
            </Text>
          </Pressable>
        </View>
      )}

      {/* Modal para ingresar código ISBN manual */}
      <Modal
        visible={manualModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.manualModalContent}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.manualModalScrollContent}
          >
            <View style={styles.manualModalHeader}>
              <Text style={styles.manualModalTitle}>Ingreso Manual de ISBN</Text>
              <Pressable onPress={() => setManualModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.manualModalDesc}>
              Escribe el código ISBN de 10 o 13 dígitos del libro:
            </Text>

            <TextInput
              style={styles.manualInput}
              placeholder="Ej. 9788437604947"
              keyboardType="numeric"
              value={inputIsbnManual}
              onChangeText={setInputIsbnManual}
            />

            <Text style={styles.presetTitle}>Ejemplares rápidos para evaluación:</Text>
            <View style={styles.presetsList}>
              <Pressable
                style={styles.presetItem}
                onPress={() => setInputIsbnManual('9788437604947')}
              >
                <Text style={styles.presetBook}>Cien años de soledad</Text>
                <Text style={styles.presetIsbn}>9788437604947</Text>
              </Pressable>

              <Pressable
                style={styles.presetItem}
                onPress={() => setInputIsbnManual('9788408043645')}
              >
                <Text style={styles.presetBook}>La sombra del viento</Text>
                <Text style={styles.presetIsbn}>9788408043645</Text>
              </Pressable>

              <Pressable
                style={styles.presetItem}
                onPress={() => setInputIsbnManual('9788437604572')}
              >
                <Text style={styles.presetBook}>Rayuela</Text>
                <Text style={styles.presetIsbn}>9788437604572</Text>
              </Pressable>
            </View>

            <Pressable style={styles.btnBuscarManual} onPress={handleManualSubmit}>
              <Ionicons name="search" size={18} color="#FFFFFF" />
              <Text style={styles.btnBuscarManualText}>Buscar libro</Text>
            </Pressable>
          </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navButton: {
    padding: 6,
  },
  topTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  permissionFallback: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ExLibrisMetrics.spacingLg,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  permissionText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  btnPermiso: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: ExLibrisMetrics.radiusPill,
  },
  btnPermisoText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 30,
  },
  btnIngresoManual: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 25, 25, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  btnIngresoManualText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  scanReticle: {
    width: 260,
    height: 180,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFFFFF',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#FF334B',
    shadowColor: '#FF334B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  isbnBadge: {
    position: 'absolute',
    bottom: -12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  isbnBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scannerPrompt: {
    color: '#FFFFFF',
    fontSize: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: ExLibrisMetrics.radiusPill,
    fontWeight: '500',
    textAlign: 'center',
  },
  searchingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 10,
  },
  searchingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  bottomSheetCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: ExLibrisMetrics.spacingMd,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
    alignSelf: 'center',
    marginBottom: 10,
  },
  detectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: 10,
  },
  detectedCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detectedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  detectedCode: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  bookSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  detectedCover: {
    width: 65,
    height: 95,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.surfaceVariant,
  },
  detectedInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  detectedCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  detectedBookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  detectedBookAuthor: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detectedEditorial: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  estadoSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  estadoSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  estadoBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  estadoBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  estadoBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  estadoBtnTextActive: {
    color: '#FFFFFF',
  },
  btnConfirmar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: ExLibrisMetrics.radiusSm,
    gap: 8,
  },
  btnConfirmarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnReintentar: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 4,
  },
  btnReintentarText: {
    fontSize: 11,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalKeyboardAvoiding: {
    flex: 1,
  },
  manualModalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusLg,
    overflow: 'hidden',
  },
  manualModalScrollContent: {
    padding: ExLibrisMetrics.spacingLg,
  },
  manualModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  manualModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  manualModalDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: ExLibrisMetrics.radiusSm,
    padding: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surfaceVariant,
    marginBottom: 14,
  },
  presetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  presetsList: {
    gap: 6,
    marginBottom: 16,
  },
  presetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: ExLibrisMetrics.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetBook: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  presetIsbn: {
    fontSize: 10,
    color: colors.textMuted,
  },
  btnBuscarManual: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: ExLibrisMetrics.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnBuscarManualText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
