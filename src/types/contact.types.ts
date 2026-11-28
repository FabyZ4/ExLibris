export type ContactTopic = 'recomendacion' | 'queja' | 'mejora';
export type ContactMessageStatus = 'pendiente' | 'atendido';

export interface ContactMessage {
  id_contacto: string;
  id_usuario: string;
  tipo: ContactTopic;
  mensaje: string;
  estado: ContactMessageStatus;
  creado_el: string;
  revisado_el: string | null;
  nombre_usuario?: string;
}
