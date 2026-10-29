import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';
import { useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PerfilScreen() {
  const router = useRouter();
  const { currentUser, userRole, cerrarSesion, biblioteca } = useExLibris();

  const enCurso = biblioteca.filter(b => b.estado === 'leyendo').length;
  const leidos = biblioteca.filter(b => b.estado === 'leido').length;
  const porLeer = biblioteca.filter(b => b.estado === 'por_leer').length;

  const handleCerrarSesion = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await cerrarSesion();
            } catch {
              Alert.alert('Error', 'No se pudo cerrar la sesión de Supabase. Inténtalo nuevamente.');
            }
          },
        },
      ]
    );
  };

  const handleIrModeracion = () => {
    router.push('/panel_moderacion');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Avatar y nombre */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.userName}>{currentUser?.nombre || 'Invitado'}</Text>
          <Text style={styles.userEmail}>{currentUser?.email || ''}</Text>
          <View style={[
            styles.rolePill,
            userRole === 'moderador' ? styles.rolePillMod : styles.rolePillLector,
          ]}>
            <Ionicons
              name={userRole === 'moderador' ? 'shield-checkmark-outline' : 'person-circle-outline'}
              size={13}
              color={userRole === 'moderador' ? ExLibrisColors.moderator : ExLibrisColors.primary}
            />
            <Text style={[
              styles.roleText,
              userRole === 'moderador' ? styles.roleTextMod : styles.roleTextLector,
            ]}>
              {userRole === 'moderador' ? 'Moderador' : 'Lector'}
            </Text>
          </View>
        </View>

        {/* Estadísticas de biblioteca */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Mi Biblioteca</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="book-outline" size={20} color={ExLibrisColors.primary} />
              <Text style={styles.statNumber}>{enCurso}</Text>
              <Text style={styles.statLabel}>Leyendo</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="list-outline" size={20} color={ExLibrisColors.textSecondary} />
              <Text style={styles.statNumber}>{porLeer}</Text>
              <Text style={styles.statLabel}>Por leer</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="checkmark-done-outline" size={20} color={ExLibrisColors.progress} />
              <Text style={styles.statNumber}>{leidos}</Text>
              <Text style={styles.statLabel}>Leídos</Text>
            </View>
          </View>
        </View>

        {/* Opciones de cuenta */}
        <View style={styles.optionsCard}>
          <Text style={styles.sectionTitle}>Opciones</Text>

          {/* Moderation link — only for moderators */}
          {userRole === 'moderador' && (
            <Pressable
              style={styles.optionRow}
              onPress={handleIrModeracion}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color={ExLibrisColors.moderator} />
                <Text style={styles.optionText}>Panel de Moderación</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ExLibrisColors.textMuted} />
            </Pressable>
          )}

          {/* Cerrar sesión */}
          <Pressable
            style={[styles.optionRow, styles.optionRowDanger]}
            onPress={handleCerrarSesion}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="power-outline" size={20} color={ExLibrisColors.danger} />
              <Text style={[styles.optionText, { color: ExLibrisColors.danger }]}>
                Cerrar Sesión
              </Text>
            </View>
          </Pressable>
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
    paddingHorizontal: ExLibrisMetrics.spacingMd,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ExLibrisColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: ExLibrisColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: ExLibrisColors.text,
  },
  userEmail: {
    fontSize: 13,
    color: ExLibrisColors.textSecondary,
    marginTop: 4,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 5,
    marginTop: 10,
  },
  rolePillLector: {
    backgroundColor: ExLibrisColors.primaryMuted,
  },
  rolePillMod: {
    backgroundColor: ExLibrisColors.moderatorLight,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleTextLector: {
    color: ExLibrisColors.primary,
  },
  roleTextMod: {
    color: ExLibrisColors.moderator,
  },
  statsCard: {
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: ExLibrisMetrics.spacingMd,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ExLibrisColors.text,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: ExLibrisColors.border,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: ExLibrisColors.text,
  },
  statLabel: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
  },
  optionsCard: {
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: ExLibrisMetrics.spacingMd,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    marginBottom: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ExLibrisColors.border,
  },
  optionRowDanger: {
    borderBottomWidth: 0,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: ExLibrisColors.text,
  },
});
