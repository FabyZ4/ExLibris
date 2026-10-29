export interface GoogleBookVolume {
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

// Catálogo local de respaldo para demostración / cuando la API está sin cuota (429)
const CATALOGO_LOCAL: Record<string, GoogleBookVolume> = {
};

// Tiempo de espera entre intentos si recibimos 429 (ms)
let _lastApiCallMs = 0;
const MIN_INTERVAL_MS = 3000; // 3 segundos mínimo entre llamadas

export const buscarLibroPorIsbn = async (isbn: string): Promise<GoogleBookVolume | null> => {
  const cleanIsbn = isbn.replace(/[-\s]/g, '').trim();
  if (!cleanIsbn) return null;

  // 1. Siempre buscar primero en el catálogo local (sin consumir cuota)
  const localMatch = CATALOGO_LOCAL[cleanIsbn];
  if (localMatch) {
    return localMatch;
  }

  // 2. Respetar intervalo mínimo entre llamadas para no provocar 429
  const now = Date.now();
  const elapsed = now - _lastApiCallMs;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `https://www.google.com/books/jsapi.js`;
    _lastApiCallMs = Date.now();
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    // 429 → cuota agotada, devolver null silenciosamente
    if (response.status === 429) {
      console.warn('Google Books API: límite de peticiones alcanzado (429). Usando catálogo local.');
      return null;
    }

    if (!response.ok) {
      throw new Error(`Google Books API HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.totalItems > 0 && data.items?.[0]?.volumeInfo) {
      const info = data.items[0].volumeInfo;
      const thumbnail = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
      const secureThumbnail = thumbnail.replace(/^http:\/\//i, 'https://');

      return {
        isbn: cleanIsbn,
        titulo: info.title || 'Título desconocido',
        autor: (info.authors && info.authors.length > 0) ? info.authors.join(', ') : 'Autor anónimo',
        categorias: info.categories && info.categories.length > 0 ? info.categories : [],
        sinopsis: info.description || 'Sin sinopsis disponible.',
        portada_url: secureThumbnail || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
        total_paginas: info.pageCount || 250,
        editorial: info.publisher || 'Editorial estándar',
        anio: info.publishedDate ? parseInt(info.publishedDate.substring(0, 4), 10) : 2024,
      };
    }
  } catch (error) {
    // No mostramos el warn en consola si fue un 429 (ya manejado arriba)
    if (!(error instanceof Error && error.message.includes('429'))) {
      console.warn('Google Books API: consulta fallida, usando catálogo local.', error);
    }
  }

  return null;
};
