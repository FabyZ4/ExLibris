export interface ModerationReport {
  id_reporte: string;
  id_resena: string;
  id_usuario_infractor?: string;
  usuario_infractor: string;
  titulo_obra: string;
  motivo: string;
  comentario: string;
  fecha: string;
  prioridad: 'alta' | 'media' | 'baja';
  estado: 'pendiente' | 'descartado' | 'eliminado';
}
