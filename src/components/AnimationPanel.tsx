import React, { useState } from 'react';
import {
  Film,
  Play,
  Pause,
  RotateCcw,
  X,
  Gauge,
  Repeat,
  Sparkles,
  Gamepad2,
  CheckCircle2,
} from 'lucide-react';
import { ClipDetail } from '../utils/characterAnimation.ts';

interface AnimationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  clips: ClipDetail[];
  activeClipName?: string;
  isCustomPlaying: boolean;
  playbackSpeed: number;
  isPaused: boolean;
  onPlayClip: (name: string, speed?: number, loop?: boolean) => void;
  onStopCustom: () => void;
  onTogglePause: () => void;
  onChangeSpeed: (speed: number) => void;
  modelName: string;
}

export const AnimationPanel: React.FC<AnimationPanelProps> = ({
  isOpen,
  onClose,
  clips,
  activeClipName,
  isCustomPlaying,
  playbackSpeed,
  isPaused,
  onPlayClip,
  onStopCustom,
  onTogglePause,
  onChangeSpeed,
  modelName,
}) => {
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [selectedSpeed, setSelectedSpeed] = useState<number>(playbackSpeed || 1.0);

  if (!isOpen) return null;

  const handleSpeedSelect = (speed: number) => {
    setSelectedSpeed(speed);
    onChangeSpeed(speed);
  };

  const handlePlay = (name: string) => {
    onPlayClip(name, selectedSpeed, isLooping);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[85vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Film className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg text-white tracking-tight truncate">
                  Show Animation
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0">
                  {clips.length} {clips.length === 1 ? 'animacja' : 'animacje'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Odtwórz wybraną animację dla postaci: <span className="text-slate-200 font-medium">{modelName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
            title="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Controls & Status Bar */}
        <div className="px-5 py-3.5 bg-slate-950/40 border-b border-slate-800/80 space-y-3 shrink-0">
          {/* Active animation bar */}
          {isCustomPlaying && activeClipName ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isPaused ? 'hidden' : ''}`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPaused ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-emerald-300">
                    {isPaused ? 'Animacja wstrzymana:' : 'Odtwarzana animacja:'}
                  </div>
                  <div className="text-xs font-bold text-white font-mono truncate">
                    {activeClipName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={onTogglePause}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Wznów</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pauza</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onStopCustom}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Powrót do standardowego sterowania chodzeniem/bieganiem"
                >
                  <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Tryb gry</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-cyan-400" />
                Aktualnie: <strong className="text-cyan-300">Sterowanie postacią w grze</strong>
              </span>
              <span className="text-[11px] text-slate-500">Kliknij „Odpal” przy dowolnym klipie</span>
            </div>
          )}

          {/* Quick Playback Speed & Looping Options */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Speed selection */}
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 font-medium text-[11px]">Prędkość:</span>
              <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
                {[0.5, 1.0, 1.5, 2.0].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => handleSpeedSelect(spd)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      selectedSpeed === spd
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Loop Toggle */}
            <button
              type="button"
              onClick={() => setIsLooping((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                isLooping
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Repeat className={`w-3.5 h-3.5 ${isLooping ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>{isLooping ? 'Pętla (Loop)' : 'Pojedynczo (1x)'}</span>
            </button>
          </div>
        </div>

        {/* Clip List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 divide-y-0">
          {clips.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
              <Film className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">Brak animacji w tym modelu</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Ten plik .glb nie posiada wbudowanych animacji szkieletowych. Załaduj plik z animacjami, np. z Mixamo lub Blendera.
              </p>
            </div>
          ) : (
            clips.map((clip, index) => {
              const isActive = isCustomPlaying && activeClipName === clip.name;

              return (
                <div
                  key={`${clip.name}-${index}`}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-emerald-950/30 border-emerald-500/60 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                        isActive
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {isActive ? (
                        <Sparkles className="w-4 h-4 animate-spin-slow" />
                      ) : (
                        <Film className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100 font-mono truncate">
                          {clip.name}
                        </span>
                        {clip.isProcedural && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold shrink-0">
                            Generator
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                        <span>Czas: <strong className="text-slate-300">{clip.duration}s</strong></span>
                        <span>·</span>
                        <span>Ścieżki: <strong className="text-slate-300">{clip.tracksCount}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Play / Trigger Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={onTogglePause}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer"
                        title={isPaused ? 'Wznów animację' : 'Wstrzymaj animację'}
                      >
                        {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                        <span>{isPaused ? 'Wznów' : 'Gra teraz'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePlay(clip.name)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/30 active:scale-95 transition-all cursor-pointer"
                        title={`Odpal animację: ${clip.name}`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Odpal</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & Return to Game Mode */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Animacja działa w czasie rzeczywistym na modelu</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
