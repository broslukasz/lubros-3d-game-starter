import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  RotateCcw,
  Maximize2,
  Minimize2,
  Camera,
  Layers,
  Gamepad2,
  Sun,
  Film,
} from 'lucide-react';
import { getTerrainHeight, buildNatureEnvironment, resolveObstacleCollisions } from '../utils/terrainBuilder.ts';
import { VirtualJoystick, JoystickVector } from './VirtualJoystick.tsx';
import { CharacterAnimationController, AnimationDetectionInfo } from '../utils/characterAnimation.ts';

interface GlbViewerProps {
  gltfData: GLTF | null;
  fileName?: string;
  wireframe: boolean;
  onToggleWireframe: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  autoRotate?: boolean;
  onToggleAutoRotate?: () => void;
}

// Helper for shortest angle interpolation
function lerpAngle(start: number, end: number, t: number): number {
  const da = (end - start) % (Math.PI * 2);
  const diff = ((2 * da) % (Math.PI * 2)) - da;
  return start + diff * t;
}

export const GlbViewer: React.FC<GlbViewerProps> = ({
  gltfData,
  fileName = 'model.glb',
  wireframe,
  onToggleWireframe,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const characterRootRef = useRef<THREE.Group | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Character dimensions
  const characterHeightRef = useRef<number>(1.8);
  const characterRadiusRef = useRef<number>(1.0);

  // ==========================================
  // MOBILE GAME CHARACTER MOVEMENT & PHYSICS
  // ==========================================
  const joystickVectorRef = useRef<JoystickVector>({ x: 0, y: 0 });
  const keyboardKeysRef = useRef<{ [key: string]: boolean }>({});
  const isSprintingRef = useRef<boolean>(false);
  const [isSprinting, setIsSprinting] = useState<boolean>(false);

  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const verticalVelocityRef = useRef<number>(0);
  const isGroundedRef = useRef<boolean>(true);
  const lastGroundedTimeRef = useRef<number>(0);
  const cameraYawRef = useRef<number>(0); // Horizontal camera rotation
  const cameraPitchRef = useRef<number>(0.25); // Vertical camera tilt

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  // Character Skeletal Animation Controller (Walk / Run / Idle / Jump)
  const animControllerRef = useRef<CharacterAnimationController>(new CharacterAnimationController());
  const [animInfo, setAnimInfo] = useState<AnimationDetectionInfo | null>(null);

  // Prevent default window drag/drop
  useEffect(() => {
    const preventDrag = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventDrag);
    window.addEventListener('drop', preventDrag);
    return () => {
      window.removeEventListener('dragover', preventDrag);
      window.removeEventListener('drop', preventDrag);
    };
  }, []);

  // Desktop Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft'].includes(e.code)) {
        keyboardKeysRef.current[e.code] = true;
      }
      if (e.code === 'Space') {
        handleJump();
      }
      if (e.code === 'ShiftLeft') {
        isSprintingRef.current = true;
        setIsSprinting(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (keyboardKeysRef.current[e.code]) {
        delete keyboardKeysRef.current[e.code];
      }
      if (e.code === 'ShiftLeft') {
        isSprintingRef.current = false;
        setIsSprinting(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Jump action with responsive coyote-time window during running
  const handleJump = useCallback(() => {
    const now = clockRef.current.getElapsedTime();
    const canJump = isGroundedRef.current || (now - lastGroundedTimeRef.current < 0.22);
    if (canJump) {
      verticalVelocityRef.current = 10.0; // Jump upward impulse
      isGroundedRef.current = false;
      lastGroundedTimeRef.current = 0;
    }
  }, []);

  // Toggle sprint
  const handleToggleSprint = useCallback(() => {
    isSprintingRef.current = !isSprintingRef.current;
    setIsSprinting(isSprintingRef.current);
  }, []);

  // Reset player position to center spawn
  const handleResetPosition = useCallback(() => {
    const startY = getTerrainHeight(0, 0);
    playerPosRef.current.set(0, startY, 0);
    verticalVelocityRef.current = 0;
    isGroundedRef.current = true;
    cameraYawRef.current = 0;
    cameraPitchRef.current = 0.25;
    if (characterRootRef.current) {
      characterRootRef.current.position.set(0, startY, 0);
      characterRootRef.current.rotation.set(0, 0, 0);
    }
  }, []);

  // Camera swipe rotation handler
  const handleCameraRotate = useCallback((deltaX: number, deltaY: number) => {
    cameraYawRef.current -= deltaX * 0.006;
    cameraPitchRef.current = Math.max(0.05, Math.min(1.1, cameraPitchRef.current + deltaY * 0.004));
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = Math.max(containerRef.current.clientWidth || 800, 300);
    const height = Math.max(containerRef.current.clientHeight || 500, 300);

    // 1. Scene with soft atmospheric sunset blue fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x93c5fd, 0.007);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 3, 6);
    cameraRef.current = camera;

    // 3. Renderer with tone mapping & resilient fallback
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;
    } catch (e1) {
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: false,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(1);
        rendererRef.current = renderer;
      } catch (e2) {
        console.error('Failed to create WebGL context:', e2);
        setWebglSupported(false);
        return;
      }
    }

    // 4. LIGHTING: Setting Sun + Blue Sky Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x2d6a4f, 1.1);
    hemiLight.name = 'hemiLight';
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    sunLight.position.set(-80, 22, -100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 250;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.name = 'sunLight';
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xfef08a, 0.4);
    ambientLight.name = 'ambientLight';
    scene.add(ambientLight);

    // 5. BUILD NATURE ENVIRONMENT (Hilly Grass Terrain + Blue Sunset Sky Dome + Setting Sun)
    const natureEnv = buildNatureEnvironment(scene);

    // Generate lightweight, bulletproof sunset equirectangular reflection map
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 512;
    envCanvas.height = 256;
    const envCtx = envCanvas.getContext('2d');
    let envTexture: THREE.CanvasTexture | null = null;

    if (envCtx) {
      const grad = envCtx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, '#1e40af'); // Zenith blue
      grad.addColorStop(0.35, '#38bdf8'); // Sky azure
      grad.addColorStop(0.48, '#fde047'); // Golden horizon
      grad.addColorStop(0.55, '#f97316'); // Warm sunset glow
      grad.addColorStop(0.68, '#22c55e'); // Meadow green
      grad.addColorStop(1.0, '#14532d'); // Ground dark green
      envCtx.fillStyle = grad;
      envCtx.fillRect(0, 0, 512, 256);

      const sunGrad = envCtx.createRadialGradient(160, 125, 4, 160, 125, 40);
      sunGrad.addColorStop(0, '#ffffff');
      sunGrad.addColorStop(0.4, '#fef08a');
      sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      envCtx.fillStyle = sunGrad;
      envCtx.fillRect(100, 75, 120, 100);

      envTexture = new THREE.CanvasTexture(envCanvas);
      envTexture.mapping = THREE.EquirectangularReflectionMapping;
      envTexture.colorSpace = THREE.SRGBColorSpace;
      scene.environment = envTexture;
    }

    // 6. Touch Movement & Physics Loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min(clockRef.current.getDelta(), 0.08);
      const characterRoot = characterRootRef.current;

      if (characterRoot) {
        // Read Mobile Joystick + Keyboard inputs
        const joy = joystickVectorRef.current;
        const keys = keyboardKeysRef.current;

        let inputX = joy.x;
        let inputY = joy.y;

        if (keys['KeyW'] || keys['ArrowUp']) inputY += 1;
        if (keys['KeyS'] || keys['ArrowDown']) inputY -= 1;
        if (keys['KeyA'] || keys['ArrowLeft']) inputX -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) inputX += 1;

        const inputLen = Math.hypot(inputX, inputY);
        if (inputLen > 1) {
          inputX /= inputLen;
          inputY /= inputLen;
        }

        const isMoving = inputLen > 0.05;
        const speed = isSprintingRef.current ? 8.0 : 4.5;

        // Calculate move direction relative to camera horizontal yaw
        const yaw = cameraYawRef.current;
        const camForward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
        const camRight = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();

        const moveDir = new THREE.Vector3()
          .addScaledVector(camForward, inputY)
          .addScaledVector(camRight, inputX);

        let bob = 0;

        if (isMoving) {
          // Attempted new position
          const nextX = playerPosRef.current.x + moveDir.x * speed * delta;
          const nextZ = playerPosRef.current.z + moveDir.z * speed * delta;

          // Resolve obstacle collisions (Trees & Rocks block passage!)
          const collision = resolveObstacleCollisions(
            nextX,
            nextZ,
            playerPosRef.current.y,
            characterRadiusRef.current
          );

          playerPosRef.current.x = collision.x;
          playerPosRef.current.z = collision.z;

          // Smoothly rotate character to face movement direction
          const targetAngle = Math.atan2(moveDir.x, moveDir.z);
          characterRoot.rotation.y = lerpAngle(characterRoot.rotation.y, targetAngle, 0.2);

          // Stride bobbing: only applied if model has NO skeletal animation
          if (!animControllerRef.current.hasAnimations) {
            const bobFreq = isSprintingRef.current ? 16 : 10;
            bob = Math.abs(Math.sin(clockRef.current.getElapsedTime() * bobFreq)) * 0.08;
            characterRoot.rotation.z = Math.sin(clockRef.current.getElapsedTime() * bobFreq) * 0.03;
          } else {
            bob = 0;
            characterRoot.rotation.z = 0;
          }
        } else {
          // Keep character outside obstacles even when standing still
          const collision = resolveObstacleCollisions(
            playerPosRef.current.x,
            playerPosRef.current.z,
            playerPosRef.current.y,
            characterRadiusRef.current
          );
          playerPosRef.current.x = collision.x;
          playerPosRef.current.z = collision.z;
          characterRoot.rotation.z = 0;
        }

        // Update character locomotion animations (Idle / Walk / Run / Jump)
        animControllerRef.current.update(
          isMoving,
          isSprintingRef.current,
          isGroundedRef.current,
          delta
        );

        // Gravity and Jump
        verticalVelocityRef.current -= 24 * delta;
        playerPosRef.current.y += verticalVelocityRef.current * delta;

        // Elevation collision with rolling hilly terrain & standing on rocks
        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        const terrainHeight = getTerrainHeight(px, pz);
        const { obstacleGroundY } = resolveObstacleCollisions(
          px,
          pz,
          playerPosRef.current.y,
          characterRadiusRef.current
        );
        const effectiveGround = Math.max(terrainHeight, obstacleGroundY);

        if (playerPosRef.current.y <= effectiveGround + 0.08) {
          playerPosRef.current.y = effectiveGround;
          verticalVelocityRef.current = 0;
          isGroundedRef.current = true;
          lastGroundedTimeRef.current = clockRef.current.getElapsedTime();
        } else {
          isGroundedRef.current = false;
        }

        // Boundary limit to stay within the grassy landscape
        const distFromCenter = Math.hypot(px, pz);
        if (distFromCenter > 65) {
          const angle = Math.atan2(pz, px);
          playerPosRef.current.x = Math.cos(angle) * 65;
          playerPosRef.current.z = Math.sin(angle) * 65;
        }

        // Apply position to characterRoot (Feet rest precisely on ground!)
        characterRoot.position.x = playerPosRef.current.x;
        characterRoot.position.y = playerPosRef.current.y + bob;
        characterRoot.position.z = playerPosRef.current.z;

        // Third-Person Camera Follow
        const charHeight = characterHeightRef.current;
        const rad = characterRadiusRef.current;
        const camDist = Math.max(charHeight * 2.3, rad * 3.2, 3.2);
        const pitch = cameraPitchRef.current;
        const camHeight = Math.max(charHeight * 0.7, 1.4) + pitch * 1.8;

        const targetCamX = playerPosRef.current.x + Math.sin(yaw) * camDist;
        const targetCamZ = playerPosRef.current.z + Math.cos(yaw) * camDist;
        const targetCamY = playerPosRef.current.y + camHeight;

        camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.14);
        camera.lookAt(
          playerPosRef.current.x,
          playerPosRef.current.y + charHeight * 0.55,
          playerPosRef.current.z
        );
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      natureEnv.cleanup();
      animControllerRef.current.dispose();
      if (envTexture) envTexture.dispose();
      renderer.dispose();
    };
  }, []);

  // Load GLTF Model into scene with Grounding & Centering
  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !gltfData) return;

    const scene = sceneRef.current;

    // Remove old character if present
    if (characterRootRef.current) {
      scene.remove(characterRootRef.current);
      characterRootRef.current = null;
      animControllerRef.current.dispose();
      setAnimInfo(null);
    }

    try {
      const model = gltfData.scene;

      // Scale model to 70% of current size (0.7x)
      model.scale.set(0.7, 0.7, 0.7);

      // Enable shadows, apply wireframe state, and give materials a subtle mirror reflection of the surroundings
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              if (m) {
                m.wireframe = wireframe;

                // Make base model slightly a mirror of surrounding space
                if (m instanceof THREE.MeshStandardMaterial || (m as any).isMeshStandardMaterial) {
                  const stdMat = m as THREE.MeshStandardMaterial;
                  stdMat.roughness = 0.18; // smooth, polished mirror surface
                  stdMat.metalness = 0.48; // semi-metallic mirror reflectivity
                  stdMat.envMapIntensity = 2.2; // vibrant reflections of the sunset sky, sun and meadow
                  if ('clearcoat' in stdMat) {
                    (stdMat as any).clearcoat = 0.85; // glossy clearcoat glaze
                    (stdMat as any).clearcoatRoughness = 0.08;
                  }
                }

                m.needsUpdate = true;
              }
            });
          }
        }
      });

      // 1. Calculate the scaled model's exact bounding box
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const height = Math.max(size.y, 0.3);
      const radius = Math.max(Math.hypot(size.x, size.z) / 2, 0.2);

      characterHeightRef.current = height;
      characterRadiusRef.current = radius;

      // 2. Create a dedicated characterRoot container
      // Inside characterRoot, we center the model horizontally and ground its feet at y = 0
      const characterRoot = new THREE.Group();
      characterRoot.name = 'CharacterPlayerRoot';

      // Offset model inside characterRoot:
      // X and Z centered around 0
      // Y lifted up so that the lowest point (box.min.y) is at exactly y = 0 (surface of grass)
      model.position.x = -center.x;
      model.position.z = -center.z;
      model.position.y = -box.min.y + 0.02; // +2cm clearance above grass blades

      characterRoot.add(model);
      scene.add(characterRoot);
      characterRootRef.current = characterRoot;

      // 3. Detect and bind locomotion animations (Walk / Run / Idle / Jump)
      const detectedAnim = animControllerRef.current.setup(model, gltfData.animations || []);
      setAnimInfo(detectedAnim);

      // Reset character position to starting meadow
      handleResetPosition();
    } catch (modelErr) {
      console.error('Error mounting model to scene:', modelErr);
    }
  }, [gltfData, handleResetPosition, wireframe]);

  // Update wireframe state on existing model
  useEffect(() => {
    if (!characterRootRef.current) return;
    try {
      characterRootRef.current.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (m) {
              m.wireframe = wireframe;
              m.needsUpdate = true;
            }
          });
        }
      });
    } catch (e) {
      console.warn('Could not update wireframe:', e);
    }
  }, [wireframe]);

  // Take Screenshot
  const handleScreenshot = () => {
    if (!rendererRef.current) return;
    try {
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${fileName.replace(/\.[^/.]+$/, '')}_zachod_slonca.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Screenshot failed:', e);
    }
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!webglSupported) {
    return (
      <div className="w-full h-80 rounded-2xl border border-red-800 bg-red-950/30 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm font-semibold text-red-300">Twoja przeglądarka nie ma włączonej akceleracji WebGL.</p>
        <p className="text-xs text-red-400 mt-1">Upewnij się, że w ustawieniach przeglądarki włączona jest akceleracja sprzętowa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 3D Game Canvas Viewport */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-sky-950 flex flex-col ${
          isFullscreen ? 'h-screen w-screen fixed inset-0 z-50 rounded-none' : 'h-[500px] sm:h-[560px] lg:h-[620px]'
        }`}
      >
        {/* 3D Canvas */}
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair outline-none touch-none" />

        {/* Top Controls Toolbar */}
        <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 right-2.5 sm:right-3 flex items-center justify-between pointer-events-none z-30 gap-2">
          {/* Left Badges (Compacts gracefully on mobile) */}
          <div className="flex items-center gap-1.5 pointer-events-auto min-w-0 shrink overflow-hidden">
            {/* Model Name & Landscape Badge */}
            <div className="bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-amber-500/40 shadow-lg text-xs text-slate-200 flex items-center gap-1.5 shrink min-w-0">
              <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span className="font-bold text-slate-100 truncate max-w-[75px] sm:max-w-[170px]">
                {fileName}
              </span>
              <span className="text-[10px] text-amber-300/90 font-mono hidden md:inline shrink-0">
                · Zachód słońca
              </span>
            </div>

            {/* Locomotion Animation Badge */}
            {animInfo?.hasAnimations && (
              <div
                className="bg-emerald-950/90 backdrop-blur-md px-2 py-1.5 rounded-xl border border-emerald-500/50 shadow-lg text-xs text-emerald-300 flex items-center gap-1 shrink-0 transition-all"
                title={`Wykryto animacje modelu: ${animInfo.clips.join(', ')}`}
              >
                <Film className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-semibold hidden md:inline text-[11px]">
                  {animInfo.matchedClips.walk ? 'Chód & Bieg' : 'Animacja'}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-[10px] font-mono text-emerald-300 font-bold shrink-0">
                  {animInfo.clipCount} {animInfo.clipCount === 1 ? 'klip' : 'klipy'}
                </span>
              </div>
            )}
          </div>

          {/* Right Action Buttons (Always fully visible, shrink-0, never covered or cut off) */}
          <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
            {/* Start (Reset Position) Button */}
            <button
              type="button"
              onClick={handleResetPosition}
              onTouchStart={(e) => e.stopPropagation()}
              title="Wróć na początek sceny (Reset pozycji)"
              className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-slate-900 text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-bold">Start</span>
            </button>

            {/* Quick Tools (Wireframe, Screenshot, Fullscreen - uncovered and fully accessible) */}
            <div className="bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/70 shadow-lg flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleWireframe}
                onTouchStart={(e) => e.stopPropagation()}
                title="Tryb siatki (Wireframe)"
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  wireframe ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleScreenshot}
                onTouchStart={(e) => e.stopPropagation()}
                title="Pobierz zdjęcie z zachodem słońca (PNG)"
                className="p-1.5 rounded-lg text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                onTouchStart={(e) => e.stopPropagation()}
                title={isFullscreen ? 'Opuść pełny ekran' : 'Pełny ekran na telefonie'}
                className="p-1.5 rounded-lg text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Virtual Joystick & Touch Controller Overlay */}
        <VirtualJoystick
          onMove={(vector) => {
            joystickVectorRef.current = vector;
          }}
          onCameraRotate={handleCameraRotate}
          onJump={handleJump}
          isSprinting={isSprinting}
          onToggleSprint={handleToggleSprint}
          onResetPosition={handleResetPosition}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      </div>

      {/* Guide Banner for Mobile Player */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Lewy kciuk:</strong> Joystick (chodzenie po pagórkach) · <strong>Prawy kciuk:</strong> Obrót kamery, Skok i Bieg.
          </span>
        </div>
        <div className="text-amber-400 font-mono text-[11px] flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5" />
          Zachodzące słońce i zielone pagórki
        </div>
      </div>
    </div>
  );
};
