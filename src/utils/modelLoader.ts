import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { ModelStats } from '../types/three-app.ts';

export interface LoadedGlbResult {
  gltf: GLTF;
  stats: ModelStats;
  rootObject: THREE.Group;
}

// Reusable loader with DRACO support
function createConfiguredLoader(): GLTFLoader {
  const loader = new GLTFLoader();

  try {
    const dracoLoader = new DRACOLoader();
    // Use official Google Draco decoder CDN (v1.5.7)
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    loader.setDRACOLoader(dracoLoader);
  } catch (e) {
    console.warn('Could not initialize DRACOLoader:', e);
  }

  return loader;
}

/**
 * Parses an ArrayBuffer of a GLB/GLTF into a Three.js GLTF object
 */
export async function loadGlbFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  fileName = 'model.glb',
  fileSize = 0
): Promise<LoadedGlbResult> {
  const loader = createConfiguredLoader();

  return new Promise((resolve, reject) => {
    try {
      loader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          try {
            const stats = analyzeGlb(gltf, fileName, fileSize || arrayBuffer.byteLength);
            resolve({
              gltf,
              stats,
              rootObject: gltf.scene,
            });
          } catch (statError) {
            console.warn('Non-fatal error analyzing stats:', statError);
            resolve({
              gltf,
              stats: {
                fileName,
                fileSizeBytes: fileSize || arrayBuffer.byteLength,
                triangles: 0,
                vertices: 0,
                meshesCount: 1,
                materialsCount: 1,
                texturesCount: 0,
                animationsCount: gltf.animations?.length || 0,
                hasBones: false,
                boundingBox: { width: 1, height: 1, depth: 1 },
              },
              rootObject: gltf.scene,
            });
          }
        },
        (error) => {
          console.error('GLTF parse error:', error);
          reject(new Error(error?.message || 'Błąd parsowania pliku GLB'));
        }
      );
    } catch (parseErr: any) {
      reject(new Error(parseErr?.message || 'Nieoczekiwany błąd odczytu pliku 3D'));
    }
  });
}

/**
 * Parses an uploaded GLB/GLTF File into a Three.js GLTF object
 * and gathers comprehensive technical metadata safely.
 */
export async function loadGlbFromFile(file: File): Promise<LoadedGlbResult> {
  const arrayBuffer = await file.arrayBuffer();
  return loadGlbFromArrayBuffer(arrayBuffer, file.name, file.size);
}

/**
 * Loads a GLB from a URL (e.g. public folder or remote)
 */
export async function loadGlbFromUrl(url: string, fileName = 'model.glb'): Promise<LoadedGlbResult> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      return loadGlbFromArrayBuffer(buffer, fileName, buffer.byteLength);
    }
  } catch {
    // proceed to standard loader fallback
  }

  const loader = createConfiguredLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        try {
          const stats = analyzeGlb(gltf, fileName, 0);
          resolve({
            gltf,
            stats,
            rootObject: gltf.scene,
          });
        } catch {
          resolve({
            gltf,
            stats: {
              fileName,
              fileSizeBytes: 0,
              triangles: 0,
              vertices: 0,
              meshesCount: 1,
              materialsCount: 1,
              texturesCount: 0,
              animationsCount: gltf.animations?.length || 0,
              hasBones: false,
              boundingBox: { width: 1, height: 1, depth: 1 },
            },
            rootObject: gltf.scene,
          });
        }
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
}

/**
 * Analyzes geometry, materials, animations and dimensions of a GLTF scene
 */
export function analyzeGlb(gltf: GLTF, fileName: string, fileSizeBytes: number): ModelStats {
  let triangles = 0;
  let vertices = 0;
  let meshesCount = 0;
  const materials = new Set<string>();
  const textures = new Set<string>();
  let hasBones = false;

  if (gltf.scene) {
    gltf.scene.traverse((node: THREE.Object3D) => {
      if (node instanceof THREE.Mesh) {
        meshesCount++;
        const geometry = node.geometry;

        if (geometry) {
          if (geometry.index) {
            triangles += geometry.index.count / 3;
          } else if (geometry.attributes && geometry.attributes.position) {
            triangles += geometry.attributes.position.count / 3;
          }

          if (geometry.attributes && geometry.attributes.position) {
            vertices += geometry.attributes.position.count;
          }
        }

        if (node.material) {
          const matList = Array.isArray(node.material) ? node.material : [node.material];
          matList.forEach((mat) => {
            if (mat) {
              materials.add(mat.uuid || mat.name || `mat_${materials.size}`);
              const anyMat = mat as any;
              ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((mapProp) => {
                if (anyMat && anyMat[mapProp] && anyMat[mapProp].uuid) {
                  textures.add(anyMat[mapProp].uuid);
                }
              });
            }
          });
        }
      }

      if (node instanceof THREE.Bone || (node as any).isBone) {
        hasBones = true;
      }
    });
  }

  // Calculate Bounding Box safely
  let width = 1;
  let height = 1;
  let depth = 1;

  try {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    if (!box.isEmpty() && isFinite(box.min.x) && isFinite(box.max.x)) {
      const size = new THREE.Vector3();
      box.getSize(size);
      width = Number(size.x.toFixed(2));
      height = Number(size.y.toFixed(2));
      depth = Number(size.z.toFixed(2));
    }
  } catch (boxErr) {
    console.warn('Could not calculate box size:', boxErr);
  }

  return {
    fileName,
    fileSizeBytes,
    triangles: Math.round(triangles),
    vertices,
    meshesCount: Math.max(meshesCount, 1),
    materialsCount: Math.max(materials.size, 1),
    texturesCount: textures.size,
    animationsCount: gltf.animations ? gltf.animations.length : 0,
    animationNames: gltf.animations ? gltf.animations.map((a) => a.name || 'Animacja') : [],
    hasBones,
    boundingBox: {
      width,
      height,
      depth,
    },
  };
}

/**
 * Centers model at origin and adjusts scale so it fits nicely in view,
 * with safeguards against NaN, Infinity and zero dimensions.
 */
export function fitModelToCamera(
  model: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls?: any
): { center: THREE.Vector3; radius: number } {
  try {
    const box = new THREE.Box3().setFromObject(model);

    if (box.isEmpty() || !isFinite(box.min.x) || !isFinite(box.max.x)) {
      camera.position.set(0, 1.5, 3);
      camera.lookAt(0, 0, 0);
      if (controls) {
        controls.target.set(0, 0, 0);
        controls.update();
      }
      return { center: new THREE.Vector3(0, 0, 0), radius: 1 };
    }

    const center = new THREE.Vector3();
    box.getCenter(center);

    // Offset model so its center sits at (0, 0, 0)
    model.position.x -= center.x;
    model.position.y -= center.y;
    model.position.z -= center.z;

    // After offset, compute ground position so model rests right on top of grid (y = 0)
    const updatedBox = new THREE.Box3().setFromObject(model);
    if (isFinite(updatedBox.min.y)) {
      model.position.y -= updatedBox.min.y;
    }

    const size = new THREE.Vector3();
    updatedBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.05);
    const radius = maxDim / 2;

    const fov = (camera.fov || 45) * (Math.PI / 180);
    let cameraZ = Math.abs(radius / Math.sin(fov / 2));
    cameraZ = Math.max(cameraZ * 1.5, 0.5);

    camera.position.set(cameraZ * 0.8, cameraZ * 0.6, cameraZ);
    camera.near = Math.max(maxDim / 1000, 0.01);
    camera.far = Math.max(maxDim * 1000, 100);
    camera.updateProjectionMatrix();

    if (controls) {
      const targetY = isFinite(size.y) ? size.y / 2 : 0;
      controls.target.set(0, targetY, 0);
      controls.maxDistance = cameraZ * 10;
      controls.minDistance = Math.max(maxDim / 100, 0.05);
      controls.update();
    }

    return { center: new THREE.Vector3(0, size.y / 2, 0), radius };
  } catch (err) {
    console.error('Error fitting model to camera:', err);
    camera.position.set(3, 2, 5);
    camera.lookAt(0, 0, 0);
    return { center: new THREE.Vector3(0, 0, 0), radius: 1 };
  }
}
