/* ==========================================================================
   AuraBook 3D - Application Coordinator (SPA Manager)
   ========================================================================== */

import { StorageManager } from './storage.js';
import { ReaderController } from './reader/readerController.js';
import { BookCreator } from './editor/creator.js';

class App {
  constructor() {
    this.books = [];
    this.activeReader = null;
    this.activeCreator = null;
    
    this.init();
  }

  async init() {
    await StorageManager.fetchRemoteLibrary();
    this.loadLibrary();
    this.setupGlobalEvents();
    this.renderLibrary();
  }

  loadLibrary() {
    this.books = StorageManager.getAllBooks();
  }

  setupGlobalEvents() {
    // Header shadow on scroll
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });

    // Create New Book action
    document.getElementById('btn-new-book').onclick = () => this.openCreator();
    document.getElementById('btn-hero-new-book').onclick = () => this.openCreator();

    // Import JSON action
    const importInput = document.getElementById('input-import-json');
    document.getElementById('btn-import-book').onclick = () => importInput.click();
    
    importInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedBook = StorageManager.importBook(event.target.result);
          this.showToast('Book imported successfully!');
          this.loadLibrary();
          this.renderLibrary();
        } catch (err) {
          alert('Failed to import book. Please check if the file format is valid AuraBook JSON.');
        }
        importInput.value = ''; // reset
      };
      reader.readAsText(file);
    };
  }

  renderLibrary() {
    const grid = document.getElementById('book-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (this.books.length === 0) {
      grid.innerHTML = `
        <div class="empty-state glass-card">
          <div class="empty-icon">&#128366;</div>
          <h3>Your Library is Empty</h3>
          <p style="color:var(--text-secondary);">Start your journey by creating a custom 3D interactive book or importing a JSON backup.</p>
          <button class="btn btn-primary" id="btn-empty-create">+ Create Book</button>
        </div>
      `;
      document.getElementById('btn-empty-create').onclick = () => this.openCreator();
      return;
    }

    this.books.forEach(book => {
      const card = document.createElement('div');
      card.className = 'glass-card book-card';
      
      // Determine what pages types are present to render nice layout badges
      const hasImage = book.pages.some(p => p.type === 'image');
      const hasDepth = book.pages.some(p => p.depthMapUrl);
      
      let badgesHTML = '<span class="badge badge-3d">3D Reader</span>';
      if (hasImage) {
        badgesHTML += '<span class="badge badge-webtoon">Webtoon</span>';
      }
      if (hasDepth) {
        badgesHTML += '<span class="badge badge-horizontal" style="background:var(--color-accent); border-color:var(--color-accent);">3D Parallax</span>';
      }

      card.innerHTML = `
        <div class="book-cover-wrapper">
          <img class="book-cover" src="${book.coverUrl || 'assets/cover.png'}" alt="${book.title}" onerror="this.src='assets/cover.png'">
          <div class="book-badge-container">
            ${badgesHTML}
          </div>
          
          <div class="book-actions-overlay">
            <button class="btn btn-primary btn-icon" data-action="read" data-id="${book.id}" title="Read Book">&#128214; Read</button>
            <button class="btn btn-secondary btn-icon" data-action="edit" data-id="${book.id}" title="Edit Creator">&#128295;</button>
            <button class="btn btn-secondary btn-icon" style="color:var(--color-error);" data-action="delete" data-id="${book.id}" title="Delete Book">&times;</button>
          </div>
        </div>
        
        <div class="book-info">
          <div class="book-title" title="${book.title}">${book.title}</div>
          <div class="book-author">by ${book.author}</div>
          <div class="book-desc">${book.description || 'No description available.'}</div>
          <div class="book-meta">
            <span>${book.pages.length} Pages</span>
            <span>${book.genre || 'Story'}</span>
          </div>
        </div>
      `;

      // Wire events in overlay
      card.querySelector('[data-action="read"]').onclick = (e) => {
        e.stopPropagation();
        this.openReader(book.id);
      };
      
      card.querySelector('[data-action="edit"]').onclick = (e) => {
        e.stopPropagation();
        this.openCreator(book.id);
      };
      
      card.querySelector('[data-action="delete"]').onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${book.title}"?`)) {
          StorageManager.deleteBook(book.id);
          this.showToast('Book deleted.');
          this.loadLibrary();
          this.renderLibrary();
        }
      };

      // Clicking card anywhere else opens reader by default
      card.onclick = () => this.openReader(book.id);

      grid.appendChild(card);
    });
  }

  openReader(bookId) {
    const book = StorageManager.getBookById(bookId);
    if (!book || book.pages.length === 0) {
      alert('This book has no pages! Please add pages in the Editor first.');
      return;
    }
    
    // Hide main landing dashboard
    document.getElementById('view-dashboard').style.display = 'none';
    
    this.activeReader = new ReaderController(book, () => {
      // On close callback: show dashboard again
      document.getElementById('view-dashboard').style.display = 'block';
      this.loadLibrary();
      this.renderLibrary();
      this.activeReader = null;
    });
  }

  openCreator(bookId = null) {
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-creator').style.display = 'block';
    
    this.activeCreator = new BookCreator(
      'view-creator',
      bookId,
      (savedBook) => {
        // On Save callback
        this.showToast('Book saved and downloaded.');
        this.closeCreator();
      },
      () => {
        // On Cancel callback
        this.closeCreator();
      }
    );
  }

  closeCreator() {
    document.getElementById('view-creator').style.display = 'none';
    document.getElementById('view-dashboard').style.display = 'block';
    this.activeCreator = null;
    this.loadLibrary();
    this.renderLibrary();
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <i style="color:var(--color-primary); font-style:normal;">&#9432;</i>
      <div>${message}</div>
    `;
    const container = document.getElementById('global-toast-container');
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}

// Start Application on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
