import { supabase } from '@/lib/supabase';
import {
  eliminarNotificacionDb,
  getNotificacionesDb,
  marcarNotificacionLeidaDb,
} from '@/services/database.service';
import { UserProfile } from '@/types/auth.types';
import { NotificationItem } from '@/types/notification.types';
import { mapNotificaciones } from '@/utils/mappers';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const useNotificacionesState = (currentUser: UserProfile | null) => {
  const [notificaciones, setNotificaciones] = useState<NotificationItem[]>([]);

  const notificacionesNoLeidasCount = useMemo(
    () => notificaciones.filter(n => !n.leida).length,
    [notificaciones]
  );

  const sincronizarNotificaciones = useCallback(async () => {
    if (!currentUser || currentUser.id.startsWith('demo-')) return;
    try {
      const remoteNotifs = await getNotificacionesDb(currentUser.id);
      if (remoteNotifs) {
        setNotificaciones(mapNotificaciones(remoteNotifs));
      }
    } catch (err) {
      console.warn('Error sincronizando notificaciones desde Supabase:', err);
    }
  }, [currentUser]);

  // Subscripción en tiempo real a notificaciones en Supabase y sondeo periódico
  useEffect(() => {
    if (!currentUser || currentUser.id.startsWith('demo-')) return;

    const channel = supabase
      .channel(`notificaciones-live:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificaciones',
        },
        (payload: any) => {
          if (!payload.new || payload.new.id_usuario === currentUser.id) {
            sincronizarNotificaciones();
          }
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      sincronizarNotificaciones();
    }, 8000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [currentUser, sincronizarNotificaciones]);

  const marcarNotificacionLeida = useCallback((id_notificacion: string) => {
    if (!id_notificacion.startsWith('notif-')) {
      marcarNotificacionLeidaDb(id_notificacion).catch(() => {});
    }
    setNotificaciones(prev =>
      prev.map(n => (n.id_notificacion === id_notificacion ? { ...n, leida: true } : n))
    );
  }, []);

  const marcarTodasNotificacionesLeidas = useCallback(() => {
    notificaciones.forEach(n => {
      if (!n.leida && !n.id_notificacion.startsWith('notif-')) {
        marcarNotificacionLeidaDb(n.id_notificacion).catch(() => {});
      }
    });
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
  }, [notificaciones]);

  const eliminarNotificacion = useCallback((id_notificacion: string) => {
    if (!id_notificacion.startsWith('notif-')) {
      eliminarNotificacionDb(id_notificacion).catch(() => {});
    }
    setNotificaciones(prev => prev.filter(n => n.id_notificacion !== id_notificacion));
  }, []);

  const limpiarTodasNotificaciones = useCallback(() => {
    notificaciones.forEach(n => {
      if (!n.id_notificacion.startsWith('notif-')) {
        eliminarNotificacionDb(n.id_notificacion).catch(() => {});
      }
    });
    setNotificaciones([]);
  }, [notificaciones]);

  return {
    notificaciones,
    setNotificaciones,
    notificacionesNoLeidasCount,
    sincronizarNotificaciones,
    marcarNotificacionLeida,
    marcarTodasNotificacionesLeidas,
    eliminarNotificacion,
    limpiarTodasNotificaciones,
  };
};
