import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookProposal, BookProposalData, useExLibris, ModerationReport } from '@/store/ExLibrisContext';
import { ExLibrisMetrics } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useExLibrisStyles } from '@/hooks/useExLibrisStyles';
import { ContactTopic } from '@/types/contact.types';

const camposSolicitud: { key: keyof BookProposalData; label: string }[] = [
  { key: 'titulo', label: 'Título' },
  { key: 'autor', label: 'Autor' },
  { key: 'editorial', label: 'Editorial' },
  { key: 'anio', label: 'Año' },
  { key: 'total_paginas', label: 'Páginas' },
  { key: 'sinopsis', label: 'Sinopsis' },
  { key: 'portada_url', label: 'URL de portada' },
  { key: 'categorias', label: 'Categorías' },
];

const mostrarValor = (value: string | number | string[] | undefined) => {
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Ninguna';
  return value === undefined ? '—' : String(value);
};

const camposPresentes = (data: BookProposalData) =>
  camposSolicitud
    .filter(field => Object.prototype.hasOwnProperty.call(data, field.key))
    .map(field => field.key);

export default function PanelModeracionScreen() {
  const { colors, styles } = useExLibrisStyles(createStyles);
  const router = useRouter();
  const {
    userRole,
    reportes,
    moderarReporte,
    metricasModeracion,
    resenas,
    solicitudesLibroPendientes,
    cargandoSolicitudesLibro,
    errorSolicitudesLibro,
    recargarSolicitudesLibro,
    resolverSolicitudLibro,
    recargarCatalogo,
    mensajesContactoPendientes,
    cargandoContacto,
    errorContacto,
    recargarMensajesContacto,
    resolverMensajeContacto,
  } = useExLibris();

  const [activeTab, setActiveTab] = useState<'reportados' | 'feed' | 'libros' | 'contacto'>('reportados');
  const [camposSeleccionados, setCamposSeleccionados] = useState<Record<string, string[]>>({});

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/perfil');
    }
  };

  if (userRole !== 'moderador') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>Acceso Denegado</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.accessDeniedBox}>
          <View style={styles.lockIconCircle}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          <Text style={styles.accessDeniedTitle}>Panel Restringido</Text>
          <Text style={styles.accessDeniedText}>
            Esta sección es de acceso exclusivo para cuentas con rol de Moderador. Tu usuario actual está registrado como Lector y no tiene permisos para auditar ni eliminar reseñas.
          </Text>
          <Pressable
            style={styles.btnVolver}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
            <Text style={styles.btnVolverText}>Regresar a mi Perfil</Text>
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
          onPress: async () => {
            try {
              await moderarReporte(reporte.id_reporte, 'conservar');
            } catch (error) {
              Alert.alert(
                'No se pudo guardar la revisión',
                error instanceof Error ? error.message : 'Intenta nuevamente.'
              );
            }
          },
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
          onPress: async () => {
            try {
              await moderarReporte(reporte.id_reporte, 'eliminar');
            } catch (error) {
              Alert.alert(
                'No se pudo guardar la revisión',
                error instanceof Error ? error.message : 'Intenta nuevamente.'
              );
            }
          },
        },
      ]
    );
  };

  const toggleCampoSolicitud = (solicitud: BookProposal, campo: string) => {
    setCamposSeleccionados(previous => {
      const current = previous[solicitud.id_solicitud] || camposPresentes(solicitud.datos_propuestos);
      if (solicitud.tipo === 'nuevo' && ['titulo', 'autor'].includes(campo)) {
        return previous;
      }
      const next = current.includes(campo)
        ? current.filter(value => value !== campo)
        : [...current, campo];
      return { ...previous, [solicitud.id_solicitud]: next };
    });
  };

  const handleResolverSolicitud = (solicitud: BookProposal, accion: 'aprobar' | 'rechazar') => {
    const campos = camposSeleccionados[solicitud.id_solicitud] || camposPresentes(solicitud.datos_propuestos);
    if (accion === 'aprobar' && solicitud.tipo === 'nuevo' &&
      (!campos.includes('titulo') || !campos.includes('autor'))) {
      Alert.alert('Faltan datos obligatorios', 'Para incorporar un libro deben aprobarse el título y el autor.');
      return;
    }

    Alert.alert(
      accion === 'aprobar' ? 'Aprobar propuesta' : 'Rechazar propuesta',
      accion === 'aprobar'
        ? 'Se aplicarán únicamente los campos seleccionados y el libro quedará visible en el catálogo.'
        : 'La propuesta será rechazada y no modificará el catálogo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: accion === 'aprobar' ? 'Aprobar' : 'Rechazar',
          style: accion === 'rechazar' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await resolverSolicitudLibro(
                solicitud.id_solicitud,
                accion,
                accion === 'aprobar' ? campos : [],
              );
              if (accion === 'aprobar') await recargarCatalogo();
              Alert.alert(
                accion === 'aprobar' ? 'Propuesta aprobada' : 'Propuesta rechazada',
                accion === 'aprobar'
                  ? 'Los datos aprobados ya están en el catálogo.'
                  : 'La propuesta fue cerrada sin cambios.'
              );
            } catch (error) {
              Alert.alert(
                'No se pudo procesar',
                error instanceof Error ? error.message : 'Intenta nuevamente.'
              );
            }
          },
        },
      ]
    );
  };

  const handleRefreshBookRequests = async () => {
    try {
      await recargarSolicitudesLibro();
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar',
        error instanceof Error ? error.message : 'Intenta nuevamente.'
      );
    }
  };

  const handleRefreshContactMessages = async () => {
    try {
      await recargarMensajesContacto();
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar',
        error instanceof Error ? error.message : 'Intenta nuevamente.'
      );
    }
  };

  const handleResolveContactMessage = (idContacto: string) => {
    Alert.alert(
      'Marcar como atendido',
      '¿Confirmas que este mensaje ya fue revisado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Atendido',
          onPress: async () => {
            try {
              await resolverMensajeContacto(idContacto);
            } catch (error) {
              Alert.alert(
                'No se pudo guardar la revisión',
                error instanceof Error ? error.message : 'Intenta nuevamente.'
              );
            }
          },
        },
      ]
    );
  };

  const contactTopicLabel: Record<ContactTopic, string> = {
    recomendacion: 'Recomendación',
    queja: 'Queja',
    mejora: 'Mejora',
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Barra de cabecera con botón de retorno */}
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.titleWrapper}>
          <Text style={styles.topBarTitle}>Panel de Moderación</Text>
          <Text style={styles.topBarSub}>Auditoría y Normas de la Comunidad</Text>
        </View>
        <View style={styles.shieldBadge}>
          <Ionicons name="shield-checkmark" size={18} color={colors.moderator} />
        </View>
      </View>

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
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
              Reportes ({metricasModeracion.pendientes})
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
              Feed
            </Text>
          </Pressable>

            <Pressable
              style={[styles.tabButton, activeTab === 'libros' && styles.tabButtonActive]}
              onPress={() => setActiveTab('libros')}
            >
              <Ionicons
                name="book-outline"
                size={14}
                color={activeTab === 'libros' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text style={[styles.tabButtonText, activeTab === 'libros' && styles.tabButtonTextActive]}>
                Libros ({solicitudesLibroPendientes.length})
              </Text>
            </Pressable>

          <Pressable
            style={[styles.tabButton, activeTab === 'contacto' && styles.tabButtonActive]}
            onPress={() => setActiveTab('contacto')}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={14}
              color={activeTab === 'contacto' ? '#FFFFFF' : colors.textSecondary}
            />
            <Text style={[styles.tabButtonText, activeTab === 'contacto' && styles.tabButtonTextActive]}>
              Contacto ({mensajesContactoPendientes.length})
            </Text>
          </Pressable>
        </ScrollView>

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

        {activeTab === 'libros' && (
          <View style={styles.reportsSection}>
            <View style={styles.reportsHeaderRow}>
              <Text style={styles.subHeading}>Solicitudes de libros y correcciones</Text>
              <Pressable onPress={handleRefreshBookRequests}>
                <Ionicons name="refresh-outline" size={19} color={colors.primary} />
              </Pressable>
            </View>
            {cargandoSolicitudesLibro ? (
              <View style={styles.allCleanCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.allCleanSub}>Cargando solicitudes…</Text>
              </View>
            ) : errorSolicitudesLibro ? (
              <View style={styles.allCleanCard}>
                <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
                <Text style={styles.allCleanTitle}>No se pudieron cargar las solicitudes</Text>
                <Text style={styles.allCleanSub}>{errorSolicitudesLibro}</Text>
              </View>
            ) : solicitudesLibroPendientes.length === 0 ? (
              <View style={styles.allCleanCard}>
                <Ionicons name="checkmark-circle-outline" size={42} color={colors.moderator} />
                <Text style={styles.allCleanTitle}>No hay propuestas pendientes</Text>
                <Text style={styles.allCleanSub}>Las nuevas solicitudes de lectores aparecerán aquí.</Text>
              </View>
            ) : (
              solicitudesLibroPendientes.map(solicitud => {
                const campos = camposSeleccionados[solicitud.id_solicitud] ||
                  camposPresentes(solicitud.datos_propuestos);
                const actual = solicitud.libro_actual;
                return (
                  <View key={solicitud.id_solicitud} style={styles.reportCard}>
                    <View style={styles.reportCardTop}>
                      <View style={styles.requestTitleBlock}>
                        <Text style={styles.subHeading}>
                          {solicitud.tipo === 'nuevo' ? 'Nuevo libro' : 'Corrección de libro'}
                        </Text>
                        <Text style={styles.requestMetaText}>
                          {solicitud.nombre_usuario || 'Lector'} · ISBN {solicitud.isbn}
                        </Text>
                      </View>
                      <Text style={styles.reportTimestamp}>
                        {new Date(solicitud.creado_el).toLocaleDateString('es-CL')}
                      </Text>
                    </View>

                    {camposSolicitud
                      .filter(field => Object.prototype.hasOwnProperty.call(solicitud.datos_propuestos, field.key))
                      .map(field => {
                        const checked = campos.includes(field.key);
                        const required = solicitud.tipo === 'nuevo' &&
                          ['titulo', 'autor'].includes(field.key);
                        const currentValues: BookProposalData = actual ? {
                          titulo: actual.titulo,
                          autor: actual.autor,
                          editorial: actual.editorial,
                          anio: actual.anio,
                          total_paginas: actual.total_paginas,
                          sinopsis: actual.sinopsis,
                          portada_url: actual.portada_url,
                          categorias: actual.categorias,
                        } : {};
                        const currentValue = currentValues[field.key];
                        const proposedValue = solicitud.datos_propuestos[field.key];
                        return (
                          <View key={field.key} style={styles.proposalField}>
                            <Pressable
                              style={styles.proposalFieldToggle}
                              onPress={() => toggleCampoSolicitud(solicitud, field.key)}
                              disabled={required}
                            >
                              <Ionicons
                                name={checked ? 'checkbox' : 'square-outline'}
                                size={19}
                                color={checked ? colors.primary : colors.textMuted}
                              />
                              <Text style={styles.proposalFieldLabel}>
                                {field.label}{required ? ' *' : ''}
                              </Text>
                            </Pressable>
                            {actual && (
                              <Text style={styles.proposalValue}>Actual: {mostrarValor(currentValue)}</Text>
                            )}
                            <Text style={styles.proposalValue}>
                              {field.key === 'categorias' ? 'Quedarán' : 'Propuesta'}:{' '}
                              {mostrarValor(proposedValue)}
                            </Text>
                          </View>
                        );
                      })}

                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.btnConservar}
                        onPress={() => handleResolverSolicitud(solicitud, 'rechazar')}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                        <Text style={styles.btnConservarText}>Rechazar</Text>
                      </Pressable>
                      <Pressable
                        style={styles.btnAprobarSolicitud}
                        onPress={() => handleResolverSolicitud(solicitud, 'aprobar')}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.btnEliminarText}>Aprobar selección</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'contacto' && (
          <View style={styles.reportsSection}>
            <View style={styles.reportsHeaderRow}>
              <Text style={styles.subHeading}>Mensajes de lectores</Text>
              <Pressable onPress={handleRefreshContactMessages}>
                <Ionicons name="refresh-outline" size={19} color={colors.primary} />
              </Pressable>
            </View>
            {cargandoContacto ? (
              <View style={styles.allCleanCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.allCleanSub}>Cargando mensajes…</Text>
              </View>
            ) : errorContacto ? (
              <View style={styles.allCleanCard}>
                <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
                <Text style={styles.allCleanTitle}>No se pudieron cargar los mensajes</Text>
                <Text style={styles.allCleanSub}>{errorContacto}</Text>
              </View>
            ) : mensajesContactoPendientes.length === 0 ? (
              <View style={styles.allCleanCard}>
                <Ionicons name="checkmark-circle-outline" size={42} color={colors.moderator} />
                <Text style={styles.allCleanTitle}>No hay mensajes pendientes</Text>
                <Text style={styles.allCleanSub}>Los nuevos mensajes de contacto aparecerán aquí.</Text>
              </View>
            ) : (
              mensajesContactoPendientes.map(item => (
                <View key={item.id_contacto} style={styles.reportCard}>
                  <View style={styles.reportCardTop}>
                    <View style={styles.requestTitleBlock}>
                      <Text style={styles.subHeading}>{contactTopicLabel[item.tipo]}</Text>
                      <Text style={styles.requestMetaText}>
                        {item.nombre_usuario || 'Lector'}
                      </Text>
                    </View>
                    <Text style={styles.reportTimestamp}>
                      {new Date(item.creado_el).toLocaleDateString('es-CL')}
                    </Text>
                  </View>
                  <Text style={styles.contactMessageText}>{item.mensaje}</Text>
                  <Pressable
                    style={styles.btnAprobarSolicitud}
                    onPress={() => handleResolveContactMessage(item.id_contacto)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.btnEliminarText}>Marcar atendido</Text>
                  </Pressable>
                </View>
              ))
            )}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    padding: 4,
  },
  titleWrapper: {
    flex: 1,
    marginLeft: 10,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  topBarSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  shieldBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.moderatorLight,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 12,
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
  btnVolver: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 8,
  },
  btnVolverText: {
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
    alignItems: 'center',
  },
  tabButton: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonText: {
    fontSize: 9,
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
  btnAprobarSolicitud: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: ExLibrisMetrics.radiusSm,
    backgroundColor: colors.moderator,
    gap: 6,
  },
  requestTitleBlock: {
    flex: 1,
  },
  requestMetaText: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },
  proposalField: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  proposalFieldToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  proposalFieldLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  proposalValue: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    paddingLeft: 26,
  },
  contactMessageText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
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
