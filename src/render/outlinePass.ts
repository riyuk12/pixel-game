import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Renders the scene (colour + depth + normals) and draws pixel-art borders:
 *  - a dark one-pixel outline on the near side of every silhouette (depth jump),
 *  - a light highlight along convex creases (normal change), like hand-drawn pixel art.
 * Depth is linearised so it works with orthographic and perspective cameras alike.
 */
export class OutlinePass extends Pass {
  outline = 0.78; // how dark the outline is (0..1)
  highlight = 0.45; // how bright crease highlights are
  depthThreshold = 0.35; // metres of depth jump that counts as a silhouette
  thickness = 2; // outline width in low-res pixels (1 or 2)

  private beauty = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  private normals = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  private normalMaterial = new THREE.MeshNormalMaterial();
  private swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
  private hidden: THREE.Object3D[] = [];

  /** Depth and normals of the last frame, shared with the ambient-occlusion pass. */
  get depthTexture() {
    return this.beauty.depthTexture!;
  }
  get normalTexture() {
    return this.normals.texture;
  }
  private quad: FullScreenQuad;
  private material: THREE.ShaderMaterial;

  constructor(private scene: THREE.Scene, public camera: THREE.Camera) {
    super();
    this.beauty.depthTexture = new THREE.DepthTexture(1, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        tNormal: { value: null },
        resolution: { value: new THREE.Vector4() },
        near: { value: 0.1 },
        far: { value: 1000 },
        ortho: { value: true },
        outline: { value: 0 },
        highlight: { value: 0 },
        depthThreshold: { value: 0 },
        thickness: { value: 2 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform sampler2D tNormal;
        uniform vec4 resolution;
        uniform float near;
        uniform float far;
        uniform bool ortho;
        uniform float outline;
        uniform float highlight;
        uniform float depthThreshold;
        uniform float thickness;
        varying vec2 vUv;

        float depthAt(vec2 uv) {
          float d = texture2D(tDepth, uv).r;
          if (ortho) return near + d * (far - near);
          float z = d * 2.0 - 1.0;
          return (2.0 * near * far) / (far + near - z * (far - near));
        }
        vec3 normalAt(vec2 uv) { return texture2D(tNormal, uv).rgb * 2.0 - 1.0; }

        void main() {
          vec4 colour = texture2D(tDiffuse, vUv);
          float d = depthAt(vUv);
          vec3 n = normalAt(vUv);
          vec2 px = resolution.zw;
          vec2 offs[4] = vec2[4](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));

          // Silhouette: some neighbour is clearly further away, so this pixel is the near object's border.
          // With thickness 2 the search also reaches two pixels out and to the diagonals.
          vec2 wide[8] = vec2[8](vec2(2.0, 0.0), vec2(-2.0, 0.0), vec2(0.0, 2.0), vec2(0.0, -2.0),
                                 vec2(1.0, 1.0), vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(-1.0, -1.0));
          float edge = 0.0;
          float jump = depthThreshold + d * 0.015;
          for (int i = 0; i < 4; i++) edge = max(edge, step(jump, depthAt(vUv + offs[i] * px) - d));
          if (thickness > 1.5) {
            for (int i = 0; i < 8; i++) edge = max(edge, step(jump, depthAt(vUv + wide[i] * px) - d));
          }

          // Crease highlight: normals turn, and the neighbour is not in front (convex edge).
          float crease = 0.0;
          if (edge < 0.5) {
            for (int i = 0; i < 4; i++) {
              vec2 uv2 = vUv + offs[i] * px;
              vec3 nn = normalAt(uv2);
              float facing = clamp(smoothstep(-0.01, 0.01, dot(n - nn, vec3(1.0, 1.0, 1.0))), 0.0, 1.0);
              float notInFront = clamp(sign((depthAt(uv2) - d) + 0.05), 0.0, 1.0);
              crease += (1.0 - dot(n, nn)) * facing * notInFront;
            }
            crease = clamp(crease * 1.5, 0.0, 1.0);
          }

          vec3 c = colour.rgb;
          c = mix(c, c * (1.0 + highlight) + highlight * 0.04, step(0.25, crease));
          c = mix(c, c * (1.0 - outline), edge);
          gl_FragColor = vec4(c, colour.a);
        }
      `,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(width: number, height: number) {
    this.beauty.setSize(width, height);
    this.normals.setSize(width, height);
    this.material.uniforms.resolution.value.set(width, height, 1 / width, 1 / height);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    const cam = this.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const u = this.material.uniforms;
    Object.assign(u.near, { value: cam.near });
    Object.assign(u.far, { value: cam.far });
    u.ortho.value = (cam as THREE.OrthographicCamera).isOrthographicCamera === true;
    u.outline.value = this.outline;
    u.highlight.value = this.highlight;
    u.depthThreshold.value = this.depthThreshold;
    u.thickness.value = this.thickness;

    renderer.setRenderTarget(this.beauty);
    renderer.render(this.scene, cam);
    // Normal pass: swap materials per mesh (buildings use their own cut-aware normals); effects are skipped.
    this.scene.traverse((o) => {
      if (o.userData.fx && o.visible) {
        o.visible = false;
        this.hidden.push(o);
        return;
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.Material;
      this.swapped.push([mesh, mesh.material]);
      mesh.material = m.userData?.normal ?? this.normalMaterial;
    });
    renderer.setRenderTarget(this.normals);
    renderer.render(this.scene, cam);
    for (const [mesh, m] of this.swapped) mesh.material = m;
    for (const o of this.hidden) o.visible = true;
    this.swapped.length = 0;
    this.hidden.length = 0;

    u.tDiffuse.value = this.beauty.texture;
    u.tDepth.value = this.beauty.depthTexture;
    u.tNormal.value = this.normals.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}
