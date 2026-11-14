/**
 * Thin three.js adapter for the Spider-Man mask. Draws on a transparent WebGL
 * canvas stacked over the <video>. It does NOT run inference: it consumes the
 * FaceFrame produced by the tracker. Load it with a dynamic `import()` only
 * when the user enables the filter so three.js stays out of the main bundle.
 *
 * MIRRORING: the video is shown mirrored (CSS `transform: scaleX(-1)`). MediaPipe
 * reports the pose in the un-mirrored camera image, so this canvas gets the same
 * `scaleX(-1)` to stay aligned with the face. Do not also mirror it from CSS.
 *
 * Scene mirrors PianoVirtual.py (crear_escena_3d): camera at the origin looking
 * down -Z, vertical FOV 63, near 1, far 10000; model centred and scaled to a
 * 2-unit box; pose = smoothed head matrix @ bind matrix.
 */
import {
  AmbientLight, Box3, DirectionalLight, Group, Matrix4, Mesh, PerspectiveCamera, Scene,
  SRGBColorSpace, Vector3, WebGLRenderer, type Material, type Object3D, type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { FaceFrame } from '../vision/tracker';
import { bindMatrix, smoothPose } from './pose';

export const CAMERA = { fovDeg: 63, near: 1, far: 10000 } as const;

export class FaceFilter {
  private pose: Float32Array | null = null;
  private visible = true;
  private readonly bind = new Matrix4().fromArray(bindMatrix());
  private readonly work = new Matrix4();

  private constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly holder: Group,
    private readonly canvas: HTMLCanvasElement,
  ) {
    holder.visible = false;
  }

  static async load(canvas: HTMLCanvasElement, url: string): Promise<FaceFilter> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);

    // Centre and scale to a 2-unit box, like cargar_modelo_3d.
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    const normalised = new Group();
    gltf.scene.position.sub(box.getCenter(new Vector3()));
    normalised.add(gltf.scene);
    normalised.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
    // The Python treats every drawn pixel as fully opaque (ignores material alpha).
    gltf.scene.traverse(makeOpaque);

    const holder = new Group();
    holder.matrixAutoUpdate = false; // we write the pose matrix directly
    holder.add(normalised);

    const scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 0.45), holder);
    for (const [intensity, x] of [[3, 20], [2, -20]] as const) {
      // pyrender lights keep an identity rotation, so both shine along -Z.
      const light = new DirectionalLight(0xffffff, intensity);
      light.position.set(x, 20, 40);
      light.target.position.set(x, 20, 0);
      scene.add(light, light.target);
    }

    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    canvas.style.transform = 'scaleX(-1)';

    const camera = new PerspectiveCamera(CAMERA.fovDeg, 1, CAMERA.near, CAMERA.far);
    const filter = new FaceFilter(renderer, scene, camera, holder, canvas);
    filter.resize();
    return filter;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) {
      this.holder.visible = false;
      this.renderer.clear();
    }
  }

  /** Call once per face result. `null` (no face) hides the mask and resets smoothing. */
  update(face: FaceFrame | null): void {
    if (face === null || !this.visible) {
      this.pose = null;
      this.holder.visible = false;
      this.renderer.clear();
      return;
    }
    this.pose = smoothPose(this.pose, face.matrix);
    this.holder.matrix.fromArray(this.pose).multiply(this.work.copy(this.bind));
    this.holder.matrixWorldNeedsUpdate = true; // matrixAutoUpdate is off
    this.holder.visible = true;
    this.resize();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.scene.traverse((o: Object3D) => {
      if (!(o instanceof Mesh)) return;
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) disposeMaterial(m);
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.style.transform = '';
  }

  /** Keep the drawing buffer and camera aspect in sync with the displayed size. */
  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(w, h, false);
    }
    const aspect = w / h;
    if (this.camera.aspect !== aspect) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
  }
}

function makeOpaque(o: Object3D): void {
  if (!(o instanceof Mesh)) return;
  for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    m.transparent = false;
    m.alphaTest = 0;
    m.depthWrite = true;
  }
}

function disposeMaterial(m: Material): void {
  for (const v of Object.values(m)) if (isTexture(v)) v.dispose();
  m.dispose();
}

const isTexture = (v: unknown): v is Texture => (v as Texture | null)?.isTexture === true;
