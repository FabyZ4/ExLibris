import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';
import { useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function LoginScreen() {
  const router = useRouter();
  const { currentUser, iniciarSesion, registrarse } = useExLibris();

  const [modoRegistro, setModoRegistro] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(false);

  // Redirigir a pestañas si ya hay sesión activa
  useEffect(() => {
    if (currentUser) {
      router.replace('/biblioteca');
    }
  }, [currentUser, router]);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    setCargando(true);
    try {
      if (modoRegistro) {
        if (!nombre.trim()) {
          Alert.alert('Nombre requerido', 'Por favor ingresa tu nombre completo.');
          setCargando(false);
          return;
        }

        const res = await registrarse(email.trim(), password, nombre.trim());
        if (res.success) {
          Alert.alert('¡Cuenta creada!', 'Bienvenido a ExLibris.');
          router.replace('/biblioteca');
        } else if (res.needsLogin) {
          Alert.alert('Cuenta creada', res.message || 'Inicia sesión con tu correo y contraseña.');
          setModoRegistro(false);
        } else {
          Alert.alert('Error de registro', res.message || 'No se pudo crear la cuenta.');
        }
      } else {
        const res = await iniciarSesion(email.trim(), password);
        if (res.success) {
          router.replace('/biblioteca');
        } else {
          Alert.alert('Error de inicio de sesión', res.message || 'Credenciales inválidas.');
        }
      }
    } catch {
      Alert.alert('Error', 'Ocurrió un error inesperado al procesar la solicitud.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Logo y Encabezado de Marca */}
          <View style={styles.brandHero}>
            <View style={styles.logoBadgeBig}>
              <Ionicons name="book-outline" size={38} color="#FFFFFF" />
            </View>
            <Text style={styles.brandTitleBig}>ExLibris</Text>
            <Text style={styles.brandSubtitle}>
              Catalogación, lectura física y comunidad literaria
            </Text>
          </View>

          {/* Selector de Modo: Iniciar Sesión / Registro */}
          <View style={styles.tabSelector}>
            <Pressable
              style={[styles.tabButton, !modoRegistro && styles.tabButtonActive]}
              onPress={() => setModoRegistro(false)}
            >
              <Text style={[styles.tabText, !modoRegistro && styles.tabTextActive]}>
                Iniciar Sesión
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, modoRegistro && styles.tabButtonActive]}
              onPress={() => setModoRegistro(true)}
            >
              <Text style={[styles.tabText, modoRegistro && styles.tabTextActive]}>
                Crear Cuenta
              </Text>
            </Pressable>
          </View>

          {/* Formulario */}
          <View style={styles.formCard}>
            {modoRegistro && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre completo</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={18} color={ExLibrisColors.textSecondary} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ej. Fabiola Ramírez"
                    placeholderTextColor={ExLibrisColors.textMuted}
                    value={nombre}
                    onChangeText={setNombre}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correo electrónico</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={ExLibrisColors.textSecondary} />
                <TextInput
                  style={styles.textInput}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor={ExLibrisColors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contraseña</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={ExLibrisColors.textSecondary} />
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••"
                  placeholderTextColor={ExLibrisColors.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            <Pressable
              style={[styles.btnSubmit, cargando && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={cargando}
            >
              {cargando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.btnSubmitText}>
                    {modoRegistro ? 'Crear Cuenta' : 'Iniciar Sesión'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ExLibrisColors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: ExLibrisMetrics.spacingMd,
    paddingBottom: 40,
  },
  brandHero: {
    alignItems: 'center',
    marginVertical: 18,
  },
  logoBadgeBig: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: ExLibrisColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: ExLibrisColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  brandTitleBig: {
    fontSize: 28,
    fontWeight: '900',
    color: ExLibrisColors.primary,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: ExLibrisColors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: ExLibrisColors.surfaceVariant,
    padding: 4,
    borderRadius: ExLibrisMetrics.radiusPill,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: ExLibrisMetrics.radiusPill,
  },
  tabButtonActive: {
    backgroundColor: ExLibrisColors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExLibrisColors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: ExLibrisColors.surface,
    padding: ExLibrisMetrics.spacingMd,
    borderRadius: ExLibrisMetrics.radiusMd,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: ExLibrisColors.text,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ExLibrisColors.borderDark,
    borderRadius: ExLibrisMetrics.radiusSm,
    paddingHorizontal: 12,
    backgroundColor: ExLibrisColors.surfaceVariant,
    gap: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: ExLibrisColors.text,
  },
  btnSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ExLibrisColors.primary,
    paddingVertical: 13,
    borderRadius: ExLibrisMetrics.radiusSm,
    gap: 8,
    marginTop: 4,
  },
  btnSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
