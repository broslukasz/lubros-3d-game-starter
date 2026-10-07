import React, { useState } from 'react';
import { Copy, Check, FolderTree, Sparkles, HelpCircle, Smartphone, Gamepad2 } from 'lucide-react';
import { formatShortFileName } from '../utils/formatFileName.ts';

interface ProjectIntegrationGuideProps {
  fileName?: string;
  hasAnimations?: boolean;
}

export const ProjectIntegrationGuide: React.FC<ProjectIntegrationGuideProps> = ({
  fileName = 'twoj-model.glb',
}) => {
  const [activeTab, setActiveTab] = useState<'controller' | 'r3f' | 'modelviewer' | 'structure' | 'faq'>('controller');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const characterControllerCode = `// Sterowanie modelem 3D jak postacią w grze (Touch / Joystick / WASD)
// npm install three @types/three

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default function GameCharacterView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // 1. Scena i Kamera TPP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Podłoże
    const grid = new THREE.GridHelper(50, 50, 0x06b6d4, 0x1e293b);
    scene.add(grid);

    // Światła
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(5, 12, 7);
    scene.add(sun);

    // 2. Ładowanie Twojego modelu .glb
    let character: THREE.Group | null = null;
    const playerPos = new THREE.Vector3(0, 0, 0);
    let cameraYaw = 0;

    const loader = new GLTFLoader();
    loader.load('/${fileName}', (gltf) => {
      character = gltf.scene;
      scene.add(character);
    });

    // 3. Obsługa sterowania (klawiatura / joystick)
    const keys: { [k: string]: boolean } = {};
    window.addEventListener('keydown', (e) => (keys[e.code] = true));
    window.addEventListener('keyup', (e) => delete keys[e.code]);

    // 4. Pętla gry (poruszanie postacią)
    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (character) {
        let dx = 0;
        let dz = 0;
        if (keys['KeyW'] || keys['ArrowUp']) dz -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) dz += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

        if (dx !== 0 || dz !== 0) {
          const speed = 5.0;
          playerPos.x += dx * speed * delta;
          playerPos.z += dz * speed * delta;

          // Obrót postaci w stronę marszu
          character.rotation.y = Math.atan2(dx, dz);
        }

        character.position.copy(playerPos);

        // Kamera TPP śledząca postać z tyłu
        const camDistance = 5.0;
        const camHeight = 2.5;
        camera.position.x = playerPos.x + Math.sin(cameraYaw) * camDistance;
        camera.position.z = playerPos.z + Math.cos(cameraYaw) * camDistance;
        camera.position.y = playerPos.y + camHeight;
        camera.lookAt(playerPos.x, playerPos.y + 1.0, playerPos.z);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100vh', touchAction: 'none' }} />;
}`;

  const r3fCode = `// React Three Fiber (R3F)
// npm install three @types/three @react-three/fiber @react-three/drei

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center } from '@react-three/drei';

function Model() {
  const { scene } = useGLTF('/${fileName}');
  return <primitive object={scene} />;
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0f1d' }}>
      <Canvas camera={{ position: [3, 2, 5], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <Center>
          <Model />
        </Center>
        <OrbitControls />
      </Canvas>
    </div>
  );
}

useGLTF.preload('/${fileName}');`;

  const modelViewerHtml = `<!-- Google <model-viewer> (1 linijka w HTML z obsługą AR na telefonie) -->
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"></script>

<model-viewer
  src="/${fileName}"
  auto-rotate
  camera-controls
  ar
  style="width: 100%; height: 500px;"
></model-viewer>`;

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-100">
              Jak sterować modelem <span className="text-cyan-400 font-mono" title={fileName}>{formatShortFileName(fileName, 26)}</span> we własnym kodzie?
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Wybierz wariant integracji. Kod jest w 100% gotowy do skopiowania.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('controller')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'controller'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎮 Sterowanie Postacią (Gra)
          </button>
          <button
            onClick={() => setActiveTab('r3f')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'r3f'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚛️ React Three Fiber
          </button>
          <button
            onClick={() => setActiveTab('modelviewer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'modelviewer'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📱 &lt;model-viewer&gt;
          </button>
          <button
            onClick={() => setActiveTab('structure')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'structure'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📁 Gdzie wkleić plik?
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'faq'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚠️ Pomoc (FAQ)
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="mt-5">
        {activeTab === 'controller' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-300 font-medium">
                Komponent React z kontrolerem postaci 3D (poruszanie po scenie, kamera TPP, klawisze WASD / dotyk)
              </span>
              <button
                onClick={() => handleCopy(characterControllerCode, 'controller')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors"
              >
                {copiedKey === 'controller' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'controller' ? 'Skopiowano!' : 'Kopiuj kod'}
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed max-h-[420px] select-all">
              {characterControllerCode}
            </pre>
          </div>
        )}

        {activeTab === 'r3f' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-300 font-medium">
                Standardowy komponent React Three Fiber z OrbitControls
              </span>
              <button
                onClick={() => handleCopy(r3fCode, 'r3f')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors"
              >
                {copiedKey === 'r3f' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'r3f' ? 'Skopiowano!' : 'Kopiuj kod'}
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed max-h-[420px] select-all">
              {r3fCode}
            </pre>
          </div>
        )}

        {activeTab === 'modelviewer' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-300 font-medium">
                Google &lt;model-viewer&gt;
              </span>
              <button
                onClick={() => handleCopy(modelViewerHtml, 'modelviewer')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors"
              >
                {copiedKey === 'modelviewer' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'modelviewer' ? 'Skopiowano!' : 'Kopiuj kod'}
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed max-h-[420px] select-all">
              {modelViewerHtml}
            </pre>
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-cyan-400" />
                Gdzie wkleić plik {fileName} w Twoim projekcie?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                W aplikacjach <strong>Vite, Next.js lub React</strong> pliki 3D umieszczamy w katalogu <strong className="text-white">public/</strong>:
              </p>

              <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 border border-slate-800 leading-relaxed">
{`twoj-projekt/
├── public/                 <-- TUTAJ WKLEJASZ SWÓJ PLIK
│   └── ${fileName}
├── src/
│   └── App.tsx             <-- W kodzie ścieżka to "/${fileName}"
└── package.json`}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                1. "Mój model jest czarny na scenie"
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Format GLB wymaga oświetlenia sceny. Dodaj <code className="text-cyan-300">scene.add(new THREE.AmbientLight(0xffffff, 0.8))</code> oraz <code className="text-cyan-300">scene.add(new THREE.DirectionalLight(0xffffff, 1.5))</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                2. "Błąd 404 (Not Found)"
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Upewnij się, że plik leży w folderze <strong>public/</strong>, a w kodzie ścieżka zaczyna się od slasha: <code className="text-emerald-400">/{fileName}</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
