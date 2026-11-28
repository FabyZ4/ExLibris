import { GoogleBookDTO, searchBooks } from '@/services/googleBooks.service';

async function probarIntegracion(): Promise<void> {
  console.log('--- Probando búsqueda en Google Books (langRestrict=es) ---');
  try {
    const resultados: GoogleBookDTO[] = await searchBooks('Cien años de soledad', { maxResults: 2 });
    console.log(`Resultados encontrados: ${resultados.length}`);
    resultados.forEach((libro: GoogleBookDTO, idx: number) => {
      console.log(`\n[${idx + 1}] ID: ${libro.id}`);
      console.log(`Título: ${libro.title}`);
      console.log(`Autores: ${libro.authors.join(', ')}`);
      console.log(`Editorial: ${libro.publisher}`);
      console.log(`Fecha: ${libro.publishedDate}`);
      console.log(`Páginas: ${libro.pageCount}`);
      console.log(`Categorías: ${libro.categories.join(', ')}`);
      console.log(`ISBN: ${libro.isbn}`);
      console.log(`Portada HTTPS: ${libro.thumbnail}`);
      console.log(`Preview: ${libro.previewLink}`);
    });
  } catch (error) {
    console.error('Error en prueba:', error);
  }
}

void probarIntegracion();
