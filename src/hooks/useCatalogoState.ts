import { getCategoriasFromDb, getLibrosFromDb } from '@/services/database.service';
import { buscarLibroPorIsbn } from '@/services/googleBooks.service';
import { Book } from '@/types/book.types';
import { useCallback, useState } from 'react';

export const useCatalogoState = () => {
  const [catalogo, setCatalogo] = useState<Book[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);

  const recargarCatalogo = useCallback(async () => {
    try {
      const [dbLibros, dbCategorias] = await Promise.all([
        getLibrosFromDb(),
        getCategoriasFromDb(),
      ]);

      setCategorias(dbCategorias.map(category => category.nombre_categoria));
      setCatalogo(prev => {
        const ids = new Set(dbLibros.map(book => book.isbn));
        const formatDb = dbLibros.map(book => ({
          ...book,
          editorial: book.editorial || 'Editorial canónica',
          anio: book.anio || 2024,
        }));
        return [...formatDb, ...prev.filter(book => !ids.has(book.isbn))];
      });
    } catch (error) {
      console.warn('Error al recargar catálogo desde Supabase:', error);
    }
  }, []);

  const buscarEnCatalogo = useCallback((query: string, categoria?: string | string[]) => {
    const q = query.toLowerCase().trim();
    const categoriasSeleccionadas = Array.isArray(categoria)
      ? categoria.filter(c => c && c !== 'Todos')
      : (categoria && categoria !== 'Todos' ? [categoria] : []);

    return catalogo.filter(b => {
      const matchQuery =
        !q ||
        b.titulo.toLowerCase().includes(q) ||
        b.autor.toLowerCase().includes(q) ||
        b.isbn.includes(q);

      if (!matchQuery) return false;
      if (categoriasSeleccionadas.length === 0) return true;

      // Un libro coincide si tiene al menos una de las categorías seleccionadas
      const bookCats = (b.categorias || []).map(c => c.toLowerCase());
      return categoriasSeleccionadas.some(cat => bookCats.includes(cat.toLowerCase()));
    });
  }, [catalogo]);

  const buscarObrasPorIsbn = useCallback(async (isbn: string): Promise<Book | null> => {
    const clean = isbn.replace(/[-\s]/g, '');
    const filtrarCategoriasRegistradas = async (categoriasExtraidas: string[]) => {
      try {
        const dbCategorias = await getCategoriasFromDb();
        const nombresRegistrados = dbCategorias.map(category => category.nombre_categoria);
        const clavesRegistradas = new Set(
          nombresRegistrados.map(nombre =>
            nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
          )
        );

        return categoriasExtraidas.filter(categoria => {
          const clave = categoria
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
          return clavesRegistradas.has(clave);
        });
      } catch (error) {
        console.warn('No se pudieron validar las categorías contra Supabase:', error);
        return [];
      }
    };

    const inCatalog = catalogo.find(b => b.isbn === clean);
    if (inCatalog) {
      console.log(`[Escáner] Obra ISBN ${clean} obtenida desde: Catálogo Local / Supabase`);
      return {
        ...inCatalog,
        categorias: await filtrarCategoriasRegistradas(inCatalog.categorias || []),
      };
    }

    const fromExternal = await buscarLibroPorIsbn(clean);
    if (fromExternal) {
      // Retorna el objeto encontrado sin inyectarlo automáticamente en el catálogo ni en la BD
      return {
        isbn: fromExternal.isbn,
        titulo: fromExternal.titulo,
        autor: fromExternal.autor,
        categorias: await filtrarCategoriasRegistradas(fromExternal.categorias),
        sinopsis: fromExternal.sinopsis,
        portada_url: fromExternal.portada_url,
        total_paginas: fromExternal.total_paginas,
        editorial: fromExternal.editorial,
        anio: fromExternal.anio,
      };
    }

    console.warn(`[Escáner] ISBN ${clean} no encontrado en ninguna fuente (Catálogo Local, Google Books, Open Library).`);
    return null;
  }, [catalogo]);

  return {
    catalogo,
    setCatalogo,
    categorias,
    setCategorias,
    recargarCatalogo,
    buscarEnCatalogo,
    buscarObrasPorIsbn,
  };
};
