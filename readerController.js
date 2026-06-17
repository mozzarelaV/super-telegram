/* ==========================================================================
   AuraBook 3D - Reader Layout & Views Coordinator
   ========================================================================== */

import { Reader3D } from './reader3d.js';
import { Reader2D } from './reader2d.js';

export class ReaderController {
  constructor(book, onCloseCallback = null) {
    this.book = book;
    this.onClose = onCloseCallback;
    this.activeLayout = '3d'; // '3d', 'webtoon', 'webtoon-h', 'book-h'
    
    this.reader3dInstance = null;
    
    this.setupUI();
    this.initActiveLayout();
  }

  setupUI() {
    // Create reader container full overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'reader-overlay';
    
    this.overlay.innerHTML = `
      <div class="reader-toolbar">
        <div class="reader-title-info">
          <div class="reader-book-title">${this.book.title}</div>
          <div class="reader-chapter-title">by ${this.book.author}</div>
        </div>
        
        <div class="reader-layout-selector">
          <div class="layout-tab active" data-layout="3d">3D Book</div>
          <div class="layout-tab" data-layout="webtoon">Webtoon</div>
          <div class="layout-tab" data-layout="webtoon-h">H-Webtoon</div>
          <div class="layout-tab" data-layout="book-h">2D Book</div>
        </div>
        
        <div class="reader-close" id="btn-reader-close">&times;</div>
      </div>
      
      <div class="reader-viewport">
        <!-- 3D Canvas -->
        <div class="canvas-3d-container" id="canvas-3d-container"></div>
        <!-- 2D layouts scroll/viewport -->
        <div class="reader-viewport-2d" id="reader-viewport-2d"></div>
        
        <div class="reader-help-tip" id="reader-help-tip">
          Hint: Drag mouse to rotate book in 3D. Click near the edges to turn pages.
        </div>
      </div>
      
      <div class="reader-bottom-nav">
        <div class="nav-progress-container">
          <input type="range" class="progress-slider" id="reader-progress-slider" min="0" max="100" value="0">
          <div class="progress-label" id="reader-progress-label">0 / 0</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.overlay);
    
    // Wire up events
    document.getElementById('btn-reader-close').onclick = () => this.destroy();
    
    // Layout switcher tabs
    const tabs = this.overlay.querySelectorAll('.layout-tab');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const layout = tab.getAttribute('data-layout');
        this.switchLayout(layout);
      };
    });
    
    // Progress slider interaction
    this.progressSlider = document.getElementById('reader-progress-slider');
    this.progressLabel = document.getElementById('reader-progress-label');
  }

  initActiveLayout() {
    const container3D = document.getElementById('canvas-3d-container');
    const viewport2D = document.getElementById('reader-viewport-2d');
    const helpTip = document.getElementById('reader-help-tip');
    
    // Clean current instances
    if (this.reader3dInstance) {
      this.reader3dInstance.destroy();
      this.reader3dInstance = null;
    }
    Reader2D.clearActiveParallaxes();
    
    viewport2D.classList.remove('active');
    viewport2D.style.display = 'none';
    container3D.style.display = 'none';
    helpTip.style.display = 'none';
    
    if (this.activeLayout === '3d') {
      container3D.style.display = 'block';
      helpTip.style.display = 'block';
      helpTip.style.animation = 'none'; // reset animation
      void helpTip.offsetWidth; // trigger reflow
      helpTip.style.animation = 'fadeOutHelp 5s forwards';
      helpTip.textContent = 'Hint: Drag mouse to rotate book in 3D. Use arrow keys or click left/right side to flip pages!';
      
      // Initialize Three.js reader
      this.reader3dInstance = new Reader3D(
        container3D, 
        this.book.pages, 
        0, 
        (leftIdx, total) => this.on3DPageChange(leftIdx, total)
      );
      
      // Arrow keys mapping for Three.js page turns
      this.arrowKeyHandler = (e) => {
        if (e.key === 'ArrowLeft') {
          this.reader3dInstance.flipPage('prev');
        } else if (e.key === 'ArrowRight') {
          this.reader3dInstance.flipPage('next');
        }
      };
      window.addEventListener('keydown', this.arrowKeyHandler);
      
      // Connect slider to page selection in 3D
      this.progressSlider.oninput = (e) => {
        const targetSpread = parseInt(e.target.value);
        if (this.reader3dInstance && !this.reader3dInstance.isAnimating) {
          this.reader3dInstance.currentIndex = targetSpread;
          this.reader3dInstance.updatePages(true);
        }
      };
      
    } else {
      viewport2D.classList.add('active');
      viewport2D.style.display = 'block';
      
      if (this.activeLayout === 'webtoon') {
        Reader2D.renderWebtoon(viewport2D, this.book.pages, (progress) => {
          this.progressSlider.value = Math.round(progress * 100);
          this.progressLabel.textContent = `${Math.round(progress * 100)}%`;
        });
        
        this.progressSlider.max = 100;
        this.progressSlider.value = 0;
        this.progressLabel.textContent = '0%';
        this.progressSlider.oninput = (e) => {
          const progress = parseInt(e.target.value) / 100;
          viewport2D.scrollTop = progress * (viewport2D.scrollHeight - viewport2D.clientHeight);
        };
        
      } else if (this.activeLayout === 'webtoon-h') {
        Reader2D.renderWebtoonHorizontal(viewport2D, this.book.pages, (progress) => {
          this.progressSlider.value = Math.round(progress * 100);
          this.progressLabel.textContent = `${Math.round(progress * 100)}%`;
        });
        
        this.progressSlider.max = 100;
        this.progressSlider.value = 0;
        this.progressLabel.textContent = '0%';
        this.progressSlider.oninput = (e) => {
          const progress = parseInt(e.target.value) / 100;
          viewport2D.scrollLeft = progress * (viewport2D.scrollWidth - viewport2D.clientWidth);
        };
        
      } else if (this.activeLayout === 'book-h') {
        Reader2D.renderHorizontalBook(viewport2D, this.book.pages, (activeSpread, totalSpreads) => {
          this.progressSlider.max = totalSpreads - 1;
          this.progressSlider.value = activeSpread;
          this.progressLabel.textContent = `Spread ${activeSpread + 1} / ${totalSpreads}`;
        });
        
        this.progressSlider.oninput = (e) => {
          const targetIndex = parseInt(e.target.value);
          // Re-render at target index by simulating arrow clicks or custom triggers
          // But our renderHorizontalBook sets up state: we can bind it directly by recalling slide triggers
          const slides = viewport2D.querySelectorAll('.book-h-slide');
          const arrows = viewport2D.querySelectorAll('.slide-arrow');
          if (slides && slides.length > targetIndex) {
            slides.forEach((s, idx) => {
              s.classList.remove('active');
              if(idx === targetIndex) s.classList.add('active');
            });
            // Update arrows display
            const prevBtn = viewport2D.querySelector('.arrow-prev');
            const nextBtn = viewport2D.querySelector('.arrow-next');
            if (prevBtn) prevBtn.style.display = targetIndex === 0 ? 'none' : 'flex';
            if (nextBtn) nextBtn.style.display = targetIndex === slides.length - 1 ? 'none' : 'flex';
            
            this.progressSlider.value = targetIndex;
            this.progressLabel.textContent = `Spread ${targetIndex + 1} / ${slides.length}`;
          }
        };
      }
    }
  }

  on3DPageChange(leftIdx, totalPages) {
    const activeSpread = this.reader3dInstance.currentIndex;
    const totalSpreads = Math.ceil(totalPages / 2);
    
    this.progressSlider.max = totalSpreads - 1;
    this.progressSlider.value = activeSpread;
    
    // Page count displays
    const leftPageNum = leftIdx + 1;
    const rightPageNum = leftIdx + 2;
    
    if (rightPageNum <= totalPages) {
      this.progressLabel.textContent = `Pages ${leftPageNum}-${rightPageNum} / ${totalPages}`;
    } else {
      this.progressLabel.textContent = `Page ${leftPageNum} / ${totalPages}`;
    }
  }

  switchLayout(layout) {
    if (this.arrowKeyHandler) {
      window.removeEventListener('keydown', this.arrowKeyHandler);
      this.arrowKeyHandler = null;
    }
    this.activeLayout = layout;
    this.initActiveLayout();
  }

  destroy() {
    if (this.arrowKeyHandler) {
      window.removeEventListener('keydown', this.arrowKeyHandler);
    }
    
    if (this.reader3dInstance) {
      this.reader3dInstance.destroy();
    }
    
    Reader2D.clearActiveParallaxes();
    
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    
    if (this.onClose) {
      this.onClose();
    }
  }
}
export default ReaderController;
