import {
  crearNotificacionDb,
  crearReporteDb,
  eliminarResenaModeradorDb,
} from '@/services/database.service';
import { UserProfile } from '@/types/auth.types';
import { Review } from '@/types/community.types';
import { ModerationReport } from '@/types/moderation.types';
import { useCallback, useMemo, useState } from 'react';

export const useModeracionState = (
  currentUser: UserProfile | null,
  resenas: Review[],
  setResenas: React.Dispatch<React.SetStateAction<Review[]>>
) => {
  const [reportes, setReportes] = useState<ModerationReport[]>([]);
  const [aprobadosHoy, setAprobadosHoy] = useState(0);

  const reportarComentario = useCallback(
    (id_resena: string, motivo: string) => {
      const resena = resenas.find(r => r.id_resena === id_resena);
      if (!resena) return;

      const newReport: ModerationReport = {
        id_reporte: `rep-${Date.now()}`,
        id_resena,
        id_usuario_infractor: resena.id_usuario,
        usuario_infractor: `@${resena.nombre_usuario.toLowerCase().replace(/\s+/g, '_')}`,
        titulo_obra: resena.titulo_libro,
        motivo,
        comentario: resena.comentario,
        fecha: 'Hoy, hace un momento',
        prioridad: 'alta',
        estado: 'pendiente',
      };
      setReportes(prev => [newReport, ...prev]);

      if (currentUser && !currentUser.id.startsWith('demo-')) {
        crearReporteDb({
          id_resena,
          id_usuario: currentUser.id,
          motivo,
          estado: 'pendiente',
        }).catch(() => {});
      }
    },
    [currentUser, resenas]
  );

  const moderarReporte = useCallback(
    (id_reporte: string, accion: 'conservar' | 'eliminar') => {
      const reporte = reportes.find(r => r.id_reporte === id_reporte);
      if (!reporte) return;

      if (accion === 'eliminar') {
        eliminarResenaModeradorDb(reporte.id_resena).catch(() => {});
        setResenas(prev => prev.filter(r => r.id_resena !== reporte.id_resena));
        setReportes(prev => prev.filter(r => r.id_reporte !== id_reporte));

        if (reporte.id_usuario_infractor && !reporte.id_usuario_infractor.startsWith('demo-')) {
          crearNotificacionDb({
            id_usuario: reporte.id_usuario_infractor,
            tipo: 'moderacion',
            titulo: 'Comentario eliminado por Moderación',
            mensaje: `Tu comentario en "${reporte.titulo_obra}" ha sido eliminado por el equipo de moderación (${reporte.motivo}).`,
            id_resena: reporte.id_resena,
          }).catch(() => {});
        }
      } else {
        setReportes(prev => prev.filter(r => r.id_reporte !== id_reporte));
        setAprobadosHoy(prev => prev + 1);
      }
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
