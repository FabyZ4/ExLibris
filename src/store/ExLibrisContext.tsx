import { getAuthenticatedUserProfile, signInWithEmail, signOutUser, signUpWithEmail, UserProfile } from '@/services/auth.service';
import {
  actualizarProgresoDb,
  crearResenaDb,
  DbBibliotecaItemConLibro,
  eliminarResenaModeradorDb,
  getBibliotecaFromDb,
  getCategoriasFromDb,
  getLibrosFromDb,
  guardarEnBibliotecaDb,
  guardarLibroEnDb,
} from '@/services/database.service';
import { buscarLibroPorIsbn, GoogleBookVolume } from '@/services/googleBooks.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'lector' | 'moderador';
export type { UserProfile };

export interface Book {
  isbn: string;
  titulo: string;
  autor: string;
  categorias: string[];
  sinopsis: string;
  portada_url: string;
  total_paginas: number;
  editorial?: string;
  anio?: number;
  rating?: number;
  rating_count?: number;
}

export interface BibliotecaItem {
  id_biblioteca: string;
  id_usuario?: string;
  isbn: string;
  libro: Book;
  estado: 'leyendo' | 'por_leer' | 'leido';
  pagina_actual: number;
  lugar_compra: string;
  precio_compra: number;
  fecha_compra: string;
  formato_edicion: string;
  actualizado_el: string;
}

export interface Review {
  id_resena: string;
  isbn: string;
  titulo_libro: string;
  autor_libro: string;
  nombre_usuario: string;
  rol_usuario: UserRole;
  avatar_badge?: string;
  calificacion: number;
  comentario: string;
  fecha: string;
  likes: number;
  estado: 'publicado' | 'eliminado';
}

export interface ModerationReport {
  id_reporte: string;
  id_resena: string;
  usuario_infractor: string;
  titulo_obra: string;
  motivo: string;
  comentario: string;
  fecha: string;
  prioridad: 'alta' | 'media' | 'baja';
  estado: 'pendiente' | 'descartado' | 'eliminado';
}

interface ExLibrisContextType {
  currentUser: UserProfile | null;
  userRole: UserRole;
  iniciarSesion: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  cerrarSesion: () => Promise<void>;
  registrarse: (email: string, password: string, nombre: string) => Promise<{ success: boolean; message?: string; needsLogin?: boolean }>;
  
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
  buscarEnCatalogo: (query: string, categoria?: string) => Book[];
  buscarObrasPorIsbn: (isbn: string) => Promise<Book | null>;

  resenas: Review[];
  publicarResena: (isbn: string, calificacion: number, comentario: string) => void;
  
  reportes: ModerationReport[];
  reportarComentario: (id_resena: string, motivo: string) => void;
  moderarReporte: (id_reporte: string, accion: 'conservar' | 'eliminar') => void;

  metricasModeracion: {
    pendientes: number;
    aprobadosHoy: number;
  };
}

const STORAGE_KEY = '@exlibris_data_store_v1';

const mapBibliotecaFromDb = (items: DbBibliotecaItemConLibro[]): BibliotecaItem[] =>
  items.flatMap(item => {
    if (!item.libros) return [];
    const libro: Book = {
      ...item.libros,
      categorias: item.libros.categorias || [],
      editorial: 'Editorial canónica',
      anio: 2024,
      rating: 4.8,
      rating_count: 140,
    };
    return [{
      id_biblioteca: item.id_biblioteca,
      id_usuario: item.id_usuario,
      isbn: item.isbn,
      libro,
      estado: item.estado,
      pagina_actual: item.pagina_actual,
      lugar_compra: item.lugar_compra || '',
      precio_compra: item.precio_compra || 0,
      fecha_compra: item.fecha_compra || '',
      formato_edicion: item.formato_edicion || '',
      actualizado_el: item.actualizado_el || new Date().toISOString(),
    }];
  });

const normalizeCategories = (categories: string[] | string | null | undefined): string[] => {
  if (Array.isArray(categories)) return categories;
  if (typeof categories === 'string') {
    return categories.split(/\s*[,/|]\s*/).filter(Boolean);
  }
  return [];
};

// Catálogo base de obras literarias destacadas en español
export const LIBROS_INICIALES: Book[] = [
];

const BIBLIOTECA_INICIAL: BibliotecaItem[] = [
];

const RESENAS_INICIALES: Review[] = [
  {
    id_resena: 'res-1',
    isbn: '9788408043645',
    titulo_libro: 'La sombra del viento',
    autor_libro: 'Carlos Ruiz Zafón',
    nombre_usuario: 'Valeria Montes',
    rol_usuario: 'lector',
    avatar_badge: 'Lectora verificada',
    calificacion: 5,
    comentario: 'Una prosa envolvente que te transporta de inmediato a las callejuelas góticas de Barcelona. El Cementerio de los Libros Olvidados es uno de los mejores tributos al amor por la lectura.',
    fecha: 'Hace 2 días',
    likes: 48,
    estado: 'publicado',
  },
  {
    id_resena: 'res-2',
    isbn: '9788408043645',
    titulo_libro: 'La sombra del viento',
    autor_libro: 'Carlos Ruiz Zafón',
    nombre_usuario: 'Mateo Rivas',
    rol_usuario: 'lector',
    avatar_badge: 'Coleccionista',
    calificacion: 5,
    comentario: 'Personajes memorables y ritmo impecable, aunque el desenlace apura algunos hilos argumentales. Muy recomendado para coleccionistas.',
    fecha: 'Hace 5 días',
    likes: 23,
    estado: 'publicado',
  },
  {
    id_resena: 'res-3',
    isbn: '9788437604947',
    titulo_libro: 'Cien años de soledad',
    autor_libro: 'Gabriel García Márquez',
    nombre_usuario: 'carlos_lector99',
    rol_usuario: 'lector',
    avatar_badge: 'Infractor',
    calificacion: 1,
    comentario: 'Este libro es una porquería ilegible, los que lo leen no tienen cerebro y el final es que todos mueren en la página final bajo una plaga de hormigas.',
    fecha: 'Hoy, 11:40',
    likes: 0,
    estado: 'publicado',
  },
  {
    id_resena: 'res-4',
    isbn: '9788437604572',
    titulo_libro: 'Rayuela',
    autor_libro: 'Julio Cortázar',
    nombre_usuario: 'promo_bot',
    rol_usuario: 'lector',
    avatar_badge: 'Cuenta nueva',
    calificacion: 1,
    comentario: 'Gana dinero fácil descargando PDFs piratas en mi canal de Telegram bit.ly/librosgratis con soporte 24/7.',
    fecha: 'Ayer, 18:20',
    likes: 0,
    estado: 'publicado',
  },
];

const REPORTES_INICIALES: ModerationReport[] = [
  {
    id_reporte: 'rep-1',
    id_resena: 'res-3',
    usuario_infractor: '@carlos_lector99',
    titulo_obra: 'Cien años de soledad',
    motivo: 'Lenguaje ofensivo / Spoilers graves',
    comentario: 'Este libro es una porquería ilegible, los que lo leen no tienen cerebro y el final es que todos mueren en la página...',
    fecha: 'Hoy, 11:40',
    prioridad: 'alta',
    estado: 'pendiente',
  },
  {
    id_reporte: 'rep-2',
    id_resena: 'res-4',
    usuario_infractor: '@promo_bot',
    titulo_obra: 'Rayuela',
    motivo: 'Spam comercial',
    comentario: 'Gana dinero fácil descargando PDFs piratas en mi canal de Telegram bit.ly/librosgratis',
    fecha: 'Ayer, 18:20',
    prioridad: 'alta',
    estado: 'pendiente',
  },
];

const ExLibrisContext = createContext<ExLibrisContextType | undefined>(undefined);

export const ExLibrisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('lector');
  const [todasLasBibliotecas, setTodasLasBibliotecas] = useState<BibliotecaItem[]>(BIBLIOTECA_INICIAL);
  const [catalogo, setCatalogo] = useState<Book[]>(LIBROS_INICIALES);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [resenas, setResenas] = useState<Review[]>(RESENAS_INICIALES);
  const [reportes, setReportes] = useState<ModerationReport[]>(REPORTES_INICIALES);
  const [aprobadosHoy, setAprobadosHoy] = useState(18);
  const [datosLocalesCargados, setDatosLocalesCargados] = useState(false);

  const recargarCatalogo = async () => {
    const [dbLibros, dbCategorias] = await Promise.all([
      getLibrosFromDb(),
      getCategoriasFromDb(),
    ]);

    setCategorias(dbCategorias.map(category => category.nombre_categoria));
    setCatalogo(prev => {
      const ids = new Set(dbLibros.map(book => book.isbn));
      const formatDb = dbLibros.map(book => ({
        ...book,
        rating: 4.8,
        rating_count: 140,
        editorial: 'Editorial canónica',
        anio: 2024,
      }));
      return [...formatDb, ...prev.filter(book => !ids.has(book.isbn))];
    });
  };

  // Libros asociados al usuario actualmente activo — solo los suyos, no huérfanos
  const biblioteca = currentUser
    ? todasLasBibliotecas.filter(item => item.id_usuario === currentUser.id)
    : [];

  // Carga inicial persistida y sincronización con Supabase
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
          if (parsed.biblioteca && Array.isArray(parsed.biblioteca) && parsed.biblioteca.length > 0) {
            setTodasLasBibliotecas(parsed.biblioteca.map((item: BibliotecaItem) => ({
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
          if (parsed.resenas) setResenas(parsed.resenas);
          if (parsed.reportes) setReportes(parsed.reportes);
        }

        try {
          const dbCategorias = await getCategoriasFromDb();
          setCategorias(dbCategorias.map(category => category.nombre_categoria));
        } catch (categoryError) {
          console.warn('No se pudieron cargar las categorías desde Supabase:', categoryError);
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
        }

        // Intento de conexión en vivo a Supabase (si las credenciales .env están activas)
        try {
          const dbLibros = await getLibrosFromDb();
          if (dbLibros && dbLibros.length > 0) {
            setCatalogo(prev => {
              const ids = new Set(dbLibros.map(l => l.isbn));
              const formatDb = dbLibros.map(d => ({
                ...d,
                rating: 4.8,
                rating_count: 140,
                editorial: 'Editorial canónica',
                anio: 2024,
              }));
              return [...formatDb, ...prev.filter(p => !ids.has(p.isbn))];
            });
          }
        } catch (catalogError) {
          console.warn('No se pudo cargar el catálogo de libros desde Supabase:', catalogError);
        }
      } catch (e) {
        console.warn('Error al cargar datos locales de ExLibris:', e);
      } finally {
        setDatosLocalesCargados(true);
      }
    }
    loadStoredData();
  }, []);

  // Guardar cada vez que el estado crítico cambia
  useEffect(() => {
    if (!datosLocalesCargados) return;

    async function persist() {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ biblioteca: todasLasBibliotecas, resenas, reportes })
        );
      } catch (e) {
        console.warn('Error al persistir datos de ExLibris:', e);
      }
    }
    persist();
  }, [datosLocalesCargados, todasLasBibliotecas, resenas, reportes]);

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
      return { success: true };
    }

    return { success: false, message: error || 'Credenciales inválidas. Verifica tu correo y contraseña.' };
  };

  const cerrarSesion = async () => {
    await signOutUser();
    setCurrentUser(null);
    setUserRole('lector');
  };

  const registrarse = async (
    email: string,
    password: string,
    nombre: string
  ): Promise<{ success: boolean; message?: string; needsLogin?: boolean }> => {
    const res = await signUpWithEmail(email, password, nombre);
    if (!res.success) {
      return { success: false, message: res.error };
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

  const agregarALaBiblioteca = (
    bookInput: Book | GoogleBookVolume,
    estado: 'leyendo' | 'por_leer' | 'leido',
    bitacoraData?: Partial<BibliotecaItem>
  ) => {
    if (!currentUser) return;

    // Si no está en el catálogo, agregarlo
    const existsInCatalog = catalogo.some(b => b.isbn === bookInput.isbn);
    const bookToAdd: Book = {
      isbn: bookInput.isbn,
      titulo: bookInput.titulo,
      autor: bookInput.autor,
      categorias: 'categorias' in bookInput ? bookInput.categorias : [],
      sinopsis: bookInput.sinopsis || 'Sin descripción',
      portada_url: bookInput.portada_url,
      total_paginas: bookInput.total_paginas || 300,
      editorial: bookInput.editorial || 'Editorial estándar',
      anio: bookInput.anio || 2024,
      rating: (bookInput as Book).rating || 4.5,
      rating_count: (bookInput as Book).rating_count || 1,
    };

    if (!existsInCatalog) {
      setCatalogo(prev => [bookToAdd, ...prev]);
    }

    const currentUserId = currentUser.id;
    const paginaActualFinal = estado === 'leido'
      ? bookToAdd.total_paginas
      : Math.min(bitacoraData?.pagina_actual || 0, bookToAdd.total_paginas);
    const estadoFinal = paginaActualFinal >= bookToAdd.total_paginas ? 'leido' : estado;

    setTodasLasBibliotecas(prev => {
      const existingIndex = prev.findIndex(
        item => item.isbn === bookInput.isbn && item.id_usuario === currentUserId
      );
      const newItem: BibliotecaItem = {
        id_biblioteca: `bib-${Date.now()}`,
        id_usuario: currentUserId,
        isbn: bookInput.isbn,
        libro: bookToAdd,
        estado: estadoFinal,
        pagina_actual: paginaActualFinal,
        lugar_compra: bitacoraData?.lugar_compra || 'Librería local',
        precio_compra: bitacoraData?.precio_compra || 14990,
        fecha_compra: bitacoraData?.fecha_compra || 'Recientemente',
        formato_edicion: bitacoraData?.formato_edicion || 'Tapa rústica',
        actualizado_el: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = { ...copy[existingIndex], ...newItem };
        return copy;
      }
      return [newItem, ...prev];
    });

    if (currentUser && !currentUser.id.startsWith('demo-')) {
      void (async () => {
        try {
          await guardarLibroEnDb({
            isbn: bookToAdd.isbn,
            titulo: bookToAdd.titulo,
            autor: bookToAdd.autor,
            categorias: bookToAdd.categorias,
            sinopsis: bookToAdd.sinopsis,
            portada_url: bookToAdd.portada_url,
            total_paginas: bookToAdd.total_paginas,
          });
          const [savedItem] = await guardarEnBibliotecaDb({
            isbn: bookToAdd.isbn,
            id_usuario: currentUser.id,
            estado: estadoFinal,
            pagina_actual: paginaActualFinal,
            lugar_compra: bitacoraData?.lugar_compra || 'Librería local',
            precio_compra: bitacoraData?.precio_compra || 14990,
            formato_edicion: bitacoraData?.formato_edicion || 'Tapa rústica',
          });
          if (savedItem) {
            setTodasLasBibliotecas(prev => prev.map(item =>
              item.id_usuario === currentUser.id && item.isbn === bookToAdd.isbn
                ? { ...item, id_biblioteca: savedItem.id_biblioteca }
                : item
            ));
          }
        } catch (saveError) {
          console.warn('No se pudo guardar el libro en Supabase:', saveError);
        }
      })();
    }
  };

  const actualizarProgreso = (isbn: string, pagina_actual: number, nuevoEstado?: 'leyendo' | 'por_leer' | 'leido') => {
    if (!currentUser) return;
    const currentUserId = currentUser.id;
    setTodasLasBibliotecas(prev =>
      prev.map(item => {
        if (item.isbn === isbn && item.id_usuario === currentUserId) {
          const finalPagina = Math.min(Math.max(0, pagina_actual), item.libro.total_paginas);
          const finalEstado = finalPagina >= item.libro.total_paginas
            ? 'leido'
            : nuevoEstado || (finalPagina > 0 ? 'leyendo' : item.estado);
          // Sincronización asíncrona con Supabase
          actualizarProgresoDb(item.id_biblioteca, finalPagina, finalEstado).catch(() => {});

          return {
            ...item,
            pagina_actual: finalPagina,
            estado: finalEstado,
            actualizado_el: new Date().toISOString(),
          };
        }
        return item;
      })
    );
  };

  const actualizarBitacora = (isbn: string, bitacora: Partial<BibliotecaItem>) => {
    if (!currentUser) return;
    const currentUserId = currentUser.id;
    setTodasLasBibliotecas(prev =>
      prev.map(item =>
        item.isbn === isbn && item.id_usuario === currentUserId
          ? { ...item, ...bitacora, actualizado_el: new Date().toISOString() }
          : item
      )
    );
  };

  const removerDeBiblioteca = (isbn: string) => {
    if (!currentUser) return;
    const currentUserId = currentUser.id;
    setTodasLasBibliotecas(prev =>
      prev.filter(item => !(item.isbn === isbn && item.id_usuario === currentUserId))
    );
  };

  const getBibliotecaItem = (isbn: string) => {
    return biblioteca.find(item => item.isbn === isbn);
  };

  const buscarEnCatalogo = (query: string, categoria?: string) => {
    const q = query.toLowerCase().trim();
    return catalogo.filter(b => {
      const matchQuery =
        !q ||
        b.titulo.toLowerCase().includes(q) ||
        b.autor.toLowerCase().includes(q) ||
        b.isbn.includes(q);
      const matchCat =
        !categoria ||
        categoria === 'Todos' ||
        b.categorias.some(item => item.toLowerCase().includes(categoria.toLowerCase()));
      return matchQuery && matchCat;
    });
  };

  const buscarObrasPorIsbn = async (isbn: string): Promise<Book | null> => {
    const clean = isbn.replace(/[-\s]/g, '');
    const inCatalog = catalogo.find(b => b.isbn === clean);
    if (inCatalog) return inCatalog;

    const fromGoogle = await buscarLibroPorIsbn(clean);
    if (fromGoogle) {
      const newBook: Book = {
        isbn: fromGoogle.isbn,
        titulo: fromGoogle.titulo,
        autor: fromGoogle.autor,
        categorias: fromGoogle.categorias,
        sinopsis: fromGoogle.sinopsis,
        portada_url: fromGoogle.portada_url,
        total_paginas: fromGoogle.total_paginas,
        editorial: fromGoogle.editorial,
        anio: fromGoogle.anio,
        rating: 4.5,
        rating_count: 10,
      };
      setCatalogo(prev => [newBook, ...prev]);
      return newBook;
    }

    return null;
  };

  const publicarResena = (isbn: string, calificacion: number, comentario: string) => {
    const libro = catalogo.find(b => b.isbn === isbn);
    const newReview: Review = {
      id_resena: `res-${Date.now()}`,
      isbn,
      titulo_libro: libro?.titulo || 'Obra Literaria',
      autor_libro: libro?.autor || 'Autor',
      nombre_usuario: userRole === 'moderador' ? 'Fabiola (Moderadora)' : 'Fabiola Ramírez',
      rol_usuario: userRole,
      avatar_badge: userRole === 'moderador' ? 'Moderadora Oficial' : 'Lectora activa',
      calificacion,
      comentario,
      fecha: 'Recién publicado',
      likes: 0,
      estado: 'publicado',
    };
    // Sincronización asíncrona con Supabase
    crearResenaDb({
      isbn,
      calificacion,
      comentario,
      estado: 'publicado',
    }).catch(() => {});

    setResenas(prev => [newReview, ...prev]);
  };

  const reportarComentario = (id_resena: string, motivo: string) => {
    const resena = resenas.find(r => r.id_resena === id_resena);
    if (!resena) return;

    const newReport: ModerationReport = {
      id_reporte: `rep-${Date.now()}`,
      id_resena,
      usuario_infractor: `@${resena.nombre_usuario.toLowerCase().replace(/\s+/g, '_')}`,
      titulo_obra: resena.titulo_libro,
      motivo,
      comentario: resena.comentario,
      fecha: 'Hoy, hace un momento',
      prioridad: 'alta',
      estado: 'pendiente',
    };
    setReportes(prev => [newReport, ...prev]);
  };

  const moderarReporte = (id_reporte: string, accion: 'conservar' | 'eliminar') => {
    const reporte = reportes.find(r => r.id_reporte === id_reporte);
    if (!reporte) return;

    if (accion === 'eliminar') {
      // Sincronización asíncrona con Supabase
      eliminarResenaModeradorDb(reporte.id_resena).catch(() => {});
      // Elimina el comentario de las reseñas comunitarias
      setResenas(prev => prev.filter(r => r.id_resena !== reporte.id_resena));
      setReportes(prev => prev.filter(r => r.id_reporte !== id_reporte));
    } else {
      // Conservar / descartar reporte
      setReportes(prev => prev.filter(r => r.id_reporte !== id_reporte));
      setAprobadosHoy(prev => prev + 1);
    }
  };

  const pendientes = reportes.filter(r => r.estado === 'pendiente').length;

  return (
    <ExLibrisContext.Provider
      value={{
        currentUser,
        userRole,
        iniciarSesion,
        cerrarSesion,
        registrarse,
        biblioteca,
        agregarALaBiblioteca,
        actualizarProgreso,
        actualizarBitacora,
        removerDeBiblioteca,
        getBibliotecaItem,
        catalogo,
        categorias,
        recargarCatalogo,
        buscarEnCatalogo,
        buscarObrasPorIsbn,
        resenas,
        publicarResena,
        reportes,
        reportarComentario,
        moderarReporte,
        metricasModeracion: {
          pendientes,
          aprobadosHoy,
        },
      }}
    >
      {children}
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
