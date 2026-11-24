import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';
import { NotificationItem, useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ subtitle }) => {
  const router = useRouter();
  const {
    userRole,
    notificaciones,
    notificacionesNoLeidasCount,
    marcarNotificacionLeida,
    marcarTodasNotificacionesLeidas,
    eliminarNotificacion,
    limpiarTodasNotificaciones,
    sincronizarDatos,
  } = useExLibris();

  const [modalNotifVisible, setModalNotifVisible] = useState(false);

  const handlePressNotificacion = (item: NotificationItem) => {
    marcarNotificacionLeida(item.id_notificacion);
    if (item.isbn) {
      setModalNotifVisible(false);
      router.push({
        pathname: '/(tabs)/comunidad',
        params: { isbn: item.isbn },
      });
    }
  };

  const renderIconoTipo = (tipo: NotificationItem['tipo']) => {
    switch (tipo) {
      case 'like':
        return (
          <View style={[styles.tipoBadge, { backgroundColor: ExLibrisColors.primary }]}>
            <Ionicons name="thumbs-up" size={14} color="#FFFFFF" />
          </View>
        );
      case 'respuesta':
        return (
          <View style={[styles.tipoBadge, { backgroundColor: '#2E7D32' }]}>
            <Ionicons name="chatbubble-ellipses" size={14} color="#FFFFFF" />
          </View>
        );
      case 'moderacion':
        return (
          <View style={[styles.tipoBadge, { backgroundColor: ExLibrisColors.danger }]}>
            <Ionicons name="alert-circle" size={14} color="#FFFFFF" />
          </View>
        );
      default:
        return (
          <View style={[styles.tipoBadge, { backgroundColor: ExLibrisColors.textSecondary }]}>
            <Ionicons name="notifications" size={14} color="#FFFFFF" />
          </View>
        );
    }
  };

  return (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.leftSection}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="book-outline" size={16} color={ExLibrisColors.textLight} />
            </View>
            <Text style={styles.brandTitle}>ExLibris</Text>
          </View>
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.rightSection}>
          {/* Badge de Rol */}
          <View
            style={[
              styles.rolePill,
              userRole === 'moderador' ? styles.rolePillModerador : styles.rolePillLector,
            ]}
          >
            <Ionicons
              name={userRole === 'moderador' ? 'alert-circle-outline' : 'person-circle-outline'}
              size={13}
              color={userRole === 'moderador' ? ExLibrisColors.moderator : ExLibrisColors.primary}
            />
            <Text
              style={[
                styles.roleText,
                userRole === 'moderador' ? styles.roleTextModerador : styles.roleTextLector,
              ]}
            >
              {userRole === 'moderador' ? 'Mod' : 'Lector'}
            </Text>
          </View>

          {/* Campana de Notificaciones Funcional con Badge */}
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              setModalNotifVisible(true);
              sincronizarDatos().catch(() => {});
            }}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={ExLibrisColors.text} />
            {notificacionesNoLeidasCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificacionesNoLeidasCount > 9 ? '9+' : notificacionesNoLeidasCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Modal de Centro de Notificaciones */}
      <Modal
        visible={modalNotifVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalNotifVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          {/* Encabezado del Modal */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <View style={styles.modalBellBadge}>
                <Ionicons name="notifications" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Notificaciones</Text>
                <Text style={styles.modalSubtitle}>
                  {notificacionesNoLeidasCount > 0
                    ? `${notificacionesNoLeidasCount} sin leer`
                    : 'Al día'}
                </Text>
              </View>
            </View>

            <View style={styles.modalHeaderActions}>
              <Pressable
                style={styles.btnActionRefresh}
                onPress={() => sincronizarDatos().catch(() => {})}
                hitSlop={8}
                accessibilityLabel="Actualizar notificaciones"
              >
                <Ionicons name="refresh-outline" size={20} color={ExLibrisColors.primary} />
              </Pressable>
              <Pressable
                style={styles.btnClose}
                onPress={() => setModalNotifVisible(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={24} color={ExLibrisColors.text} />
              </Pressable>
            </View>
          </View>

          {/* Barra de Acciones Rápidas */}
          {notificaciones.length > 0 && (
            <View style={styles.actionsBar}>
              <Pressable
                style={styles.btnActionSecondary}
                onPress={marcarTodasNotificacionesLeidas}
              >
                <Ionicons name="checkmark-done-outline" size={15} color={ExLibrisColors.primary} />
                <Text style={styles.btnActionSecondaryText}>Marcar todas como leídas</Text>
              </Pressable>

              <Pressable
                style={styles.btnActionSecondary}
                onPress={limpiarTodasNotificaciones}
              >
                <Ionicons name="trash-outline" size={14} color={ExLibrisColors.textSecondary} />
                <Text style={styles.btnActionSecondaryTextMuted}>Limpiar</Text>
              </Pressable>
            </View>
          )}

          {/* Lista de Notificaciones */}
          <FlatList
            data={notificaciones}
            keyExtractor={item => item.id_notificacion}
            refreshing={false}
            onRefresh={() => sincronizarDatos().catch(() => {})}
            contentContainerStyle={styles.notifListContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.notifCard,
                  !item.leida && styles.notifCardUnread,
                ]}
                onPress={() => handlePressNotificacion(item)}
              >
                <View style={styles.notifLeft}>
                  {renderIconoTipo(item.tipo)}
                </View>

                <View style={styles.notifBody}>
                  <View style={styles.notifTitleRow}>
                    <Text style={[styles.notifTitle, !item.leida && styles.notifTitleUnread]}>
                      {item.titulo}
                    </Text>
                    {!item.leida && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifMessage}>{item.mensaje}</Text>

                  <View style={styles.notifFooterRow}>
                    <Text style={styles.notifDate}>{item.fecha}</Text>
                    {item.isbn && (
                      <View style={styles.notifGoLink}>
                        <Text style={styles.notifGoLinkText}>Ver en debate</Text>
                        <Ionicons name="arrow-forward" size={11} color={ExLibrisColors.primary} />
                      </View>
                    )}
                  </View>
                </View>

                {/* Botón para eliminar notificación individual */}
                <Pressable
                  style={styles.btnDeleteSingle}
                  onPress={() => eliminarNotificacion(item.id_notificacion)}
                  hitSlop={6}
                >
                  <Ionicons name="close-outline" size={16} color={ExLibrisColors.textMuted} />
                </Pressable>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="notifications-off-outline" size={36} color={ExLibrisColors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Bandeja sin notificaciones</Text>
                <Text style={styles.emptySubtitle}>
                  Te avisaremos aquí cuando otros lectores den like a tus comentarios, respondan a tus opiniones o cuando haya avisos de moderación.
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: ExLibrisMetrics.spacingSm,
    backgroundColor: ExLibrisColors.background,
    borderBottomWidth: 1,
    borderBottomColor: ExLibrisColors.border,
  },
  leftSection: {
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: ExLibrisColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: ExLibrisColors.primary,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 4,
  },
  rolePillLector: {
    backgroundColor: ExLibrisColors.primaryMuted,
  },
  rolePillModerador: {
    backgroundColor: ExLibrisColors.moderatorLight,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  roleTextLector: {
    color: ExLibrisColors.primary,
  },
  roleTextModerador: {
    color: ExLibrisColors.moderator,
  },
  iconButton: {
    padding: 4,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: ExLibrisColors.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: ExLibrisColors.background,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: ExLibrisColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: ExLibrisColors.border,
    backgroundColor: ExLibrisColors.surface,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalBellBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ExLibrisColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: ExLibrisColors.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnActionRefresh: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: ExLibrisColors.surfaceVariant,
  },
  btnClose: {
    padding: 4,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: 8,
    backgroundColor: ExLibrisColors.surfaceVariant,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ExLibrisColors.border,
  },
  btnActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  btnActionSecondaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  btnActionSecondaryTextMuted: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
  },
  notifListContent: {
    padding: ExLibrisMetrics.spacingMd,
    paddingBottom: 40,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: ExLibrisColors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: 12,
    borderWidth: 1,
    borderColor: ExLibrisColors.border,
    gap: 10,
    alignItems: 'flex-start',
  },
  notifCardUnread: {
    backgroundColor: '#FBF8F4',
    borderColor: ExLibrisColors.primaryMuted,
    borderLeftWidth: 3,
    borderLeftColor: ExLibrisColors.primary,
  },
  notifLeft: {
    paddingTop: 2,
  },
  tipoBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBody: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: ExLibrisColors.text,
  },
  notifTitleUnread: {
    fontWeight: '800',
    color: ExLibrisColors.primary,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ExLibrisColors.primary,
  },
  notifMessage: {
    fontSize: 12,
    color: ExLibrisColors.textSecondary,
    lineHeight: 16,
  },
  notifFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  notifDate: {
    fontSize: 10,
    color: ExLibrisColors.textMuted,
  },
  notifGoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  notifGoLinkText: {
    fontSize: 10,
    fontWeight: '700',
    color: ExLibrisColors.primary,
  },
  btnDeleteSingle: {
    padding: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ExLibrisColors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ExLibrisColors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: ExLibrisColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
