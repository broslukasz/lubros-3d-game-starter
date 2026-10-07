import * as THREE from 'three';

/**
 * Calculates smooth rolling hills elevation at coordinate (x, z).
 * Flattens out near origin (0,0) so character spawns comfortably.
 */
export function getTerrainHeight(x: number, z: number): number {
  // Gentle rolling waves
  const hill1 = Math.sin(x * 0.045) * Math.cos(z * 0.045) * 2.2;
  const hill2 = Math.sin(x * 0.08 + 1.2) * Math.sin(z * 0.07 + 0.8) * 1.1;
  const ridge = Math.cos(x * 0.02 - z * 0.02) * 1.4;

  const rawHeight = hill1 + hill2 + ridge;

  // Flatten the spawn clearing in the center (radius ~10 meters)
  const distFromCenter = Math.hypot(x, z);
  const spawnDamping = Math.min(Math.max((distFromCenter - 4) / 10, 0), 1);

  return rawHeight * spawnDamping;
}

/**
 * World Obstacles with physical dimensions for collision detection
 */
export interface WorldObstacle {
  x: number;
  z: number;
  radius: number; // Collision boundary radius
  height: number; // Height of obstacle above ground
  type: 'tree' | 'rock';
}

export const WORLD_OBSTACLES: WorldObstacle[] = [
  // Trees (balanced natural distance ~ 1.15m)
  { x: 18, z: -16, radius: 0.65, height: 7.0, type: 'tree' },
  { x: -22, z: -14, radius: 0.65, height: 7.0, type: 'tree' },
  { x: 26, z: 12, radius: 0.68, height: 7.0, type: 'tree' },
  { x: -18, z: 22, radius: 0.65, height: 7.0, type: 'tree' },
  { x: 35, z: -25, radius: 0.68, height: 7.0, type: 'tree' },
  { x: -32, z: -28, radius: 0.68, height: 7.0, type: 'tree' },
  { x: 8, z: 32, radius: 0.65, height: 7.0, type: 'tree' },
  { x: -10, z: -35, radius: 0.65, height: 7.0, type: 'tree' },
  { x: 40, z: 18, radius: 0.68, height: 7.0, type: 'tree' },

  // Boulders & Rocks (balanced distance ~ 1.55m, can stand on top)
  { x: 12, z: 6, radius: 1.1, height: 1.1, type: 'rock' },
  { x: -14, z: 8, radius: 1.1, height: 1.1, type: 'rock' },
  { x: 7, z: -12, radius: 1.1, height: 1.1, type: 'rock' },
  { x: -8, z: -18, radius: 1.1, height: 1.1, type: 'rock' },
];

/**
 * Resolves collisions against all trees and rocks.
 * Prevents passing through obstacles and pushes character smoothly outside.
 */
export function resolveObstacleCollisions(
  x: number,
  z: number,
  y: number,
  charRadius: number
): { x: number; z: number; obstacleGroundY: number } {
  let resolvedX = x;
  let resolvedZ = z;
  let obstacleGroundY = -999;

  // Balanced character collision body buffer (~0.45m - 0.55m)
  const effectiveBodyRadius = Math.min(Math.max(charRadius * 0.45, 0.45), 0.55);

  for (const obs of WORLD_OBSTACLES) {
    const terrainBaseY = getTerrainHeight(obs.x, obs.z);
    const obstacleTopY = terrainBaseY + obs.height;

    const dx = resolvedX - obs.x;
    const dz = resolvedZ - obs.z;
    const dist = Math.hypot(dx, dz);
    const minDistance = obs.radius + effectiveBodyRadius;

    // Check if character is landing on top of a rock
    if (obs.type === 'rock' && dist < obs.radius + 0.35 && y >= obstacleTopY - 0.4) {
      if (obstacleTopY > obstacleGroundY) {
        obstacleGroundY = obstacleTopY;
      }
      continue;
    }

    // If character is below obstacle top and penetrates the boundary:
    if (y < obstacleTopY && dist < minDistance) {
      if (dist > 0.001) {
        const penetration = minDistance - dist;
        resolvedX += (dx / dist) * penetration;
        resolvedZ += (dz / dist) * penetration;
      } else {
        resolvedX += minDistance;
      }
    }
  }

  return { x: resolvedX, z: resolvedZ, obstacleGroundY };
}

/**
 * Procedurally generates a lush grass texture with grass blades and natural hue variation.
 */
export function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base lush grass gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#2d6a4f');
  grad.addColorStop(0.5, '#40916c');
  grad.addColorStop(1, '#1b4332');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Grass blades
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 3 + Math.random() * 7;
    const hue = Math.random() > 0.35 ? '#52b788' : '#74c69d';
    ctx.strokeStyle = hue;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y - len);
    ctx.stroke();
  }

  // Golden sunset flecks / daisies
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? '#fef08a' : '#ffffff';
    ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(32, 32);
  return texture;
}

/**
 * Builds the rolling hilly grass terrain, setting sunset sun, blue sky dome,
 * and decorative trees/rocks.
 */
export function buildNatureEnvironment(scene: THREE.Scene): {
  terrainMesh: THREE.Mesh;
  sunMesh: THREE.Mesh;
  updateWind: (time: number, playerPos?: THREE.Vector3) => void;
  cleanup: () => void;
} {
  const group = new THREE.Group();
  group.name = 'NatureSunsetEnvironment';

  // 1. SKY DOME (Deep blue sky transitioning into golden sunset horizon)
  const skyGeo = new THREE.SphereGeometry(180, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x1d4ed8) }, // deep rich blue
      midColor: { value: new THREE.Color(0x38bdf8) }, // sky azure blue
      horizonColor: { value: new THREE.Color(0xfde047) }, // sunset golden warmth
      sunPosition: { value: new THREE.Vector3(-80, 20, -100).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 sunPosition;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normPos = normalize(vWorldPosition);
        float h = max(normPos.y, 0.0);

        // Sky gradient from horizon to zenith
        vec3 sky = mix(horizonColor, midColor, smoothstep(0.0, 0.25, h));
        sky = mix(sky, topColor, smoothstep(0.25, 0.85, h));

        // Sun disc & glow
        float sunDot = max(dot(normPos, sunPosition), 0.0);
        float sunGlow = pow(sunDot, 6.0) * 0.7;
        float sunDisc = step(0.995, sunDot) * 1.5;

        vec3 finalColor = sky + vec3(1.0, 0.85, 0.4) * (sunGlow + sunDisc);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });

  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  // 2. SETTING SUN (Soft glowing disc near the horizon)
  const sunPos = new THREE.Vector3(-80, 18, -100);

  const sunGeo = new THREE.SphereGeometry(7, 24, 24);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.copy(sunPos);
  group.add(sunMesh);

  // Sunset Sun Corona / Halo
  const haloGeo = new THREE.RingGeometry(7, 20, 32);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.copy(sunPos);
  haloMesh.lookAt(0, 0, 0);
  group.add(haloMesh);

  // 3. HILLY GRASS TERRAIN
  const terrainSize = 140;
  const segments = 100;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = getTerrainHeight(x, z);
    posAttr.setY(i, y);
  }
  terrainGeo.computeVertexNormals();

  const grassTex = createGrassTexture();
  const terrainMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 0.85,
    metalness: 0.1,
    flatShading: false,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // 4. SCATTERED NATURE PROPS (Trees and Boulders with solid physics)
  const treeWoodMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
  const treeFoliageMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.7,
    flatShading: true,
  });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });

  // Place trees
  const trees = WORLD_OBSTACLES.filter((o) => o.type === 'tree');
  trees.forEach((treeObs, i) => {
    const y = getTerrainHeight(treeObs.x, treeObs.z);
    const scale = 0.85 + (i % 3) * 0.2;

    const tree = new THREE.Group();
    tree.position.set(treeObs.x, y, treeObs.z);
    tree.scale.set(scale, scale, scale);

    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.5, 8), treeWoodMat);
    trunk.position.y = 1.25;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Foliage cones (pine tree look)
    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.2, 8), treeFoliageMat);
    cone1.position.y = 3.5;
    cone1.castShadow = true;
    tree.add(cone1);

    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 8), treeFoliageMat);
    cone2.position.y = 5.0;
    cone2.castShadow = true;
    tree.add(cone2);

    group.add(tree);
  });

  // Place Rocks & Boulders
  const rocks = WORLD_OBSTACLES.filter((o) => o.type === 'rock');
  rocks.forEach((rockObs) => {
    const y = getTerrainHeight(rockObs.x, rockObs.z);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), rockMat);
    rock.position.set(rockObs.x, y + 0.45, rockObs.z);
    rock.rotation.set(0.2, 0.4, 0.1);
    rock.scale.set(1.2, 0.8, 1.2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  });

  scene.add(group);

  return {
    terrainMesh,
    sunMesh,
    updateWind: () => {},
    cleanup: () => {
      scene.remove(group);
      terrainGeo.dispose();
      terrainMat.dispose();
      grassTex.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      sunGeo.dispose();
      sunMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
    },
  };
}
