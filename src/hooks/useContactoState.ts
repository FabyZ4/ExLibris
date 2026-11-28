import { UserProfile } from '@/types/auth.types';
import { ContactMessage, ContactTopic } from '@/types/contact.types';
import {
  createContactMessageDb,
  getContactMessagesForUserDb,
  getPendingContactMessagesDb,
  resolveContactMessageDb,
} from '@/services/database.service';
import { useCallback, useEffect, useState } from 'react';

export const useContactoState = (currentUser: UserProfile | null) => {
  const [misMensajesContacto, setMisMensajesContacto] = useState<ContactMessage[]>([]);
  const [mensajesContactoPendientes, setMensajesContactoPendientes] = useState<ContactMessage[]>([]);
  const [cargandoContacto, setCargandoContacto] = useState(false);
  const [errorContacto, setErrorContacto] = useState<{ userId: string; message: string } | null>(null);
  const [mensajesCargadosParaUsuario, setMensajesCargadosParaUsuario] = useState<string | null>(null);

  const recargarMensajesContacto = useCallback(async () => {
    if (!currentUser || currentUser.id.startsWith('demo-')) {
      setMisMensajesContacto([]);
      setMensajesContactoPendientes([]);
      return;
    }

    setCargandoContacto(true);
    setErrorContacto(null);
    try {
      const [propios, pendientes] = await Promise.all([
        getContactMessagesForUserDb(currentUser.id),
        currentUser.rol === 'moderador' ? getPendingContactMessagesDb() : Promise.resolve([]),
      ]);
      setMisMensajesContacto(propios);
      setMensajesContactoPendientes(pendientes);
      setMensajesCargadosParaUsuario(currentUser.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los mensajes.';
      setErrorContacto({ userId: currentUser.id, message });
      throw error;
    } finally {
      setCargandoContacto(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.id.startsWith('demo-')) return;
    let active = true;

    const sync = async () => {
      try {
        const [propios, pendientes] = await Promise.all([
          getContactMessagesForUserDb(currentUser.id),
          currentUser.rol === 'moderador' ? getPendingContactMessagesDb() : Promise.resolve([]),
        ]);
        if (active) {
          setMisMensajesContacto(propios);
          setMensajesContactoPendientes(pendientes);
          setMensajesCargadosParaUsuario(currentUser.id);
          setErrorContacto(null);
        }
      } catch (error) {
        if (active) {
          setErrorContacto({
            userId: currentUser.id,
            message: error instanceof Error ? error.message : 'No se pudieron cargar los mensajes.',
          });
        }
      }
    };

    void sync();
    const interval = currentUser.rol === 'moderador' ? setInterval(sync, 10000) : undefined;
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [currentUser]);

  const enviarMensajeContacto = useCallback(async (tipo: ContactTopic, mensaje: string) => {
    if (!currentUser || currentUser.id.startsWith('demo-')) {
      throw new Error('Inicia sesión con una cuenta para contactar al equipo.');
    }
    await createContactMessageDb(currentUser.id, tipo, mensaje);
    try {
      await recargarMensajesContacto();
    } catch (error) {
      console.warn('El mensaje se envió, pero no se pudo actualizar el historial:', error);
    }
  }, [currentUser, recargarMensajesContacto]);

  const resolverMensajeContacto = useCallback(async (idContacto: string) => {
    await resolveContactMessageDb(idContacto);
    try {
      await recargarMensajesContacto();
    } catch (error) {
      console.warn('El mensaje se atendió, pero no se pudo actualizar la cola:', error);
    }
  }, [recargarMensajesContacto]);

  return {
    misMensajesContacto: mensajesCargadosParaUsuario === currentUser?.id ? misMensajesContacto : [],
    mensajesContactoPendientes: mensajesCargadosParaUsuario === currentUser?.id &&
      currentUser?.rol === 'moderador'
      ? mensajesContactoPendientes
      : [],
    cargandoContacto: cargandoContacto || Boolean(
      currentUser &&
      !currentUser.id.startsWith('demo-') &&
      mensajesCargadosParaUsuario !== currentUser.id &&
      errorContacto?.userId !== currentUser.id
    ),
    errorContacto: errorContacto && currentUser && errorContacto.userId === currentUser.id
      ? errorContacto.message
      : null,
    recargarMensajesContacto,
    enviarMensajeContacto,
    resolverMensajeContacto,
  };
};
