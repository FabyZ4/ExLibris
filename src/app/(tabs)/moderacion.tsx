import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/AppHeader';
import { useExLibris, ModerationReport } from '@/store/ExLibrisContext';
import { ExLibrisMetrics } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';

export default function ModeracionScreen() {
  const { colors, styles } = useExLibrisStyles(createStyles);
  const router = useRouter();
  const {
    userRole,
    reportes,
    moderarReporte,
    metricasModeracion,
    resenas,
  } = useExLibris();

  const [activeTab, setActiveTab] = useState<'reportados' | 'feed'>('reportados');

  if (userRole !== 'moderador') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <AppHeader subtitle="Acceso Restringido" />
        <View style={styles.accessDeniedBox}>
          <View style={styles.lockIconCircle}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          <Text style={styles.accessDeniedTitle}>Panel Restringido</Text>
          <Text style={styles.accessDeniedText}>
            Esta sección es de acceso exclusivo para cuentas con rol de Moderador. Tu usuario actual está registrado como Lector y no tiene permisos para auditar ni eliminar reseñas.
          </Text>
          <Pressable
            style={styles.btnVolverBiblioteca}
            onPress={() => router.replace('/biblioteca')}
          >
            <Ionicons name="book-outline" size={16} color="#FFFFFF" />
            <Text style={styles.btnVolverBibliotecaText}>Volver a mi Biblioteca</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const reportesPendientes = reportes.filter(r => r.estado === 'pendiente');

  const handleConservar = (reporte: ModerationReport) => {
    Alert.alert(
      'Conservar Comentario',
      '¿Confirmas que este comentario no infringe las normas de convivencia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Conservar',
          onPress: () => moderarReporte(reporte.id_reporte, 'conservar'),
        },
      ]
    );
  };

  const handleEliminar = (reporte: ModerationReport) => {
    Alert.alert(
      'Eliminar Comentario',
      '¿Estás seguro de que deseas eliminar permanentemente este comentario por infringir las normas de la comunidad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar definitivamente',
          style: 'destructive',
          onPress: () => moderarReporte(reporte.id_reporte, 'eliminar'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader subtitle="Panel de Moderación" />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Banner distintivo de seguridad verde */}
        <View style={styles.securityHeader}>
          <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.securityHeaderText}>
            PANEL DE MODERADOR EXLIBRIS - ACCESO SEGURO
          </Text>
        </View>

        {/* Estado de la Comunidad y Métricas */}
        <Text style={styles.sectionHeading}>Estado de la Comunidad</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="warning-outline" size={14} color={colors.danger} />
              <Text style={styles.metricLabelRed}>Pendientes</Text>
            </View>
            <Text style={styles.metricValue}>{metricasModeracion.pendientes}</Text>
            <Text style={styles.metricSub}>Reportes por revisar</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="checkmark-done" size={14} color={colors.moderator} />
              <Text style={styles.metricLabelGreen}>Aprobados</Text>
            </View>
            <Text style={styles.metricValue}>{metricasModeracion.aprobadosHoy}</Text>
            <Text style={styles.metricSub}>Comentarios hoy</Text>
          </View>
        </View>

        {/* Selector de pestañas: Reportados por usuarios vs Feed reciente */}
        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.tabButton, activeTab === 'reportados' && styles.tabButtonActive]}
            onPress={() => setActiveTab('reportados')}
          >
            <Ionicons
              name="alert-circle-outline"
              size={14}
              color={activeTab === 'reportados' ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[styles.tabButtonText, activeTab === 'reportados' && styles.tabButtonTextActive]}
            >
              Reportados por usuarios ({metricasModeracion.pendientes})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabButton, activeTab === 'feed' && styles.tabButtonActive]}
            onPress={() => setActiveTab('feed')}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={activeTab === 'feed' ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[styles.tabButtonText, activeTab === 'feed' && styles.tabButtonTextActive]}
            >
              Feed reciente
            </Text>
          </Pressable>
        </View>

        {/* Lista de Reportes Pendientes */}
        {activeTab === 'reportados' && (
          <View style={styles.reportsSection}>
            <View style={styles.reportsHeaderRow}>
              <Text style={styles.subHeading}>Casos marcados por lectores</Text>
              <Text style={styles.priorityTag}>Prioridad alta</Text>
            </View>

            {reportesPendientes.length === 0 ? (
              <View style={styles.allCleanCard}>
                <Ionicons name="checkmark-circle-outline" size={42} color={colors.moderator} />
                <Text style={styles.allCleanTitle}>Comunidad en orden</Text>
                <Text style={styles.allCleanSub}>
                  No hay comentarios reportados pendientes de auditoría en este momento.
                </Text>
              </View>
            ) : (
              reportesPendientes.map(reporte => (
                <View key={reporte.id_reporte} style={styles.reportCard}>
                  {/* Fila usuario infractor y obra */}
                  <View style={styles.reportCardTop}>
                    <View style={styles.infractorUserRow}>
                      <Ionicons name="person-circle-outline" size={32} color={colors.danger} />
                      <View>
                        <View style={styles.userNameBadgeRow}>
                          <Text style={styles.infractorName}>{reporte.usuario_infractor}</Text>
                          <View style={styles.infractorBadge}>
                            <Text style={styles.infractorBadgeText}>▲ Infractor</Text>
                          </View>
                        </View>
                        <Text style={styles.obraText}>
                          {reporte.tipo_comentario === 'respuesta' ? 'Respuesta en: ' : 'Reseña de: '}
                          <Text style={{ fontWeight: '700' }}>{reporte.titulo_obra}</Text>
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.reportTimestamp}>{reporte.fecha}</Text>
                  </View>

                  {/* Causa del reporte */}
                  <View style={styles.causaBox}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                    <Text style={styles.causaText}>Causa: {reporte.motivo}</Text>
                  </View>

                  {/* Texto del comentario */}
                  <View style={styles.commentQuoteBox}>
                    <Text style={styles.commentQuoteText}>
                      {reporte.tipo_comentario === 'respuesta' ? 'Respuesta: ' : 'Reseña: '}
                      &ldquo;{reporte.comentario}&rdquo;
                    </Text>
                  </View>

                  {/* Acciones de Moderación */}
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={styles.btnConservar}
                      onPress={() => handleConservar(reporte)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.text} />
                      <Text style={styles.btnConservarText}>Conservar</Text>
                    </Pressable>

                    <Pressable
                      style={styles.btnEliminar}
                      onPress={() => handleEliminar(reporte)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.btnEliminarText}>Eliminar comentario</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Feed Reciente de todos los comentarios */}
        {activeTab === 'feed' && (
          <View style={styles.feedSection}>
            <Text style={styles.subHeading}>Historial reciente de la comunidad</Text>
            {resenas.map(r => (
              <View key={r.id_resena} style={styles.feedItem}>
                <View style={styles.feedHeader}>
                  <Text style={styles.feedUser}>{r.nombre_usuario}</Text>
                  <Text style={styles.feedBook}>en &ldquo;{r.titulo_libro}&rdquo;</Text>
                </View>
                <Text style={styles.feedText}>{r.comentario}</Text>
                <Text style={styles.feedTime}>{r.fecha}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingHorizontal: ExLibrisMetrics.spacingMd,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.moderator,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: ExLibrisMetrics.radiusSm,
    marginTop: 10,
    gap: 8,
  },
  securityHeaderText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  accessDeniedBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ExLibrisMetrics.spacingLg,
  },
  lockIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  accessDeniedText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 320,
  },
  btnVolverBiblioteca: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 8,
  },
  btnVolverBibliotecaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 14,
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: ExLibrisMetrics.radiusMd,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabelRed: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
  },
  metricLabelGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.moderator,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 4,
  },
  metricSub: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    padding: 4,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 4,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  reportsSection: {
    gap: 12,
  },
  reportsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  priorityTag: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.danger,
  },
  allCleanCard: {
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  allCleanTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.moderator,
    marginTop: 8,
  },
  allCleanSub: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: ExLibrisMetrics.radiusMd,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reportCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infractorUserRow: {
    flexDirection: 'row',
    gap: 8,
  },
  infractorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infractorInitial: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
  },
  userNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infractorName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  infractorBadge: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  infractorBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.danger,
  },
  obraText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reportTimestamp: {
    fontSize: 10,
    color: colors.textMuted,
  },
  causaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 6,
    marginBottom: 8,
  },
  causaText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.danger,
  },
  commentQuoteBox: {
    backgroundColor: colors.surfaceVariant,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  commentQuoteText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.text,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnConservar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.borderDark,
    gap: 6,
  },
  btnConservarText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  btnEliminar: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.danger,
    gap: 6,
  },
  btnEliminarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedSection: {
    gap: 10,
  },
  feedItem: {
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: ExLibrisMetrics.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedHeader: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  feedUser: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  feedBook: {
    fontSize: 11,
    color: colors.primary,
    fontStyle: 'italic',
  },
  feedText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  feedTime: {
    fontSize: 9,
    color: colors.textMuted,
  },
});
