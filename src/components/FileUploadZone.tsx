import React, { useRef, useState } from 'react';
import { Upload, CheckCircle, AlertCircle, RefreshCw, Sparkles, Link as LinkIcon, Globe } from 'lucide-react';
import { ModelStats } from '../types/three-app.ts';
import { formatShortFileName } from '../utils/formatFileName.ts';

interface FileUploadZoneProps {
  onFileSelected: (file: File) => void;
  onUrlSelected?: (url: string) => Promise<void>;
  onLoadSample?: () => void;
  onResetToDemo?: () => void;
  isCustomDefault?: boolean;
  currentStats: ModelStats | null;
  isLoading: boolean;
  error: string | null;
}

function normalizeDirectDownloadUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  // GitHub: github.com/user/repo/blob/branch/file.glb -> raw.githubusercontent.com/user/repo/branch/file.glb
  if (url.includes('github.com') && url.includes('/blob/')) {
    url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  // Dropbox: dropbox.com/.../file.glb?dl=0 -> ?dl=1
  if (url.includes('dropbox.com')) {
    url = url.replace('?dl=0', '?dl=1');
    if (!url.includes('dl=')) {
      url += (url.includes('?') ? '&' : '?') + 'dl=1';
    }
  }
  // Google Drive: drive.google.com/file/d/<id>/view...
  const gDriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gDriveMatch && gDriveMatch[1]) {
    url = `https://drive.google.com/uc?export=download&id=${gDriveMatch[1]}`;
  }
  return url;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFileSelected,
  onUrlSelected,
  onLoadSample,
  onResetToDemo,
  isCustomDefault,
  currentStats,
  isLoading,
  error,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const validateAndUpload = (file: File) => {
    setValidationError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'glb' && ext !== 'gltf') {
      setValidationError(`Wybrany plik "${file.name}" nie jest modelem 3D. Wybierz plik z rozszerzeniem .glb lub .gltf.`);
      return;
    }
    onFileSelected(file);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !onUrlSelected) return;
    setValidationError(null);
    const normalized = normalizeDirectDownloadUrl(urlInput);
    try {
      await onUrlSelected(normalized);
      setShowUrlModal(false);
      setUrlInput('');
    } catch (err: any) {
      setValidationError(err.message || 'Nie udało się pobrać modelu z podanego linku.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const activeError = error || validationError;

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer transition-all duration-200 border-2 border-dashed rounded-xl p-5 text-center ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-500/20'
            : currentStats
            ? 'border-slate-700 hover:border-slate-500 bg-slate-900/60'
            : 'border-cyan-500/50 hover:border-cyan-400 bg-slate-900/80 shadow-md'
        }`}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-4">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-200">Przetwarzanie Twojego pliku 3D...</p>
            <p className="text-xs text-slate-400 mt-1">Parsowanie siatki, kości i materiałów PBR</p>
          </div>
        ) : currentStats ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-100 text-sm font-mono" title={currentStats.fileName}>
                    {formatShortFileName(currentStats.fileName, 34)}
                  </span>
                  <span className="text-xs font-mono text-slate-400">({formatFileSize(currentStats.fileSizeBytes)})</span>
                  {isCustomDefault && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      ★ Domyślna postać
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isCustomDefault
                    ? 'Twój model jest zapisany w przeglądarce i ładuje się automatycznie jako domyślna postać.'
                    : 'Model wczytany pomyślnie. Kliknij lub upuść tutaj inny plik, aby go zmienić.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isCustomDefault && onResetToDemo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetToDemo();
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  Przywróć demo
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
              >
                Zmień plik .glb
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-5">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 text-cyan-400">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">
              Przeciągnij i upuść tutaj swój plik <span className="text-cyan-400 font-mono">.glb</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Obsługiwane formaty: binarne modele 3D <strong className="text-slate-300">.GLB</strong> oraz tekstowe <strong className="text-slate-300">.GLTF</strong> z Blendera, Maya, Sketchfab lub 3ds Max.
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-sm"
              >
                Wybierz plik z dysku
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUrlModal((prev) => !prev);
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                Wczytaj z linku (URL)
              </button>

              {onLoadSample && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadSample();
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Testowy model demo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* URL Input Box */}
      {showUrlModal && (
        <form
          onSubmit={handleUrlSubmit}
          onClick={(e) => e.stopPropagation()}
          className="mt-3 p-4 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <LinkIcon className="w-4 h-4 text-cyan-400" />
              <span>Pobierz model bezpośrednio z linku (URL)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowUrlModal(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ Zamknij
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              required
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://twoja-domena.pl/sciezka/model.glb (GitHub, Dropbox, Google Drive, itp.)"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={isLoading || !urlInput.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 transition-colors shrink-0"
            >
              {isLoading ? 'Pobieranie...' : 'Pobierz i ustaw jako domyślny'}
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            Obsługuje bezpośrednie linki do plików <strong className="text-slate-300">.glb</strong> (w tym linki z <em>GitHub Raw</em>, <em>Dropbox</em>, <em>Google Drive</em> oraz dowolnego serwera/CDN).
          </p>
        </form>
      )}

      {activeError && (
        <div className="mt-2.5 p-3 rounded-lg bg-red-950/40 border border-red-800/50 flex items-start gap-2.5 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Błąd ładowania pliku: </span>
            {activeError}
          </div>
        </div>
      )}
    </div>
  );
};
