import { supabase } from '@/lib/supabase';

export interface DbLibro {
  isbn: string;
  titulo: string;
  autor: string;
  categorias: string[];
  sinopsis: string;
  portada_url: string;
  total_paginas: number;
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
    .select('isbn, titulo, autor, sinopsis, portada_url, total_paginas, libro_categorias(categorias(nombre_categoria))');
  if (error) throw error;
  return (data || []).map(mapLibroFromDb);
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

const guardarCategoriasLibroDb = async (isbn: string, nombres: string[]) => {
  const uniqueNames = [...new Set(nombres.map(name => name.trim()).filter(Boolean))];
  if (uniqueNames.length === 0) return;

  const { data: categorias, error: categoryError } = await supabase
    .from('categorias')
    .select('id_categoria, nombre_categoria')
    .in('nombre_categoria', uniqueNames);
  if (categoryError) throw categoryError;

  if (!categorias || categorias.length === 0) return;
  const { error } = await supabase
    .from('libro_categorias')
    .upsert(
      categorias.map(category => ({ isbn, id_categoria: category.id_categoria })),
      { onConflict: 'isbn,id_categoria', ignoreDuplicates: true }
    );
  if (error) throw error;
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

export const getResenasFromDb = async (isbn?: string) => {
  let query = supabase
    .from('resenas')
    .select('*, usuario!resenas_id_usuario_fkey(nombre_usuario, id_rol), libros(titulo, autor)')
    .eq('estado', 'publicado');
  if (isbn) query = query.eq('isbn', isbn);
  const { data, error } = await query.order('creado_el', { ascending: false });
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

export const crearReporteDb = async (reporte: Partial<DbReporte>) => {
  const { data, error } = await supabase.from('reportes').insert(reporte).select();
  if (error) throw error;
  return data;
};

export const getReportesPendientesDb = async () => {
  const { data, error } = await supabase
    .from('reportes')
    .select('*, resenas(*, libros(titulo), usuario!resenas_id_usuario_fkey(nombre_usuario))')
    .eq('estado', 'pendiente')
    .order('creado_el', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const darLikeResenaDb = async (id_resena: string, id_usuario: string) => {
  const { error } = await supabase
    .from('resena_likes')
    .insert({ id_resena, id_usuario });
  if (error) throw error;
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
    .insert({ id_respuesta, id_usuario });
  if (error) throw error;
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
