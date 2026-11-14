/**
 * Face-paint Spider-Man mask: a tiny raw WebGL2 renderer that draws ONE textured triangle mesh
 * (MediaPipe's 468-vertex face mesh) on a transparent canvas stacked over the <video>.
 * Vertex positions = the tracker's face landmarks every frame; texture coordinates = a
 * thin-plate-spline warp of the mesh UVs onto the mask drawing, computed once at load.
 * It does NOT run inference. Load it with a dynamic `import()` only when the user enables it.
 *
 * MIRRORING: the video is shown mirrored (CSS `transform: scaleX(-1)`). Landmarks come from
 * the un-mirrored camera image, so this canvas gets the same `scaleX(-1)` to stay aligned.
 */
import type { FaceFrame } from '../vision/tracker';
import mesh from './faceMesh.json';
import { maskTexCoords, spidermanAnchors } from './maskMapping';
import { MESH_VERTICES, smoothVertices, toClipSpace } from './vertices';

/** Weight of the newest frame in the vertex smoothing (1 = raw landmarks, lower = steadier). */
export const SMOOTHING = 0.5;

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uMask;
out vec4 color;
void main() {
  color = texture(uMask, vUv); // premultiplied alpha
}`;

interface GlResources {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  positions: WebGLBuffer;
  uvs: WebGLBuffer;
  indices: WebGLBuffer;
  texture: WebGLTexture;
}

export class FaceFilter {
  private visible = true;
  private drawn = false;
  private disposed = false;
  private contextLost = false;
  private needsResize = true;
  private cssSize = { w: 0, h: 0 };
  private readonly raw = new Float32Array(MESH_VERTICES * 2);
  private smoothed: Float32Array | null = null;
  private readonly observer: ResizeObserver;
  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly res: GlResources,
    private readonly canvas: HTMLCanvasElement,
  ) {
    canvas.style.transform = 'scaleX(-1)';
    this.cssSize = { w: canvas.clientWidth, h: canvas.clientHeight }; // one read; then the observer
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box) return;
      this.cssSize = { w: box.width, h: box.height };
      this.needsResize = true;
    });
    this.observer.observe(canvas);
  }

  static async load(canvas: HTMLCanvasElement, url: string): Promise<FaceFilter> {
    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false,
    });
    if (!gl) throw new Error('Tu navegador no puede mostrar el filtro: no tiene WebGL2 (gráficos 3D) disponible.');
    try {
      const image = await loadImage(url);
      return new FaceFilter(gl, createResources(gl, image), canvas);
    } catch (e) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      throw e;
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) this.hide();
  }

  /** Call once per face result. `null` (no face) hides the mask and resets smoothing. */
  update(face: FaceFrame | null): void {
    if (this.disposed || this.contextLost) return;
    if (face === null || !this.visible) {
      this.hide();
      return;
    }
    toClipSpace(face.landmarks, this.raw);
    this.smoothed = smoothVertices(this.smoothed, this.raw, SMOOTHING);
    this.draw(this.smoothed);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    const { gl, res } = this;
    if (!this.contextLost) {
      gl.deleteVertexArray(res.vao);
      for (const b of [res.positions, res.uvs, res.indices]) gl.deleteBuffer(b);
      gl.deleteTexture(res.texture);
      gl.deleteProgram(res.program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.canvas.style.transform = '';
  }

  private hide(): void {
    this.smoothed = null;
    if (!this.drawn || this.disposed || this.contextLost) return;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.drawn = false;
  }

  private draw(positions: Float32Array): void {
    const { gl, res } = this;
    this.applyResize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(res.program);
    gl.bindVertexArray(res.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.positions);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    gl.drawElements(gl.TRIANGLES, mesh.triangles.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
    this.drawn = true;
  }

  /** Match the drawing buffer to the size the ResizeObserver reported (no per-frame layout reads). */
  private applyResize(): void {
    if (!this.needsResize) return;
    this.needsResize = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.cssSize.w * dpr));
    const h = Math.max(1, Math.round(this.cssSize.h * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    throw new Error(`No se pudo cargar la imagen de la máscara (${url}).`);
  }
  return img;
}

function createResources(gl: WebGL2RenderingContext, image: HTMLImageElement): GlResources {
  const program = linkProgram(gl);
  const vao = gl.createVertexArray();
  const positions = gl.createBuffer();
  const uvs = gl.createBuffer();
  const indices = gl.createBuffer();
  const texture = gl.createTexture();
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, positions);
  gl.bufferData(gl.ARRAY_BUFFER, MESH_VERTICES * 2 * 4, gl.DYNAMIC_DRAW);
  bindAttribute(gl, program, 'aPos');

  gl.bindBuffer(gl.ARRAY_BUFFER, uvs);
  gl.bufferData(gl.ARRAY_BUFFER, maskTexCoords(mesh.uv, spidermanAnchors(mesh.uv)), gl.STATIC_DRAW);
  bindAttribute(gl, program, 'aUv');

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); // stays bound to the VAO
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(mesh.triangles), gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // texcoord y=0 is the top row of the image
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, 'uMask'), 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied: transparent texels paint nothing
  // Triangles are CCW for a face seen from the front; when the head turns, the far side folds
  // over and becomes CW, so culling it stops it painting over the near side.
  gl.enable(gl.CULL_FACE);
  gl.frontFace(gl.CCW);
  gl.cullFace(gl.BACK);
  gl.clearColor(0, 0, 0, 0);
  return { program, vao, positions, uvs, indices, texture };
}

function bindAttribute(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): void {
  const loc = gl.getAttribLocation(program, name);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

function linkProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  const shaders = ([[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, FRAGMENT_SHADER]] as const)
    .map(([type, source]) => {
      const s = gl.createShader(type);
      if (!s) throw new Error('No se pudo crear el sombreador del filtro.');
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(`Error al compilar el sombreador del filtro: ${gl.getShaderInfoLog(s) ?? ''}`);
      }
      gl.attachShader(program, s);
      return s;
    });
  gl.linkProgram(program);
  for (const s of shaders) gl.deleteShader(s); // flagged; freed with the program
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Error al enlazar el programa del filtro: ${gl.getProgramInfoLog(program) ?? ''}`);
  }
  return program;
}
