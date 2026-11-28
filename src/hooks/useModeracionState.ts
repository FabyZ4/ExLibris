import {
  crearNotificacionDb,
  crearReporteDb,
  getReportesPendientesDb,
  resolverReporteModeradorDb,
} from '@/services/database.service';
import { UserProfile } from '@/types/auth.types';
import { Review } from '@/types/community.types';
import { ModerationReport } from '@/types/moderation.types';
import { findReply, removeReplyTree } from '@/utils/commentTree';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const useModeracionState = (
  currentUser: UserProfile | null,
  resenas: Review[],
  setResenas: React.Dispatch<React.SetStateAction<Review[]>>
) => {
  const [reportes, setReportes] = useState<ModerationReport[]>([]);
  const [aprobadosHoy, setAprobadosHoy] = useState(0);

  const obtenerReportesPendientes = useCallback(async (): Promise<ModerationReport[]> => {
    if (!currentUser || currentUser.rol !== 'moderador' || currentUser.id.startsWith('demo-')) return [];

    const remoteReports = await getReportesPendientesDb();
    return remoteReports.map((rep: any): ModerationReport => {
      const respuesta = Array.isArray(rep.resena_respuestas)
        ? rep.resena_respuestas[0]
        : rep.resena_respuestas;
      const tipoComentario = rep.tipo_comentario || (rep.id_respuesta ? 'respuesta' : 'resena');
      const esRespuesta = tipoComentario === 'respuesta';
      const nombreInfractor = esRespuesta
        ? respuesta?.usuario?.nombre_usuario || 'usuario'
        : rep.resenas?.usuario?.nombre_usuario || 'usuario';

      return {
        id_reporte: rep.id_reporte,
        id_resena: rep.id_resena,
        id_respuesta: rep.id_respuesta || undefined,
        tipo_comentario: tipoComentario,
        id_usuario_infractor: esRespuesta ? respuesta?.id_usuario : rep.resenas?.id_usuario,
        usuario_infractor: `@${nombreInfractor.toLowerCase().replace(/\s+/g, '_')}`,
        titulo_obra: rep.resenas?.libros?.titulo || 'Obra Literaria',
        motivo: rep.motivo,
        comentario: esRespuesta
          ? respuesta?.comentario || 'La respuesta ya no está disponible.'
          : rep.resenas?.comentario || '',
        fecha: rep.creado_el
          ? new Date(rep.creado_el).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
          : 'Reciente',
        prioridad: 'alta',
        estado: rep.estado || 'pendiente',
      };
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.rol !== 'moderador' || currentUser.id.startsWith('demo-')) return;

    let active = true;
    const sincronizar = async () => {
      try {
        const remoteReports = await obtenerReportesPendientes();
        if (active) setReportes(remoteReports);
      } catch (error) {
        if (active) console.warn('No se pudieron actualizar los reportes de moderación:', error);
      }
    };

    void sincronizar();
    const interval = setInterval(sincronizar, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentUser, obtenerReportesPendientes]);

  const reportarComentario = useCallback(
    async (id_resena: string, motivo: string, id_respuesta?: string) => {
      if (!currentUser) throw new Error('Inicia sesión para enviar un reporte.');
      const resena = resenas.find(r => r.id_resena === id_resena);
      if (!resena) throw new Error('No se encontró el comentario que intentas reportar.');

      const respuesta = id_respuesta
        ? findReply(resena.respuestas || [], id_respuesta)
        : undefined;
      if (id_respuesta && !respuesta) {
        throw new Error('No se encontró la respuesta que intentas reportar.');
      }

      const idUsuarioInfractor = respuesta?.id_usuario || resena.id_usuario;
      if (idUsuarioInfractor === currentUser.id) {
        throw new Error('No puedes reportar tu propio comentario.');
      }
      const tipoComentario = respuesta ? 'respuesta' : 'resena';

      const newReport: ModerationReport = {
        id_reporte: `rep-${Date.now()}`,
        id_resena,
        id_respuesta,
        tipo_comentario: tipoComentario,
        id_usuario_infractor: idUsuarioInfractor,
        usuario_infractor: `@${(respuesta?.nombre_usuario || resena.nombre_usuario).toLowerCase().replace(/\s+/g, '_')}`,
        titulo_obra: resena.titulo_libro,
        motivo,
        comentario: respuesta?.comentario || resena.comentario,
        fecha: 'Hoy, hace un momento',
        prioridad: 'alta',
        estado: 'pendiente',
      };

      if (currentUser.id.startsWith('demo-')) {
        setReportes(prev => [newReport, ...prev]);
        return;
      }

      const savedReportId = await crearReporteDb({
        id_resena,
        id_respuesta: id_respuesta || null,
        motivo,
      });
      if (currentUser.rol === 'moderador') {
        setReportes(prev => [{ ...newReport, id_reporte: savedReportId }, ...prev]);
      }
    },
    [currentUser, resenas]
  );

  const moderarReporte = useCallback(
    async (id_reporte: string, accion: 'conservar' | 'eliminar') => {
      const reporte = reportes.find(r => r.id_reporte === id_reporte);
      if (!reporte) return;

      if (!id_reporte.startsWith('rep-')) {
        await resolverReporteModeradorDb(id_reporte, accion);
      }

      if (accion === 'eliminar') {
        const tipoComentario = reporte.tipo_comentario
          || (reporte.id_respuesta ? 'respuesta' : 'resena');
        if (tipoComentario === 'respuesta') {
          const idRespuesta = reporte.id_respuesta;
          if (!idRespuesta) {
            throw new Error('No se encontró la respuesta reportada para eliminar.');
          }
          setResenas(prev => prev.map(review =>
            review.id_resena === reporte.id_resena
              ? { ...review, respuestas: removeReplyTree(review.respuestas || [], idRespuesta) }
              : review
          ));
        } else {
          setResenas(prev => prev.filter(r => r.id_resena !== reporte.id_resena));
        }

        if (reporte.id_usuario_infractor && !reporte.id_usuario_infractor.startsWith('demo-')) {
          const esRespuesta = tipoComentario === 'respuesta';
          crearNotificacionDb({
            id_usuario: reporte.id_usuario_infractor,
            tipo: 'moderacion',
            titulo: esRespuesta
              ? 'Respuesta eliminada por Moderación'
              : 'Comentario eliminado por Moderación',
            mensaje: `Tu ${esRespuesta ? 'respuesta' : 'comentario'} en "${reporte.titulo_obra}" ha sido eliminado por el equipo de moderación (${reporte.motivo}).`,
            id_resena: reporte.id_resena,
          }).catch(error => {
            console.warn('No se pudo notificar al autor del comentario eliminado:', error);
          });
        }
      }

      setReportes(prev => prev.filter(r => r.id_reporte !== id_reporte));
      if (accion === 'conservar') setAprobadosHoy(prev => prev + 1);
    },
    [reportes, setResenas]
  );

  const metricasModeracion = useMemo(
    () => ({
      pendientes: reportes.filter(r => r.estado === 'pendiente').length,
      aprobadosHoy,
    }),
    [reportes, aprobadosHoy]
  );

  return {
    reportes,
    setReportes,
    aprobadosHoy,
    setAprobadosHoy,
    reportarComentario,
    moderarReporte,
    metricasModeracion,
  };
};
