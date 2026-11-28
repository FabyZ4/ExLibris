import {
  crearSolicitudLibroDb,
  getSolicitudesLibroPendientesDb,
  getSolicitudesLibroPropiasDb,
  getRevisionesPendientesCountDb,
  revisarSolicitudLibroDb,
  CrearSolicitudLibro,
} from '@/services/database.service';
import { UserProfile, UserRole } from '@/types/auth.types';
import { BookProposal } from '@/types/moderation.types';
import { useCallback, useEffect, useState } from 'react';

export const useSolicitudesLibroState = (
  currentUser: UserProfile | null,
  userRole: UserRole
) => {
  const userId = currentUser?.id;
  const [solicitudesLibroPropias, setSolicitudesLibroPropias] = useState<BookProposal[]>([]);
  const [solicitudesLibroPendientes, setSolicitudesLibroPendientes] = useState<BookProposal[]>([]);
  const [cargandoSolicitudesLibro, setCargandoSolicitudesLibro] = useState(false);
  const [errorSolicitudesLibro, setErrorSolicitudesLibro] = useState<{
    userId: string;
    message: string;
  } | null>(null);
  const [solicitudesCargadasParaUsuario, setSolicitudesCargadasParaUsuario] = useState<string | null>(null);
  const [revisionesPendientes, setRevisionesPendientes] = useState<{
    userId: string;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (!userId || userId.startsWith('demo-') || userRole !== 'moderador') return;

    let active = true;
    const actualizarCantidad = async () => {
      try {
        const count = await getRevisionesPendientesCountDb();
        if (active) setRevisionesPendientes({ userId, count });
      } catch (error) {
        if (active) {
          console.warn('No se pudo actualizar el conteo de revisiones pendientes:', error);
        }
      }
    };

    void actualizarCantidad();
    const interval = setInterval(actualizarCantidad, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [userId, userRole]);

  const recargarSolicitudesLibro = useCallback(async () => {
    if (!userId) {
      setSolicitudesLibroPropias([]);
      setSolicitudesLibroPendientes([]);
      setSolicitudesCargadasParaUsuario(null);
      setErrorSolicitudesLibro(null);
      return;
    }

    setCargandoSolicitudesLibro(true);
    setErrorSolicitudesLibro(null);
    try {
      const propiasPromise = getSolicitudesLibroPropiasDb(userId);
      const pendientesPromise = userRole === 'moderador'
        ? getSolicitudesLibroPendientesDb()
        : Promise.resolve([]);
      const [propias, pendientes] = await Promise.all([propiasPromise, pendientesPromise]);
      setSolicitudesLibroPropias(propias);
      setSolicitudesLibroPendientes(pendientes);
      setSolicitudesCargadasParaUsuario(userId);
    } catch (error) {
      setErrorSolicitudesLibro(
        {
          userId,
          message: error instanceof Error ? error.message : 'No se pudieron cargar las solicitudes.',
        }
      );
      throw error;
    } finally {
      setCargandoSolicitudesLibro(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    let active = true;
    if (!userId) return () => {
      active = false;
    };

    const pendientesPromise = userRole === 'moderador'
      ? getSolicitudesLibroPendientesDb()
      : Promise.resolve([]);
    Promise.all([getSolicitudesLibroPropiasDb(userId), pendientesPromise])
      .then(([propias, pendientes]) => {
        if (!active) return;
        setSolicitudesLibroPropias(propias);
        setSolicitudesLibroPendientes(pendientes);
        setSolicitudesCargadasParaUsuario(userId);
        setErrorSolicitudesLibro(null);
      })
      .catch(error => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorSolicitudesLibro({ userId, message });
        console.warn('No se pudieron cargar las solicitudes de libros:', error);
      });

    return () => {
      active = false;
    };
  }, [userId, userRole]);

  const enviarSolicitudLibro = useCallback(async (solicitud: Omit<CrearSolicitudLibro, 'id_usuario'>) => {
    if (!userId) {
      throw new Error('Debes iniciar sesión para enviar una solicitud de libro.');
    }
    await crearSolicitudLibroDb({ ...solicitud, id_usuario: userId });
    try {
      await recargarSolicitudesLibro();
    } catch (error) {
      console.warn('La solicitud se guardó, pero no se pudo actualizar el historial:', error);
    }
  }, [userId, recargarSolicitudesLibro]);

  const resolverSolicitudLibro = useCallback(async (
    idSolicitud: string,
    accion: 'aprobar' | 'rechazar',
    camposAprobados: string[] = [],
    nota?: string
  ) => {
    await revisarSolicitudLibroDb(idSolicitud, accion, camposAprobados, nota);
    try {
      await recargarSolicitudesLibro();
    } catch (error) {
      console.warn('La revisión se guardó, pero no se pudo actualizar la cola:', error);
    }
  }, [recargarSolicitudesLibro]);

  return {
    solicitudesLibroPropias: solicitudesCargadasParaUsuario === userId ? solicitudesLibroPropias : [],
    solicitudesLibroPendientes: solicitudesCargadasParaUsuario === userId && userRole === 'moderador'
      ? solicitudesLibroPendientes
      : [],
    cargandoSolicitudesLibro: cargandoSolicitudesLibro ||
      Boolean(userId && solicitudesCargadasParaUsuario !== userId &&
        errorSolicitudesLibro?.userId !== userId),
    errorSolicitudesLibro: errorSolicitudesLibro && errorSolicitudesLibro.userId === userId
      ? errorSolicitudesLibro.message
      : null,
    revisionesPendientesCount: userId && !userId.startsWith('demo-') && userRole === 'moderador' &&
      revisionesPendientes?.userId === userId
      ? revisionesPendientes.count
      : 0,
    recargarSolicitudesLibro,
    enviarSolicitudLibro,
    resolverSolicitudLibro,
  };
};
