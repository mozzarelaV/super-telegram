/* ==========================================================================
   AuraBook 3D - Three.js WebGL 3D Book Simulator
   ========================================================================== */

export class Reader3D {
  constructor(container, pages, startIndex = 0, onPageChange = null) {
    this.container = container;
    this.pages = pages;
    this.currentIndex = startIndex; // Current double-page spread index (left page = currentIndex * 2, right = left + 1)
    this.onPageChange = onPageChange;
    
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    
    // Page dimensions in 3D units
    this.pageWidth = 4.2;
    this.pageHeight = 6.0;
    this.spineWidth = 0.2;
    
    this.textures = {};
    this.isAnimating = false;
    this.isDestroyed = false;
    
    this.initThree();
    this.initBook();
    this.setupEvents();
    this.updatePages(true);
  }

  initThree() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07070a);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 8, 10); // Look down at book
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    
    // Orbit Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 15;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below table
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);
    
    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.3); // Warm indigo tint
    fillLight.position.set(-8, 5, -3);
    this.scene.add(fillLight);
  }

  // Create text page texture by rendering text to a 2D canvas
  createTextTexture(text, title) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1440; // Book aspect ratio (approx 1:1.4)
    const ctx = canvas.getContext('2d');
    
    // Background (book paper color)
    ctx.fillStyle = '#fbf9f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Book page details (soft lines, side shadows)
    const grad = ctx.createLinearGradient(0, 0, 80, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 80, canvas.height);
    
    // Margins
    const marginL = 100;
    const marginR = 100;
    const marginT = 120;
    const maxW = canvas.width - marginL - marginR;
    
    // Draw Header
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(title ? title.toUpperCase() : 'AETHERBOOK', marginL, marginT - 40);
    
    // Divider line
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginL, marginT - 20);
    ctx.lineTo(canvas.width - marginR, marginT - 20);
    ctx.stroke();
    
    // Wrap text lines
    ctx.fillStyle = '#1e293b';
    ctx.font = '36px "Montserrat", "Nanum Gothic", sans-serif';
    
    const lines = [];
    const paragraphs = text.split('\n');
    const lineHeight = 56;
    
    for (let p of paragraphs) {
      if (p.trim() === '') {
        lines.push('');
        continue;
      }
      
      let words = p.split(' ');
      let currentLine = '';
      
      for (let w of words) {
        let testLine = currentLine + w + ' ';
        let metrics = ctx.measureText(testLine);
        if (metrics.width > maxW) {
          lines.push(currentLine.trim());
          currentLine = w + ' ';
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine.trim());
    }
    
    // Draw text
    let y = marginT + 30;
    for (let line of lines) {
      if (y > canvas.height - 100) break; // page bounds
      if (line !== '') {
        ctx.fillText(line, marginL, y);
      }
      y += lineHeight;
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }

  // Load image texture helper
  loadImageTexture(url) {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = 'anonymous';
      loader.load(
        url,
        (tex) => {
          tex.minFilter = THREE.LinearFilter;
          resolve(tex);
        },
        undefined,
        () => {
          // Fallback to error canvas texture
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#1e1b4b';
          ctx.fillRect(0,0,512,512);
          ctx.fillStyle = '#fff';
          ctx.font = '24px sans-serif';
          ctx.fillText('Image Load Error', 100, 256);
          resolve(new THREE.CanvasTexture(canvas));
        }
      );
    });
  }

  // Get texture for a page index
  async getPageTexture(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      // Empty white page texture
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fbf9f5';
      ctx.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(canvas);
    }
    
    const cacheKey = `p_${pageIndex}`;
    if (this.textures[cacheKey]) return this.textures[cacheKey];
    
    const page = this.pages[pageIndex];
    let tex;
    if (page.type === 'image' && page.imageUrl) {
      // We apply filters inside storage/editor. This imageUrl might already contain filters.
      tex = await this.loadImageTexture(page.imageUrl);
    } else {
      tex = this.createTextTexture(page.text || '', page.title || `Page ${pageIndex + 1}`);
    }
    
    this.textures[cacheKey] = tex;
    return tex;
  }

  initBook() {
    this.bookGroup = new THREE.Group();
    this.scene.add(this.bookGroup);
    
    // 1. Cover Mesh
    const coverGeo = new THREE.BoxGeometry(this.pageWidth * 2 + this.spineWidth + 0.1, 0.08, this.pageHeight + 0.1);
    const coverMat = new THREE.MeshStandardMaterial({ 
      color: 0x0f0f18, 
      roughness: 0.8,
      metalness: 0.1 
    });
    this.coverMesh = new THREE.Mesh(coverGeo, coverMat);
    this.coverMesh.position.y = -0.05;
    this.coverMesh.receiveShadow = true;
    this.bookGroup.add(this.coverMesh);
    
    // 2. Left Page Mesh (Steady background)
    // Segmented horizontally (width) to allow folding bends
    const pageGeo = new THREE.PlaneGeometry(this.pageWidth, this.pageHeight, 15, 1);
    
    this.leftMat = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      side: THREE.DoubleSide
    });
    this.leftPageMesh = new THREE.Mesh(pageGeo, this.leftMat);
    // Align left page hinge to the center spine
    this.leftPageMesh.geometry.translate(-this.pageWidth / 2, 0, 0);
    this.leftPageMesh.position.set(-this.spineWidth / 2, 0.05, 0);
    this.leftPageMesh.rotation.x = -Math.PI / 2; // Flat on table
    this.leftPageMesh.castShadow = true;
    this.leftPageMesh.receiveShadow = true;
    this.bookGroup.add(this.leftPageMesh);
    
    // 3. Right Page Mesh (Steady background)
    this.rightMat = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      side: THREE.DoubleSide
    });
    this.rightPageMesh = new THREE.Mesh(pageGeo, this.rightMat);
    this.rightPageMesh.geometry.translate(this.pageWidth / 2, 0, 0);
    this.rightPageMesh.position.set(this.spineWidth / 2, 0.05, 0);
    this.rightPageMesh.rotation.x = -Math.PI / 2;
    this.rightPageMesh.castShadow = true;
    this.rightPageMesh.receiveShadow = true;
    this.bookGroup.add(this.rightPageMesh);
    
    // 4. Flipping Page Mesh (Dynamic turning sheet)
    const flipGeo = new THREE.PlaneGeometry(this.pageWidth, this.pageHeight, 20, 1);
    // Move geometry vertices so hinge is at X=0
    flipGeo.translate(this.pageWidth / 2, 0, 0);
    
    // Multi-materials: 0 for front, 1 for back
    this.flipMatFront = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide });
    this.flipMatBack = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide });
    
    // Create double-sided page using two meshes facing opposite directions or custom shaders.
    // In Three.js, a single PlaneGeometry with different materials on front/back can be modeled
    // by using a Group with two planes back-to-back, or custom material index.
    // Back-to-back planes is easiest and robust:
    this.flipGroup = new THREE.Group();
    
    const fMesh = new THREE.Mesh(flipGeo, this.flipMatFront);
    fMesh.castShadow = true;
    fMesh.receiveShadow = true;
    
    // Back side needs to face the opposite way and be translated slightly to avoid Z-fighting
    const bGeo = flipGeo.clone();
    bGeo.rotateY(Math.PI); // Flip texture horizontally
    const bMesh = new THREE.Mesh(bGeo, this.flipMatBack);
    bMesh.position.y = -0.002; // Thin separation
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    
    this.flipGroup.add(fMesh);
    this.flipGroup.add(bMesh);
    
    this.flipGroup.position.set(this.spineWidth / 2, 0.07, 0);
    this.flipGroup.rotation.x = -Math.PI / 2;
    this.flipGroup.visible = false; // Hidden when not flipping
    
    this.bookGroup.add(this.flipGroup);
    
    // Keep reference to vertices for bend deformations
    this.flipGeometryOriginalVertices = [];
    const pos = flipGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      this.flipGeometryOriginalVertices.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
  }

  setupEvents() {
    this.resizeHandler = () => {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    };
    window.addEventListener('resize', this.resizeHandler);
    
    // Start render loop
    this.animate();
  }

  async updatePages(immediate = false) {
    // Left page index = currentIndex * 2
    // Right page index = currentIndex * 2 + 1
    const leftIdx = this.currentIndex * 2;
    const rightIdx = leftIdx + 1;
    
    const leftTex = await this.getPageTexture(leftIdx);
    const rightTex = await this.getPageTexture(rightIdx);
    
    this.leftMat.map = leftTex;
    this.leftMat.needsUpdate = true;
    
    this.rightMat.map = rightTex;
    this.rightMat.needsUpdate = true;
    
    if (this.onPageChange) {
      // Return details
      this.onPageChange(leftIdx, this.pages.length);
    }
  }

  // Animate page turn
  async flipPage(direction) {
    if (this.isAnimating) return;
    
    const nextSpread = this.currentIndex + (direction === 'next' ? 1 : -1);
    if (nextSpread < 0 || nextSpread * 2 >= this.pages.length) return; // Out of bounds
    
    this.isAnimating = true;
    this.flipGroup.visible = true;
    
    let startAngle = 0; // Starts flat on right
    let endAngle = -Math.PI; // Ends flat on left
    
    let frontTexIndex, backTexIndex;
    
    if (direction === 'next') {
      // Turning page from right to left
      // Front of turning page is the current right page
      // Back of turning page is the next left page
      frontTexIndex = this.currentIndex * 2 + 1;
      backTexIndex = nextSpread * 2;
      
      startAngle = 0;
      endAngle = -Math.PI;
      
      // Temporary hide the right page background texture since we are turning it
      const nextRightTex = await this.getPageTexture(nextSpread * 2 + 1);
      this.rightMat.map = nextRightTex;
      this.rightMat.needsUpdate = true;
    } else {
      // Turning page from left to right
      // Front of turning page is the next right page
      // Back of turning page is the current left page
      frontTexIndex = this.currentIndex * 2;
      backTexIndex = nextSpread * 2 + 1;
      
      startAngle = -Math.PI;
      endAngle = 0;
      
      // Temporary hide the left page background texture since we are turning it
      const nextLeftTex = await this.getPageTexture(nextSpread * 2);
      this.leftMat.map = nextLeftTex;
      this.leftMat.needsUpdate = true;
      
      // Set initial rotation of turning page
      this.flipGroup.position.x = -this.spineWidth / 2;
    }
    
    const frontTex = await this.getPageTexture(frontTexIndex);
    const backTex = await this.getPageTexture(backTexIndex);
    
    this.flipMatFront.map = frontTex;
    this.flipMatFront.needsUpdate = true;
    
    this.flipMatBack.map = backTex;
    this.flipMatBack.needsUpdate = true;
    
    const duration = 900; // ms
    const startTime = performance.now();
    
    const performFlip = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Ease in-out
      const t = progress < 0.5 ? 2 * t * t : -1 + (4 - 2 * progress) * progress; // smooth interpolation
      const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
      
      const currentAngle = startAngle + (endAngle - startAngle) * easeProgress;
      this.flipGroup.rotation.z = currentAngle; // Rotate page Y/Z axis
      
      // Apply bend warp to page geometries based on rotation angle!
      // Sinusoidal bend that is maximum when page is vertical (angle = -PI/2)
      const bendMax = 0.8;
      const bendFactor = Math.sin(easeProgress * Math.PI) * bendMax * (direction === 'next' ? 1 : -1);
      
      this.flipGroup.children.forEach(mesh => {
        const posAttr = mesh.geometry.attributes.position;
        const count = posAttr.count;
        
        for (let i = 0; i < count; i++) {
          const origV = this.flipGeometryOriginalVertices[i];
          // Scale bend relative to X (hinge is at X=0, edges bend more)
          const normalizedX = origV.x / this.pageWidth;
          const bendZ = Math.sin(normalizedX * Math.PI) * bendFactor;
          
          posAttr.setZ(i, origV.z + bendZ);
        }
        posAttr.needsUpdate = true;
      });
      
      if (progress < 1) {
        requestAnimationFrame(performFlip);
      } else {
        // Animation end
        this.currentIndex = nextSpread;
        this.flipGroup.visible = false;
        
        // Reset positions
        this.flipGroup.position.set(this.spineWidth / 2, 0.07, 0);
        this.flipGroup.rotation.z = 0;
        
        // Render updated base layers
        this.updatePages(true);
        this.isAnimating = false;
      }
    };
    
    requestAnimationFrame(performFlip);
  }

  animate() {
    if (this.isDestroyed) return;
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    
    requestAnimationFrame(() => this.animate());
  }

  destroy() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.resizeHandler);
    this.controls.dispose();
    this.renderer.dispose();
    
    // Dispose textures
    Object.values(this.textures).forEach(tex => tex.dispose());
    
    // Remove element
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
