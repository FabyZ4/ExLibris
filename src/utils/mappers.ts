import { DbBibliotecaItemConLibro } from '@/services/database.service';
import { UserRole } from '@/types/auth.types';
import { BibliotecaItem, Book } from '@/types/book.types';
import { CommentReply, Review } from '@/types/community.types';
import { NotificationItem } from '@/types/notification.types';

export const normalizeCategories = (categories: string[] | string | null | undefined): string[] => {
  if (Array.isArray(categories)) return categories;
  if (typeof categories === 'string') {
    return categories.split(/\s*[,/|]\s*/).filter(Boolean);
  }
  return [];
};

export const mapBibliotecaFromDb = (items: DbBibliotecaItemConLibro[]): BibliotecaItem[] =>
  items.flatMap(item => {
    if (!item.libros) return [];
    const libro: Book = {
      ...item.libros,
      categorias: item.libros.categorias || [],
      editorial: item.libros.editorial || 'Editorial canónica',
      anio: item.libros.anio || 2024,
    };
    return [{
      id_biblioteca: item.id_biblioteca,
      id_usuario: item.id_usuario,
      isbn: item.isbn,
      libro,
      estado: item.estado,
      pagina_actual: item.pagina_actual,
      lugar_compra: item.lugar_compra || '',
      precio_compra: item.precio_compra || 0,
      fecha_compra: item.fecha_compra || '',
      formato_edicion: item.formato_edicion || '',
      actualizado_el: item.actualizado_el || new Date().toISOString(),
    }];
  });

export const mapNotificaciones = (rawNotifs: any[]): NotificationItem[] => {
  const seen = new Set<string>();
  const list: NotificationItem[] = [];

  for (const n of rawNotifs) {
    // Normalizar mensaje removiendo elipsis para evitar que "Texto" y "Texto..." se traten como distintos
    const normalizedMsg = (n.mensaje || '')
      .replace(/["“”'’]/g, '')
      .replace(/\.{2,4}$/, '')
      .trim();
    const timeBucket = n.creado_el ? Math.floor(new Date(n.creado_el).getTime() / 15000) : n.id_notificacion;
    const dedupeKey = `${n.id_usuario}_${n.tipo}_${normalizedMsg}_${timeBucket}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    list.push({
      id_notificacion: n.id_notificacion,
      id_usuario: n.id_usuario,
      tipo: n.tipo as NotificationItem['tipo'],
      titulo: n.titulo,
      mensaje: n.mensaje,
      fecha: n.creado_el
        ? (() => {
            const d = new Date(n.creado_el);
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin < 1) return 'Hace un momento';
            if (diffMin < 60) return `Hace ${diffMin} min`;
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `Hace ${diffHr}h`;
            return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
          })()
        : 'Reciente',
      leida: Boolean(n.leida),
      isbn: n.isbn ?? undefined,
      id_resena: n.id_resena ?? undefined,
    });
  }

  return list;
};

export const mapResenasFromDb = (dbResenas: any[], dbLikes: any[], dbRespuestas: any[]): Review[] =>
  dbResenas.map(r => {
    const resenaLikes = dbLikes.filter((l: any) => l.id_resena === r.id_resena);
    const reviewResponses = dbRespuestas.filter((resp: any) => resp.id_resena === r.id_resena);
    const mapReplies = (parentId?: string): CommentReply[] =>
      reviewResponses
        .filter((resp: any) => (resp.id_respuesta_padre || undefined) === parentId)
        .map((resp: any): CommentReply => {
          const responseLikes = resp.respuesta_likes || [];
          return {
            id_respuesta: resp.id_respuesta,
            id_resena: resp.id_resena,
            id_respuesta_padre: resp.id_respuesta_padre || undefined,
            id_usuario: resp.id_usuario,
            nombre_usuario: resp.usuario?.nombre_usuario || 'Lector',
            rol_usuario: 'lector',
            comentario: resp.comentario,
            fecha: resp.creado_el
              ? new Date(resp.creado_el).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
              : 'Reciente',
            likes: responseLikes.length,
            likedBy: responseLikes.map((like: any) => like.id_usuario as string),
            respuestas: mapReplies(resp.id_respuesta),
          };
        });
    const resenaRespuestas = mapReplies();
    return {
      id_resena: r.id_resena,
      isbn: r.isbn,
      id_usuario: r.id_usuario,
      titulo_libro: r.libros?.titulo || 'Obra Literaria',
      autor_libro: r.libros?.autor || 'Autor',
      nombre_usuario: r.usuario?.nombre_usuario || 'Lector',
      rol_usuario: 'lector' as UserRole,
      avatar_badge: undefined,
      calificacion: r.calificacion,
      comentario: r.comentario,
      fecha: r.creado_el
        ? new Date(r.creado_el).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : 'Reciente',
      likes: resenaLikes.length,
      likedBy: resenaLikes.map((l: any) => l.id_usuario as string),
      respuestas: resenaRespuestas,
      estado: (r.estado || 'publicado') as Review['estado'],
    };
  });
