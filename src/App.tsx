import React, { useState, useEffect } from 'react';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Box } from 'lucide-react';
import { FileUploadZone } from './components/FileUploadZone.tsx';
import { GlbViewer } from './components/GlbViewer.tsx';
import { ProjectIntegrationGuide } from './components/ProjectIntegrationGuide.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { loadGlbFromFile, loadGlbFromArrayBuffer, loadGlbFromUrl } from './utils/modelLoader.ts';
import { createDemoScene } from './utils/demoModel.ts';
import { saveDefaultModel, loadSavedDefaultModel, clearSavedDefaultModel } from './utils/savedModelStorage.ts';
import { ModelStats } from './types/three-app.ts';

export default function App() {
  // GLB State
  const [gltfData, setGltfData] = useState<GLTF | null>(null);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCustomDefault, setIsCustomDefault] = useState<boolean>(false);

  // Viewer Toggles
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  // Initialize character: Check IndexedDB saved model -> Check public /model.glb -> Fallback to procedural demo
  useEffect(() => {
    let isMounted = true;

    async function initCharacter() {
      // 1. Check if user previously saved a custom model in browser storage
      try {
        const saved = await loadSavedDefaultModel();
        if (saved && isMounted) {
          const result = await loadGlbFromArrayBuffer(saved.buffer, saved.name, saved.size);
          if (isMounted) {
            setGltfData(result.gltf);
            setModelStats(result.stats);
            setIsCustomDefault(true);
            return;
          }
        }
      } catch (e) {
        console.warn('Could not load saved model from storage:', e);
      }

      // 2. Check if static default model exists in public folder (e.g. /default-model.glb or /model.glb)
      try {
        const modelPath = `${(import.meta.env.BASE_URL || './').replace(/\/$/, '')}/model.glb`;
        const checkPublic = await fetch(modelPath, { method: 'HEAD' });
        if (checkPublic.ok && isMounted) {
          const result = await loadGlbFromUrl(
            modelPath,
            'Meshy_AI_The_Welcoming_Savior_biped_Animation_Running_withSkin.glb'
          );
          if (isMounted) {
            setGltfData(result.gltf);
            setModelStats(result.stats);
            setIsCustomDefault(true);
            return;
          }
        }
      } catch {
        // Public model not present, proceed to procedural demo
      }

      // 3. Fallback: Procedural demo robot
      if (isMounted) {
        try {
          const demo = createDemoScene();
          setGltfData(demo.gltf);
          setModelStats(demo.stats);
          setIsCustomDefault(false);
        } catch (e: any) {
          console.error('Demo error:', e);
        }
      }
    }

    initCharacter();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileSelected = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await loadGlbFromFile(file);
      setGltfData(result.gltf);
      setModelStats(result.stats);

      // Automatically persist to browser IndexedDB as the default character!
      await saveDefaultModel(file);
      setIsCustomDefault(true);
    } catch (err: any) {
      console.error('Błąd parsowania pliku GLB:', err);
      setErrorMessage(
        err.message || 'Nie udało się odczytać pliku .glb. Upewnij się, że plik nie jest uszkodzony.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSelected = async (url: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Serwer zwrócił błąd HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      // Extract file name from URL path or fallback
      const urlFileName = url.split('/').pop()?.split('?')[0] || 'model.glb';
      const cleanFileName = urlFileName.endsWith('.glb') || urlFileName.endsWith('.gltf')
        ? decodeURIComponent(urlFileName)
        : `${decodeURIComponent(urlFileName)}.glb`;

      const result = await loadGlbFromArrayBuffer(arrayBuffer, cleanFileName, arrayBuffer.byteLength);
      setGltfData(result.gltf);
      setModelStats(result.stats);

      // Save to IndexedDB as default character
      await saveDefaultModel(new File([arrayBuffer], cleanFileName, { type: 'model/gltf-binary' }));
      setIsCustomDefault(true);
    } catch (err: any) {
      console.error('Błąd pobierania modelu z URL:', err);
      setErrorMessage(
        err.message || 'Nie udało się pobrać pliku 3D z podanego linku. Upewnij się, że link jest bezpośredni i publiczny.'
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDemo = async () => {
    try {
      await clearSavedDefaultModel();
      const demo = createDemoScene();
      setGltfData(demo.gltf);
      setModelStats(demo.stats);
      setIsCustomDefault(false);
      setErrorMessage(null);
    } catch (e) {
      console.error('Failed to reset to demo:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
              <Box className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-white">
                  3D GLB Studio
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  WebGL · Three.js
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Podgląd, analiza i gotowy kod integracji własnych modeli 3D (.glb) w aplikacjach webowych
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Step 1: Upload Your Own Model */}
        <section>
          <FileUploadZone
            onFileSelected={handleFileSelected}
            onUrlSelected={handleUrlSelected}
            onLoadSample={handleResetToDemo}
            onResetToDemo={handleResetToDemo}
            isCustomDefault={isCustomDefault}
            currentStats={modelStats}
            isLoading={isLoading}
            error={errorMessage}
          />
        </section>

        {/* Step 2: 3D Viewport wrapped in ErrorBoundary */}
        <section className="space-y-4">
          <ErrorBoundary
            fallbackMessage="Wystąpił problem podczas renderowania modelu 3D"
            onReset={handleResetToDemo}
          >
            <GlbViewer
              gltfData={gltfData}
              fileName={modelStats?.fileName || 'model.glb'}
              wireframe={wireframe}
              onToggleWireframe={() => setWireframe((prev) => !prev)}
              showGrid={showGrid}
              onToggleGrid={() => setShowGrid((prev) => !prev)}
              autoRotate={autoRotate}
              onToggleAutoRotate={() => setAutoRotate((prev) => !prev)}
            />
          </ErrorBoundary>
        </section>

        {/* Step 4: Step-by-Step Code Generator & Project Setup */}
        <section>
          <ProjectIntegrationGuide
            fileName={modelStats?.fileName || 'twoj-model.glb'}
            hasAnimations={(modelStats?.animationsCount || 0) > 0}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>
          Studio formatów 3D. Obsługa plików <strong className="text-slate-400">.GLB / .GLTF</strong> przez Three.js i WebGL.
        </p>
      </footer>
    </div>
  );
}
