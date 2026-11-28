import { supabase } from '@/lib/supabase';
import { ContactMessage, ContactTopic } from '@/types/contact.types';
import { BookProposal, BookProposalData } from '@/types/moderation.types';

export interface DbLibro {
  isbn: string;
  titulo: string;
  autor: string;
  categorias: string[];
  sinopsis: string;
  portada_url: string;
  total_paginas: number;
  editorial?: string;
  anio?: number;
}

export interface CrearSolicitudLibro {
  id_usuario: string;
  id_libro: string | null;
  isbn: string;
  tipo: BookProposal['tipo'];
  datos_propuestos: BookProposalData;
}

export interface DbCategoria {
  id_categoria: string;
  nombre_categoria: string;
}

interface DbLibroConRelaciones extends Omit<DbLibro, 'categorias'> {
  libro_categorias?: {
    categorias: { nombre_categoria: string } | { nombre_categoria: string }[] | null;
  }[];
}

interface DbSolicitudLibroConRelaciones extends BookProposal {
  usuario: { nombre_usuario: string } | null;
  libros: DbLibroConRelaciones | null;
}

export interface DbBibliotecaItem {
  id_biblioteca: string;
  id_usuario: string;
  isbn: string;
  estado: 'leyendo' | 'por_leer' | 'leido';
  pagina_actual: number;
  lugar_compra?: string;
  precio_compra?: number;
  fecha_compra?: string;
  formato_edicion?: string;
  actualizado_el?: string;
}

export interface DbBibliotecaItemConLibro extends DbBibliotecaItem {
  libros: DbLibro | null;
}

export interface DbResena {
  id_resena: string;
  isbn: string;
  id_usuario: string;
  calificacion: number;
  comentario: string;
  estado: 'publicado' | 'eliminado';
  creado_el?: string;
}

export interface DbReporte {
  id_reporte: string;
  id_resena: string;
  id_respuesta?: string | null;
  tipo_comentario?: 'resena' | 'respuesta';
  id_usuario: string;
  motivo: string;
  estado: 'pendiente' | 'descartado' | 'atendido';
  creado_el?: string;
  revisado_el?: string;
}

// Funciones preparadas para conectar con Supabase
export const getLibrosFromDb = async (): Promise<DbLibro[]> => {
  const { data, error } = await supabase
    .from('libros')
    .select('isbn, titulo, autor, sinopsis, portada_url, total_paginas, editorial, anio, libro_categorias(categorias(nombre_categoria))');
  if (error) throw error;
  return (data || []).map(mapLibroFromDb);
};

export const getLibroPorIsbnDb = async (isbn: string): Promise<DbLibro | null> => {
  const { data, error } = await supabase
    .from('libros')
    .select('isbn, titulo, autor, sinopsis, portada_url, total_paginas, editorial, anio, libro_categorias(categorias(nombre_categoria))')
    .eq('isbn', isbn)
    .maybeSingle();
  if (error) throw error;
  return data ? mapLibroFromDb(data as DbLibroConRelaciones) : null;
};

export const getCategoriasFromDb = async (): Promise<DbCategoria[]> => {
  const { data, error } = await supabase
    .from('categorias')
    .select('id_categoria, nombre_categoria')
    .order('nombre_categoria', { ascending: true });
  if (error) throw error;
  return data || [];
};

const mapLibroFromDb = (libro: DbLibroConRelaciones): DbLibro => ({
  ...libro,
  categorias: (libro.libro_categorias || []).flatMap(relation => {
    const categories = relation.categorias;
    if (!categories) return [];
    return Array.isArray(categories)
      ? categories.map(category => category.nombre_categoria)
      : [categories.nombre_categoria];
  }),
});

interface DbBibliotecaItemConLibroRaw extends Omit<DbBibliotecaItemConLibro, 'libros'> {
  libros: DbLibroConRelaciones | null;
}

export const getBibliotecaFromDb = async (id_usuario: string): Promise<DbBibliotecaItemConLibro[]> => {
  const { data, error } = await supabase
    .from('biblioteca_usuario')
    .select('*, libros(*, libro_categorias(categorias(nombre_categoria)))')
    .eq('id_usuario', id_usuario)
    .order('actualizado_el', { ascending: false });
  if (error) throw error;
  return (data || []).map((item: DbBibliotecaItemConLibroRaw) => ({
    ...item,
    libros: item.libros ? mapLibroFromDb(item.libros) : null,
  }));
};

export const guardarLibroEnDb = async (libro: DbLibro) => {
  const { data: existing, error: lookupError } = await supabase
    .from('libros')
    .select('isbn')
    .eq('isbn', libro.isbn)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (!existing) {
    const { categorias, ...libroRow } = libro;
    const { error } = await supabase.from('libros').insert(libroRow);
    if (error) throw error;
  }

  await guardarCategoriasLibroDb(libro.isbn, libro.categorias);
};

export const crearSolicitudLibroDb = async (solicitud: CrearSolicitudLibro) => {
  const { data, error } = await supabase
    .from('solicitudes_libro')
    .insert(solicitud)
    .select('id_solicitud')
    .single();
  if (error) throw error;
  return data;
};

export const getSolicitudesLibroPropiasDb = async (idUsuario: string): Promise<BookProposal[]> => {
  const { data, error } = await supabase
    .from('solicitudes_libro')
    .select('*')
    .eq('id_usuario', idUsuario)
    .order('creado_el', { ascending: false });
  if (error) throw error;
  return (data || []) as BookProposal[];
};

export const getSolicitudesLibroPendientesDb = async (): Promise<BookProposal[]> => {
  const { data, error } = await supabase
    .from('solicitudes_libro')
    .select(`
      *,
      usuario:usuario!solicitudes_libro_id_usuario_fkey(nombre_usuario),
      libros:libros!solicitudes_libro_id_libro_fkey(
        isbn, titulo, autor, sinopsis, portada_url, total_paginas, editorial, anio,
        libro_categorias(categorias(nombre_categoria))
      )
    `)
    .eq('estado', 'pendiente')
    .order('creado_el', { ascending: true });
  if (error) throw error;

  return ((data || []) as DbSolicitudLibroConRelaciones[]).map(row => ({
    ...row,
    nombre_usuario: row.usuario?.nombre_usuario || 'Lector',
    libro_actual: row.libros ? mapLibroFromDb(row.libros) : null,
  })) as BookProposal[];
};

export const getRevisionesPendientesCountDb = async (): Promise<number> => {
  const [reportes, solicitudes, contactos] = await Promise.all([
    supabase
      .from('reportes')
      .select('id_reporte', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
    supabase
      .from('solicitudes_libro')
      .select('id_solicitud', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
    supabase
      .from('contacto_app')
      .select('id_contacto', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
  ]);
  if (reportes.error) throw reportes.error;
  if (solicitudes.error) throw solicitudes.error;
  if (contactos.error) throw contactos.error;
  return (reportes.count || 0) + (solicitudes.count || 0) + (contactos.count || 0);
};

export const updatePublicUsernameDb = async (idUsuario: string, nombreUsuario: string): Promise<void> => {
  const { data, error } = await supabase
    .from('usuario')
    .update({ nombre_usuario: nombreUsuario })
    .eq('id_usuario', idUsuario)
    .select('id_usuario')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No se encontró el perfil que intentas actualizar.');
};

export const createContactMessageDb = async (
  idUsuario: string,
  tipo: ContactTopic,
  mensaje: string
): Promise<void> => {
  const { error } = await supabase
    .from('contacto_app')
    .insert({ id_usuario: idUsuario, tipo, mensaje: mensaje.trim() });
  if (error) throw error;
};

export const getContactMessagesForUserDb = async (idUsuario: string): Promise<ContactMessage[]> => {
  const { data, error } = await supabase
    .from('contacto_app')
    .select('id_contacto, id_usuario, tipo, mensaje, estado, creado_el, revisado_el')
    .eq('id_usuario', idUsuario)
    .order('creado_el', { ascending: false });
  if (error) throw error;
  return (data || []) as ContactMessage[];
};

export const getPendingContactMessagesDb = async (): Promise<ContactMessage[]> => {
  const { data, error } = await supabase
    .from('contacto_app')
    .select(`
      id_contacto, id_usuario, tipo, mensaje, estado, creado_el, revisado_el,
      usuario:usuario!contacto_app_id_usuario_fkey(nombre_usuario)
    `)
    .eq('estado', 'pendiente')
    .order('creado_el', { ascending: true });
  if (error) throw error;

  return (data || []).map(row => {
    const usuario = Array.isArray(row.usuario) ? row.usuario[0] : row.usuario;
    return {
      ...row,
      nombre_usuario: usuario?.nombre_usuario || 'Lector',
    } as ContactMessage;
  });
};

export const resolveContactMessageDb = async (idContacto: string): Promise<void> => {
  const { error } = await supabase.rpc('resolver_contacto_app', {
    p_id_contacto: idContacto,
  });
  if (error) throw error;
};

export const revisarSolicitudLibroDb = async (
  id_solicitud: string,
  accion: 'aprobar' | 'rechazar',
  camposAprobados: string[] = [],
  nota?: string
) => {
  const { error } = await supabase.rpc('revisar_solicitud_libro', {
    p_id_solicitud: id_solicitud,
    p_accion: accion,
    p_campos_aprobados: camposAprobados,
    p_nota: nota || null,
  });
  if (error) throw error;
};

const desacentuarString = (str: string): string =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const guardarCategoriasLibroDb = async (isbn: string, nombres: string[]) => {
  const uniqueNames = [...new Set(nombres.map(name => name.trim()).filter(Boolean))];
  if (uniqueNames.length === 0) return;

  // 1. Obtener únicamente las categorías autorizadas que ya existen en la base de datos
  const { data: todasCategorias, error: fetchError } = await supabase
    .from('categorias')
    .select('id_categoria, nombre_categoria');
  if (fetchError) throw fetchError;

  const categoriasDb = todasCategorias || [];
  const targetIds: string[] = [];

  for (const nombre of uniqueNames) {
    const normNombre = desacentuarString(nombre);
    // Buscar solo equivalencias contra categorías registradas (con o sin tilde)
    const matchExistente = categoriasDb.find(
      c => desacentuarString(c.nombre_categoria) === normNombre
    );

    if (matchExistente) {
      targetIds.push(matchExistente.id_categoria);
    }
  }

  const uniqueIds = [...new Set(targetIds)];
  if (uniqueIds.length === 0) return;

  // 2. Vincular libro con sus categorías en libro_categorias
  const { error: relError } = await supabase
    .from('libro_categorias')
    .upsert(
      uniqueIds.map(id_categoria => ({ isbn, id_categoria })),
      { onConflict: 'isbn,id_categoria', ignoreDuplicates: true }
    );
  if (relError) throw relError;
};

export const guardarEnBibliotecaDb = async (item: Partial<DbBibliotecaItem>) => {
  const { data, error } = await supabase
    .from('biblioteca_usuario')
    .upsert(item, { onConflict: 'id_usuario,isbn' })
    .select();
  if (error) throw error;
  return data;
};

export const actualizarProgresoDb = async (id_biblioteca: string, pagina_actual: number, estado?: string) => {
  const payload: any = { pagina_actual, actualizado_el: new Date().toISOString() };
  if (estado) payload.estado = estado;
  const { error } = await supabase
    .from('biblioteca_usuario')
    .update(payload)
    .eq('id_biblioteca', id_biblioteca);
  if (error) throw error;
};

export const getResenasFromDb = async (isbn?: string, limit: number = 30, offset: number = 0) => {
  let query = supabase
    .from('resenas')
    .select('*, usuario!resenas_id_usuario_fkey(nombre_usuario, id_rol), libros(titulo, autor)')
    .eq('estado', 'publicado');
  if (isbn) query = query.eq('isbn', isbn);
  const { data, error } = await query
    .order('creado_el', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
};

export const crearResenaDb = async (resena: Partial<DbResena>) => {
  const { data, error } = await supabase.from('resenas').insert(resena).select();
  if (error) throw error;
  return data;
};

export const eliminarResenaPropia = async (id_resena: string) => {
  const { error } = await supabase
    .from('resenas')
    .update({ estado: 'eliminado' })
    .eq('id_resena', id_resena)
    .eq('id_usuario', (await supabase.auth.getUser()).data.user?.id ?? '');
  if (error) throw error;
};

export const eliminarResenaModeradorDb = async (id_resena: string) => {
  const { error } = await supabase
    .from('resenas')
    .update({ estado: 'eliminado' })
    .eq('id_resena', id_resena);
  if (error) throw error;
};

export const crearReporteDb = async (
  reporte: Pick<DbReporte, 'id_resena' | 'id_respuesta' | 'motivo'>
): Promise<string> => {
  const { data, error } = await supabase.rpc('crear_reporte_comentario', {
    p_id_resena: reporte.id_resena,
    p_id_respuesta: reporte.id_respuesta || null,
    p_motivo: reporte.motivo,
  });
  if (error) throw error;
  if (typeof data !== 'string') {
    throw new Error('Supabase no devolvió el identificador del reporte.');
  }
  return data;
};

export const resolverReporteModeradorDb = async (
  id_reporte: string,
  accion: 'conservar' | 'eliminar'
) => {
  const { error } = await supabase.rpc('resolver_reporte_moderacion', {
    p_id_reporte: id_reporte,
    p_accion: accion,
  });
  if (error) throw error;
};

export const getReportesPendientesDb = async () => {
  const { data, error } = await supabase
    .from('reportes')
    .select('*, resenas(*, libros(titulo), usuario!resenas_id_usuario_fkey(nombre_usuario)), resena_respuestas(id_respuesta, id_usuario, comentario, usuario!resena_respuestas_id_usuario_fkey(nombre_usuario))')
    .eq('estado', 'pendiente')
    .order('creado_el', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const darLikeResenaDb = async (id_resena: string, id_usuario: string) => {
  const { error } = await supabase
    .from('resena_likes')
    .upsert({ id_resena, id_usuario }, { onConflict: 'id_resena,id_usuario', ignoreDuplicates: true });
  if (error && error.code !== '23505') throw error;
};

export const quitarLikeResenaDb = async (id_resena: string, id_usuario: string) => {
  const { error } = await supabase
    .from('resena_likes')
    .delete()
    .eq('id_resena', id_resena)
    .eq('id_usuario', id_usuario);
  if (error) throw error;
};

export const getLikesResenaDb = async (id_resena?: string) => {
  let query = supabase.from('resena_likes').select('id_resena, id_usuario');
  if (id_resena) query = query.eq('id_resena', id_resena);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const crearRespuestaDb = async (
  id_resena: string,
  id_usuario: string,
  comentario: string,
  id_respuesta_padre?: string
) => {
  const payload: Record<string, unknown> = { id_resena, id_usuario, comentario };
  if (id_respuesta_padre) payload.id_respuesta_padre = id_respuesta_padre;
  const { data, error } = await supabase
    .from('resena_respuestas')
    .insert(payload)
    .select('*, usuario!resena_respuestas_id_usuario_fkey(nombre_usuario)');
  if (error?.code === 'PGRST204' && id_respuesta_padre) {
    throw new Error(
      'Las respuestas anidadas aún no están habilitadas en Supabase. Ejecuta la migración de comentarios.'
    );
  }
  if (error) throw error;
  return data;
};

export const eliminarRespuestaDb = async (id_respuesta: string) => {
  const { error } = await supabase
    .from('resena_respuestas')
    .delete()
    .eq('id_respuesta', id_respuesta)
    .eq('id_usuario', (await supabase.auth.getUser()).data.user?.id ?? '');
  if (error) throw error;
};

export const getRespuestasResenaDb = async (id_resena?: string) => {
  let query = supabase
    .from('resena_respuestas')
    .select('*, usuario!resena_respuestas_id_usuario_fkey(nombre_usuario), respuesta_likes(id_usuario)');
  if (id_resena) query = query.eq('id_resena', id_resena);
  const { data, error } = await query.order('creado_el', { ascending: true });
  if (!error) return data || [];
  if (error.code !== 'PGRST200' && error.code !== 'PGRST204') throw error;

  console.warn(
    'Supabase aún no tiene la migración de respuestas anidadas y sus likes; se cargarán las respuestas sin esas funciones.'
  );
  let legacyQuery = supabase
    .from('resena_respuestas')
    .select('*, usuario!resena_respuestas_id_usuario_fkey(nombre_usuario)');
  if (id_resena) legacyQuery = legacyQuery.eq('id_resena', id_resena);
  const legacyResult = await legacyQuery.order('creado_el', { ascending: true });
  if (legacyResult.error) throw legacyResult.error;
  return legacyResult.data || [];
};

export const darLikeRespuestaDb = async (id_respuesta: string, id_usuario: string) => {
  const { error } = await supabase
    .from('respuesta_likes')
    .upsert({ id_respuesta, id_usuario }, { onConflict: 'id_respuesta,id_usuario', ignoreDuplicates: true });
  if (error && error.code !== '23505') throw error;
};

export const quitarLikeRespuestaDb = async (id_respuesta: string, id_usuario: string) => {
  const { error } = await supabase
    .from('respuesta_likes')
    .delete()
    .eq('id_respuesta', id_respuesta)
    .eq('id_usuario', id_usuario);
  if (error) throw error;
};

const isValidUuid = (id?: string): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const crearNotificacionDb = async (notif: {
  id_usuario: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  isbn?: string;
  id_resena?: string;
}) => {
  const payload: Record<string, unknown> = {
    id_usuario: notif.id_usuario,
    tipo: notif.tipo,
    titulo: notif.titulo,
    mensaje: notif.mensaje,
  };
  if (notif.isbn && notif.isbn.trim()) {
    payload.isbn = notif.isbn.trim();
  }
  if (isValidUuid(notif.id_resena)) {
    payload.id_resena = notif.id_resena;
  }

  const { error } = await supabase.from('notificaciones').insert(payload);
  if (error) {
    console.error('Error al insertar notificación en Supabase:', error);
    throw error;
  }
  return true;
};

export const getNotificacionesDb = async (id_usuario: string) => {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('id_usuario', id_usuario)
    .order('creado_el', { ascending: false });
  if (error) {
    console.error('Error al obtener notificaciones desde Supabase:', error);
    throw error;
  }
  return data || [];
};

export const marcarNotificacionLeidaDb = async (id_notificacion: string) => {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('id_notificacion', id_notificacion);
  if (error) throw error;
};

export const eliminarNotificacionDb = async (id_notificacion: string) => {
  const { error } = await supabase
    .from('notificaciones')
    .delete()
    .eq('id_notificacion', id_notificacion);
  if (error) throw error;
};

export const eliminarBibliotecaItemDb = async (id_usuario: string, isbn: string) => {
  const { error } = await supabase
    .from('biblioteca_usuario')
    .delete()
    .eq('id_usuario', id_usuario)
    .eq('isbn', isbn);
  if (error) throw error;
};
