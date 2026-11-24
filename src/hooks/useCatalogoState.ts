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
          editorial: 'Editorial canónica',
          anio: 2024,
        }));
        return [...formatDb, ...prev.filter(book => !ids.has(book.isbn))];
      });
    } catch (error) {
      console.warn('Error al recargar catálogo desde Supabase:', error);
    }
  }, []);

  const buscarEnCatalogo = useCallback((query: string, categoria?: string) => {
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
  }, [catalogo]);

  const buscarObrasPorIsbn = useCallback(async (isbn: string): Promise<Book | null> => {
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
      };
      setCatalogo(prev => [newBook, ...prev]);
      return newBook;
    }

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
