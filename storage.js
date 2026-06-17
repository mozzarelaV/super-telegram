/* ==========================================================================
   AuraBook 3D - Storage and Library Manager
   ========================================================================== */

const STORAGE_KEY = 'aurabook_library';

// Sample Seed Books data
const SEED_BOOKS = [
  {
    id: 'seed-aether-chronicles',
    title: 'Aether Chronicles',
    author: 'Seraphina Vale',
    genre: 'Fantasy / Sci-Fi',
    description: 'An immersive journey through the celestial clouds. Experience the interactive 3D parallax cover and the RGB glitching visual nodes.',
    coverUrl: 'assets/cover.png',
    createdAt: new Date().toISOString(),
    pages: [
      {
        id: 'p1',
        title: 'The Portal Opens',
        type: 'image',
        imageUrl: 'assets/cover.png',
        depthMapUrl: '', // Default empty, painter will create
        text: 'The spherical crystals of Aether began to rotate, hum, and glow in a language forgotten by humans. A door was opening, and she knew there was no turning back.',
        filter: 'none'
      },
      {
        id: 'p2',
        title: 'Cyberpunk Skyline',
        type: 'image',
        imageUrl: 'assets/parallax_bg.png',
        depthMapUrl: '', // We can pre-generate a simple gradient or paint depth map
        text: 'Beneath the neon arch, the city pulsed like a mechanical heart. Millions of lights reflected in the toxic mist, telling stories of hope and code.',
        filter: 'glitch'
      },
      {
        id: 'p3',
        title: 'The Codex of Light',
        type: 'text',
        imageUrl: '',
        depthMapUrl: '',
        text: 'Chapter 1: The Principle of Duality\n\nIn the beginning, there was only the Source—a singular frequency of light vibrating in total darkness. From this source arose the first particles of Aether, forming the core of the three realms.\n\nTo control the Aether is to understand the harmonic frequencies of creation itself. Aether-mages did not create matter; they simply sang it into existence by altering the strings of local space-time. But the power was volatile. Too much resonance, and the user would be pulled into the anti-realms, dissolved into pure quantum probability.\n\nShe read these lines under the dim glow of her holographic lantern, feeling the cold wind of the mountain pass brush against her neck. The crystals in her pouch responded to the words, glowing with a soft, pulsing azure light.',
        filter: 'none'
      }
    ]
  },
  {
    id: 'seed-neon-horizon',
    title: 'Neon Horizon',
    author: 'Vince Thorne',
    genre: 'Cyberpunk Webtoon',
    description: 'A scrolling webtoon layout demo. Follow the story of a rogue netrunner diving into the deep layers of the city grid.',
    coverUrl: 'assets/parallax_bg.png',
    createdAt: new Date().toISOString(),
    pages: [
      {
        id: 'w1',
        title: 'Deep Dive',
        type: 'image',
        imageUrl: 'assets/parallax_bg.png',
        depthMapUrl: '',
        text: 'System online. Neural link active. Diving into the deep grid...',
        filter: 'pixel'
      },
      {
        id: 'w2',
        title: 'The Glitch',
        type: 'image',
        imageUrl: 'assets/cover.png',
        depthMapUrl: '',
        text: 'WARNING: Unknown signature detected. The grid is morphing...',
        filter: 'anaglyph'
      },
      {
        id: 'w3',
        title: 'ASCII Protocol',
        type: 'image',
        imageUrl: 'assets/parallax_bg.png',
        depthMapUrl: '',
        text: 'Decoding data streams... Raw matrix interface active.',
        filter: 'ascii'
      }
    ]
  },
  {
    id: 'seed-dreamscapes',
    title: 'Dreamscapes Portfolio',
    author: 'Elena Rostova',
    genre: 'Art / Photography',
    description: 'An interactive showcase of photographic transformation. Featuring Halftone dot structures, charcoal sketch styles, and 3D stereo separations.',
    coverUrl: 'assets/cover.png',
    createdAt: new Date().toISOString(),
    pages: [
      {
        id: 'ds1',
        title: 'Pencil Sketch Portal',
        type: 'image',
        imageUrl: 'assets/cover.png',
        depthMapUrl: '',
        text: 'Hand-drawn interpretation of the spherical core. Hand-sketch simulation shader.',
        filter: 'sketch'
      },
      {
        id: 'ds2',
        title: 'Retro Halftone',
        type: 'image',
        imageUrl: 'assets/parallax_bg.png',
        depthMapUrl: '',
        text: 'A halftone print layout simulating retro comic book paper and dot patterns.',
        filter: 'halftone'
      }
    ]
  }
];

export const StorageManager = {
  // Remote books cache
  remoteBooks: [],

  // Fetch remote library.json
  async fetchRemoteLibrary() {
    try {
      const res = await fetch('assets/library.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.remoteBooks = data;
        }
      }
    } catch (e) {
      console.warn('Could not fetch assets/library.json, falling back to local storage.', e);
    }
  },

  // Retrieve all books (combining localStorage and remote library)
  getAllBooks() {
    let localBooks = [];
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      // Seed initial library if empty
      this.saveAllBooks(SEED_BOOKS);
      localBooks = SEED_BOOKS;
    } else {
      try {
        localBooks = JSON.parse(data);
      } catch (e) {
        console.error('Error parsing library storage', e);
        localBooks = SEED_BOOKS;
      }
    }

    // Merge remote books avoiding duplicate IDs (prioritize local edits)
    const merged = [...localBooks];
    this.remoteBooks.forEach(remoteBook => {
      if (!merged.some(b => b.id === remoteBook.id)) {
        merged.push(remoteBook);
      }
    });

    return merged;
  },

  // Save full library array
  saveAllBooks(books) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  },

  // Get a single book by ID
  getBookById(id) {
    const books = this.getAllBooks();
    return books.find(b => b.id === id);
  },

  // Add or update a book
  saveBook(book) {
    const books = this.getAllBooks();
    const index = books.findIndex(b => b.id === book.id);
    
    if (index >= 0) {
      books[index] = { ...book, updatedAt: new Date().toISOString() };
    } else {
      book.id = book.id || 'book-' + Math.random().toString(36).substr(2, 9);
      book.createdAt = book.createdAt || new Date().toISOString();
      books.push(book);
    }
    
    // We only save to local storage for user edits
    // Remote books are read-only from GitHub commits
    const localOnly = books.filter(b => !this.remoteBooks.some(rb => rb.id === b.id));
    this.saveAllBooks(localOnly);
    return book;
  },

  // Delete a book
  deleteBook(id) {
    let books = this.getAllBooks();
    books = books.filter(b => b.id !== id);
    const localOnly = books.filter(b => !this.remoteBooks.some(rb => rb.id === b.id));
    this.saveAllBooks(localOnly);
  },

  // Export a book to JSON string
  exportBook(book) {
    return JSON.stringify(book, null, 2);
  },

  // Import a book from JSON string
  importBook(jsonStr) {
    try {
      const book = JSON.parse(jsonStr);
      if (!book.title || !Array.isArray(book.pages)) {
        throw new Error('Invalid book structure');
      }
      // Generate new ID to avoid conflict, set metadata
      book.id = 'imported-' + Math.random().toString(36).substr(2, 9);
      book.createdAt = new Date().toISOString();
      
      this.saveBook(book);
      return book;
    } catch (e) {
      console.error('Failed to import book', e);
      throw e;
    }
  }
};
