import * as THREE from 'three';

export interface ClipDetail {
  name: string;
  duration: number;
  tracksCount: number;
  isProcedural?: boolean;
}

export interface AnimationDetectionInfo {
  hasAnimations: boolean;
  clipCount: number;
  clips: string[];
  clipDetails: ClipDetail[];
  matchedClips: {
    idle?: string;
    walk?: string;
    run?: string;
    jump?: string;
  };
  activeState: 'idle' | 'walk' | 'run' | 'jump' | 'custom' | 'none';
  activeClipName?: string;
  isCustomPlaying: boolean;
  playbackSpeed: number;
  isPaused: boolean;
}

export class CharacterAnimationController {
  private mixer: THREE.AnimationMixer | null = null;
  private actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
    jump?: THREE.AnimationAction;
  } = {};
  private allActions: Map<string, THREE.AnimationAction> = new Map();
  private allClips: THREE.AnimationClip[] = [];
  private currentAction: THREE.AnimationAction | null = null;
  private currentState: 'idle' | 'walk' | 'run' | 'jump' | 'custom' | 'none' = 'none';

  // Manual Animation Override State (Show Animation panel)
  private isManualOverride = false;
  private manualClipName?: string;
  private currentSpeed = 1.0;
  private isPausedState = false;

  private info: AnimationDetectionInfo = {
    hasAnimations: false,
    clipCount: 0,
    clips: [],
    clipDetails: [],
    matchedClips: {},
    activeState: 'none',
    isCustomPlaying: false,
    playbackSpeed: 1.0,
    isPaused: false,
  };

  /**
   * Scans GLTF animation clips, identifies locomotion clips (walk/run/idle/jump),
   * sets up all clips for individual playback via "Show Animation",
   * and prepares smooth cross-fading actions.
   */
  public setup(rootObject: THREE.Object3D, clips: THREE.AnimationClip[]): AnimationDetectionInfo {
    this.dispose();

    this.mixer = new THREE.AnimationMixer(rootObject);
    let workingClips = [...(clips || [])];

    // If the model contains no clips at all, synthesize clean procedural clips
    // so users can always test and preview animations on any loaded character!
    if (workingClips.length === 0) {
      const proceduralClips = this.createProceduralClips(rootObject);
      workingClips = proceduralClips;
    }

    this.allClips = workingClips;

    // Register all clips into the mixer
    const clipNames: string[] = [];
    const clipDetails: ClipDetail[] = [];

    workingClips.forEach((clip) => {
      const name = clip.name || 'Animacja';
      clipNames.push(name);
      clipDetails.push({
        name,
        duration: Number((clip.duration || 1).toFixed(2)),
        tracksCount: clip.tracks?.length || 0,
        isProcedural: clip.name.startsWith('Procedural:'),
      });

      const action = this.mixer!.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.allActions.set(name, action);
    });

    // Categorization helper for standard locomotion (walk / run / idle / jump)
    const findClip = (keywords: string[]): THREE.AnimationClip | undefined => {
      return workingClips.find((c) => {
        const lower = (c.name || '').toLowerCase();
        return keywords.some((kw) => lower.includes(kw));
      });
    };

    const walkClip = findClip([
      'walk', 'chod', 'chód', 'step', 'march', 'strut', 'move', 'locomotion_walk', 'wlk'
    ]);
    const runClip = findClip([
      'run', 'bieg', 'sprint', 'dash', 'fast', 'trot', 'jog', 'locomotion_run'
    ]);
    const idleClip = findClip([
      'idle', 'stand', 'spoczynek', 'rest', 'wait', 'breath', 'pose', 'stop', 'default'
    ]);
    const jumpClip = findClip([
      'jump', 'skok', 'leap', 'fall', 'air'
    ]);

    let finalWalk = walkClip;
    let finalRun = runClip;
    let finalIdle = idleClip;
    const finalJump = jumpClip;

    if (!finalWalk && !finalRun) {
      if (workingClips.length === 1) {
        finalWalk = workingClips[0];
        finalRun = workingClips[0];
      } else if (workingClips.length >= 2) {
        const nonIdle = workingClips.find((c) => c !== finalIdle);
        finalWalk = nonIdle || workingClips[0];
      }
    }

    if (finalWalk && !finalRun) finalRun = finalWalk;
    if (finalRun && !finalWalk) finalWalk = finalRun;

    if (finalIdle) {
      this.actions.idle = this.mixer.clipAction(finalIdle);
      this.actions.idle.setLoop(THREE.LoopRepeat, Infinity);
    }
    if (finalWalk) {
      this.actions.walk = this.mixer.clipAction(finalWalk);
      this.actions.walk.setLoop(THREE.LoopRepeat, Infinity);
    }
    if (finalRun && finalRun !== finalWalk) {
      this.actions.run = this.mixer.clipAction(finalRun);
      this.actions.run.setLoop(THREE.LoopRepeat, Infinity);
    } else if (finalRun && finalRun === finalWalk) {
      this.actions.run = this.actions.walk;
    }
    if (finalJump) {
      this.actions.jump = this.mixer.clipAction(finalJump);
      this.actions.jump.setLoop(THREE.LoopOnce, 1);
      this.actions.jump.clampWhenFinished = true;
    }

    // Default to idle state
    if (this.actions.idle) {
      this.currentAction = this.actions.idle;
      this.currentState = 'idle';
      this.currentAction.reset().play();
    } else {
      this.currentAction = null;
      this.currentState = 'idle';
    }

    this.info = {
      hasAnimations: workingClips.length > 0,
      clipCount: workingClips.length,
      clips: clipNames,
      clipDetails,
      matchedClips: {
        idle: finalIdle?.name,
        walk: finalWalk?.name,
        run: finalRun?.name,
        jump: finalJump?.name,
      },
      activeState: this.currentState,
      isCustomPlaying: false,
      playbackSpeed: 1.0,
      isPaused: false,
    };

    return this.info;
  }

  /**
   * Triggers a specific chosen animation from the "Show Animation" panel.
   */
  public playClip(name: string, speed = 1.0, loop = true): boolean {
    if (!this.mixer) return false;
    const action = this.allActions.get(name);
    if (!action) return false;

    this.currentSpeed = speed;
    this.isPausedState = false;
    action.enabled = true;
    action.paused = false;
    action.setEffectiveTimeScale(speed);
    action.setEffectiveWeight(1);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;

    const prev = this.currentAction;
    if (prev && prev !== action) {
      action.reset();
      prev.crossFadeTo(action, 0.22, true);
    } else {
      action.reset().fadeIn(0.2);
    }

    action.play();
    this.currentAction = action;
    this.isManualOverride = true;
    this.manualClipName = name;
    this.currentState = 'custom';

    this.info.activeState = 'custom';
    this.info.activeClipName = name;
    this.info.isCustomPlaying = true;
    this.info.isPaused = false;
    this.info.playbackSpeed = speed;

    return true;
  }

  /**
   * Stops manual override and returns character to standard auto-locomotion (idle/walk/run/jump).
   */
  public stopCustomAnimation() {
    this.isManualOverride = false;
    this.manualClipName = undefined;
    this.isPausedState = false;
    this.currentState = 'none';

    this.info.activeState = 'none';
    this.info.activeClipName = undefined;
    this.info.isCustomPlaying = false;
    this.info.isPaused = false;
  }

  /**
   * Sets playback speed for currently active animation.
   */
  public setPlaybackSpeed(speed: number) {
    this.currentSpeed = Math.max(0.1, Math.min(speed, 4.0));
    this.info.playbackSpeed = this.currentSpeed;
    if (this.currentAction) {
      this.currentAction.setEffectiveTimeScale(this.currentSpeed);
    }
  }

  /**
   * Toggles pause/resume on the active animation.
   */
  public togglePause(): boolean {
    if (!this.currentAction) return false;
    this.isPausedState = !this.isPausedState;
    this.currentAction.paused = this.isPausedState;
    this.info.isPaused = this.isPausedState;
    return this.isPausedState;
  }

  public get isPaused(): boolean {
    return this.isPausedState;
  }

  public get isCustomPlaying(): boolean {
    return this.isManualOverride;
  }

  public get activeClipName(): string | undefined {
    return this.manualClipName;
  }

  /**
   * Per-frame update called inside the animation loop.
   */
  public update(
    isMoving: boolean,
    isSprinting: boolean,
    isGrounded: boolean,
    delta: number
  ) {
    if (!this.mixer) return;

    // 1. Manual Animation Override Mode (active via Show Animation panel)
    if (this.isManualOverride && this.currentAction) {
      if (!this.isPausedState) {
        this.mixer.update(delta);
      }
      return;
    }

    // 2. Standard Locomotion Mode (Blend between Idle / Walk / Run / Jump)
    let targetState: 'idle' | 'walk' | 'run' | 'jump' = 'idle';

    if (!isGrounded && this.actions.jump) {
      targetState = 'jump';
    } else if (isMoving) {
      targetState = isSprinting ? 'run' : 'walk';
    } else {
      targetState = 'idle';
    }

    if (targetState !== this.currentState) {
      const prevAction = this.currentAction;
      const nextAction = this.actions[targetState];

      if (nextAction) {
        nextAction.enabled = true;
        nextAction.setEffectiveWeight(1);
        nextAction.setEffectiveTimeScale(1);

        if (prevAction && prevAction !== nextAction) {
          nextAction.reset();
          prevAction.crossFadeTo(nextAction, 0.2, true);
        } else if (!prevAction) {
          nextAction.reset().fadeIn(0.18);
        }

        nextAction.play();
        this.currentAction = nextAction;
      } else if (!nextAction && prevAction) {
        prevAction.fadeOut(0.2);
        this.currentAction = null;
      }

      this.currentState = targetState;
      this.info.activeState = targetState;
    }

    // Speed modulation for standard locomotion
    if (this.currentAction) {
      const isSharedWalkRun = this.actions.run === this.actions.walk;
      if (this.currentState === 'run') {
        this.currentAction.timeScale = isSharedWalkRun ? 1.7 : 1.3;
      } else {
        this.currentAction.timeScale = 1.0;
      }
    }

    this.mixer.update(delta);
  }

  public getInfo(): AnimationDetectionInfo {
    return this.info;
  }

  public get hasAnimations(): boolean {
    return this.info.hasAnimations;
  }

  public dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }
    this.actions = {};
    this.allActions.clear();
    this.allClips = [];
    this.currentAction = null;
    this.currentState = 'none';
    this.isManualOverride = false;
    this.manualClipName = undefined;
    this.isPausedState = false;
    this.info = {
      hasAnimations: false,
      clipCount: 0,
      clips: [],
      clipDetails: [],
      matchedClips: {},
      activeState: 'none',
      isCustomPlaying: false,
      playbackSpeed: 1.0,
      isPaused: false,
    };
  }

  /**
   * Helper to generate lightweight procedural clips for models lacking embedded keyframes.
   */
  private createProceduralClips(root: THREE.Object3D): THREE.AnimationClip[] {
    const clips: THREE.AnimationClip[] = [];

    // 1. Obrót 360° (Turntable)
    const rotTimes = [0, 1.5, 3];
    const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 2);
    const rotValues = [q0.x, q0.y, q0.z, q0.w, q1.x, q1.y, q1.z, q1.w, q2.x, q2.y, q2.z, q2.w];
    const rotTrack = new THREE.QuaternionKeyframeTrack('.quaternion', rotTimes, rotValues);
    clips.push(new THREE.AnimationClip('Procedural: Obrót 360° (Turntable)', 3, [rotTrack]));

    // 2. Bujanie postaci (Groove Sway)
    const swayTimes = [0, 0.5, 1.0, 1.5, 2.0];
    const sq0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0);
    const sq1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.08);
    const sq2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0);
    const sq3 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.08);
    const sq4 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0);
    const swayValues = [
      sq0.x, sq0.y, sq0.z, sq0.w,
      sq1.x, sq1.y, sq1.z, sq1.w,
      sq2.x, sq2.y, sq2.z, sq2.w,
      sq3.x, sq3.y, sq3.z, sq3.w,
      sq4.x, sq4.y, sq4.z, sq4.w,
    ];
    const swayTrack = new THREE.QuaternionKeyframeTrack('.quaternion', swayTimes, swayValues);
    clips.push(new THREE.AnimationClip('Procedural: Bujanie / Groove', 2.0, [swayTrack]));

    // 3. Oddychanie (Breathing scale pulse)
    const breathTimes = [0, 1.2, 2.4];
    const breathValues = [1, 1, 1, 1.02, 1.04, 1.02, 1, 1, 1];
    const breathTrack = new THREE.VectorKeyframeTrack('.scale', breathTimes, breathValues);
    clips.push(new THREE.AnimationClip('Procedural: Oddychanie (Idle)', 2.4, [breathTrack]));

    return clips;
  }
}
