import { UserRole } from './auth.types';

export interface CommentReply {
  id_respuesta: string;
  id_resena: string;
  id_respuesta_padre?: string;
  id_usuario?: string;
  nombre_usuario: string;
  rol_usuario: UserRole;
  comentario: string;
  fecha: string;
  likes: number;
  likedBy?: string[];
  respuestas?: CommentReply[];
}

export interface Review {
  id_resena: string;
  isbn: string;
  id_usuario?: string;
  titulo_libro: string;
  autor_libro: string;
  nombre_usuario: string;
  rol_usuario: UserRole;
  avatar_badge?: string;
  calificacion: number;
  comentario: string;
  fecha: string;
  likes: number;
  likedBy?: string[];
  respuestas?: CommentReply[];
  estado: 'publicado' | 'eliminado';
}
