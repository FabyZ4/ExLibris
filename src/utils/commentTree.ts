import { CommentReply } from '@/types/community.types';

export const findReply = (replies: CommentReply[], id_respuesta: string): CommentReply | undefined => {
  for (const reply of replies) {
    if (reply.id_respuesta === id_respuesta) return reply;
    const nestedReply = findReply(reply.respuestas || [], id_respuesta);
    if (nestedReply) return nestedReply;
  }
  return undefined;
};

export const updateReplyTree = (
  replies: CommentReply[],
  id_respuesta: string,
  update: (reply: CommentReply) => CommentReply
): CommentReply[] =>
  replies.map(reply => {
    const updatedReply = reply.id_respuesta === id_respuesta ? update(reply) : reply;
    return {
      ...updatedReply,
      respuestas: updateReplyTree(updatedReply.respuestas || [], id_respuesta, update),
    };
  });

export const removeReplyTree = (replies: CommentReply[], id_respuesta: string): CommentReply[] =>
  replies
    .filter(reply => reply.id_respuesta !== id_respuesta)
    .map(reply => ({
      ...reply,
      respuestas: removeReplyTree(reply.respuestas || [], id_respuesta),
    }));

export const countReplies = (replies: CommentReply[]): number =>
  replies.reduce((count, reply) => count + 1 + countReplies(reply.respuestas || []), 0);
