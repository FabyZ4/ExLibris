import { ExLibrisMetrics } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';
import { useExLibris } from '@/store/ExLibrisContext';
import { ContactTopic } from '@/types/contact.types';
import { Ionicons } from '@expo/vector-icons';
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const topics: { value: ContactTopic; label: string }[] = [
  { value: 'recomendacion', label: 'Recomendación' },
  { value: 'queja', label: 'Queja' },
  { value: 'mejora', label: 'Mejora' },
];

const topicLabels: Record<ContactTopic, string> = {
  recomendacion: 'Recomendación',
  queja: 'Queja',
  mejora: 'Mejora',
};

export default function ContactoScreen() {
  const { colors, styles } = useExLibrisStyles(createStyles);
  const router = useRouter();
  const {
    currentUser,
    misMensajesContacto,
    cargandoContacto,
    errorContacto,
    enviarMensajeContacto,
    recargarMensajesContacto,
  } = useExLibris();
  const [tipo, setTipo] = useState<ContactTopic>('recomendacion');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    const texto = mensaje.trim();
    if (texto.length < 10) {
      Alert.alert('Mensaje incompleto', 'Escribe al menos 10 caracteres para que podamos entender tu solicitud.');
      return;
    }

    setEnviando(true);
    try {
      await enviarMensajeContacto(tipo, texto);
      setMensaje('');
      Alert.alert('Mensaje enviado', 'El equipo de moderación recibió tu mensaje.');
    } catch (error) {
      Alert.alert('No se pudo enviar', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  const actualizar = async () => {
    try {
      await recargarMensajesContacto();
    } catch (error) {
      Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intenta nuevamente.');
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
            accessibilityLabel="Volver"
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Contáctanos</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <Ionicons name="chatbubbles-outline" size={25} color={colors.primary} />
            <Text style={styles.introTitle}>Tu opinión ayuda a mejorar ExLibris</Text>
            <Text style={styles.introText}>
              Envía una recomendación, queja o propuesta de mejora. El equipo de moderación podrá revisar tu mensaje.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Nuevo mensaje</Text>
            <Text style={styles.fieldLabel}>Tipo de mensaje</Text>
            <View style={styles.topicList}>
              {topics.map(topic => {
                const selected = tipo === topic.value;
                return (
                  <Pressable
                    key={topic.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.topicChip, selected && styles.topicChipSelected]}
                    onPress={() => setTipo(topic.value)}
                  >
                    <Text style={[styles.topicText, selected && styles.topicTextSelected]}>
                      {topic.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Cuéntanos más</Text>
            <TextInput
              style={styles.messageInput}
              value={mensaje}
              onChangeText={setMensaje}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              placeholder="Escribe aquí tu mensaje (10 a 2000 caracteres)"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.counter}>{mensaje.length}/2000</Text>
            <Pressable
              style={[styles.sendButton, enviando && styles.disabledButton]}
              onPress={enviar}
              disabled={enviando || !currentUser}
            >
              {enviando
                ? <ActivityIndicator color={colors.textLight} />
                : (
                  <>
                    <Ionicons name="send-outline" size={17} color={colors.textLight} />
                    <Text style={styles.sendButtonText}>Enviar a moderación</Text>
                  </>
                )}
            </Pressable>
          </View>

          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Mis mensajes</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Actualizar mensajes"
              onPress={() => void actualizar()}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>

          {errorContacto ? (
            <View style={styles.infoCard}>
              <Text style={styles.errorText}>{errorContacto}</Text>
            </View>
          ) : cargandoContacto && misMensajesContacto.length === 0 ? (
            <View style={styles.infoCard}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : misMensajesContacto.length === 0 ? (
            <View style={styles.infoCard}>
              <Text style={styles.emptyText}>Aún no has enviado mensajes.</Text>
            </View>
          ) : (
            misMensajesContacto.map(item => (
              <View key={item.id_contacto} style={styles.messageCard}>
                <View style={styles.messageHeader}>
                  <Text style={styles.messageTopic}>{topicLabels[item.tipo]}</Text>
                  <View style={[
                    styles.statusBadge,
                    item.estado === 'atendido' ? styles.statusDone : styles.statusPending,
                  ]}>
                    <Text style={styles.statusText}>
                      {item.estado === 'atendido' ? 'Atendido' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.messageBody}>{item.mensaje}</Text>
                <Text style={styles.messageDate}>
                  {new Date(item.creado_el).toLocaleDateString('es-CL')}
                </Text>
              </View>
            ))
          )}
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
    alignItems: 'flex-start',
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
  introCard: {
    padding: ExLibrisMetrics.spacingMd,
    marginBottom: ExLibrisMetrics.spacingMd,
    borderRadius: ExLibrisMetrics.radiusMd,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  introTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 5,
  },
  introText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  formCard: {
    padding: ExLibrisMetrics.spacingMd,
    marginBottom: ExLibrisMetrics.spacingLg,
    borderRadius: ExLibrisMetrics.radiusMd,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 8,
  },
  topicList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ExLibrisMetrics.radiusPill,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topicChipSelected: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  topicText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  topicTextSelected: {
    color: colors.primary,
  },
  messageInput: {
    minHeight: 130,
    padding: 12,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 13,
  },
  counter: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 5,
  },
  sendButton: {
    minHeight: 46,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.primary,
  },
  sendButtonText: {
    color: colors.textLight,
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  messageCard: {
    padding: 13,
    marginBottom: 10,
    borderRadius: ExLibrisMetrics.radiusMd,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  messageTopic: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: ExLibrisMetrics.radiusPill,
  },
  statusPending: {
    backgroundColor: colors.goldMuted,
  },
  statusDone: {
    backgroundColor: colors.moderatorLight,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  messageBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  messageDate: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 8,
  },
  infoCard: {
    padding: 16,
    alignItems: 'center',
    borderRadius: ExLibrisMetrics.radiusMd,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    textAlign: 'center',
  },
  bottomSpace: {
    height: 28,
  },
});
