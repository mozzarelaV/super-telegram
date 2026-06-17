/* ==========================================================================
   AuraBook 3D - Depth Map Canvas Painter
   ========================================================================== */

export class DepthPainter {
  constructor(containerId, bgImageUrl, initialDepthDataUrl = '', onSaveCallback = null) {
    this.container = document.getElementById(containerId);
    this.bgImageUrl = bgImageUrl;
    this.initialDepthDataUrl = initialDepthDataUrl;
    this.onSave = onSaveCallback;
    
    this.brushSize = 30;
    this.brushOpacity = 0.5;
    this.brushSoftness = 20;
    this.brushColor = '#808080'; // Middle gray default
    this.isDrawing = false;
    this.isEraser = false;
    
    this.setupUI();
    this.initCanvases();
  }

  setupUI() {
    this.container.innerHTML = `
      <div class="depth-painter-overlay">
        <div class="painter-header">
          <h3 class="neon-text-indigo">Depth Map Painter Studio</h3>
          <div style="display: flex; gap: 0.75rem;">
            <button class="btn btn-secondary" id="btn-painter-clear">Clear (Fill Gray)</button>
            <button class="btn btn-secondary" id="btn-painter-cancel">Cancel</button>
            <button class="btn btn-primary" id="btn-painter-save">Apply Depth Map</button>
          </div>
        </div>
        <div class="painter-body">
          <div class="painter-canvas-container" id="painter-canvas-container">
            <div class="painter-canvas-wrapper" id="painter-canvas-wrapper">
              <canvas class="painter-base-canvas" id="painter-base-canvas"></canvas>
              <canvas class="painter-draw-canvas" id="painter-draw-canvas"></canvas>
            </div>
          </div>
          
          <div class="painter-controls">
            <h4 style="margin-bottom: 1rem;">Brush Properties</h4>
            
            <div class="brush-preview" id="brush-preview"></div>
            
            <div class="slider-group">
              <label>Brush Size <span id="label-brush-size">30px</span></label>
              <input type="range" id="input-brush-size" min="5" max="100" value="30">
            </div>
            
            <div class="slider-group">
              <label>Opacity <span id="label-brush-opacity">50%</span></label>
              <input type="range" id="input-brush-opacity" min="10" max="100" value="50">
            </div>
            
            <div class="slider-group">
              <label>Softness (Blur) <span id="label-brush-softness">20px</span></label>
              <input type="range" id="input-brush-softness" min="0" max="50" value="20">
            </div>
            
            <h4 style="margin-bottom: 0.5rem; margin-top: 1.5rem;">Depth Level</h4>
            <div class="color-palette">
              <div class="color-swatch" style="background:#ffffff;" data-color="#ffffff" title="Near (White)"></div>
              <div class="color-swatch" style="background:#c0c0c0;" data-color="#c0c0c0" title="Mid-Near"></div>
              <div class="color-swatch active" style="background:#808080;" data-color="#808080" title="Mid-Ground (Gray)"></div>
              <div class="color-swatch" style="background:#404040;" data-color="#404040" title="Mid-Far"></div>
              <div class="color-swatch" style="background:#000000;" data-color="#000000" title="Far (Black)"></div>
              <div class="color-swatch" style="background:#222; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:bold; width: auto; padding:0 0.5rem; height:30px;" id="swatch-eraser">Eraser</div>
            </div>
            
            <div class="depth-tips">
              <strong>How it works:</strong><br>
              - <strong>White</strong> strokes draw details that shift <strong>closer</strong> to the viewer.<br>
              - <strong>Black</strong> strokes draw elements that shift <strong>deeper</strong> background.<br>
              - <strong>Gray (#808080)</strong> represents the steady plane.<br>
              - Use high softness (blur) for smoother transitions, low softness for sharp edge cutouts.
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Wire up events
    document.getElementById('input-brush-size').addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
      document.getElementById('label-brush-size').textContent = `${this.brushSize}px`;
      this.updateBrushPreview();
    });
    
    document.getElementById('input-brush-opacity').addEventListener('input', (e) => {
      this.brushOpacity = parseInt(e.target.value) / 100;
      document.getElementById('label-brush-opacity').textContent = `${Math.round(this.brushOpacity*100)}%`;
      this.updateBrushPreview();
    });
    
    document.getElementById('input-brush-softness').addEventListener('input', (e) => {
      this.brushSoftness = parseInt(e.target.value);
      document.getElementById('label-brush-softness').textContent = `${this.brushSoftness}px`;
      this.updateBrushPreview();
    });
    
    // Swatches
    const swatches = this.container.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        
        if (swatch.id === 'swatch-eraser') {
          this.isEraser = true;
        } else {
          this.isEraser = false;
          this.brushColor = swatch.getAttribute('data-color');
        }
        this.updateBrushPreview();
      });
    });
    
    // Header buttons
    document.getElementById('btn-painter-clear').addEventListener('click', () => this.clearCanvas());
    document.getElementById('btn-painter-cancel').addEventListener('click', () => this.close());
    document.getElementById('btn-painter-save').addEventListener('click', () => this.save());
    
    this.updateBrushPreview();
  }

  updateBrushPreview() {
    const preview = document.getElementById('brush-preview');
    if (!preview) return;
    
    preview.style.width = `${this.brushSize}px`;
    preview.style.height = `${this.brushSize}px`;
    
    if (this.isEraser) {
      preview.style.background = 'transparent';
      preview.style.border = '2px dashed #ff4444';
      preview.style.boxShadow = 'none';
    } else {
      preview.style.border = '1px solid var(--glass-border)';
      preview.style.background = this.brushColor;
      preview.style.opacity = this.brushOpacity;
      // Shadow blur simulation
      preview.style.boxShadow = `0 0 ${this.brushSoftness}px ${this.brushColor}`;
    }
  }

  initCanvases() {
    this.bgCanvas = document.getElementById('painter-base-canvas');
    this.drawCanvas = document.getElementById('painter-draw-canvas');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.drawCtx = this.drawCanvas.getContext('2d');
    
    const bgImage = new Image();
    bgImage.crossOrigin = 'anonymous';
    bgImage.onload = () => {
      // Fit to screen width/height nicely
      const container = document.getElementById('painter-canvas-container');
      const containerRect = container.getBoundingClientRect();
      
      const aspect = bgImage.naturalWidth / bgImage.naturalHeight;
      let w = bgImage.naturalWidth;
      let h = bgImage.naturalHeight;
      
      const maxW = containerRect.width - 40;
      const maxH = containerRect.height - 40;
      
      if (w > maxW) {
        w = maxW;
        h = w / aspect;
      }
      if (h > maxH) {
        h = maxH;
        w = h * aspect;
      }
      
      // Set sizes
      const wrapper = document.getElementById('painter-canvas-wrapper');
      wrapper.style.width = `${w}px`;
      wrapper.style.height = `${h}px`;
      
      this.bgCanvas.width = w;
      this.bgCanvas.height = h;
      this.drawCanvas.width = w;
      this.drawCanvas.height = h;
      
      // Draw background
      this.bgCtx.drawImage(bgImage, 0, 0, w, h);
      
      // Load initial depth or fill middle gray
      if (this.initialDepthDataUrl) {
        const depthImg = new Image();
        depthImg.onload = () => {
          this.drawCtx.drawImage(depthImg, 0, 0, w, h);
        };
        depthImg.src = this.initialDepthDataUrl;
      } else {
        this.clearCanvas();
      }
      
      this.setupDrawingEvents();
    };
    bgImage.src = this.bgImageUrl;
  }

  clearCanvas() {
    const ctx = this.drawCtx;
    ctx.fillStyle = '#808080'; // middle gray (steady/flat plane)
    ctx.fillRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
  }

  setupDrawingEvents() {
    const getPos = (e) => {
      const rect = this.drawCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const draw = (pos) => {
      const ctx = this.drawCtx;
      
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      // Soft brush setup using drop shadows or linear gradient
      ctx.shadowBlur = this.brushSoftness;
      ctx.lineWidth = this.brushSize;
      
      if (this.isEraser) {
        // Eraser in depth paint resets to middle ground gray (#808080)
        ctx.strokeStyle = '#808080';
        ctx.shadowColor = '#808080';
        ctx.globalAlpha = 1.0;
      } else {
        ctx.strokeStyle = this.brushColor;
        ctx.shadowColor = this.brushColor;
        ctx.globalAlpha = this.brushOpacity;
      }
      
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      
      // Reset shadow so it doesn't slow down subsequent drawing
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    };

    const startDraw = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = getPos(e);
      this.drawCtx.beginPath();
      this.drawCtx.moveTo(pos.x, pos.y);
      draw(pos);
    };

    const continueDraw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      draw(pos);
    };

    const stopDraw = () => {
      this.isDrawing = false;
    };
    
    // Mouse
    this.drawCanvas.addEventListener('mousedown', startDraw);
    this.drawCanvas.addEventListener('mousemove', continueDraw);
    window.addEventListener('mouseup', stopDraw);
    
    // Touch
    this.drawCanvas.addEventListener('touchstart', startDraw, { passive: false });
    this.drawCanvas.addEventListener('touchmove', continueDraw, { passive: false });
    window.addEventListener('touchend', stopDraw);
    
    // Track references to clean up
    this.drawingListeners = { startDraw, continueDraw, stopDraw };
  }

  save() {
    // Generate data URL of drawing canvas
    const depthDataUrl = this.drawCanvas.toDataURL();
    if (this.onSave) {
      this.onSave(depthDataUrl);
    }
    this.close();
  }

  close() {
    // Cleanup listeners
    if (this.drawingListeners) {
      this.drawCanvas.removeEventListener('mousedown', this.drawingListeners.startDraw);
      this.drawCanvas.removeEventListener('mousemove', this.drawingListeners.continueDraw);
      window.removeEventListener('mouseup', this.drawingListeners.stopDraw);
      
      this.drawCanvas.removeEventListener('touchstart', this.drawingListeners.startDraw);
      this.drawCanvas.removeEventListener('touchmove', this.drawingListeners.continueDraw);
      window.removeEventListener('touchend', this.drawingListeners.stopDraw);
    }
    
    this.container.innerHTML = '';
  }
}
