import {
  crearResenaDb,
  crearRespuestaDb,
  darLikeResenaDb,
  darLikeRespuestaDb,
  eliminarResenaPropia,
  eliminarRespuestaDb,
  quitarLikeResenaDb,
  quitarLikeRespuestaDb,
} from '@/services/database.service';
import { UserProfile, UserRole } from '@/types/auth.types';
import { Book, BookRatingStats } from '@/types/book.types';
import { CommentReply, Review } from '@/types/community.types';
import { findReply, removeReplyTree, updateReplyTree } from '@/utils/commentTree';
import { useCallback, useState } from 'react';

export const useComunidadState = (
  currentUser: UserProfile | null,
  userRole: UserRole,
  catalogo: Book[]
) => {
  const [resenas, setResenas] = useState<Review[]>([]);

  const publicarResena = useCallback(
    (isbn: string, calificacion: number, comentario: string) => {
      const libro = catalogo.find(b => b.isbn === isbn);
      const authorName = currentUser?.nombre || 'Lector';
      const localId = `res-${Date.now()}`;
      const newReview: Review = {
        id_resena: localId,
        isbn,
        id_usuario: currentUser?.id,
        titulo_libro: libro?.titulo || 'Obra Literaria',
        autor_libro: libro?.autor || 'Autor',
        nombre_usuario: authorName,
        rol_usuario: userRole,
        avatar_badge: userRole === 'moderador' ? 'Moderador Oficial' : undefined,
        calificacion,
        comentario,
        fecha: 'Recién publicado',
        likes: 0,
        likedBy: [],
        respuestas: [],
        estado: 'publicado',
      };

      setResenas(prev => [newReview, ...prev]);

      if (currentUser && !currentUser.id.startsWith('demo-')) {
        crearResenaDb({
          isbn,
          id_usuario: currentUser.id,
          calificacion,
          comentario,
          estado: 'publicado',
        })
          .then(saved => {
            if (saved && saved[0]) {
              setResenas(prev =>
                prev.map(r => (r.id_resena === localId ? { ...r, id_resena: saved[0].id_resena } : r))
              );
            }
          })
          .catch(err => {
            console.warn('Error al guardar reseña en Supabase:', err);
          });
      }
    },
    [currentUser, userRole, catalogo]
  );

  const eliminarResenaPropiaContext = useCallback(
    async (id_resena: string) => {
      const review = resenas.find(item => item.id_resena === id_resena);
      if (!review || !currentUser || review.id_usuario !== currentUser.id) return;

      setResenas(prev =>
        prev.map(item => (item.id_resena === id_resena ? { ...item, estado: 'eliminado' } : item))
      );
      if (id_resena.startsWith('res-') || currentUser.id.startsWith('demo-')) return;

      try {
        await eliminarResenaPropia(id_resena);
      } catch (error) {
        setResenas(prev =>
          prev.map(item => (item.id_resena === id_resena ? { ...item, estado: 'publicado' } : item))
        );
        throw error;
      }
    },
    [currentUser, resenas]
  );

  const darLikeResena = useCallback(
    (id_resena: string) => {
      if (!currentUser) return;
      const userId = currentUser.id;
      const target = resenas.find(r => r.id_resena === id_resena);
      const yaDioLike = target?.likedBy?.includes(userId);

      if (yaDioLike) {
        if (!userId.startsWith('demo-')) {
          quitarLikeResenaDb(id_resena, userId).catch(err => {
            console.warn('Error al quitar like en Supabase:', err);
          });
        }
      } else {
        if (!userId.startsWith('demo-')) {
          darLikeResenaDb(id_resena, userId).catch(err => {
            console.warn('Error al dar like en Supabase:', err);
          });
        }
      }

      setResenas(prev =>
        prev.map(r => {
          if (r.id_resena !== id_resena) return r;
          const likedBy = r.likedBy || [];
          const isLiked = likedBy.includes(userId);
          const newLikedBy = isLiked ? likedBy.filter(id => id !== userId) : [...likedBy, userId];
          const newLikes = Math.max(0, (r.likes || 0) + (isLiked ? -1 : 1));
          return {
            ...r,
            likes: newLikes,
            likedBy: newLikedBy,
          };
        })
      );
    },
    [currentUser, resenas]
  );

  const responderResena = useCallback(
    async (id_resena: string, comentario: string, id_respuesta_padre?: string) => {
      if (!comentario.trim() || !currentUser) return;
      const target = resenas.find(r => r.id_resena === id_resena);
      if (!target) return;
      const parentReply = id_respuesta_padre
        ? findReply(target.respuestas || [], id_respuesta_padre)
        : undefined;
      if (id_respuesta_padre && !parentReply) {
        throw new Error('No se encontró el comentario al que intentas responder.');
      }

      const text = comentario.trim();
      const authorName = currentUser.nombre || 'Lector';
      const newReply: CommentReply = {
        id_respuesta: `reply-${Date.now()}`,
        id_resena,
        id_respuesta_padre,
        id_usuario: currentUser.id,
        nombre_usuario: authorName,
        rol_usuario: userRole,
        comentario: text,
        fecha: 'Recién respondido',
        likes: 0,
        likedBy: [],
        respuestas: [],
      };

      if (!currentUser.id.startsWith('demo-') && !id_resena.startsWith('res-')) {
        const saved = await crearRespuestaDb(id_resena, currentUser.id, text, id_respuesta_padre);
        if (!saved[0]) throw new Error('No se pudo guardar la respuesta.');
        newReply.id_respuesta = saved[0].id_respuesta;
        newReply.fecha = saved[0].creado_el
          ? new Date(saved[0].creado_el).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
          : newReply.fecha;
      }

      setResenas(prev =>
        prev.map(r => {
          if (r.id_resena !== id_resena) return r;
          if (!id_respuesta_padre) {
            return { ...r, respuestas: [...(r.respuestas || []), newReply] };
          }
          return {
            ...r,
            respuestas: updateReplyTree(r.respuestas || [], id_respuesta_padre, parent => ({
              ...parent,
              respuestas: [...(parent.respuestas || []), newReply],
            })),
          };
        })
      );
    },
    [currentUser, userRole, resenas]
  );

  const darLikeRespuesta = useCallback(
    async (id_resena: string, id_respuesta: string) => {
      if (!currentUser) return;
      const review = resenas.find(item => item.id_resena === id_resena);
      const reply = review && findReply(review.respuestas || [], id_respuesta);
      if (!reply) return;

      const alreadyLiked = reply.likedBy?.includes(currentUser.id) || false;
      if (!currentUser.id.startsWith('demo-') && !id_respuesta.startsWith('reply-')) {
        if (alreadyLiked) {
          await quitarLikeRespuestaDb(id_respuesta, currentUser.id);
        } else {
          await darLikeRespuestaDb(id_respuesta, currentUser.id);
        }
      }

      setResenas(prev =>
        prev.map(item => {
          if (item.id_resena !== id_resena) return item;
          return {
            ...item,
            respuestas: updateReplyTree(item.respuestas || [], id_respuesta, current => {
              const likedBy = current.likedBy || [];
              const liked = likedBy.includes(currentUser.id);
              return {
                ...current,
                likes: Math.max(0, (current.likes || 0) + (liked ? -1 : 1)),
                likedBy: liked
                  ? likedBy.filter(userId => userId !== currentUser.id)
                  : [...likedBy, currentUser.id],
              };
            }),
          };
        })
      );
    },
    [currentUser, resenas]
  );

  const eliminarRespuestaPropiaContext = useCallback(
    async (id_resena: string, id_respuesta: string) => {
      if (!currentUser) return;
      const review = resenas.find(item => item.id_resena === id_resena);
      const reply = review && findReply(review.respuestas || [], id_respuesta);
      if (!reply || reply.id_usuario !== currentUser.id) return;

      if (!id_respuesta.startsWith('reply-') && !currentUser.id.startsWith('demo-')) {
        await eliminarRespuestaDb(id_respuesta);
      }
      setResenas(prev =>
        prev.map(item =>
          item.id_resena === id_resena
            ? { ...item, respuestas: removeReplyTree(item.respuestas || [], id_respuesta) }
            : item
        )
      );
    },
    [currentUser, resenas]
  );

  const obtenerMetricasLibro = useCallback(
    (isbn: string): BookRatingStats => {
      const bookReviews = resenas.filter(r => r.isbn === isbn && r.estado === 'publicado');
      const totalVotos = bookReviews.length;
      if (totalVotos === 0) {
        return {
          promedio: null,
          totalVotos: 0,
          distribucion: [5, 4, 3, 2, 1].map(star => ({
            star,
            pct: 0,
            count: 0,
            label: '0%',
          })),
        };
      }

      const sum = bookReviews.reduce((acc, r) => acc + r.calificacion, 0);
      const promedio = parseFloat((sum / totalVotos).toFixed(1));

      const distribucion = [5, 4, 3, 2, 1].map(star => {
        const count = bookReviews.filter(r => Math.round(r.calificacion) === star).length;
        const pct = totalVotos > 0 ? count / totalVotos : 0;
        return {
          star,
          pct,
          count,
          label: `${Math.round(pct * 100)}%`,
        };
      });

      return {
        promedio,
        totalVotos,
        distribucion,
      };
    },
    [resenas]
  );

  return {
    resenas,
    setResenas,
    publicarResena,
    eliminarResenaPropia: eliminarResenaPropiaContext,
    darLikeResena,
    responderResena,
    darLikeRespuesta,
    eliminarRespuestaPropia: eliminarRespuestaPropiaContext,
    obtenerMetricasLibro,
  };
};
