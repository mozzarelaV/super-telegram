/* ==========================================================================
   AuraBook 3D - 2D Layouts Renderer (Webtoon, Webtoon-H, Book-H)
   ========================================================================== */

import { Parallax3DEngine } from '../effects/parallax3d.js';

export const Reader2D = {
  activeParallaxes: [],

  // Clean active parallax instances to avoid WebGL memory leaks
  clearActiveParallaxes() {
    this.activeParallaxes.forEach(p => p.destroy());
    this.activeParallaxes = [];
  },

  // Helper to create page container (wraps image and/or text)
  createPageDOM(page, index, containerClass, imageClass, textClass) {
    const pageDiv = document.createElement('div');
    pageDiv.className = containerClass;
    pageDiv.dataset.index = index;

    if (page.type === 'image' && page.imageUrl) {
      const wrapper = document.createElement('div');
      wrapper.className = 'webtoon-image-wrapper';
      wrapper.style.width = '100%';
      wrapper.style.position = 'relative';

      // Check if this page has a depth map -> instantiate WebGL parallax!
      if (page.depthMapUrl) {
        wrapper.style.height = '500px'; // fixed height wrapper for WebGL canvas aspect mapping
        wrapper.style.background = '#000';
        
        // We'll instantiate the engine after adding to the DOM
        setTimeout(() => {
          try {
            const parallax = new Parallax3DEngine(wrapper, page.imageUrl, page.depthMapUrl);
            this.activeParallaxes.push(parallax);
          } catch (e) {
            console.error('Failed to init WebGL parallax in reader', e);
            // Fallback to img
            wrapper.style.height = 'auto';
            const img = document.createElement('img');
            img.src = page.imageUrl;
            img.className = imageClass;
            wrapper.appendChild(img);
          }
        }, 50);
      } else {
        const img = document.createElement('img');
        img.src = page.imageUrl;
        img.className = imageClass;
        wrapper.appendChild(img);
      }

      pageDiv.appendChild(wrapper);

      if (page.text) {
        const textOverlay = document.createElement('div');
        textOverlay.className = 'stage-text-overlay';
        textOverlay.textContent = page.text;
        pageDiv.appendChild(textOverlay);
      }
    } else {
      // Text-only page
      const textDiv = document.createElement('div');
      textDiv.className = textClass;
      
      // Preserve line breaks
      const formattedText = (page.text || '').replace(/\n/g, '<br>');
      textDiv.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: var(--color-primary);">${page.title || `Chapter ${index + 1}`}</h3>
        <p>${formattedText}</p>
      `;
      pageDiv.appendChild(textDiv);
    }

    return pageDiv;
  },

  // 1. Render Vertical Webtoon Mode
  renderWebtoon(viewport, pages, onScrollProgress) {
    this.clearActiveParallaxes();
    viewport.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'webtoon-layout';
    
    pages.forEach((page, idx) => {
      const pageNode = this.createPageDOM(
        page, 
        idx, 
        'webtoon-page', 
        'webtoon-image', 
        'webtoon-text'
      );
      container.appendChild(pageNode);
    });
    
    viewport.appendChild(container);
    
    // Add scroll tracking progress
    viewport.onscroll = () => {
      const scrollHeight = viewport.scrollHeight - viewport.clientHeight;
      if (scrollHeight > 0) {
        const progress = viewport.scrollTop / scrollHeight;
        if (onScrollProgress) onScrollProgress(progress);
      }
    };
  },

  // 2. Render Horizontal Webtoon Mode (Strip scrolling side-by-side)
  renderWebtoonHorizontal(viewport, pages, onScrollProgress) {
    this.clearActiveParallaxes();
    viewport.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'webtoon-h-layout';
    
    pages.forEach((page, idx) => {
      const pageNode = this.createPageDOM(
        page, 
        idx, 
        'webtoon-h-page', 
        'webtoon-h-image', 
        'webtoon-h-text'
      );
      container.appendChild(pageNode);
    });
    
    viewport.appendChild(container);
    
    // Add horizontal scroll progress tracking
    viewport.onscroll = () => {
      const scrollWidth = viewport.scrollWidth - viewport.clientWidth;
      if (scrollWidth > 0) {
        const progress = viewport.scrollLeft / scrollWidth;
        if (onScrollProgress) onScrollProgress(progress);
      }
    };
    
    // Mouse drag-to-scroll support for desktop convenience
    let isDown = false;
    let startX;
    let scrollLeft;
    
    viewport.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - viewport.offsetLeft;
      scrollLeft = viewport.scrollLeft;
    });
    viewport.addEventListener('mouseleave', () => {
      isDown = false;
    });
    viewport.addEventListener('mouseup', () => {
      isDown = false;
    });
    viewport.addEventListener('mousemove', (e) => {
      if(!isDown) return;
      e.preventDefault();
      const x = e.pageX - viewport.offsetLeft;
      const walk = (x - startX) * 1.5; // scroll speed multiplier
      viewport.scrollLeft = scrollLeft - walk;
    });
  },

  // 3. Render 2D Slide Book Mode (Traditional Double-Page slider)
  renderHorizontalBook(viewport, pages, onPageChange) {
    this.clearActiveParallaxes();
    viewport.innerHTML = '';
    
    const layout = document.createElement('div');
    layout.className = 'book-h-layout';
    
    const slidesContainer = document.createElement('div');
    slidesContainer.className = 'book-h-pages-container';
    
    // Create double page slides
    // Slide 0: Cover (Single or right aligned)
    // Slide 1+: Pages side-by-side (Left: page index 2k, Right: page index 2k+1)
    const slides = [];
    let activeSlideIndex = 0;
    
    // Helper to render slide children
    const makeLeaf = (page, idx) => {
      const leaf = document.createElement('div');
      leaf.className = `book-h-page-leaf ${page && page.type === 'image' ? 'has-image' : ''}`;
      
      if (!page) {
        // empty leaf representing page block end
        leaf.style.background = 'transparent';
        leaf.style.border = 'none';
        leaf.style.boxShadow = 'none';
        return leaf;
      }
      
      if (page.type === 'image' && page.imageUrl) {
        const imgWrapper = document.createElement('div');
        imgWrapper.style.width = '100%';
        imgWrapper.style.height = '100%';
        imgWrapper.style.position = 'relative';
        
        if (page.depthMapUrl) {
          setTimeout(() => {
            try {
              const parallax = new Parallax3DEngine(imgWrapper, page.imageUrl, page.depthMapUrl);
              this.activeParallaxes.push(parallax);
            } catch (e) {
              const img = document.createElement('img');
              img.src = page.imageUrl;
              imgWrapper.appendChild(img);
            }
          }, 50);
        } else {
          const img = document.createElement('img');
          img.src = page.imageUrl;
          imgWrapper.appendChild(img);
        }
        leaf.appendChild(imgWrapper);
      } else {
        const textDiv = document.createElement('div');
        textDiv.className = 'leaf-text';
        textDiv.innerHTML = `
          <h3 style="margin-bottom: 0.75rem; color: var(--color-primary);">${page.title || `Chapter ${idx + 1}`}</h3>
          <p>${(page.text || '').replace(/\n/g, '<br>')}</p>
        `;
        leaf.appendChild(textDiv);
      }
      return leaf;
    };
    
    // Group pages into spreads
    // Slide 0 has cover (Page 0) on right, empty on left
    const slide0 = document.createElement('div');
    slide0.className = 'book-h-slide active';
    slide0.appendChild(makeLeaf(null, -1)); // empty left
    slide0.appendChild(makeLeaf(pages[0], 0)); // cover right
    slidesContainer.appendChild(slide0);
    slides.push(slide0);
    
    for (let i = 1; i < pages.length; i += 2) {
      const slide = document.createElement('div');
      slide.className = 'book-h-slide';
      
      slide.appendChild(makeLeaf(pages[i], i)); // left
      slide.appendChild(makeLeaf(pages[i+1], i+1)); // right (might be undefined, which is handled)
      
      slidesContainer.appendChild(slide);
      slides.push(slide);
    }
    
    layout.appendChild(slidesContainer);
    
    // Left & Right navigation buttons
    const prevBtn = document.createElement('button');
    prevBtn.className = 'slide-arrow arrow-prev';
    prevBtn.innerHTML = '&#9664;';
    prevBtn.style.display = 'none'; // hidden initially
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'slide-arrow arrow-next';
    nextBtn.innerHTML = '&#9654;';
    if (slides.length <= 1) nextBtn.style.display = 'none';
    
    layout.appendChild(prevBtn);
    layout.appendChild(nextBtn);
    
    viewport.appendChild(layout);
    
    const updateActiveSlide = (newIndex) => {
      slides[activeSlideIndex].classList.remove('active');
      activeSlideIndex = newIndex;
      slides[activeSlideIndex].classList.add('active');
      
      // Toggle button visibilities
      prevBtn.style.display = activeSlideIndex === 0 ? 'none' : 'flex';
      nextBtn.style.display = activeSlideIndex === slides.length - 1 ? 'none' : 'flex';
      
      if (onPageChange) {
        // Return active slide spread details
        onPageChange(activeSlideIndex, slides.length);
      }
    };
    
    prevBtn.onclick = () => {
      if (activeSlideIndex > 0) updateActiveSlide(activeSlideIndex - 1);
    };
    
    nextBtn.onclick = () => {
      if (activeSlideIndex < slides.length - 1) updateActiveSlide(activeSlideIndex + 1);
    };
    
    if (onPageChange) onPageChange(0, slides.length);
  }
};
