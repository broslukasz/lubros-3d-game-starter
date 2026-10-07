import * as THREE from 'three';

export interface ModelStats {
  fileName: string;
  fileSizeBytes: number;
  triangles: number;
  vertices: number;
  meshesCount: number;
  materialsCount: number;
  texturesCount: number;
  animationsCount: number;
  animationNames?: string[];
  hasBones: boolean;
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
}

export type LightingPreset = 'studio' | 'cyberpunk' | 'daylight' | 'sunset' | 'darkroom';

export interface ViewerSettings {
  autoRotate: boolean;
  autoRotateSpeed: number;
  wireframe: boolean;
  showGrid: boolean;
  showAxes: boolean;
  showBoundingBox: boolean;
  lightingPreset: LightingPreset;
  exposure: number;
  backgroundColor: string;
  shadows: boolean;
  metalnessMultiplier: number;
  roughnessMultiplier: number;
}
