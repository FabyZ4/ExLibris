/**
 * Servicio de integración con la API de Google Books (v1)
 * Diseñado con tipado estricto, manejo resiliente de errores y priorización en español (langRestrict=es).
 */

const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const BNE_SRU_BASE_URL = 'https://catalogo.bne.es/view/sru/34BNE_INST';

/**
 * Modelo DTO normalizado y seguro para el consumo en la aplicación.
 */
export interface GoogleBookDTO {
  id: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedDate: string;
  description: string;
  pageCount: number;
  categories: string[];
  isbn: string;
  thumbnail: string;
  previewLink: string;
}

/**
 * Opciones para refinar búsquedas con Google Books API
 */
export interface SearchBooksOptions {
  /** Término específico en el título */
  intitle?: string;
  /** Autor específico */
  inauthor?: string;
  /** ISBN específico */
  isbn?: string;
  /** Índice de inicio para paginación (por defecto: 0) */
  startIndex?: number;
  /** Cantidad máxima de resultados (por defecto: 10, máx: 40) */
  maxResults?: number;
}

/**
 * Tipo retrocompatible con el consumo previo en useBibliotecaState y useCatalogoState
 */
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

/**
 * Extrae de forma segura la API Key configurada para Google Books.
 * Soporta EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY y GOOGLE_BOOKS_API_KEY.
 */
const getApiKey = (): string | undefined => {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY ||
    process.env.GOOGLE_BOOKS_API_KEY ||
    undefined
  );
};

/**
 * Extrae preferentemente el ISBN_13 o ISBN_10 de los identificadores estándar de la industria.
 */
const extractIsbn = (industryIdentifiers?: { type: string; identifier: string }[]): string => {
  if (!industryIdentifiers || !Array.isArray(industryIdentifiers)) return '';

  const isbn13 = industryIdentifiers.find(id => id.type === 'ISBN_13')?.identifier;
  if (isbn13) return isbn13.replace(/[-\s]/g, '').trim();

  const isbn10 = industryIdentifiers.find(id => id.type === 'ISBN_10')?.identifier;
  if (isbn10) return isbn10.replace(/[-\s]/g, '').trim();

  return industryIdentifiers[0]?.identifier?.replace(/[-\s]/g, '').trim() || '';
};

/**
 * Remueve tildes y diacríticos para comparación canónica.
 */
export const desacentuar = (str: string): string =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Capitaliza elegantemente una frase o palabra.
 */
export const capitalizarCategoria = (str: string): string => {
  const limpia = str.trim();
  if (!limpia) return '';
  return limpia
    .split(/\s+/)
    .map(palabra => {
      const lower = palabra.toLowerCase();
      if (['de', 'y', 'en', 'el', 'la', 'los', 'las', 'del'].includes(lower)) {
        return lower;
      }
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
    })
    .join(' ');
};

/**
 * Mapeo y traducción de categorías crudas de APIs internacionales a géneros amigables en español.
 * Conserva únicamente categorías literarias reconocidas por el diccionario canónico,
 * unificando sinónimos con y sin tilde.
 */
export const normalizarCategoriasLiterarias = (rawCategorias?: string[]): string[] => {
  if (!rawCategorias || !Array.isArray(rawCategorias) || rawCategorias.length === 0) {
    return [];
  }

  // Diccionario canónico con acentuación correcta en español
  const CANONICAL_MAP: Record<string, string> = {
    'fantasia': 'Fantasía',
    'fantasía': 'Fantasía',
    'fantasy': 'Fantasía',
    'magia': 'Fantasía',
    'magic': 'Fantasía',
    'mythology': 'Mitología',
    'mitologia': 'Mitología',
    'mitología': 'Mitología',
    'romance': 'Romance',
    'amor': 'Romance',
    'romantic': 'Romance',
    'novela rosa': 'Romance',
    'ciencia ficcion': 'Ciencia Ficción',
    'ciencia ficción': 'Ciencia Ficción',
    'science fiction': 'Ciencia Ficción',
    'sci-fi': 'Ciencia Ficción',
    'cyberpunk': 'Ciencia Ficción',
    'misterio': 'Misterio & Suspenso',
    'mystery': 'Misterio & Suspenso',
    'suspenso': 'Misterio & Suspenso',
    'suspense': 'Misterio & Suspenso',
    'thriller': 'Misterio & Suspenso',
    'policial': 'Misterio & Suspenso',
    'policiaca': 'Misterio & Suspenso',
    'policíaca': 'Misterio & Suspenso',
    'detective': 'Misterio & Suspenso',
    'crimen': 'Misterio & Suspenso',
    'crime': 'Misterio & Suspenso',
    'terror': 'Terror',
    'horror': 'Terror',
    'miedo': 'Terror',
    'gotico': 'Terror',
    'gótico': 'Terror',
    'aventura': 'Aventura',
    'aventuras': 'Aventura',
    'adventure': 'Aventura',
    'historia': 'Historia & Biografía',
    'history': 'Historia & Biografía',
    'biografia': 'Historia & Biografía',
    'biografía': 'Historia & Biografía',
    'biography': 'Historia & Biografía',
    'memoir': 'Historia & Biografía',
    'filosofia': 'Filosofía',
    'filosofía': 'Filosofía',
    'philosophy': 'Filosofía',
    'autoayuda': 'Autoayuda',
    'self-help': 'Autoayuda',
    'psicologia': 'Autoayuda',
    'psicología': 'Autoayuda',
    'desarrollo personal': 'Autoayuda',
    'juvenil': 'Juvenil',
    'young adult': 'Juvenil',
    'infantil': 'Infantil',
    'children': 'Infantil',
    'poesia': 'Poesía',
    'poesía': 'Poesía',
    'poetry': 'Poesía',
    'clasicos': 'Clásicos',
    'clásicos': 'Clásicos',
    'clasico': 'Clásicos',
    'clásico': 'Clásicos',
    'classic': 'Clásicos',
    'novela': 'Novela',
    'novel': 'Novela',
    'fiction': 'Ficción',
    'ficcion': 'Ficción',
    'ficción': 'Ficción',
    'drama': 'Drama',
    'teatro': 'Teatro',
    'comic': 'Cómic & Manga',
    'comics': 'Cómic & Manga',
    'manga': 'Cómic & Manga',
    'novela grafica': 'Cómic & Manga',
    'novela gráfica': 'Cómic & Manga',
    'arte': 'Arte & Diseño',
    'art': 'Arte & Diseño',
    'politica': 'Política & Sociedad',
    'política': 'Política & Sociedad',
    'ciencia': 'Ciencia',
    'science': 'Ciencia',
    'religion': 'Religión & Espiritualidad',
    'religión': 'Religión & Espiritualidad',
    'espiritualidad': 'Religión & Espiritualidad',
  };

  const clavesDesacentuadas: Record<string, string> = {};
  for (const [clave, caninica] of Object.entries(CANONICAL_MAP)) {
    clavesDesacentuadas[desacentuar(clave)] = caninica;
  }

  // Mapa de desacentuado a forma canónica para evitar duplicados como "Fantasía" y "Fantasia"
  const categoriasMap = new Map<string, string>();

  for (const cat of rawCategorias) {
    if (!cat || typeof cat !== 'string') continue;
    // Dividir segmentos jerárquicos ej: "Fiction / Fantasy / Epic" o "Ficción, Novela"
    const partes = cat.split(/[\/,;|]/).map(p => p.trim()).filter(Boolean);
    for (const parte of partes) {
      const parteNormalizada = desacentuar(parte);
      let asignada: string | null = null;

      // 1. Coincidencia exacta o por subclave en diccionario canónico
      for (const [claveNorm, valorCanonica] of Object.entries(clavesDesacentuadas)) {
        if (parteNormalizada === claveNorm || parteNormalizada.includes(claveNorm)) {
          asignada = valorCanonica;
          break;
        }
      }

      if (asignada) {
        const keyDedupe = desacentuar(asignada);
        // Si ya existe una versión, conservamos la que tenga tilde o longitud mayor
        if (!categoriasMap.has(keyDedupe)) {
          categoriasMap.set(keyDedupe, asignada);
        } else {
          const actual = categoriasMap.get(keyDedupe)!;
          // Si la nueva tiene acento y la actual no, preferir la acentuada
          if (/[áéíóúÁÉÍÓÚ]/.test(asignada) && !/[áéíóúÁÉÍÓÚ]/.test(actual)) {
            categoriasMap.set(keyDedupe, asignada);
          }
        }
      }
    }
  }

  return Array.from(categoriasMap.values());
};

/**
 * Transforma un elemento crudo de Google Books en un objeto normalizado seguro (GoogleBookDTO).
 */
export const normalizeGoogleBookItem = (item: any): GoogleBookDTO => {
  const volumeInfo = item?.volumeInfo || {};

  // Corrección y seguridad de protocolo HTTPS en imágenes
  const rawThumbnail =
    volumeInfo.imageLinks?.thumbnail ||
    volumeInfo.imageLinks?.smallThumbnail ||
    '';
  const secureThumbnail = rawThumbnail
    ? rawThumbnail.replace(/^http:\/\//i, 'https://')
    : '';

  const rawCats = Array.isArray(volumeInfo.categories) ? volumeInfo.categories : [];
  const categoriasNormalizadas = normalizarCategoriasLiterarias(rawCats);

  return {
    id: item?.id || '',
    title: volumeInfo.title || 'Título no disponible',
    authors: Array.isArray(volumeInfo.authors) && volumeInfo.authors.length > 0
      ? volumeInfo.authors
      : ['Autor desconocido'],
    publisher: volumeInfo.publisher || 'Editorial desconocida',
    publishedDate: volumeInfo.publishedDate || '',
    description: volumeInfo.description || 'Sin descripción.',
    pageCount: typeof volumeInfo.pageCount === 'number' && volumeInfo.pageCount > 0
      ? volumeInfo.pageCount
      : 0,
    categories: categoriasNormalizadas,
    isbn: extractIsbn(volumeInfo.industryIdentifiers),
    thumbnail: secureThumbnail,
    previewLink: volumeInfo.previewLink || '',
  };
};

/**
 * Mapea un DTO normalizado a la estructura interna `GoogleBookVolume` que usa el catálogo de ExLibris.
 */
export const mapDtoToVolume = (dto: GoogleBookDTO): GoogleBookVolume => {
  const parsedYear = dto.publishedDate ? parseInt(dto.publishedDate.substring(0, 4), 10) : undefined;
  return {
    isbn: dto.isbn || dto.id,
    titulo: dto.title,
    autor: dto.authors.join(', '),
    categorias: dto.categories,
    sinopsis: dto.description,
    portada_url: dto.thumbnail || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
    total_paginas: dto.pageCount > 0 ? dto.pageCount : 250,
    editorial: dto.publisher,
    anio: !isNaN(Number(parsedYear)) ? parsedYear : 2024,
  };
};

/**
 * Maneja respuestas de error HTTP de Google Books API arrojando descripciones claras.
 */
const handleHttpErrors = async (response: Response) => {
  if (response.ok) return;

  if (response.status === 429) {
    throw new Error('Google Books API: Límite de cuota excedido (HTTP 429). Intente nuevamente en unos instantes.');
  }

  if (response.status === 400 || response.status === 403) {
    let errorDetail = '';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson?.error?.message ? ` - ${errorJson.error.message}` : '';
    } catch {
      // Ignorar si no viene cuerpo json
    }
    throw new Error(`Google Books API: Petición o API Key inválida (HTTP ${response.status})${errorDetail}`);
  }

  throw new Error(`Google Books API: Error inesperado en la solicitud (HTTP ${response.status})`);
};

/**
 * Busca libros en Google Books API con soporte de paginación y filtros en español.
 *
 * @param query Texto principal de búsqueda
 * @param options Opciones de búsqueda especializada (intitle, inauthor, isbn, paginación)
 * @returns Lista de libros normalizados (GoogleBookDTO[])
 */
export const searchBooks = async (
  query: string,
  options?: SearchBooksOptions
): Promise<GoogleBookDTO[]> => {
  const queryParts: string[] = [];
  const trimmedQuery = query?.trim();

  if (trimmedQuery) {
    queryParts.push(trimmedQuery);
  }

  if (options?.intitle?.trim()) {
    queryParts.push(`intitle:${options.intitle.trim()}`);
  }

  if (options?.inauthor?.trim()) {
    queryParts.push(`inauthor:${options.inauthor.trim()}`);
  }

  if (options?.isbn?.trim()) {
    const cleanIsbn = options.isbn.replace(/[-\s]/g, '').trim();
    queryParts.push(`isbn:${cleanIsbn}`);
  }

  const finalQuery = queryParts.join(' ');
  if (!finalQuery) return [];

  const startIndex = Math.max(0, options?.startIndex ?? 0);
  const maxResults = Math.min(40, Math.max(1, options?.maxResults ?? 10));

  const params = new URLSearchParams({
    q: finalQuery,
    langRestrict: 'es',
    startIndex: startIndex.toString(),
    maxResults: maxResults.toString(),
  });

  const apiKey = getApiKey();
  if (apiKey) {
    params.append('key', apiKey);
  }

  const url = `${GOOGLE_BOOKS_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    await handleHttpErrors(response);

    const data = await response.json();

    // Verificación defensiva cuando no hay resultados o la clave totalItems es 0
    if (!data || data.totalItems === 0 || !Array.isArray(data.items)) {
      return [];
    }

    return data.items.map(normalizeGoogleBookItem);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Google Books API:')) {
      throw error;
    }
    throw new Error(`Google Books API: Fallo de conexión o red: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Obtiene el detalle de un libro específico mediante su ID de volumen en Google Books.
 *
 * @param volumeId Identificador único del volumen en Google Books
 * @returns GoogleBookDTO o null si no se encuentra
 */
export const getBookById = async (volumeId: string): Promise<GoogleBookDTO | null> => {
  const cleanId = volumeId?.trim();
  if (!cleanId) return null;

  const params = new URLSearchParams();
  const apiKey = getApiKey();
  if (apiKey) {
    params.append('key', apiKey);
  }

  const queryString = params.toString();
  const url = `${GOOGLE_BOOKS_BASE_URL}/${encodeURIComponent(cleanId)}${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url);
    if (response.status === 404) return null;
    await handleHttpErrors(response);

    const data = await response.json();
    if (!data || !data.id) return null;

    return normalizeGoogleBookItem(data);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Google Books API:')) {
      throw error;
    }
    throw new Error(`Google Books API: Error al consultar volumen '${cleanId}': ${error instanceof Error ? error.message : String(error)}`);
  }
};

const DEFAULT_FALLBACK_COVER = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600';

/**
 * Fusión enriquecida de metadatos (Google Books + Open Library).
 * Si un proveedor carece de portada, sinopsis, autor, páginas o categorías, se complementa con el otro.
 */
export const fusionarMetadatosLibro = (
  primario: Partial<GoogleBookVolume> | null,
  secundario: Partial<GoogleBookVolume> | null,
  isbn: string
): GoogleBookVolume => {
  const cleanIsbn = isbn.replace(/[-\s]/g, '').trim();

  const esValido = (val?: string | null) =>
    Boolean(val && val.trim() && !val.includes('no disponible') && !val.includes('desconocid') && !val.includes('estándar'));

  const titulo = esValido(primario?.titulo)
    ? primario!.titulo!
    : esValido(secundario?.titulo)
    ? secundario!.titulo!
    : primario?.titulo || secundario?.titulo || 'Título no disponible';

  const autor = esValido(primario?.autor)
    ? primario!.autor!
    : esValido(secundario?.autor)
    ? secundario!.autor!
    : primario?.autor || secundario?.autor || 'Autor desconocido';

  const esPortadaValida = (url?: string | null) =>
    Boolean(url && url.startsWith('http') && !url.includes('unsplash.com'));

  const portada_url = esPortadaValida(primario?.portada_url)
    ? primario!.portada_url!
    : esPortadaValida(secundario?.portada_url)
    ? secundario!.portada_url!
    : primario?.portada_url || secundario?.portada_url || DEFAULT_FALLBACK_COVER;

  const sinopsis = (primario?.sinopsis && primario.sinopsis.length > 30)
    ? primario.sinopsis
    : (secundario?.sinopsis && secundario.sinopsis.length > 30)
    ? secundario.sinopsis
    : primario?.sinopsis || secundario?.sinopsis || 'Sin sinopsis disponible.';

  const todasCategorias = [
    ...(primario?.categorias || []),
    ...(secundario?.categorias || []),
  ];
  const categorias = normalizarCategoriasLiterarias(todasCategorias);

  const total_paginas = (primario?.total_paginas && primario.total_paginas > 0)
    ? primario.total_paginas
    : (secundario?.total_paginas && secundario.total_paginas > 0)
    ? secundario.total_paginas
    : 250;

  const editorial = esValido(primario?.editorial)
    ? primario!.editorial
    : esValido(secundario?.editorial)
    ? secundario!.editorial
    : primario?.editorial || secundario?.editorial || 'Editorial estándar';

  const anio = (primario?.anio && primario.anio > 1000)
    ? primario.anio
    : (secundario?.anio && secundario.anio > 1000)
    ? secundario.anio
    : 2024;

  return {
    isbn: cleanIsbn,
    titulo,
    autor,
    categorias,
    sinopsis,
    portada_url,
    total_paginas,
    editorial,
    anio,
  };
};

/**
 * Consulta la API pública y gratuita de Open Library como respaldo cuando Google Books
 * arroja 429 (límite de cuota) o para complementar información incompleta.
 */
export const buscarLibroEnOpenLibrary = async (isbn: string): Promise<GoogleBookVolume | null> => {
  const cleanIsbn = isbn.replace(/[-\s]/g, '').trim();
  if (!cleanIsbn) return null;

  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&jscmd=data&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const entry = data[`ISBN:${cleanIsbn}`];
    if (!entry) return null;

    const autores = Array.isArray(entry.authors)
      ? entry.authors.map((a: any) => a.name).filter(Boolean).join(', ')
      : 'Autor anónimo';

    const portada = entry.cover?.large || entry.cover?.medium || entry.cover?.small || '';
    const securePortada = portada ? portada.replace(/^http:\/\//i, 'https://') : '';

    const rawSubjects = Array.isArray(entry.subjects)
      ? entry.subjects.map((s: any) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)
      : [];
    const categorias = normalizarCategoriasLiterarias(rawSubjects);

    const anio = entry.publish_date
      ? parseInt(entry.publish_date.match(/\d{4}/)?.[0] || '2024', 10)
      : 2024;

    return {
      isbn: cleanIsbn,
      titulo: entry.title || 'Título no disponible',
      autor: autores || 'Autor desconocido',
      categorias,
      sinopsis: entry.notes || entry.subtitle || 'Sin sinopsis disponible.',
      portada_url: securePortada || DEFAULT_FALLBACK_COVER,
      total_paginas: typeof entry.number_of_pages === 'number' && entry.number_of_pages > 0
        ? entry.number_of_pages
        : 250,
      editorial: Array.isArray(entry.publishers) && entry.publishers[0]?.name
        ? entry.publishers[0].name
        : 'Editorial estándar',
      anio,
    };
  } catch {
    return null;
  }
};

const extraerValoresXml = (xml: string, etiqueta: string): string[] => {
  const escapedTag = etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, 'gi');
  const decodificarXml = (value: string) => value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

  return Array.from(xml.matchAll(matcher), match => decodificarXml(match[1]));
};

/**
 * Consulta el catálogo SRU de la Biblioteca Nacional de España por ISBN.
 * Se usa como último respaldo cuando Google Books y Open Library no encuentran la obra.
 */
export const buscarLibroEnBne = async (isbn: string): Promise<GoogleBookVolume | null> => {
  const cleanIsbn = isbn.replace(/[-\s]/g, '').trim();
  if (!/^(?:\d{13}|\d{9}[\dX])$/i.test(cleanIsbn)) return null;

  const params = new URLSearchParams({
    version: '1.2',
    operation: 'searchRetrieve',
    query: `alma.isbn="${cleanIsbn}"`,
    maximumRecords: '1',
    recordSchema: 'dc',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${BNE_SRU_BASE_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/xml, text/xml' },
    });
    if (!response.ok) {
      throw new Error(`BNE SRU respondió HTTP ${response.status}`);
    }

    const xml = await response.text();
    const recordCount = Number(extraerValoresXml(xml, 'numberOfRecords')[0] || 0);
    if (recordCount < 1) return null;

    const titulo = extraerValoresXml(xml, 'dc:title')[0];
    if (!titulo) return null;
    const idiomas = extraerValoresXml(xml, 'dc:language');
    if (!idiomas.some(language => /^(spa|es|spanish|español)$/i.test(language.trim()))) {
      return null;
    }

    const autores = [
      ...extraerValoresXml(xml, 'dc:creator'),
      ...extraerValoresXml(xml, 'dc:contributor')
        .filter(value => /(?:^|\s)aut(?:\s|$)/i.test(value)),
    ].map(value => value.replace(/\s+\d{4}(?:-\d{0,4})?.*$/, '').replace(/[,;:\s]+$/, '').trim())
      .filter((value, index, values) => value && values.indexOf(value) === index);
    const fechas = extraerValoresXml(xml, 'dc:date');
    const year = fechas.map(value => value.match(/\b\d{4}\b/)?.[0]).find(Boolean);
    const editoriales = extraerValoresXml(xml, 'dc:publisher');
    const categorias = normalizarCategoriasLiterarias(extraerValoresXml(xml, 'dc:subject'));

    return {
      isbn: cleanIsbn,
      titulo,
      autor: autores.join(', ') || 'Autor desconocido',
      categorias,
      sinopsis: 'Sin sinopsis disponible.',
      portada_url: DEFAULT_FALLBACK_COVER,
      total_paginas: 250,
      editorial: editoriales[editoriales.length - 1] || 'Editorial estándar',
      anio: year ? Number(year) : 2024,
    };
  } finally {
    clearTimeout(timeout);
  }
};

// Caché local en memoria de resultados de ISBN para evitar re-consultas y 429
const isbnCache = new Map<string, GoogleBookVolume>();

/**
 * Consulta de catálogo híbrida e inteligente:
 * Ejecuta búsqueda en Google Books y Open Library en paralelo para complementar metadatos faltantes
 * (portada, sinopsis, autor, número de páginas).
 */
export const buscarLibroPorIsbn = async (isbn: string): Promise<GoogleBookVolume | null> => {
  const cleanIsbn = isbn.replace(/[-\s]/g, '').trim();
  if (!cleanIsbn) return null;

  if (isbnCache.has(cleanIsbn)) {
    console.log(`[Escáner] Obra ISBN ${cleanIsbn} obtenida desde: Caché en Memoria (Sesión actual)`);
    return isbnCache.get(cleanIsbn) || null;
  }

  let googleMatch: GoogleBookVolume | null = null;
  let openLibMatch: GoogleBookVolume | null = null;

  // 1. Ejecutar consultas complementarias
  const [googleResult, openLibResult] = await Promise.allSettled([
    (async () => {
      const results = await searchBooks('', { isbn: cleanIsbn, maxResults: 1 });
      return results.length > 0 ? mapDtoToVolume(results[0]) : null;
    })(),
    buscarLibroEnOpenLibrary(cleanIsbn),
  ]);

  if (googleResult.status === 'fulfilled' && googleResult.value) {
    googleMatch = googleResult.value;
  }
  if (openLibResult.status === 'fulfilled' && openLibResult.value) {
    openLibMatch = openLibResult.value;
  }

  if (googleMatch && openLibMatch) {
    console.log(`[Escáner] Obra ISBN ${cleanIsbn}: Metadatos complementados entre Google Books y Open Library.`);
    const enriquecido = fusionarMetadatosLibro(googleMatch, openLibMatch, cleanIsbn);
    isbnCache.set(cleanIsbn, enriquecido);
    return enriquecido;
  }

  if (googleMatch) {
    console.log(`[Escáner] Obra ISBN ${cleanIsbn} obtenida desde: Google Books API`);
    isbnCache.set(cleanIsbn, googleMatch);
    return googleMatch;
  }

  if (openLibMatch) {
    console.log(`[Escáner] Obra ISBN ${cleanIsbn} obtenida desde: Open Library API`);
    isbnCache.set(cleanIsbn, openLibMatch);
    return openLibMatch;
  }

  try {
    const bneMatch = await buscarLibroEnBne(cleanIsbn);
    if (bneMatch) {
      console.log(`[Escáner] Obra ISBN ${cleanIsbn} obtenida desde: Catálogo SRU de la BNE`);
      isbnCache.set(cleanIsbn, bneMatch);
      return bneMatch;
    }
  } catch (error) {
    console.warn(
      `[Escáner] No se pudo consultar la BNE para el ISBN ${cleanIsbn}:`,
      error
    );
  }

  return null;
};
