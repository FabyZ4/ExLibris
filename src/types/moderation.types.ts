export interface ModerationReport {
  id_reporte: string;
  id_resena: string;
  id_respuesta?: string;
  tipo_comentario?: 'resena' | 'respuesta';
  id_usuario_infractor?: string;
  usuario_infractor: string;
  titulo_obra: string;
  motivo: string;
  comentario: string;
  fecha: string;
  prioridad: 'alta' | 'media' | 'baja';
  estado: 'pendiente' | 'descartado' | 'eliminado';
}

export interface BookProposalData {
  titulo?: string;
  autor?: string;
  editorial?: string;
  anio?: number;
  total_paginas?: number;
  sinopsis?: string;
  portada_url?: string;
  categorias?: string[];
  id_categorias?: string[];
}

export interface BookProposal {
  id_solicitud: string;
  id_usuario: string;
  id_libro: string | null;
  isbn: string;
  tipo: 'nuevo' | 'actualizacion';
  datos_propuestos: BookProposalData;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  nota_moderador: string | null;
  creado_el: string;
  revisado_el: string | null;
  nombre_usuario?: string;
  libro_actual?: {
    titulo: string;
    autor: string;
    editorial?: string;
    anio?: number;
    total_paginas: number;
    sinopsis: string;
    portada_url: string;
    categorias: string[];
  } | null;
}
