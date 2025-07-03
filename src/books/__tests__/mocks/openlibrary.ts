/**
 * Mock responses for OpenLibrary API testing
 */

export const mockOpenLibraryResponse = {
  'ISBN:9781789349917': {
    title: 'Learn C Programming',
    subtitle: 'A beginner\'s guide to learning C',
    authors: [
      { name: 'Jeff Szuhay' }
    ],
    publishers: [
      { name: 'Packt Publishing' }
    ],
    publish_date: '2020',
    description: {
      value: 'Get started with writing simple programs in C while learning the skills that will help you work with practically any programming language.'
    },
    number_of_pages: 742,
    subjects: [
      { name: 'Programming' },
      { name: 'Computer Science' },
      { name: 'C Programming Language' }
    ],
    cover: {
      small: 'https://covers.openlibrary.org/b/id/12345-S.jpg',
      medium: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
      large: 'https://covers.openlibrary.org/b/id/12345-L.jpg'
    }
  }
};

export const mockOpenLibraryEmptyResponse = {};

export const mockOpenLibrarySearchResponse = {
  numFound: 2,
  start: 0,
  docs: [
    {
      title: 'The Catcher in the Rye',
      author_name: ['J.D. Salinger'],
      publisher: ['Little, Brown and Company'],
      first_publish_year: 1951,
      number_of_pages_median: 277,
      subject: ['Fiction', 'Coming of age', 'Literature'],
      isbn: ['9780316769174'],
      language: ['eng'],
      cover_i: 8567531
    },
    {
      title: 'The Catcher in the Rye: A Novel',
      author_name: ['J.D. Salinger'],
      publisher: ['Bantam Books'],
      first_publish_year: 1964,
      number_of_pages_median: 234,
      subject: ['Fiction', 'Classic Literature'],
      isbn: ['9780553250251'],
      language: ['eng'],
      cover_i: 8567532
    }
  ]
};

export const mockOpenLibraryEmptySearchResponse = {
  numFound: 0,
  start: 0,
  docs: []
};