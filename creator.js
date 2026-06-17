/* ==========================================================================
   AuraBook 3D - Creator and Editor Studio
   ========================================================================== */

import { StorageManager } from '../storage.js';
import { ImageFilters } from '../effects/imageFilter.js';
import { DepthPainter } from './depthPainter.js';

export class BookCreator {
  constructor(containerId, bookId = null, onSaveCallback = null, onCancelCallback = null) {
    this.container = document.getElementById(containerId);
    this.onSave = onSaveCallback;
    this.onCancel = onCancelCallback;
    
    // Load book data or init empty book
    if (bookId) {
      this.book = { ...StorageManager.getBookById(bookId) };
      // Deep copy pages
      this.book.pages = this.book.pages.map(p => ({ ...p }));
    } else {
      this.book = {
        id: 'book-' + Math.random().toString(36).substr(2, 9),
        title: 'Untitled Book',
        author: 'Unknown Author',
        genre: 'Fantasy',
        description: 'Describe your immersive book here...',
        coverUrl: 'assets/cover.png',
        pages: []
      };
    }
    
    this.activePageIndex = this.book.pages.length > 0 ? 0 : -1;
    this.setupUI();
    this.updateTimeline();
    this.loadActivePage();
  }

  setupUI() {
    this.container.innerHTML = `
      <div class="editor-container">
        <!-- Sidebar: Book Info & Page List -->
        <div class="editor-sidebar">
          
          <div class="sidebar-section">
            <h4 class="sidebar-title">Book Properties</h4>
            
            <div class="form-group">
              <label>Book Title</label>
              <input type="text" class="form-input" id="input-book-title" value="${this.book.title}">
            </div>
            
            <div class="form-group">
              <label>Author</label>
              <input type="text" class="form-input" id="input-book-author" value="${this.book.author}">
            </div>
            
            <div class="form-group">
              <label>Genre</label>
              <input type="text" class="form-input" id="input-book-genre" value="${this.book.genre}">
            </div>
            
            <div class="form-group">
              <label>Description</label>
              <textarea class="form-textarea" id="input-book-desc" rows="3">${this.book.description}</textarea>
            </div>
            
            <div class="form-group">
              <label>Cover Image (Click to change)</label>
              <div style="display:flex; gap:0.5rem; align-items:center;">
                <img id="book-cover-preview" src="${this.book.coverUrl}" style="width:60px; height:80px; object-fit:cover; border-radius:4px; border:1px solid var(--glass-border); cursor:pointer;">
                <input type="file" id="input-book-cover-file" accept="image/*" style="display:none;">
                <button class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.75rem;" onclick="document.getElementById('input-book-cover-file').click()">Upload Cover</button>
              </div>
            </div>
          </div>
          
          <div class="sidebar-section" style="flex-grow:1; display:flex; flex-direction:column; min-height:250px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <h4 class="sidebar-title" style="margin:0;">Pages Timeline</h4>
              <button class="btn btn-primary" id="btn-add-page" style="padding:0.3rem 0.6rem; font-size:0.75rem;">+ Add Page</button>
            </div>
            
            <div style="flex-grow:1; overflow-y:auto;">
              <div class="pages-timeline" id="pages-timeline">
                <!-- Pages list injected here -->
              </div>
            </div>
          </div>
          
        </div>
        
        <!-- Main Workspace: Active Page Canvas & Editing fields -->
        <div class="editor-workspace">
          <div class="workspace-header">
            <div class="workspace-title">
              <h3 class="neon-text-cyan" id="workspace-page-indicator">No Page Selected</h3>
            </div>
            <div style="display:flex; gap:0.75rem;">
              <button class="btn btn-secondary" id="btn-creator-cancel">Back to Dashboard</button>
              <button class="btn btn-primary" id="btn-creator-save">Save & Export Book</button>
            </div>
          </div>
          
          <div class="workspace-content" id="workspace-content" style="display:none;">
            <!-- Left: Live Preview Canvas -->
            <div class="canvas-area">
              <div class="page-stage" id="page-stage">
                <!-- Dynamic Page preview -->
              </div>
            </div>
            
            <!-- Right: Page details inputs, filters, depth painting -->
            <div class="page-controls-sidebar">
              <div style="padding:1.25rem; border-bottom:1px solid var(--glass-border);">
                <h4 style="margin-bottom:1rem; color:var(--text-primary);">Page Settings</h4>
                
                <div class="form-group">
                  <label>Page Title</label>
                  <input type="text" class="form-input" id="input-page-title">
                </div>
                
                <div class="form-group">
                  <label>Page Type</label>
                  <select class="form-select" id="select-page-type">
                    <option value="text">Rich Text Page</option>
                    <option value="image">Image Page</option>
                  </select>
                </div>
                
                <!-- Image Upload section -->
                <div class="form-group" id="editor-image-upload-group" style="display:none;">
                  <label>Page Image</label>
                  <input type="file" id="input-page-image-file" accept="image/*" style="display:none;">
                  <button class="btn btn-secondary" style="width:100%;" onclick="document.getElementById('input-page-image-file').click()">Upload Image (JPG/PNG/GIF)</button>
                </div>
                
                <!-- Text Area Section -->
                <div class="form-group" id="editor-text-content-group">
                  <label>Page Text</label>
                  <textarea class="form-textarea" id="input-page-text" rows="8" placeholder="Enter page text content here..."></textarea>
                </div>
              </div>
              
              <!-- Image Conversion Effects (Visible only if image page) -->
              <div id="image-effects-panel" style="display:none; padding:1.25rem; border-bottom:1px solid var(--glass-border);">
                <h4 style="margin-bottom:0.75rem; color:var(--text-primary);">Image Effects</h4>
                <div class="filter-grid">
                  <div class="filter-item active" data-filter="none">Normal</div>
                  <div class="filter-item" data-filter="sketch">Sketch Art</div>
                  <div class="filter-item" data-filter="pixel">8-Bit Pixel</div>
                  <div class="filter-item" data-filter="ascii">Monospace ASCII</div>
                  <div class="filter-item" data-filter="glitch">RGB Glitch</div>
                  <div class="filter-item" data-filter="halftone">Halftone Dot</div>
                  <div class="filter-item" data-filter="anaglyph">Red-Cyan 3D</div>
                </div>
              </div>
              
              <!-- 3D Depth Map Painter triggers -->
              <div id="depth-painter-trigger-panel" style="display:none; padding:1.25rem; text-align:center;">
                <h4 style="margin-bottom:0.75rem; color:var(--text-primary); text-align:left;">3D Depth Map</h4>
                <button class="btn btn-accent" id="btn-open-depth-painter" style="width:100%;">
                  Paint 3D Parallax Depth
                </button>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.5rem; text-align:left;">
                  Create a custom depth displacement map so the image responds dynamically to mouse tilting in 3D.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Modal Canvas Painting Overlay -->
      <div id="painter-overlay-container"></div>
    `;
    
    // Bind listeners
    document.getElementById('input-book-title').oninput = (e) => this.book.title = e.target.value;
    document.getElementById('input-book-author').oninput = (e) => this.book.author = e.target.value;
    document.getElementById('input-book-genre').oninput = (e) => this.book.genre = e.target.value;
    document.getElementById('input-book-desc').oninput = (e) => this.book.description = e.target.value;
    
    // Cover upload
    document.getElementById('input-book-cover-file').onchange = (e) => this.handleCoverUpload(e);
    document.getElementById('book-cover-preview').onclick = () => document.getElementById('input-book-cover-file').click();
    
    // Pages timeline interactions
    document.getElementById('btn-add-page').onclick = () => this.addNewPage();
    
    // Workspace action buttons
    document.getElementById('btn-creator-cancel').onclick = () => {
      if (confirm('Any unsaved changes might be lost. Exit?')) {
        if (this.onCancel) this.onCancel();
      }
    };
    
    document.getElementById('btn-creator-save').onclick = () => this.saveBook();
    
    // Page fields interactions
    document.getElementById('input-page-title').oninput = (e) => {
      if (this.activePageIndex >= 0) {
        this.book.pages[this.activePageIndex].title = e.target.value;
        this.updateTimeline();
      }
    };
    
    document.getElementById('select-page-type').onchange = (e) => {
      if (this.activePageIndex >= 0) {
        this.book.pages[this.activePageIndex].type = e.target.value;
        this.togglePageTypeFields(e.target.value);
        this.renderStagePreview();
        this.updateTimeline();
      }
    };
    
    document.getElementById('input-page-text').oninput = (e) => {
      if (this.activePageIndex >= 0) {
        this.book.pages[this.activePageIndex].text = e.target.value;
        this.renderStagePreview();
      }
    };
    
    // Page image upload
    document.getElementById('input-page-image-file').onchange = (e) => this.handlePageImageUpload(e);
    
    // Filters selector
    const filterItems = this.container.querySelectorAll('.filter-item');
    filterItems.forEach(item => {
      item.onclick = async () => {
        if (this.activePageIndex < 0) return;
        
        filterItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const filterName = item.getAttribute('data-filter');
        const activePage = this.book.pages[this.activePageIndex];
        activePage.filter = filterName;
        
        // Apply filter to image and show preview
        if (activePage.originalImageUrl) {
          activePage.imageUrl = await ImageFilters.applyFilter(activePage.originalImageUrl, filterName);
          this.renderStagePreview();
          this.updateTimeline();
        }
      };
    });
    
    // Open Depth Map painter
    document.getElementById('btn-open-depth-painter').onclick = () => this.openDepthPainter();
  }

  handleCoverUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      this.book.coverUrl = event.target.result;
      document.getElementById('book-cover-preview').src = this.book.coverUrl;
    };
    reader.readAsDataURL(file);
  }

  handlePageImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const activePage = this.book.pages[this.activePageIndex];
      activePage.originalImageUrl = event.target.result;
      // Reset filter on new upload
      activePage.filter = 'none';
      activePage.imageUrl = event.target.result;
      activePage.depthMapUrl = ''; // reset depth map
      
      // Update filters active class back to 'none'
      const filterItems = this.container.querySelectorAll('.filter-item');
      filterItems.forEach(i => i.classList.remove('active'));
      this.container.querySelector('[data-filter="none"]').classList.add('active');
      
      this.renderStagePreview();
      this.updateTimeline();
    };
    reader.readAsDataURL(file);
  }

  updateTimeline() {
    const timeline = document.getElementById('pages-timeline');
    if (!timeline) return;
    
    timeline.innerHTML = '';
    
    if (this.book.pages.length === 0) {
      timeline.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:2rem;">No pages yet. Click Add Page.</div>';
      return;
    }
    
    this.book.pages.forEach((page, idx) => {
      const item = document.createElement('div');
      item.className = `timeline-item ${idx === this.activePageIndex ? 'active' : ''}`;
      
      let thumbnailContent = '';
      if (page.type === 'image' && page.imageUrl) {
        thumbnailContent = `<img class="timeline-thumb" src="${page.imageUrl}">`;
      } else {
        thumbnailContent = `<div class="timeline-thumb">TXT</div>`;
      }
      
      item.innerHTML = `
        ${thumbnailContent}
        <div class="timeline-info">
          <div class="timeline-number">PAGE ${idx + 1}</div>
          <div class="timeline-title">${page.title || 'Untitled Page'}</div>
        </div>
        <div class="timeline-delete" data-index="${idx}">&times;</div>
      `;
      
      // Select page
      item.onclick = (e) => {
        if (e.target.classList.contains('timeline-delete')) {
          e.stopPropagation();
          this.deletePage(parseInt(e.target.dataset.index));
        } else {
          this.selectPage(idx);
        }
      };
      
      timeline.appendChild(item);
    });
  }

  addNewPage() {
    const newPage = {
      id: 'page-' + Math.random().toString(36).substr(2, 9),
      title: `Page ${this.book.pages.length + 1}`,
      type: 'text',
      imageUrl: '',
      originalImageUrl: '',
      depthMapUrl: '',
      text: '',
      filter: 'none'
    };
    
    this.book.pages.push(newPage);
    this.activePageIndex = this.book.pages.length - 1;
    
    this.updateTimeline();
    this.loadActivePage();
  }

  deletePage(idx) {
    if (confirm(`Are you sure you want to delete Page ${idx + 1}?`)) {
      this.book.pages.splice(idx, 1);
      
      if (this.activePageIndex >= this.book.pages.length) {
        this.activePageIndex = this.book.pages.length - 1;
      }
      
      this.updateTimeline();
      this.loadActivePage();
    }
  }

  selectPage(idx) {
    this.activePageIndex = idx;
    this.updateTimeline();
    this.loadActivePage();
  }

  togglePageTypeFields(type) {
    const textGroup = document.getElementById('editor-text-content-group');
    const imageGroup = document.getElementById('editor-image-upload-group');
    const effectsPanel = document.getElementById('image-effects-panel');
    const painterPanel = document.getElementById('depth-painter-trigger-panel');
    
    if (type === 'image') {
      textGroup.querySelector('label').textContent = 'Caption Overlay Text';
      imageGroup.style.display = 'block';
      effectsPanel.style.display = 'block';
      painterPanel.style.display = 'block';
    } else {
      textGroup.querySelector('label').textContent = 'Page Text';
      imageGroup.style.display = 'none';
      effectsPanel.style.display = 'none';
      painterPanel.style.display = 'none';
    }
  }

  loadActivePage() {
    const workspaceContent = document.getElementById('workspace-content');
    const indicator = document.getElementById('workspace-page-indicator');
    
    if (this.activePageIndex < 0) {
      workspaceContent.style.display = 'none';
      indicator.textContent = 'No Page Selected';
      return;
    }
    
    workspaceContent.style.display = 'grid';
    indicator.textContent = `Editing Page ${this.activePageIndex + 1}`;
    
    const page = this.book.pages[this.activePageIndex];
    
    document.getElementById('input-page-title').value = page.title;
    document.getElementById('select-page-type').value = page.type;
    document.getElementById('input-page-text').value = page.text;
    
    this.togglePageTypeFields(page.type);
    
    // Set active filter button
    const filterItems = this.container.querySelectorAll('.filter-item');
    filterItems.forEach(i => {
      i.classList.remove('active');
      if (i.getAttribute('data-filter') === page.filter) {
        i.classList.add('active');
      }
    });
    
    this.renderStagePreview();
  }

  renderStagePreview() {
    const stage = document.getElementById('page-stage');
    if (!stage) return;
    
    stage.innerHTML = '';
    stage.className = 'page-stage';
    
    const page = this.book.pages[this.activePageIndex];
    
    if (page.type === 'image') {
      if (page.imageUrl) {
        stage.classList.add('has-image');
        
        const img = document.createElement('img');
        img.src = page.imageUrl;
        img.className = 'stage-image';
        stage.appendChild(img);
        
        if (page.text) {
          const textOverlay = document.createElement('div');
          textOverlay.className = 'stage-text-overlay';
          textOverlay.textContent = page.text;
          stage.appendChild(textOverlay);
        }
      } else {
        stage.innerHTML = `
          <div class="stage-placeholder" onclick="document.getElementById('input-page-image-file').click()">
            <i>&#128247;</i>
            <span>Click to upload page image</span>
          </div>
        `;
      }
    } else {
      // Text layout
      stage.style.padding = '2rem';
      stage.style.display = 'block';
      stage.style.overflowY = 'auto';
      stage.style.color = '#333';
      stage.style.background = '#fbf9f5';
      
      const title = document.createElement('h3');
      title.style.marginBottom = '1rem';
      title.style.color = 'var(--color-primary)';
      title.textContent = page.title;
      stage.appendChild(title);
      
      const body = document.createElement('p');
      body.style.whiteSpace = 'pre-wrap';
      body.style.fontSize = '0.95rem';
      body.style.lineHeight = '1.7';
      body.textContent = page.text || 'Write page text here...';
      stage.appendChild(body);
    }
  }

  openDepthPainter() {
    const page = this.book.pages[this.activePageIndex];
    if (!page.originalImageUrl) {
      alert('Please upload a page image first before drawing a depth map!');
      return;
    }
    
    // Instantiate overlay painter
    new DepthPainter(
      'painter-overlay-container',
      page.originalImageUrl,
      page.depthMapUrl,
      (paintedDepthDataUrl) => {
        page.depthMapUrl = paintedDepthDataUrl;
        
        // Fire custom alert toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
          <i style="color:var(--color-success);">&#10004;</i>
          <div>3D Depth Map Saved successfully!</div>
        `;
        const container = document.querySelector('.toast-container') || document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    );
  }

  saveBook() {
    if (!this.book.title.trim()) {
      alert('Book title cannot be empty!');
      return;
    }
    
    // Set default cover as the first page image if cover is default
    if (this.book.coverUrl === 'assets/cover.png' && this.book.pages.length > 0) {
      const firstImagePage = this.book.pages.find(p => p.type === 'image' && p.imageUrl);
      if (firstImagePage) {
        this.book.coverUrl = firstImagePage.imageUrl;
      }
    }
    
    // Save to storage
    StorageManager.saveBook(this.book);
    
    // Export JSON download trigger for the user to backup their created book!
    const jsonStr = StorageManager.exportBook(this.book);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.book.title.replace(/\s+/g, '_')}_3dbook.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (this.onSave) {
      this.onSave(this.book);
    }
  }
}
