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
  let query = supabase.from('resenas').select('*, usuario(nombre_usuario, id_rol), libros(titulo, autor)').eq('estado', 'publicado');
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

export const eliminarResenaModeradorDb = async (id_resena: string) => {
  // En Supabase la política RLS validará que el id_rol corresponda a moderador
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
    .select('*, resenas(*, libros(titulo), usuario(nombre_usuario))')
    .eq('estado', 'pendiente')
    .order('creado_el', { ascending: false });
  if (error) throw error;
  return data || [];
};
