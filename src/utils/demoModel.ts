import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ModelStats } from '../types/three-app.ts';
import { analyzeGlb } from './modelLoader.ts';

/**
 * Creates a lightweight demo scene in memory for users to test
 * before uploading their own custom GLB.
 */
export function createDemoScene(): { gltf: GLTF; stats: ModelStats } {
  const scene = new THREE.Group();
  scene.name = 'Demo_Test_Object';

  // Core geometric mesh
  const coreGeo = new THREE.IcosahedronGeometry(1.2, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    metalness: 0.85,
    roughness: 0.2,
    name: 'Demo_Cyan_Metal',
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.name = 'CoreGeometry';
  coreMesh.position.y = 0.5;
  scene.add(coreMesh);

  // Outer orbital ring
  const ringGeo = new THREE.TorusGeometry(1.8, 0.05, 16, 48);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x818cf8,
    metalness: 0.9,
    roughness: 0.3,
    emissive: 0x4f46e5,
    emissiveIntensity: 0.5,
    name: 'Demo_Ring_Material',
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 3;
  ringMesh.name = 'OrbitalRing';
  scene.add(ringMesh);

  // Base platform
  const baseGeo = new THREE.CylinderGeometry(1.4, 1.6, 0.2, 16);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.5,
    roughness: 0.5,
    name: 'Demo_Base_Platform',
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = -1.0;
  baseMesh.name = 'BasePedestal';
  scene.add(baseMesh);

  // Simple keyframe rotation animation
  const times = [0, 2, 4];
  const qInitial = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
  const qMid = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const qEnd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 2);
  const values = [
    qInitial.x, qInitial.y, qInitial.z, qInitial.w,
    qMid.x, qMid.y, qMid.z, qMid.w,
    qEnd.x, qEnd.y, qEnd.z, qEnd.w,
  ];
  const track = new THREE.QuaternionKeyframeTrack('CoreGeometry.quaternion', times, values);
  const clip = new THREE.AnimationClip('Demo_Spin_Action', 4, [track]);

  const fakeGltf: GLTF = {
    scene,
    scenes: [scene],
    cameras: [],
    animations: [clip],
    asset: { version: '2.0', generator: 'Test Preview' },
    parser: {} as any,
    userData: {},
  };

  const stats = analyzeGlb(fakeGltf, 'model_testowy_demo.glb', 124800);

  return { gltf: fakeGltf, stats };
}
