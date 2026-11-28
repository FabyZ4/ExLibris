import {
  actualizarProgresoDb,
  eliminarBibliotecaItemDb,
  guardarEnBibliotecaDb,
  guardarLibroEnDb,
} from '@/services/database.service';
import { GoogleBookVolume } from '@/services/googleBooks.service';
import { UserProfile } from '@/types/auth.types';
import { BibliotecaItem, Book } from '@/types/book.types';
import { useCallback, useMemo, useState } from 'react';

export const useBibliotecaState = (
  currentUser: UserProfile | null,
  catalogo: Book[],
  setCatalogo: React.Dispatch<React.SetStateAction<Book[]>>
) => {
  const [todasLasBibliotecas, setTodasLasBibliotecas] = useState<BibliotecaItem[]>([]);

  // Libros asociados al usuario actualmente activo
  const biblioteca = useMemo(
    () => (currentUser ? todasLasBibliotecas.filter(item => item.id_usuario === currentUser.id) : []),
    [currentUser, todasLasBibliotecas]
  );

  const agregarALaBiblioteca = useCallback(
    (
      bookInput: Book | GoogleBookVolume,
      estado: 'leyendo' | 'por_leer' | 'leido',
      bitacoraData?: Partial<BibliotecaItem>
    ) => {
      if (!currentUser) return;

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

      if (!currentUser.id.startsWith('demo-')) {
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
              editorial: bookToAdd.editorial,
              anio: bookToAdd.anio,
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
    },
    [currentUser, catalogo, setCatalogo]
  );

  const actualizarProgreso = useCallback(
    (isbn: string, pagina_actual: number, nuevoEstado?: 'leyendo' | 'por_leer' | 'leido') => {
      if (!currentUser) return;
      const currentUserId = currentUser.id;
      setTodasLasBibliotecas(prev =>
        prev.map(item => {
          if (item.isbn === isbn && item.id_usuario === currentUserId) {
            const finalPagina = Math.min(Math.max(0, pagina_actual), item.libro.total_paginas);
            const finalEstado = finalPagina >= item.libro.total_paginas
              ? 'leido'
              : nuevoEstado || (finalPagina > 0 ? 'leyendo' : item.estado);

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
    },
    [currentUser]
  );

  const actualizarBitacora = useCallback(
    (isbn: string, bitacora: Partial<BibliotecaItem>) => {
      if (!currentUser) return;
      const currentUserId = currentUser.id;
      setTodasLasBibliotecas(prev =>
        prev.map(item =>
          item.isbn === isbn && item.id_usuario === currentUserId
            ? { ...item, ...bitacora, actualizado_el: new Date().toISOString() }
            : item
        )
      );
    },
    [currentUser]
  );

  const removerDeBiblioteca = useCallback(
    (isbn: string) => {
      if (!currentUser) return;
      const currentUserId = currentUser.id;
      setTodasLasBibliotecas(prev =>
        prev.filter(item => !(item.isbn === isbn && item.id_usuario === currentUserId))
      );
      if (!currentUserId.startsWith('demo-')) {
        eliminarBibliotecaItemDb(currentUserId, isbn).catch(err => {
          console.warn('Error al eliminar de biblioteca en Supabase:', err);
        });
      }
    },
    [currentUser]
  );

  const getBibliotecaItem = useCallback(
    (isbn: string) => {
      return biblioteca.find(item => item.isbn === isbn);
    },
    [biblioteca]
  );

  return {
    todasLasBibliotecas,
    setTodasLasBibliotecas,
    biblioteca,
    agregarALaBiblioteca,
    actualizarProgreso,
    actualizarBitacora,
    removerDeBiblioteca,
    getBibliotecaItem,
  };
};
