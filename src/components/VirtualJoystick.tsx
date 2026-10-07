import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Zap, ArrowBigUp, Move } from 'lucide-react';

export interface JoystickVector {
  x: number; // -1 (left) to 1 (right)
  y: number; // -1 (backward) to 1 (forward)
}

interface VirtualJoystickProps {
  onMove: (vector: JoystickVector) => void;
  onCameraRotate: (deltaX: number, deltaY: number) => void;
  onJump: () => void;
  isSprinting: boolean;
  onToggleSprint: () => void;
  onResetPosition?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onMove,
  onCameraRotate,
  onJump,
  isSprinting,
  onToggleSprint,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);

  const joystickTouchIdRef = useRef<number | null>(null);
  const cameraTouchIdRef = useRef<number | null>(null);
  const lastCameraTouchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const radius = 48; // Joystick radius in pixels

  // Trigger haptic vibration on phone if supported
  const triggerHaptic = (ms = 25) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // ignore
      }
    }
  };

  // Immediate debounced jump trigger for reliable multitouch while running
  const lastJumpTimeRef = useRef<number>(0);
  const triggerJumpAction = useCallback(() => {
    const now = Date.now();
    if (now - lastJumpTimeRef.current < 120) return;
    lastJumpTimeRef.current = now;
    triggerHaptic(40);
    onJump();
  }, [onJump]);

  const triggerSprintAction = useCallback(() => {
    triggerHaptic(20);
    onToggleSprint();
  }, [onToggleSprint]);

  // 1. Touch start on Joystick
  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (joystickTouchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;
    setIsJoystickActive(true);
    triggerHaptic(15);
    updateJoystickKnob(touch.clientX, touch.clientY);
  };

  const updateJoystickKnob = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    const clampedDist = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setKnobPos({ x: knobX, y: knobY });

    const normX = clampedDist > 5 ? knobX / radius : 0;
    const normY = clampedDist > 5 ? -knobY / radius : 0;

    onMove({ x: Number(normX.toFixed(2)), y: Number(normY.toFixed(2)) });
  };

  // 2. Camera Touch Drag on right half of screen
  const handleCameraTouchStart = (e: React.TouchEvent) => {
    if (cameraTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    cameraTouchIdRef.current = touch.identifier;
    lastCameraTouchPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  // Global window listeners for tracking touches smoothly across screen
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Track joystick movement
        if (touch.identifier === joystickTouchIdRef.current) {
          updateJoystickKnob(touch.clientX, touch.clientY);
        }

        // Track camera rotation drag
        if (touch.identifier === cameraTouchIdRef.current) {
          const deltaX = touch.clientX - lastCameraTouchPosRef.current.x;
          const deltaY = touch.clientY - lastCameraTouchPosRef.current.y;
          lastCameraTouchPosRef.current = { x: touch.clientX, y: touch.clientY };
          onCameraRotate(deltaX, deltaY);
        }
      }
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === joystickTouchIdRef.current) {
          joystickTouchIdRef.current = null;
          setIsJoystickActive(false);
          setKnobPos({ x: 0, y: 0 });
          onMove({ x: 0, y: 0 });
        }

        if (touch.identifier === cameraTouchIdRef.current) {
          cameraTouchIdRef.current = null;
        }
      }
    };

    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [onMove, onCameraRotate]);

  // Desktop Mouse Drag helper for testing
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsJoystickActive(true);
    const onMouseMove = (ev: MouseEvent) => {
      updateJoystickKnob(ev.clientX, ev.clientY);
    };
    const onMouseUp = () => {
      setIsJoystickActive(false);
      setKnobPos({ x: 0, y: 0 });
      onMove({ x: 0, y: 0 });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    updateJoystickKnob(e.clientX, e.clientY);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-end p-3 select-none touch-none">
      {/* Middle: Right-half Camera Look Zone (Transparent touch surface) */}
      <div
        onTouchStart={handleCameraTouchStart}
        className="absolute top-20 right-0 bottom-48 w-1/2 pointer-events-auto"
      />

      {/* Bottom Controls Row: Joystick on Left, Jump & Sprint on Right */}
      <div className="flex items-end justify-between w-full pointer-events-none pb-2">
        {/* Left: Virtual Analog Joystick */}
        <div className="pointer-events-auto flex flex-col items-center pl-1">
          <div
            ref={joystickBaseRef}
            onTouchStart={handleJoystickTouchStart}
            onMouseDown={handleMouseDown}
            className="relative w-32 h-32 rounded-full bg-slate-950/80 backdrop-blur-lg border-2 border-cyan-500/50 shadow-2xl flex items-center justify-center cursor-pointer active:border-cyan-400"
            style={{ touchAction: 'none' }}
          >
            {/* Guide directional arrows */}
            <div className="absolute top-1.5 text-cyan-500/40 text-[11px] font-black">▲</div>
            <div className="absolute bottom-1.5 text-cyan-500/40 text-[11px] font-black">▼</div>
            <div className="absolute left-1.5 text-cyan-500/40 text-[11px] font-black">◀</div>
            <div className="absolute right-1.5 text-cyan-500/40 text-[11px] font-black">▶</div>

            {/* Inner Ring */}
            <div className="w-16 h-16 rounded-full border border-cyan-500/25" />

            {/* Moving Analog Stick Knob */}
            <div
              className={`absolute w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform ${
                isJoystickActive
                  ? 'bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-cyan-500/60 scale-105'
                  : 'bg-slate-800/90 border-2 border-cyan-400/80 shadow-md'
              }`}
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                transition: isJoystickActive ? 'none' : 'transform 0.12s ease-out',
              }}
            >
              <Move className={`w-5 h-5 ${isJoystickActive ? 'text-slate-950' : 'text-cyan-400'}`} />
            </div>
          </div>
          <span className="text-[10px] text-cyan-300 mt-1.5 font-bold tracking-wider bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
            JOYSTICK RUCHU
          </span>
        </div>

        {/* Right: Sprint Toggle + Large Multitouch Jump Button */}
        <div className="pointer-events-auto z-30 flex flex-col items-end gap-3 pr-2 select-none" style={{ touchAction: 'none' }}>
          {/* Sprint Toggle */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerSprintAction();
            }}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse') return;
              e.preventDefault();
              e.stopPropagation();
              triggerSprintAction();
            }}
            onClick={(e) => {
              e.preventDefault();
              triggerSprintAction();
            }}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-xs shadow-xl transition-all border active:scale-95 touch-none select-none cursor-pointer ${
              isSprinting
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-500/40 scale-105'
                : 'bg-slate-950/85 backdrop-blur-md text-slate-300 border-slate-700 hover:bg-slate-900'
            }`}
            style={{ touchAction: 'none' }}
          >
            <Zap className={`w-5 h-5 ${isSprinting ? 'fill-current' : 'text-amber-400'}`} />
            <span className="text-[9px] mt-0.5 uppercase tracking-tighter font-extrabold">Bieg</span>
          </button>

          {/* Jump Button (instant multitouch response while running) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerJumpAction();
            }}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse') return;
              e.preventDefault();
              e.stopPropagation();
              triggerJumpAction();
            }}
            onClick={(e) => {
              e.preventDefault();
              triggerJumpAction();
            }}
            className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 text-slate-950 font-black shadow-2xl shadow-cyan-500/50 border-2 border-cyan-200 flex flex-col items-center justify-center active:scale-90 transition-transform touch-none select-none cursor-pointer"
            style={{ touchAction: 'none' }}
          >
            <ArrowBigUp className="w-8 h-8 fill-current text-slate-950" />
            <span className="text-[11px] uppercase tracking-wider font-black -mt-1 text-slate-950">
              SKOK
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
