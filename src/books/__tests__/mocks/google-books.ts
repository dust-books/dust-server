/**
 * Mock responses for Google Books API testing
 */

export const mockGoogleBooksResponse = {
  items: [{
    volumeInfo: {
      title: 'Learn C Programming',
      subtitle: 'A beginner\'s guide to learning the most powerful and general-purpose programming language with ease',
      authors: ['Jeff Szuhay'],
      publisher: 'Packt Publishing',
      publishedDate: '2020-06-26',
      description: 'Get started with writing simple programs in C while learning the skills that will help you work with practically any programming language.',
      pageCount: 742,
      categories: ['Computers', 'Programming Languages', 'General'],
      language: 'en',
      averageRating: 4.2,
      ratingsCount: 15,
      maturityRating: 'NOT_MATURE',
      industryIdentifiers: [
        { type: 'ISBN_13', identifier: '9781789349917' },
        { type: 'ISBN_10', identifier: '1789349915' }
      ],
      imageLinks: {
        smallThumbnail: 'http://books.google.com/books/content?id=test&printsec=frontcover&img=1&zoom=5&source=gbs_api',
        thumbnail: 'http://books.google.com/books/content?id=test&printsec=frontcover&img=1&zoom=1&source=gbs_api'
      }
    }
  }]
};

export const mockGoogleBooksEmptyResponse = {
  totalItems: 0,
  items: []
};

export const mockGoogleBooksErrorResponse = {
  error: {
    code: 403,
    message: 'The request cannot be completed because you have exceeded your quota.'
  }
};

export const mockGoogleBooksSeriesResponse = {
  items: [{
    volumeInfo: {
      title: 'Harry Potter and the Philosopher\'s Stone (Harry Potter #1)',
      authors: ['J.K. Rowling'],
      publisher: 'Bloomsbury',
      publishedDate: '1997-06-26',
      description: 'The first book in the Harry Potter series.',
      pageCount: 223,
      categories: ['Fiction', 'Fantasy', 'Children'],
      language: 'en',
      maturityRating: 'NOT_MATURE',
      industryIdentifiers: [
        { type: 'ISBN_13', identifier: '9780747532699' }
      ]
    }
  }]
};

export const mockGoogleBooksMatureResponse = {
  items: [{
    volumeInfo: {
      title: 'Fifty Shades of Grey',
      authors: ['E. L. James'],
      publisher: 'Vintage Books',
      publishedDate: '2011-05-25',
      description: 'An erotic romance novel.',
      pageCount: 514,
      categories: ['Fiction', 'Romance', 'Adult'],
      language: 'en',
      maturityRating: 'MATURE',
      industryIdentifiers: [
        { type: 'ISBN_13', identifier: '9780345803481' }
      ]
    }
  }]
};

export const mockGoogleBooksSearchResponse = {
  items: [
    {
      volumeInfo: {
        title: 'The Great Gatsby',
        authors: ['F. Scott Fitzgerald'],
        publisher: 'Scribner',
        publishedDate: '1925',
        description: 'A classic American novel.',
        pageCount: 180,
        categories: ['Fiction', 'Classics'],
        language: 'en',
        industryIdentifiers: [
          { type: 'ISBN_13', identifier: '9780743273565' }
        ]
      }
    },
    {
      volumeInfo: {
        title: 'The Great Gatsby: A Novel',
        authors: ['F. Scott Fitzgerald'],
        publisher: 'Modern Library',
        publishedDate: '1992',
        description: 'Another edition of the classic.',
        pageCount: 193,
        categories: ['Fiction'],
        language: 'en',
        industryIdentifiers: [
          { type: 'ISBN_13', identifier: '9780679745389' }
        ]
      }
    }
  ]
};