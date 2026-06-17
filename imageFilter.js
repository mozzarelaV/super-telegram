/* ==========================================================================
   AuraBook 3D - Image Processing Filters
   ========================================================================== */

export const ImageFilters = {
  // Convert image to Canvas
  imageToCanvas(img, width = img.naturalWidth, height = img.naturalHeight) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return { canvas, ctx };
  },

  // Apply a filter by name and return DataURL
  async applyFilter(imgUrl, filterName) {
    if (!filterName || filterName === 'none') return imgUrl;
    
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const { canvas, ctx } = this.imageToCanvas(img);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        let resultCanvas;
        switch (filterName) {
          case 'sketch':
            resultCanvas = this.applySketch(canvas, imageData);
            break;
          case 'pixel':
            resultCanvas = this.applyPixel(canvas, imageData);
            break;
          case 'ascii':
            resultCanvas = this.applyAscii(canvas, imageData);
            break;
          case 'glitch':
            resultCanvas = this.applyGlitch(canvas, imageData);
            break;
          case 'halftone':
            resultCanvas = this.applyHalftone(canvas, imageData);
            break;
          case 'anaglyph':
            resultCanvas = this.applyAnaglyph(canvas, imageData);
            break;
          default:
            resultCanvas = canvas;
        }
        resolve(resultCanvas.toDataURL());
      };
      img.onerror = () => resolve(imgUrl);
      img.src = imgUrl;
    });
  },

  // Grayscale helper
  getLuminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  },

  // 1. Sketch Filter (Sobel Edge Detection)
  applySketch(canvas, imageData) {
    const w = canvas.width;
    const h = canvas.height;
    const data = imageData.data;
    
    const output = document.createElement('canvas');
    output.width = w;
    output.height = h;
    const oCtx = output.getContext('2d');
    const oImageData = oCtx.createImageData(w, h);
    const oData = oImageData.data;
    
    // Grayscale buffer
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = this.getLuminance(data[i], data[i+1], data[i+2]);
    }
    
    // Sobel kernels
    // Gx: [-1, 0, 1, -2, 0, 2, -1, 0, 1]
    // Gy: [-1, -2, -1, 0, 0, 0, 1, 2, 1]
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        
        const g00 = gray[(y-1)*w + (x-1)];
        const g01 = gray[(y-1)*w + x];
        const g02 = gray[(y-1)*w + (x+1)];
        const g10 = gray[y*w + (x-1)];
        const g12 = gray[y*w + (x+1)];
        const g20 = gray[(y+1)*w + (x-1)];
        const g21 = gray[(y+1)*w + x];
        const g22 = gray[(y+1)*w + (x+1)];
        
        const gx = -g00 + g02 - 2*g10 + 2*g12 - g20 + g22;
        const gy = -g00 - 2*g01 - g02 + g20 + 2*g21 + g22;
        
        let magnitude = Math.sqrt(gx * gx + gy * gy);
        
        // Invert & threshold edge to look like pencil lines on white paper
        magnitude = Math.min(255, magnitude * 1.5);
        let val = 255 - magnitude;
        if (val > 230) val = 255; // Clean highlights
        else if (val < 50) val = 30; // Deep shadows
        
        const oIdx = idx * 4;
        oData[oIdx] = val;     // R
        oData[oIdx+1] = val;   // G
        oData[oIdx+2] = val;   // B
        oData[oIdx+3] = 255;   // A
      }
    }
    
    oCtx.putImageData(oImageData, 0, 0);
    return output;
  },

  // 2. Pixel Art Filter
  applyPixel(canvas, imageData) {
    const w = canvas.width;
    const h = canvas.height;
    
    // Calculate pixel scale based on width (aim for ~128px width retro block size)
    const scale = Math.max(4, Math.floor(w / 128));
    
    const output = document.createElement('canvas');
    output.width = w;
    output.height = h;
    const oCtx = output.getContext('2d');
    
    const smallCanvas = document.createElement('canvas');
    const sw = Math.floor(w / scale);
    const sh = Math.floor(h / scale);
    smallCanvas.width = sw;
    smallCanvas.height = sh;
    const sCtx = smallCanvas.getContext('2d');
    
    // Draw small downscaled
    sCtx.drawImage(canvas, 0, 0, sw, sh);
    const sImageData = sCtx.getImageData(0, 0, sw, sh);
    const sData = sImageData.data;
    
    // Quantize colors (8-bit palette lock: divide RGB by 32, scale back to 255)
    for (let i = 0; i < sData.length; i += 4) {
      sData[i] = Math.round(sData[i] / 36) * 36;       // R
      sData[i+1] = Math.round(sData[i+1] / 36) * 36;   // G
      sData[i+2] = Math.round(sData[i+2] / 48) * 48;   // B (more blue bias for retro screen look)
    }
    sCtx.putImageData(sImageData, 0, 0);
    
    // Render back with nearest-neighbor interpolation
    oCtx.imageSmoothingEnabled = false;
    oCtx.msImageSmoothingEnabled = false;
    oCtx.drawImage(smallCanvas, 0, 0, w, h);
    
    return output;
  },

  // 3. ASCII Art Filter (Renders ASCII directly to image canvas)
  applyAscii(canvas, imageData) {
    const w = canvas.width;
    const h = canvas.height;
    const data = imageData.data;
    
    const output = document.createElement('canvas');
    output.width = w;
    output.height = h;
    const oCtx = output.getContext('2d');
    
    oCtx.fillStyle = '#0b0b0f'; // Dark base matching app background
    oCtx.fillRect(0, 0, w, h);
    
    // Char resolution
    const charW = 7;
    const charH = 10;
    
    oCtx.font = `bold ${charH}px monospace`;
    oCtx.textAlign = 'left';
    oCtx.textBaseline = 'top';
    
    const chars = '@#NW$9876543210?!abc;:+=-,._ '.split('');
    
    for (let y = 0; y < h; y += charH) {
      for (let x = 0; x < w; x += charW) {
        // Average color in block
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        
        for (let cy = 0; cy < charH && y + cy < h; cy++) {
          for (let cx = 0; cx < charW && x + cx < w; cx++) {
            const idx = ((y + cy) * w + (x + cx)) * 4;
            sumR += data[idx];
            sumG += data[idx+1];
            sumB += data[idx+2];
            count++;
          }
        }
        
        const r = sumR / count;
        const g = sumG / count;
        const b = sumB / count;
        const brightness = this.getLuminance(r, g, b);
        
        // Map brightness to char index
        const charIdx = Math.floor((brightness / 255) * (chars.length - 1));
        const char = chars[charIdx];
        
        // Draw character in matching color
        oCtx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        oCtx.fillText(char, x, y);
      }
    }
    
    return output;
  },

  // 4. Glitch Filter (Horizontal offset slices + RGB shift)
  applyGlitch(canvas, imageData) {
    const w = canvas.width;
    const h = canvas.height;
    
    const output = document.createElement('canvas');
    output.width = w;
    output.height = h;
    const oCtx = output.getContext('2d');
    
    // 1. Draw RGB shifted background
    oCtx.drawImage(canvas, 0, 0);
    const bgData = oCtx.getImageData(0, 0, w, h);
    const bgPixels = bgData.data;
    
    const shift = Math.floor(w * 0.015); // Shift value
    const shiftedData = oCtx.createImageData(w, h);
    const shPixels = shiftedData.data;
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const currentIdx = (y * w + x) * 4;
        
        // Shift red channel left
        const rX = Math.max(0, x - shift);
        const rIdx = (y * w + rX) * 4;
        
        // Shift cyan channel (blue + green) right
        const cX = Math.min(w - 1, x + shift);
        const cIdx = (y * w + cX) * 4;
        
        shPixels[currentIdx] = bgPixels[rIdx];         // Red channel
        shPixels[currentIdx+1] = bgPixels[cIdx+1];     // Green channel
        shPixels[currentIdx+2] = bgPixels[cIdx+2];     // Blue channel
        shPixels[currentIdx+3] = 255;
      }
    }
    oCtx.putImageData(shiftedData, 0, 0);
    
    // 2. Add horizontal slice distortions (random slices)
    const numSlices = 10;
    for (let i = 0; i < numSlices; i++) {
      const sliceY = Math.random() * h;
      const sliceH = Math.random() * (h * 0.08) + 10;
      const sliceOffset = (Math.random() - 0.5) * (w * 0.08);
      
      oCtx.drawImage(
        canvas, 
        0, sliceY, w, sliceH,                 // Source
        sliceOffset, sliceY, w, sliceH        // Destination
      );
    }
    
    // 3. Add random noise overlays
    oCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 5; i++) {
      const nX = Math.random() * w;
      const nY = Math.random() * h;
      const nW = Math.random() * (w * 0.2) + 20;
      const nH = Math.random() * 15 + 5;
      oCtx.fillRect(nX, nY, nW, nH);
    }
    
    return output;
  },

  // 5. Halftone Filter (Grayscale dots scaling)
  applyHalftone(canvas, imageData) {
    const w = canvas.width;
    const h = canvas.height;
    const data = imageData.data;
    
    const output = document.createElement('canvas');
    output.width = w;
    output.height = h;
    const oCtx = output.getContext('2d');
    
    oCtx.fillStyle = '#faf9f6'; // Clean cream paper background
    oCtx.fillRect(0, 0, w, h);
    oCtx.fillStyle = '#1c1917'; // Ink color
    
    const dotSize = 8; // Grid cell size
    const maxRadius = (dotSize * Math.SQRT2) / 2;
    
    for (let y = 0; y < h; y += dotSize) {
      for (let x = 0; x < w; x += dotSize) {
        // Average brightness of cell
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        
        for (let cy = 0; cy < dotSize && y + cy < h; cy++) {
          for (let cx = 0; cx < dotSize && x + cx < w; cx++) {
            const idx = ((y + cy) * w + (x + cx)) * 4;
            sumR += data[idx];
            sumG += data[idx+1];
            sumB += data[idx+2];
            count++;
          }
        }
        
        const brightness = this.getLuminance(sumR / count, sumG / count, sumB / count);
        
        // Darkness determines radius (darker = larger dot)
        const darkness = 1 - (brightness / 255);
        const radius = darkness * maxRadius;
        
        if (radius > 0.5) {
          oCtx.beginPath();
          oCtx.arc(x + dotSize/2, y + dotSize/2, radius, 0, Math.PI * 2);
          oCtx.fill();
        }
      }
    }
    
    return output;
  },

  // 6. Anaglyph 3D Filter (Red-Cyan Stereo Splitting)
  applyAnaglyph(canvas, imageData) {
    const w = canvas.width;
    const h = canvas.height;
    const pixels = imageData.data;
    
    const output = document.createElement('canvas');
    output.width = w;
    output.height = h;
    const oCtx = output.getContext('2d');
    
    const resultImageData = oCtx.createImageData(w, h);
    const oPixels = resultImageData.data;
    
    const shift = 8; // Pixel offset for stereo depth
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const currentIdx = (y * w + x) * 4;
        
        // Left channel shift (Red)
        const leftX = Math.max(0, x - shift);
        const leftIdx = (y * w + leftX) * 4;
        
        // Right channel shift (Cyan = Green + Blue)
        const rightX = Math.min(w - 1, x + shift);
        const rightIdx = (y * w + rightX) * 4;
        
        oPixels[currentIdx] = pixels[leftIdx];           // R from left-shifted
        oPixels[currentIdx+1] = pixels[rightIdx+1];       // G from right-shifted
        oPixels[currentIdx+2] = pixels[rightIdx+2];       // B from right-shifted
        oPixels[currentIdx+3] = pixels[currentIdx+3];     // A original alpha
      }
    }
    
    oCtx.putImageData(resultImageData, 0, 0);
    return output;
  }
};
