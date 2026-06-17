/* ==========================================================================
   AuraBook 3D - WebGL 3D Depth-Parallax Shader Engine
   ========================================================================== */

const VERTEX_SHADER_SOURCE = `
  attribute vec2 position;
  varying vec2 v_texCoord;
  void main() {
    v_texCoord = position * 0.5 + 0.5;
    v_texCoord.y = 1.0 - v_texCoord.y; // Flip Y for canvas coords
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform sampler2D u_depthMap;
  uniform vec2 u_mouseOffset;
  uniform vec2 u_threshold;

  void main() {
    // Read depth value (grayscale, take Red channel)
    float depth = texture2D(u_depthMap, v_texCoord).r;
    
    // Displace texture coordinate based on mouse offset and depth
    // We center the depth around 0.5 so white moves forward, black moves backward
    vec2 displacement = u_mouseOffset * (depth - 0.5) * u_threshold;
    vec2 displacedCoord = v_texCoord + displacement;
    
    // Clamp coordinates to prevent texture edge wrapping artifacts
    displacedCoord = clamp(displacedCoord, 0.001, 0.999);
    
    gl_FragColor = texture2D(u_image, displacedCoord);
  }
`;

export class Parallax3DEngine {
  constructor(container, imageUrl, depthMapUrl = '') {
    this.container = container;
    this.imageUrl = imageUrl;
    this.depthMapUrl = depthMapUrl;
    
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.container.appendChild(this.canvas);
    
    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    if (!this.gl) {
      console.error('WebGL is not supported in this browser.');
      this.showFallbackImage();
      return;
    }
    
    // Mouse tracking variables
    this.targetMouse = { x: 0, y: 0 };
    this.currentMouse = { x: 0, y: 0 };
    this.lerpSpeed = 0.08; // Smoothing factor
    this.threshold = { x: 0.03, y: 0.03 }; // Max displacement scale
    
    this.animationFrameId = null;
    this.isDestroyed = false;
    
    this.initWebGL();
    this.loadTextures();
    this.setupEvents();
  }

  showFallbackImage() {
    const img = document.createElement('img');
    img.src = this.imageUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    this.container.appendChild(img);
  }

  initWebGL() {
    const gl = this.gl;
    
    // Create shader program
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Failed to link program:', gl.getProgramInfoLog(this.program));
      return;
    }
    
    // Setup full-screen quad vertex buffer (-1 to 1)
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Get locations
    this.positionLocation = gl.getAttribLocation(this.program, 'position');
    this.imageLocation = gl.getUniformLocation(this.program, 'u_image');
    this.depthMapLocation = gl.getUniformLocation(this.program, 'u_depthMap');
    this.mouseOffsetLocation = gl.getUniformLocation(this.program, 'u_mouseOffset');
    this.thresholdLocation = gl.getUniformLocation(this.program, 'u_threshold');
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Failed to compile shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  loadTextures() {
    const gl = this.gl;
    
    // 1. Load Main Image Texture
    this.imageTexture = gl.createTexture();
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (this.isDestroyed) return;
      this.resizeCanvas(image.naturalWidth, image.naturalHeight);
      this.bindTexture(this.imageTexture, image, 0);
      this.imageLoaded = true;
      this.checkAndStartRender();
    };
    image.src = this.imageUrl;
    
    // 2. Load Depth Map Texture
    this.depthTexture = gl.createTexture();
    if (this.depthMapUrl) {
      const depthMap = new Image();
      depthMap.crossOrigin = 'anonymous';
      depthMap.onload = () => {
        if (this.isDestroyed) return;
        this.bindTexture(this.depthTexture, depthMap, 1);
        this.depthLoaded = true;
        this.checkAndStartRender();
      };
      depthMap.src = this.depthMapUrl;
    } else {
      // Generate fallback linear gradient depth map (top = far/black, bottom = near/white)
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#000000'); // top is black (far)
      grad.addColorStop(1, '#ffffff'); // bottom is white (near)
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      
      this.bindTexture(this.depthTexture, canvas, 1);
      this.depthLoaded = true;
      this.checkAndStartRender();
    }
  }

  bindTexture(texture, source, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Set texture wrapping and filtering parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // Upload image data to GPU
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  resizeCanvas(imgWidth, imgHeight) {
    const rect = this.container.getBoundingClientRect();
    
    // Maintain aspect ratio inside container
    const containerRatio = rect.width / rect.height;
    const imgRatio = imgWidth / imgHeight;
    
    let w, h;
    if (imgRatio > containerRatio) {
      w = rect.width;
      h = rect.width / imgRatio;
    } else {
      h = rect.height;
      w = rect.height * imgRatio;
    }
    
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  checkAndStartRender() {
    if (this.imageLoaded && this.depthLoaded && !this.animationFrameId) {
      this.render();
    }
  }

  setupEvents() {
    this.mouseMoveHandler = (e) => {
      const rect = this.container.getBoundingClientRect();
      // Calculate normalized coordinates (-1 to 1)
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      
      this.targetMouse.x = x;
      this.targetMouse.y = y;
    };
    
    this.mouseLeaveHandler = () => {
      // Return slowly to center
      this.targetMouse.x = 0;
      this.targetMouse.y = 0;
    };

    this.resizeHandler = () => {
      if (this.imageLoaded) {
        const tempImg = new Image();
        tempImg.src = this.imageUrl;
        tempImg.onload = () => {
          this.resizeCanvas(tempImg.naturalWidth, tempImg.naturalHeight);
        };
      }
    };
    
    window.addEventListener('mousemove', this.mouseMoveHandler);
    this.container.addEventListener('mouseleave', this.mouseLeaveHandler);
    window.addEventListener('resize', this.resizeHandler);
  }

  render() {
    if (this.isDestroyed) return;
    
    const gl = this.gl;
    
    // Interpolate mouse movement for smooth transition
    this.currentMouse.x += (this.targetMouse.x - this.currentMouse.x) * this.lerpSpeed;
    this.currentMouse.y += (this.targetMouse.y - this.currentMouse.y) * this.lerpSpeed;
    
    // Clear screen
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Use program
    gl.useProgram(this.program);
    
    // Bind position attributes
    gl.enableVertexAttribArray(this.positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.uniform1i(this.imageLocation, 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    gl.uniform1i(this.depthMapLocation, 1);
    
    // Set uniforms
    gl.uniform2f(this.mouseOffsetLocation, -this.currentMouse.x, this.currentMouse.y);
    gl.uniform2f(this.thresholdLocation, this.threshold.x, this.threshold.y);
    
    // Draw quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    window.removeEventListener('mousemove', this.mouseMoveHandler);
    this.container.removeEventListener('mouseleave', this.mouseLeaveHandler);
    window.removeEventListener('resize', this.resizeHandler);
    
    const gl = this.gl;
    if (gl) {
      gl.deleteTexture(this.imageTexture);
      gl.deleteTexture(this.depthTexture);
      gl.deleteBuffer(this.vertexBuffer);
      gl.deleteProgram(this.program);
    }
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
