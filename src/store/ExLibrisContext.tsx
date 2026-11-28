import { useBibliotecaState } from '@/hooks/useBibliotecaState';
import { useCatalogoState } from '@/hooks/useCatalogoState';
import { useComunidadState } from '@/hooks/useComunidadState';
import { useContactoState } from '@/hooks/useContactoState';
import { useModeracionState } from '@/hooks/useModeracionState';
import { useNotificacionesState } from '@/hooks/useNotificacionesState';
import { useSolicitudesLibroState } from '@/hooks/useSolicitudesLibroState';
import {
  getAuthenticatedUserProfile,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
} from '@/services/auth.service';
import {
  getBibliotecaFromDb,
  getCategoriasFromDb,
  getLikesResenaDb,
  getLibrosFromDb,
  getNotificacionesDb,
  getResenasFromDb,
  getRespuestasResenaDb,
  updatePublicUsernameDb,
} from '@/services/database.service';
import { GoogleBookVolume } from '@/services/googleBooks.service';
import { UserProfile, UserRole } from '@/types/auth.types';
import { BibliotecaItem, Book, BookRatingStats } from '@/types/book.types';
import { Review } from '@/types/community.types';
import { BookProposal, BookProposalData, ModerationReport } from '@/types/moderation.types';
import { NotificationItem } from '@/types/notification.types';
import { ContactMessage, ContactTopic } from '@/types/contact.types';
import type { ThemeMode } from '@/constants/theme';
import { ThemeColorsProvider } from '@/store/ThemeContext';
import {
  mapBibliotecaFromDb,
  mapNotificaciones,
  mapResenasFromDb,
  normalizeCategories,
} from '@/utils/mappers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';

// Re-exportar tipos para mantener compatibilidad total con todas las pantallas
export type { UserProfile, UserRole } from '@/types/auth.types';
export type { BibliotecaItem, Book, BookRatingStats } from '@/types/book.types';
export type { CommentReply, Review } from '@/types/community.types';
export type { ModerationReport } from '@/types/moderation.types';
export type { BookProposal, BookProposalData } from '@/types/moderation.types';
export type { NotificationItem } from '@/types/notification.types';

export interface ExLibrisContextType {
  currentUser: UserProfile | null;
  userRole: UserRole;
  themeMode: ThemeMode;
  actualizarTema: (mode: ThemeMode) => Promise<void>;
  actualizarNombrePublico: (nombre: string) => Promise<void>;
  iniciarSesion: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  cerrarSesion: () => Promise<void>;
  registrarse: (email: string, password: string, nombre: string) => Promise<{
    success: boolean;
    message?: string;
    needsLogin?: boolean;
    needsEmailVerification?: boolean;
    emailRateLimited?: boolean;
  }>;

  biblioteca: BibliotecaItem[];
  agregarALaBiblioteca: (
    book: Book | GoogleBookVolume,
    estado: 'leyendo' | 'por_leer' | 'leido',
    bitacora?: Partial<BibliotecaItem>
  ) => void;
  actualizarProgreso: (isbn: string, pagina_actual: number, nuevoEstado?: 'leyendo' | 'por_leer' | 'leido') => void;
  actualizarBitacora: (isbn: string, bitacora: Partial<BibliotecaItem>) => void;
  removerDeBiblioteca: (isbn: string) => void;
  getBibliotecaItem: (isbn: string) => BibliotecaItem | undefined;

  catalogo: Book[];
  categorias: string[];
  recargarCatalogo: () => Promise<void>;
  buscarEnCatalogo: (query: string, categoria?: string | string[]) => Book[];
  buscarObrasPorIsbn: (isbn: string) => Promise<Book | null>;

  resenas: Review[];
  cargandoMasResenas?: boolean;
  hayMasResenas?: boolean;
  cargarMasResenas?: (isbn?: string) => Promise<void>;
  publicarResena: (isbn: string, calificacion: number, comentario: string) => void;
  eliminarResenaPropia: (id_resena: string) => Promise<void>;
  darLikeResena: (id_resena: string) => void;
  responderResena: (id_resena: string, comentario: string, id_respuesta_padre?: string) => Promise<void>;
  darLikeRespuesta: (id_resena: string, id_respuesta: string) => Promise<void>;
  eliminarRespuestaPropia: (id_resena: string, id_respuesta: string) => Promise<void>;
  obtenerMetricasLibro: (isbn: string) => BookRatingStats;

  reportes: ModerationReport[];
  reportarComentario: (id_resena: string, motivo: string, id_respuesta?: string) => Promise<void>;
  moderarReporte: (id_reporte: string, accion: 'conservar' | 'eliminar') => Promise<void>;
  solicitudesLibroPropias: BookProposal[];
  solicitudesLibroPendientes: BookProposal[];
  cargandoSolicitudesLibro: boolean;
  errorSolicitudesLibro: string | null;
  revisionesPendientesCount: number;
  recargarSolicitudesLibro: () => Promise<void>;
  enviarSolicitudLibro: (solicitud: {
    id_libro: string | null;
    isbn: string;
    tipo: BookProposal['tipo'];
    datos_propuestos: BookProposalData;
  }) => Promise<void>;
  resolverSolicitudLibro: (
    id_solicitud: string,
    accion: 'aprobar' | 'rechazar',
    campos_aprobados?: string[],
    nota?: string
  ) => Promise<void>;
  misMensajesContacto: ContactMessage[];
  mensajesContactoPendientes: ContactMessage[];
  cargandoContacto: boolean;
  errorContacto: string | null;
  recargarMensajesContacto: () => Promise<void>;
  enviarMensajeContacto: (tipo: ContactTopic, mensaje: string) => Promise<void>;
  resolverMensajeContacto: (id_contacto: string) => Promise<void>;

  metricasModeracion: {
    pendientes: number;
    aprobadosHoy: number;
  };

  notificaciones: NotificationItem[];
  notificacionesNoLeidasCount: number;
  marcarNotificacionLeida: (id_notificacion: string) => void;
  marcarTodasNotificacionesLeidas: () => void;
  eliminarNotificacion: (id_notificacion: string) => void;
  limpiarTodasNotificaciones: () => void;
  sincronizarDatos: () => Promise<void>;
}

const STORAGE_KEY = '@exlibris_data_store_v1';
const THEME_MODE_STORAGE_KEY = '@exlibris_theme_mode_v1';

export const LIBROS_INICIALES: Book[] = [];

const ExLibrisContext = createContext<ExLibrisContextType | undefined>(undefined);

export const ExLibrisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado de usuario y sesión
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('lector');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [datosLocalesCargados, setDatosLocalesCargados] = useState(false);
  const themePreferenceChanged = useRef(false);
  const themePersistenceSequence = useRef(0);

  const currentUserRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Hooks modulares de dominio
  const catalogoState = useCatalogoState();
  const { catalogo, setCatalogo, setCategorias } = catalogoState;

  const bibliotecaState = useBibliotecaState(currentUser, catalogo, setCatalogo);
  const { todasLasBibliotecas, setTodasLasBibliotecas } = bibliotecaState;

  const comunidadState = useComunidadState(currentUser, userRole, catalogo);
  const { resenas, setResenas } = comunidadState;

  const notificacionesState = useNotificacionesState(currentUser);
  const { notificaciones, setNotificaciones, sincronizarNotificaciones } = notificacionesState;

  const moderacionState = useModeracionState(currentUser, resenas, setResenas);
  const { reportes, setReportes } = moderacionState;
  const solicitudesLibroState = useSolicitudesLibroState(currentUser, userRole);
  const contactoState = useContactoState(currentUser);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_MODE_STORAGE_KEY)
      .then(savedMode => {
        if (
          !active ||
          themePreferenceChanged.current ||
          (savedMode !== 'light' && savedMode !== 'dark')
        ) return;
        setThemeMode(savedMode);
      })
      .catch(error => console.warn('No se pudo cargar la preferencia de tema:', error));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const email = session?.user?.email;
      if (event === 'USER_UPDATED' && email) {
        setCurrentUser(previous => previous ? { ...previous, email } : previous);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const actualizarTema = useCallback(async (mode: ThemeMode) => {
    const previousMode = themeMode;
    const sequence = ++themePersistenceSequence.current;
    themePreferenceChanged.current = true;
    setThemeMode(mode);
    try {
      await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    } catch (error) {
      if (sequence === themePersistenceSequence.current) {
        setThemeMode(previousMode);
      }
      throw error;
    }
  }, [themeMode]);

  const actualizarNombrePublico = useCallback(async (nombre: string) => {
    if (!currentUser) throw new Error('Debes iniciar sesión para editar tu perfil.');
    const normalizedName = nombre.trim();
    if (normalizedName.length < 2 || normalizedName.length > 30) {
      throw new Error('El nombre público debe tener entre 2 y 30 caracteres.');
    }

    await updatePublicUsernameDb(currentUser.id, normalizedName);
    setCurrentUser(previous => previous ? { ...previous, nombre: normalizedName } : previous);
    const updateReplyNames = (replies: Review['respuestas']): Review['respuestas'] =>
      replies?.map(reply => ({
        ...reply,
        ...(reply.id_usuario === currentUser.id ? { nombre_usuario: normalizedName } : {}),
        respuestas: updateReplyNames(reply.respuestas),
      }));
    setResenas(previous => previous.map(review => ({
      ...review,
      ...(review.id_usuario === currentUser.id ? { nombre_usuario: normalizedName } : {}),
      respuestas: updateReplyNames(review.respuestas),
    })));
  }, [currentUser, setResenas]);

  // Sincronización en vivo
  const sincronizarDatos = useCallback(async () => {
    // 1. Sincronizar notificaciones de forma prioritaria
    await sincronizarNotificaciones();

    // 2. Sincronizar reseñas, likes y respuestas
    try {
      const [dbResenas, dbLikes, dbRespuestas] = await Promise.all([
        getResenasFromDb(),
        getLikesResenaDb(),
        getRespuestasResenaDb(),
      ]);

      if (dbResenas && dbResenas.length > 0) {
        const mapped = mapResenasFromDb(dbResenas, dbLikes, dbRespuestas);
        setResenas(prev => {
          const remoteIds = new Set(mapped.map(r => r.id_resena));
          const localOnly = prev.filter(r => r.id_resena.startsWith('res-') && !remoteIds.has(r.id_resena));
          return [...mapped, ...localOnly];
        });
      }
    } catch (err) {
      console.warn('Error sincronizando reseñas/likes en vivo:', err);
    }
  }, [sincronizarNotificaciones, setResenas]);

  // Refrescar al volver a primer plano
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        sincronizarDatos();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [sincronizarDatos]);

  // Carga inicial y persistencia
  useEffect(() => {
    async function loadStoredData() {
      try {
        const authenticatedUser = await getAuthenticatedUserProfile();
        if (authenticatedUser) {
          setCurrentUser(authenticatedUser);
          setUserRole(authenticatedUser.rol);
        }

        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const isMockId = (id?: string) => typeof id === 'string' && /^(res|rep|notif|bib)-\d+$/.test(id);

          if (parsed.biblioteca && Array.isArray(parsed.biblioteca) && parsed.biblioteca.length > 0) {
            const validBib = parsed.biblioteca.filter((item: BibliotecaItem) => !isMockId(item.id_biblioteca));
            setTodasLasBibliotecas(validBib.map((item: BibliotecaItem) => ({
              ...item,
              libro: {
                ...item.libro,
                categorias: normalizeCategories(
                  (item.libro as BibliotecaItem['libro'] & { categoria?: string }).categoria ??
                    item.libro.categorias
                ),
              },
            })));
          }

          if (parsed.resenas && Array.isArray(parsed.resenas)) {
            const validRes = parsed.resenas.filter((r: Review) => !isMockId(r.id_resena));
            setResenas(validRes.map((r: Review) => ({
              ...r,
              likes: typeof r.likes === 'number' ? r.likes : 0,
              likedBy: Array.isArray(r.likedBy) ? r.likedBy : [],
              respuestas: Array.isArray(r.respuestas) ? r.respuestas : [],
            })));
          }

          if (parsed.reportes && Array.isArray(parsed.reportes)) {
            const validRep = parsed.reportes.filter((rep: ModerationReport) => !isMockId(rep.id_reporte));
            setReportes(validRep);
          }

          if (parsed.notificaciones && Array.isArray(parsed.notificaciones)) {
            const validNotif = parsed.notificaciones.filter((n: NotificationItem) =>
              !isMockId(n.id_notificacion) && (!authenticatedUser || !n.id_usuario || n.id_usuario === authenticatedUser.id)
            );
            setNotificaciones(validNotif);
          }
        }

        try {
          const dbCategorias = await getCategoriasFromDb();
          setCategorias(dbCategorias.map(c => c.nombre_categoria));
        } catch (categoryError) {
          console.warn('No se pudieron cargar categorías desde Supabase:', categoryError);
        }

        if (authenticatedUser) {
          try {
            const remoteItems = mapBibliotecaFromDb(await getBibliotecaFromDb(authenticatedUser.id));
            if (remoteItems.length > 0) {
              setTodasLasBibliotecas(prev => {
                const remoteIsbns = new Set(remoteItems.map(item => item.isbn));
                const localItems = prev.filter(
                  item => item.id_usuario === authenticatedUser.id && !remoteIsbns.has(item.isbn)
                );
                return [
                  ...remoteItems,
                  ...localItems,
                  ...prev.filter(item => item.id_usuario !== authenticatedUser.id),
                ];
              });
              setCatalogo(prev => {
                const remoteBooks = new Map(remoteItems.map(item => [item.libro.isbn, item.libro]));
                return [...remoteBooks.values(), ...prev.filter(book => !remoteBooks.has(book.isbn))];
              });
            }
          } catch (loadError) {
            console.warn('No se pudo restaurar la biblioteca desde Supabase:', loadError);
          }

          try {
            const remoteNotifs = await getNotificacionesDb(authenticatedUser.id);
            if (remoteNotifs) {
              setNotificaciones(mapNotificaciones(remoteNotifs));
            }
          } catch (notifErr) {
            console.warn('No se pudieron cargar las notificaciones desde Supabase:', notifErr);
          }

        }

        try {
          const [dbResenas, dbLikes, dbRespuestas] = await Promise.all([
            getResenasFromDb(),
            getLikesResenaDb(),
            getRespuestasResenaDb(),
          ]);

          if (dbResenas && dbResenas.length > 0) {
            const mappedReviews = mapResenasFromDb(dbResenas, dbLikes, dbRespuestas);
            setResenas(prev => {
              const remoteIds = new Set(mappedReviews.map(r => r.id_resena));
              const localOnly = prev.filter(r => !remoteIds.has(r.id_resena));
              return [...mappedReviews, ...localOnly];
            });
          }
        } catch (resenasError) {
          console.warn('No se pudieron sincronizar las reseñas desde Supabase:', resenasError);
        }

        try {
          const dbLibros = await getLibrosFromDb();
          if (dbLibros && dbLibros.length > 0) {
            setCatalogo(prev => {
              const ids = new Set(dbLibros.map(l => l.isbn));
              const formatDb = dbLibros.map(d => ({
                ...d,
                editorial: d.editorial || 'Editorial canónica',
                anio: d.anio || 2024,
              }));
              return [...formatDb, ...prev.filter(p => !ids.has(p.isbn))];
            });
          }
        } catch (catalogError) {
          console.warn('No se pudo cargar el catálogo desde Supabase:', catalogError);
        }
      } catch (e) {
        console.warn('Error al cargar datos locales de ExLibris:', e);
      } finally {
        setDatosLocalesCargados(true);
      }
    }

    loadStoredData();
  }, [setCategorias, setTodasLasBibliotecas, setCatalogo, setNotificaciones, setReportes, setResenas]);

  // Persistir en almacenamiento local
  useEffect(() => {
    if (!datosLocalesCargados) return;

    async function persist() {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ biblioteca: todasLasBibliotecas, resenas, reportes, notificaciones })
        );
      } catch (e) {
        console.warn('Error al persistir datos de ExLibris:', e);
      }
    }
    persist();
  }, [datosLocalesCargados, todasLasBibliotecas, resenas, reportes, notificaciones]);

  // Métodos de autenticación
  const iniciarSesion = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {
    const { user, error } = await signInWithEmail(email, password);
    if (user) {
      setCurrentUser(user);
      setUserRole(user.rol);

      try {
        const remoteItems = mapBibliotecaFromDb(await getBibliotecaFromDb(user.id));
        const remoteIsbns = new Set(remoteItems.map(item => item.isbn));
        setTodasLasBibliotecas(prev => {
          const localItems = prev.filter(
            item => item.id_usuario === user.id && !remoteIsbns.has(item.isbn)
          );
          const otherUsers = prev.filter(item => item.id_usuario !== user.id);
          return [...remoteItems, ...localItems, ...otherUsers];
        });
        setCatalogo(prev => {
          const remoteBooks = new Map(remoteItems.map(item => [item.libro.isbn, item.libro]));
          return [...remoteBooks.values(), ...prev.filter(book => !remoteBooks.has(book.isbn))];
        });
      } catch (loadError) {
        console.warn('No se pudo sincronizar la biblioteca con Supabase:', loadError);
      }

      try {
        const remoteNotifs = await getNotificacionesDb(user.id);
        if (remoteNotifs) {
          setNotificaciones(mapNotificaciones(remoteNotifs));
        }
      } catch (notifErr) {
        console.warn('No se pudieron cargar notificaciones de usuario:', notifErr);
      }

      try {
        const [dbResenas, dbLikes, dbRespuestas] = await Promise.all([
          getResenasFromDb(),
          getLikesResenaDb(),
          getRespuestasResenaDb(),
        ]);
        if (dbResenas && dbResenas.length > 0) {
          const mapped = mapResenasFromDb(dbResenas, dbLikes, dbRespuestas);
          setResenas(prev => {
            const remoteIds = new Set(mapped.map(r => r.id_resena));
            const localOnly = prev.filter(r => r.id_resena.startsWith('res-') && !remoteIds.has(r.id_resena));
            return [...mapped, ...localOnly];
          });
        }
      } catch (resenasErr) {
        console.warn('No se pudieron sincronizar reseñas al iniciar sesión:', resenasErr);
      }

      return { success: true };
    }

    return { success: false, message: error || 'Credenciales inválidas. Verifica tu correo y contraseña.' };
  };

  const cerrarSesion = async () => {
    await signOutUser();
    setCurrentUser(null);
    setUserRole('lector');
    setNotificaciones([]);
    setReportes([]);
  };

  const registrarse = async (
    email: string,
    password: string,
    nombre: string
  ): Promise<{
    success: boolean;
    message?: string;
    needsLogin?: boolean;
    needsEmailVerification?: boolean;
    emailRateLimited?: boolean;
  }> => {
    const res = await signUpWithEmail(email, password, nombre);
    if (!res.success) {
      return {
        success: false,
        message: res.error,
        emailRateLimited: res.emailRateLimited,
      };
    }
    if (res.emailVerificationRequired) {
      return {
        success: false,
        needsLogin: true,
        needsEmailVerification: true,
        message: `Cuenta creada. Verifica tu correo en ${email} usando el enlace que te enviamos. Después podrás iniciar sesión. Revisa también la carpeta de spam.`,
      };
    }
    const login = await iniciarSesion(email, password);
    if (!login.success) {
      return {
        success: false,
        needsLogin: true,
        message: 'La cuenta se creó correctamente. Inicia sesión con tu correo y contraseña para continuar.',
      };
    }
    return login;
  };

  return (
    <ExLibrisContext.Provider
      value={{
        currentUser,
        userRole,
        themeMode,
        actualizarTema,
        actualizarNombrePublico,
        iniciarSesion,
        cerrarSesion,
        registrarse,
        ...bibliotecaState,
        ...catalogoState,
        ...comunidadState,
        ...moderacionState,
        ...solicitudesLibroState,
        ...contactoState,
        ...notificacionesState,
        sincronizarDatos,
      }}
    >
      <ThemeColorsProvider mode={themeMode}>{children}</ThemeColorsProvider>
    </ExLibrisContext.Provider>
  );
};

export const useExLibris = () => {
  const context = useContext(ExLibrisContext);
  if (!context) {
    throw new Error('useExLibris debe usarse dentro de un ExLibrisProvider');
  }
  return context;
};
