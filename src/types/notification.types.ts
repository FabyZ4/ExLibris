export interface NotificationItem {
  id_notificacion: string;
  id_usuario?: string;
  tipo: 'like' | 'respuesta' | 'moderacion' | 'sistema';
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  isbn?: string;
  id_resena?: string;
}
