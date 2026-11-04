import * as THREE from 'three';

export interface AnimationDetectionInfo {
  hasAnimations: boolean;
  clipCount: number;
  clips: string[];
  matchedClips: {
    idle?: string;
    walk?: string;
    run?: string;
    jump?: string;
  };
  activeState: 'idle' | 'walk' | 'run' | 'jump' | 'none';
}

export class CharacterAnimationController {
  private mixer: THREE.AnimationMixer | null = null;
  private actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
    jump?: THREE.AnimationAction;
  } = {};
  private currentAction: THREE.AnimationAction | null = null;
  private currentState: 'idle' | 'walk' | 'run' | 'jump' | 'none' = 'none';
  private info: AnimationDetectionInfo = {
    hasAnimations: false,
    clipCount: 0,
    clips: [],
    matchedClips: {},
    activeState: 'none',
  };

  /**
   * Scans GLTF animation clips, identifies locomotion clips (walk/run/idle/jump),
   * and prepares smooth cross-fading actions.
   */
  public setup(rootObject: THREE.Object3D, clips: THREE.AnimationClip[]): AnimationDetectionInfo {
    this.dispose();

    if (!clips || clips.length === 0) {
      this.info = {
        hasAnimations: false,
        clipCount: 0,
        clips: [],
        matchedClips: {},
        activeState: 'none',
      };
      return this.info;
    }

    this.mixer = new THREE.AnimationMixer(rootObject);
    const clipNames = clips.map((c) => c.name || 'Unnamed');

    // Categorization helper
    const findClip = (keywords: string[]): THREE.AnimationClip | undefined => {
      return clips.find((c) => {
        const lower = (c.name || '').toLowerCase();
        return keywords.some((kw) => lower.includes(kw));
      });
    };

    // 1. Walk keywords (Polish, English, standard GLTF naming)
    const walkClip = findClip([
      'walk',
      'chod',
      'chód',
      'step',
      'march',
      'strut',
      'move',
      'locomotion_walk',
      'wlk',
    ]);

    // 2. Run keywords
    const runClip = findClip([
      'run',
      'bieg',
      'sprint',
      'dash',
      'fast',
      'trot',
      'jog',
      'locomotion_run',
    ]);

    // 3. Idle keywords
    const idleClip = findClip([
      'idle',
      'stand',
      'spoczynek',
      'rest',
      'wait',
      'breath',
      'pose',
      'stop',
      'default',
    ]);

    // 4. Jump keywords
    const jumpClip = findClip(['jump', 'skok', 'leap', 'fall', 'air']);

    // Fallbacks if clips don't match standard naming conventions:
    let finalWalk = walkClip;
    let finalRun = runClip;
    let finalIdle = idleClip;
    const finalJump = jumpClip;

    if (!finalWalk && !finalRun) {
      if (clips.length === 1) {
        // Single animation in model: use it for movement!
        finalWalk = clips[0];
        finalRun = clips[0];
      } else if (clips.length >= 2) {
        // If one is idle, choose the other for walk
        const nonIdle = clips.find((c) => c !== finalIdle);
        if (nonIdle) {
          finalWalk = nonIdle;
        } else {
          finalWalk = clips[0];
        }
      }
    }

    // If walk exists but run does not: run uses walk with higher playback speed
    if (finalWalk && !finalRun) {
      finalRun = finalWalk;
    }
    // If run exists but walk does not: walk uses run with lower playback speed
    if (finalRun && !finalWalk) {
      finalWalk = finalRun;
    }

    // If model lacks an Idle animation clip, construct a natural Idle clip
    // that lowers the arms gracefully along the torso with gentle breathing!
    if (!finalIdle) {
      finalIdle = this.createNaturalIdleClip(rootObject) || undefined;
    }

    // Create AnimationActions
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

    // Initialize in idle state
    if (this.actions.idle) {
      this.currentAction = this.actions.idle;
      this.currentState = 'idle';
      this.currentAction.reset().play();
    } else {
      // If model has no idle animation, start with no active action
      // so on the very first movement the locomotion action starts immediately
      this.currentAction = null;
      this.currentState = 'idle';
    }

    this.info = {
      hasAnimations: true,
      clipCount: clips.length,
      clips: clipNames,
      matchedClips: {
        idle: finalIdle?.name,
        walk: finalWalk?.name,
        run: finalRun?.name,
        jump: finalJump?.name,
      },
      activeState: this.currentState,
    };

    return this.info;
  }

  /**
   * Per-frame update called inside the animation loop.
   * Blends smoothly between Idle, Walk, Run, and Jump based on player input.
   */
  public update(
    isMoving: boolean,
    isSprinting: boolean,
    isGrounded: boolean,
    delta: number
  ) {
    if (!this.mixer) return;

    let targetState: 'idle' | 'walk' | 'run' | 'jump' = 'idle';

    if (!isGrounded && this.actions.jump) {
      targetState = 'jump';
    } else if (isMoving) {
      targetState = isSprinting ? 'run' : 'walk';
    } else {
      targetState = 'idle';
    }

    // Smooth state transition
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
        // No clip for target state (e.g. stopped, but no idle clip): smoothly fade out current movement
        prevAction.fadeOut(0.2);
        this.currentAction = null;
      }

      this.currentState = targetState;
      this.info.activeState = targetState;
    }

    // Speed modulation (sprinting boosts walk/run timeScale)
    if (this.currentAction) {
      const isSharedWalkRun = this.actions.run === this.actions.walk;

      if (this.currentState === 'run') {
        this.currentAction.timeScale = isSharedWalkRun ? 1.7 : 1.3;
      } else if (this.currentState === 'walk') {
        this.currentAction.timeScale = 1.0;
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
    this.currentAction = null;
    this.currentState = 'none';
    this.info = {
      hasAnimations: false,
      clipCount: 0,
      clips: [],
      matchedClips: {},
      activeState: 'none',
    };
  }

  /**
   * Constructs a natural standing Idle AnimationClip with lowered arms and subtle breathing
   * for rigged characters (e.g. Mixamo / Meshy) that lack a dedicated idle animation.
   */
  private createNaturalIdleClip(rootObject: THREE.Object3D): THREE.AnimationClip | null {
    let leftArm: THREE.Object3D | undefined;
    let rightArm: THREE.Object3D | undefined;
    let spine: THREE.Object3D | undefined;

    rootObject.traverse((node) => {
      const lower = node.name.toLowerCase();
      // Match LeftArm (upper arm)
      if (
        !leftArm &&
        (lower.includes('leftarm') ||
          lower.includes('arm_l') ||
          lower.includes('left_arm') ||
          lower.includes('arm.l') ||
          lower.includes('leftupperarm')) &&
        !lower.includes('fore') &&
        !lower.includes('hand')
      ) {
        leftArm = node;
      }
      // Match RightArm (upper arm)
      if (
        !rightArm &&
        (lower.includes('rightarm') ||
          lower.includes('arm_r') ||
          lower.includes('right_arm') ||
          lower.includes('arm.r') ||
          lower.includes('rightupperarm')) &&
        !lower.includes('fore') &&
        !lower.includes('hand')
      ) {
        rightArm = node;
      }
      // Match Spine/Chest for subtle breathing
      if (!spine && (lower.includes('spine2') || lower.includes('chest') || lower.includes('spine1'))) {
        spine = node;
      }
    });

    if (!leftArm && !rightArm) {
      return null;
    }

    const tracks: THREE.KeyframeTrack[] = [];
    const times = [0, 1.6, 3.2];

    // Left Arm: Rotate ~68 degrees down along local Z, with subtle breathing sway
    if (leftArm) {
      const qOrig = leftArm.quaternion.clone();
      const deltaQDown = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        (-68 * Math.PI) / 180
      );
      const qLowered = qOrig.clone().multiply(deltaQDown);

      // Subtle breathing motion
      const qBreathe = qLowered
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (1.5 * Math.PI) / 180));

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${leftArm.name}.quaternion`, times, [
          qLowered.x, qLowered.y, qLowered.z, qLowered.w,
          qBreathe.x, qBreathe.y, qBreathe.z, qBreathe.w,
          qLowered.x, qLowered.y, qLowered.z, qLowered.w,
        ])
      );
    }

    // Right Arm: Rotate ~68 degrees down along local Z, with subtle breathing sway
    if (rightArm) {
      const qOrig = rightArm.quaternion.clone();
      const deltaQDown = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        (68 * Math.PI) / 180
      );
      const qLowered = qOrig.clone().multiply(deltaQDown);

      const qBreathe = qLowered
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (-1.5 * Math.PI) / 180));

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${rightArm.name}.quaternion`, times, [
          qLowered.x, qLowered.y, qLowered.z, qLowered.w,
          qBreathe.x, qBreathe.y, qBreathe.z, qBreathe.w,
          qLowered.x, qLowered.y, qLowered.z, qLowered.w,
        ])
      );
    }

    // Spine breathing expansion
    if (spine) {
      const qOrig = spine.quaternion.clone();
      const qBreathe = qOrig
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (1.2 * Math.PI) / 180));

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${spine.name}.quaternion`, times, [
          qOrig.x, qOrig.y, qOrig.z, qOrig.w,
          qBreathe.x, qBreathe.y, qBreathe.z, qBreathe.w,
          qOrig.x, qOrig.y, qOrig.z, qOrig.w,
        ])
      );
    }

    if (tracks.length === 0) return null;

    return new THREE.AnimationClip('Spoczynek_OpuszczoneRece', 3.2, tracks);
  }
}
