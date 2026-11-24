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

export interface BookRatingStats {
  promedio: number | null;
  totalVotos: number;
  distribucion: { star: number; pct: number; count: number; label: string }[];
}
