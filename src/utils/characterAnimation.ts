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
   * Constructs a natural standing Idle AnimationClip with lowered arms, clear elbow flexion (bend),
   * relaxed wrists, and subtle breathing for rigged characters lacking an idle animation.
   */
  private createNaturalIdleClip(rootObject: THREE.Object3D): THREE.AnimationClip | null {
    let leftArm: THREE.Object3D | undefined;
    let rightArm: THREE.Object3D | undefined;
    let leftForeArm: THREE.Object3D | undefined;
    let rightForeArm: THREE.Object3D | undefined;
    let leftHand: THREE.Object3D | undefined;
    let rightHand: THREE.Object3D | undefined;
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
      // Match ForeArms (elbows)
      if (
        !leftForeArm &&
        (lower.includes('leftforearm') ||
          lower.includes('forearm_l') ||
          lower.includes('left_forearm') ||
          lower.includes('lowerarm_l'))
      ) {
        leftForeArm = node;
      }
      if (
        !rightForeArm &&
        (lower.includes('rightforearm') ||
          lower.includes('forearm_r') ||
          lower.includes('right_forearm') ||
          lower.includes('lowerarm_r'))
      ) {
        rightForeArm = node;
      }
      // Match Hands / Wrists
      if (
        !leftHand &&
        (lower.includes('lefthand') || lower.includes('hand_l') || lower.includes('left_hand')) &&
        !lower.includes('middle') &&
        !lower.includes('thumb') &&
        !lower.includes('index')
      ) {
        leftHand = node;
      }
      if (
        !rightHand &&
        (lower.includes('righthand') || lower.includes('hand_r') || lower.includes('right_hand')) &&
        !lower.includes('middle') &&
        !lower.includes('thumb') &&
        !lower.includes('index')
      ) {
        rightHand = node;
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

    // 1. Left Upper Arm: Lowered by ~60° (not glued to body), tilted forward ~12°
    if (leftArm) {
      const qOrigL = leftArm.quaternion.clone();
      const qDownL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (-60 * Math.PI) / 180);
      const qFwdL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (12 * Math.PI) / 180);
      const qRelaxedL = qOrigL.clone().multiply(qDownL).multiply(qFwdL);

      // Subtle breathing motion
      const qBreatheL = qRelaxedL
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (1.5 * Math.PI) / 180));

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${leftArm.name}.quaternion`, times, [
          qRelaxedL.x, qRelaxedL.y, qRelaxedL.z, qRelaxedL.w,
          qBreatheL.x, qBreatheL.y, qBreatheL.z, qBreatheL.w,
          qRelaxedL.x, qRelaxedL.y, qRelaxedL.z, qRelaxedL.w,
        ])
      );
    }

    // 2. Right Upper Arm: Lowered by ~60°, tilted forward ~10°
    if (rightArm) {
      const qOrigR = rightArm.quaternion.clone();
      const qDownR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (60 * Math.PI) / 180);
      const qFwdR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (-10 * Math.PI) / 180);
      const qRelaxedR = qOrigR.clone().multiply(qDownR).multiply(qFwdR);

      const qBreatheR = qRelaxedR
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (-1.5 * Math.PI) / 180));

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${rightArm.name}.quaternion`, times, [
          qRelaxedR.x, qRelaxedR.y, qRelaxedR.z, qRelaxedR.w,
          qBreatheR.x, qBreatheR.y, qBreatheR.z, qBreatheR.w,
          qRelaxedR.x, qRelaxedR.y, qRelaxedR.z, qRelaxedR.w,
        ])
      );
    }

    // 3. Left Forearm: Visible natural elbow flexion (~26° forward) + slight inward angle (~6°)
    if (leftForeArm) {
      const qOrigForeL = leftForeArm.quaternion.clone();
      const qElbowL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (26 * Math.PI) / 180);
      const qInL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (6 * Math.PI) / 180);
      const qBentL = qOrigForeL.clone().multiply(qElbowL).multiply(qInL);

      const qBreatheForeL = qBentL
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (1.0 * Math.PI) / 180));

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${leftForeArm.name}.quaternion`, times, [
          qBentL.x, qBentL.y, qBentL.z, qBentL.w,
          qBreatheForeL.x, qBreatheForeL.y, qBreatheForeL.z, qBreatheForeL.w,
          qBentL.x, qBentL.y, qBentL.z, qBentL.w,
        ])
      );
    }

    // 4. Right Forearm: Visible natural elbow flexion (~35° forward) + slight inward angle (~-6°)
    if (rightForeArm) {
      const qOrigForeR = rightForeArm.quaternion.clone();
      const qElbowR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (35 * Math.PI) / 180);
      const qInR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (-6 * Math.PI) / 180);
      const qBentR = qOrigForeR.clone().multiply(qElbowR).multiply(qInR);

      const qBreatheForeR = qBentR
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (-1.0 * Math.PI) / 180));

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${rightForeArm.name}.quaternion`, times, [
          qBentR.x, qBentR.y, qBentR.z, qBentR.w,
          qBreatheForeR.x, qBreatheForeR.y, qBreatheForeR.z, qBreatheForeR.w,
          qBentR.x, qBentR.y, qBentR.z, qBentR.w,
        ])
      );
    }

    // 5. Wrists / Hands: Relaxed inward orientation next to thighs
    if (leftHand) {
      const qOrigHandL = leftHand.quaternion.clone();
      const qRelaxHandL = qOrigHandL
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (-10 * Math.PI) / 180));

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${leftHand.name}.quaternion`, times, [
          qRelaxHandL.x, qRelaxHandL.y, qRelaxHandL.z, qRelaxHandL.w,
          qRelaxHandL.x, qRelaxHandL.y, qRelaxHandL.z, qRelaxHandL.w,
          qRelaxHandL.x, qRelaxHandL.y, qRelaxHandL.z, qRelaxHandL.w,
        ])
      );
    }

    if (rightHand) {
      const qOrigHandR = rightHand.quaternion.clone();
      const qRelaxHandR = qOrigHandR
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (10 * Math.PI) / 180));

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${rightHand.name}.quaternion`, times, [
          qRelaxHandR.x, qRelaxHandR.y, qRelaxHandR.z, qRelaxHandR.w,
          qRelaxHandR.x, qRelaxHandR.y, qRelaxHandR.z, qRelaxHandR.w,
          qRelaxHandR.x, qRelaxHandR.y, qRelaxHandR.z, qRelaxHandR.w,
        ])
      );
    }

    // 6. Spine: Subtle breathing expansion
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

    return new THREE.AnimationClip('Spoczynek_NaturalneRece', 3.2, tracks);
  }
}
