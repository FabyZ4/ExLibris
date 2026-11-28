import { ExLibrisMetrics } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';
import { requestAuthEmailChange, updateAuthPassword } from '@/services/auth.service';
import { useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

export default function ConfiguracionesScreen() {
  const { colors, styles } = useExLibrisStyles(createStyles);
  const router = useRouter();
  const { currentUser, themeMode, actualizarTema, actualizarNombrePublico } = useExLibris();
  const [nombre, setNombre] = useState(currentUser?.nombre || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [guardandoEmail, setGuardandoEmail] = useState(false);
  const [guardandoContrasena, setGuardandoContrasena] = useState(false);

  const guardarNombre = async () => {
    setGuardandoNombre(true);
    try {
      await actualizarNombrePublico(nombre);
      Alert.alert('Perfil actualizado', 'Tu nombre público ya está actualizado.');
    } catch (error) {
      Alert.alert('No se pudo actualizar el perfil', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setGuardandoNombre(false);
    }
  };

  const cambiarEmail = async () => {
    const nuevoEmail = email.trim();
    if (!nuevoEmail || nuevoEmail === currentUser?.email) {
      Alert.alert('Revisa el correo', 'Escribe una dirección distinta a la actual.');
      return;
    }

    setGuardandoEmail(true);
    try {
      await requestAuthEmailChange(nuevoEmail);
      Alert.alert(
        'Confirma el cambio de correo',
        'Supabase enviará instrucciones de confirmación. Tu correo actual seguirá activo hasta que completes la confirmación.'
      );
    } catch (error) {
      Alert.alert('No se pudo cambiar el correo', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setGuardandoEmail(false);
    }
  };

  const cambiarContrasena = async () => {
    if (!contrasenaActual) {
      Alert.alert('Falta la contraseña actual', 'Escríbela para verificar tu identidad.');
      return;
    }
    if (contrasena.length < 8) {
      Alert.alert('Contraseña demasiado corta', 'Usa al menos 8 caracteres.');
      return;
    }
    if (contrasena !== confirmarContrasena) {
      Alert.alert('Las contraseñas no coinciden', 'Confirma la nueva contraseña correctamente.');
      return;
    }

    setGuardandoContrasena(true);
    try {
      if (!currentUser) throw new Error('Debes iniciar sesión para cambiar la contraseña.');
      await updateAuthPassword(currentUser.id, contrasenaActual, contrasena);
      setContrasenaActual('');
      setContrasena('');
      setConfirmarContrasena('');
      Alert.alert('Contraseña actualizada', 'Tu contraseña se cambió correctamente.');
    } catch (error) {
      Alert.alert('No se pudo cambiar la contraseña', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setGuardandoContrasena(false);
    }
  };

  const guardarTema = async (mode: 'light' | 'dark') => {
    try {
      await actualizarTema(mode);
    } catch (error) {
      Alert.alert('No se pudo guardar la preferencia', error instanceof Error ? error.message : 'Intenta nuevamente.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver al perfil"
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/perfil')}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={21} color={colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Configuraciones</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cuenta</Text>
            <Text style={styles.fieldLabel}>Nombre que ve la comunidad</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
              maxLength={30}
              placeholder="Tu nombre público"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              style={[styles.primaryButton, guardandoNombre && styles.disabledButton]}
              onPress={guardarNombre}
              disabled={guardandoNombre}
            >
              {guardandoNombre
                ? <ActivityIndicator color={colors.textLight} />
                : <Text style={styles.primaryButtonText}>Guardar nombre</Text>}
            </Pressable>

            <View style={styles.separator} />
            <Text style={styles.fieldLabel}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="correo@ejemplo.com"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.helperText}>
              El cambio se activa después de confirmar el correo según las instrucciones de Supabase.
            </Text>
            <Pressable
              style={[styles.secondaryButton, guardandoEmail && styles.disabledButton]}
              onPress={cambiarEmail}
              disabled={guardandoEmail}
            >
              {guardandoEmail
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={styles.secondaryButtonText}>Solicitar cambio de correo</Text>}
            </Pressable>

            <View style={styles.separator} />
            <Text style={styles.fieldLabel}>Contraseña actual</Text>
            <TextInput
              style={styles.input}
              value={contrasenaActual}
              onChangeText={setContrasenaActual}
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              placeholder="Confirma tu contraseña actual"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Nueva contraseña</Text>
            <TextInput
              style={styles.input}
              value={contrasena}
              onChangeText={setContrasena}
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Confirmar contraseña</Text>
            <TextInput
              style={styles.input}
              value={confirmarContrasena}
              onChangeText={setConfirmarContrasena}
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              placeholder="Repite la contraseña"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              style={[styles.secondaryButton, guardandoContrasena && styles.disabledButton]}
              onPress={cambiarContrasena}
              disabled={guardandoContrasena}
            >
              {guardandoContrasena
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={styles.secondaryButtonText}>Actualizar contraseña</Text>}
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aplicación</Text>
            <Text style={styles.helperText}>Elige el aspecto de ExLibris en este dispositivo.</Text>
            <View style={styles.themeOptions}>
              {([
                { mode: 'light', label: 'Claro', icon: 'sunny-outline' },
                { mode: 'dark', label: 'Oscuro', icon: 'moon-outline' },
              ] as const).map(option => {
                const selected = themeMode === option.mode;
                return (
                  <Pressable
                    key={option.mode}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.themeOption, selected && styles.themeOptionSelected]}
                    onPress={() => void guardarTema(option.mode)}
                  >
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={selected ? colors.textLight : colors.textSecondary}
                    />
                    <Text style={[styles.themeOptionText, selected && styles.themeOptionTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 54,
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 36,
  },
  container: {
    flex: 1,
    paddingHorizontal: ExLibrisMetrics.spacingMd,
  },
  content: {
    paddingTop: ExLibrisMetrics.spacingMd,
  },
  section: {
    padding: ExLibrisMetrics.spacingMd,
    marginBottom: ExLibrisMetrics.spacingMd,
    borderRadius: ExLibrisMetrics.radiusMd,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    marginBottom: 12,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ExLibrisMetrics.radiusSm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.6,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 18,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  themeOption: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: ExLibrisMetrics.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceVariant,
  },
  themeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeOptionText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  themeOptionTextSelected: {
    color: colors.textLight,
  },
  bottomSpace: {
    height: 28,
  },
});
