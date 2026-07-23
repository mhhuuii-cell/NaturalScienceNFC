/*
 * 動物單元 Intro Animation 自然環境音管理器
 *
 * 所有素材、音量、淡入淡出與 Scene 配置都集中在此檔案。
 * intro.js 只負責把畫面事件交給 AudioManager，不直接操作個別音軌。
 */

export const INTRO_AUDIO_MANIFEST = Object.freeze({
  forest: {
    src: "media/intro/audio/forest-ambience.mp3",
    enabled: true,
    loop: true
  },
  distantBirds: {
    src: "media/intro/audio/distant-birds.mp3",
    enabled: true,
    loop: true
  },
  softInsects: {
    src: "media/intro/audio/soft-insects.mp3",
    enabled: true,
    loop: true
  },
  grassRustle: {
    src: "media/intro/audio/grass-rustle.mp3",
    enabled: true,
    loop: true
  },
  waterStream: {
    src: "media/intro/audio/water-stream.mp3",
    enabled: true,
    loop: true
  },
  waterRipple: {
    src: "media/intro/audio/water-ripple.mp3",
    enabled: true,
    loop: false
  },
  wingFlutter: {
    src: "media/intro/audio/wing-flutter.mp3",
    enabled: true,
    loop: false
  }
});

/*
 * 音量為 HTMLAudioElement 的線性音量值。
 * Scene 4、5、6 依目前畫面內容，分別對應羽毛、草叢與水面線索。
 */
export const INTRO_SCENE_AUDIO = Object.freeze({
  1: {
    mix: { forest: 0.18 },
    fadeMs: 1800
  },
  2: {
    mix: { forest: 0.20, grassRustle: 0.06 },
    fadeMs: 1400
  },
  3: {
    mix: { forest: 0.20, distantBirds: 0.08, softInsects: 0.05 },
    fadeMs: 1200
  },
  4: {
    mix: { forest: 0.19, distantBirds: 0.055 },
    cues: [{ id: "wingFlutter", volume: 0.08 }],
    fadeMs: 900
  },
  5: {
    mix: { forest: 0.18, grassRustle: 0.10 },
    fadeMs: 900
  },
  6: {
    mix: { forest: 0.14, waterStream: 0.11 },
    cues: [{ id: "waterRipple", volume: 0.10 }],
    fadeMs: 900
  },
  7: {
    mix: { forest: 0.18, distantBirds: 0.06 },
    fadeMs: 1100
  },
  8: {
    mix: { forest: 0.20, distantBirds: 0.08, softInsects: 0.05 },
    fadeMs: 1100
  },
  9: {
    mix: { forest: 0.15, distantBirds: 0.035, softInsects: 0.02 },
    fadeMs: 1400
  },
  10: {
    mix: { forest: 0.16, distantBirds: 0.05 },
    fadeMs: 1300
  },
  11: {
    mix: { forest: 0.12, distantBirds: 0.035, softInsects: 0.018 },
    fadeMs: 1500
  },
  12: {
    mix: { forest: 0.09, distantBirds: 0.025 },
    fadeMs: 1700
  }
});

export class AudioManager {
  constructor({
    manifest = INTRO_AUDIO_MANIFEST,
    sceneAudio = INTRO_SCENE_AUDIO,
    masterVolume = 1,
    onStateChange = null
  } = {}) {
    this.manifest = manifest;
    this.sceneAudio = sceneAudio;
    this.masterVolume = this.clampVolume(masterVolume);
    this.onStateChange = typeof onStateChange === "function" ? onStateChange : null;
    this.tracks = new Map();
    this.fadeFrames = new Map();
    this.currentScene = 1;
    this.unlocked = false;
    this.muted = false;
    this.suspended = false;

    this.prepareEnabledTracks();
  }

  prepareEnabledTracks() {
    Object.entries(this.manifest).forEach(([id, config]) => {
      if (!config.enabled) {
        return;
      }

      const audio = new Audio(new URL(config.src, document.baseURI).href);
      audio.preload = "auto";
      audio.loop = Boolean(config.loop);
      audio.volume = 0;

      const track = {
        audio,
        config,
        desiredVolume: 0,
        failed: false
      };

      audio.addEventListener("error", () => {
        track.failed = true;
        this.cancelFade(id);
        console.warn(`Intro audio unavailable: ${config.src}`);
        this.emitState();
      });

      this.tracks.set(id, track);
    });
  }

  async unlock() {
    if (this.unlocked) {
      return true;
    }

    const unlockTasks = [...this.tracks.values()].map(async (track) => {
      if (track.failed) {
        return false;
      }

      const { audio } = track;
      const originalVolume = audio.volume;
      audio.volume = 0;

      try {
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.volume = originalVolume;
        return true;
      } catch (error) {
        audio.volume = originalVolume;
        if (error?.name !== "AbortError") {
          console.warn("Intro audio unlock failed:", error);
        }
        return false;
      }
    });

    const results = await Promise.all(unlockTasks);
    this.unlocked = results.some(Boolean) || this.tracks.size === 0;

    if (this.unlocked && !this.muted && !this.suspended) {
      await this.applyScene(this.currentScene, { replayCues: false });
    }

    this.emitState();
    return this.unlocked;
  }

  async setScene(sceneNumber) {
    this.stopTransientCues();
    this.currentScene = sceneNumber;
    this.syncDesiredVolumes(sceneNumber);

    if (!this.unlocked || this.muted || this.suspended) {
      this.emitState();
      return;
    }

    await this.applyScene(sceneNumber, { replayCues: true });
  }

  stopTransientCues() {
    this.tracks.forEach((track, id) => {
      if (track.config.loop) {
        return;
      }

      this.cancelFade(id);
      track.desiredVolume = 0;
      track.audio.volume = 0;
      track.audio.pause();
      track.audio.currentTime = 0;
    });
  }

  syncDesiredVolumes(sceneNumber) {
    const mix = this.sceneAudio[sceneNumber]?.mix || {};

    this.tracks.forEach((track, id) => {
      track.desiredVolume = this.clampVolume(mix[id] ?? 0) * this.masterVolume;
    });
  }

  async applyScene(sceneNumber, { replayCues = false } = {}) {
    const scene = this.sceneAudio[sceneNumber] || { mix: {} };
    const mix = scene.mix || {};
    const fadeMs = scene.fadeMs ?? 1100;

    const transitions = [...this.tracks.keys()].map((id) => {
      const targetVolume = mix[id] ?? 0;
      return targetVolume > 0
        ? this.play(id, targetVolume, fadeMs)
        : this.stop(id, Math.min(fadeMs, 900));
    });

    await Promise.all(transitions);

    if (replayCues && Array.isArray(scene.cues) && !this.muted && !this.suspended) {
      scene.cues.forEach(({ id, volume }) => {
        void this.play(id, volume, 260, { restart: true });
      });
    }

    this.emitState();
  }

  async play(id, volume, fadeMs = 800, { restart = false } = {}) {
    const track = this.tracks.get(id);
    if (!track || track.failed) {
      return false;
    }

    const targetVolume = this.clampVolume(volume) * this.masterVolume;
    track.desiredVolume = targetVolume;

    if (!this.unlocked || this.muted || this.suspended) {
      return false;
    }

    if (restart) {
      track.audio.currentTime = 0;
    }

    if (track.audio.paused) {
      try {
        await track.audio.play();
      } catch (error) {
        console.warn(`Intro audio could not play: ${track.config.src}`, error);
        return false;
      }
    }

    this.fadeTo(id, targetVolume, fadeMs);
    return true;
  }

  stop(id, fadeMs = 700) {
    const track = this.tracks.get(id);
    if (!track) {
      return Promise.resolve(false);
    }

    track.desiredVolume = 0;

    if (track.audio.paused || !this.unlocked) {
      track.audio.volume = 0;
      if (!track.config.loop) {
        track.audio.currentTime = 0;
      }
      return Promise.resolve(true);
    }

    this.fadeTo(id, 0, fadeMs, () => {
      track.audio.pause();
      if (!track.config.loop) {
        track.audio.currentTime = 0;
      }
    });

    return Promise.resolve(true);
  }

  setVolume(id, volume, fadeMs = 500) {
    const track = this.tracks.get(id);
    if (!track) {
      return false;
    }

    const targetVolume = this.clampVolume(volume) * this.masterVolume;
    track.desiredVolume = targetVolume;

    if (!this.muted && !this.suspended) {
      this.fadeTo(id, targetVolume, fadeMs);
    }

    return true;
  }

  setMasterVolume(volume, fadeMs = 500) {
    this.masterVolume = this.clampVolume(volume);
    const mix = this.sceneAudio[this.currentScene]?.mix || {};

    this.tracks.forEach((track, id) => {
      track.desiredVolume = this.clampVolume(mix[id] ?? 0) * this.masterVolume;
      if (!this.muted && !this.suspended) {
        this.fadeTo(id, track.desiredVolume, fadeMs);
      }
    });
  }

  async setMuted(shouldMute) {
    const nextMuted = Boolean(shouldMute);
    if (this.muted === nextMuted) {
      return this.muted;
    }

    this.muted = nextMuted;

    if (this.muted) {
      this.cancelAllFades();
      this.tracks.forEach(({ audio }) => {
        audio.volume = 0;
        audio.pause();
      });
    } else if (this.unlocked && !this.suspended) {
      await this.applyScene(this.currentScene, { replayCues: false });
    }

    this.emitState();
    return this.muted;
  }

  async toggleMuted() {
    await this.setMuted(!this.muted);
    return this.muted;
  }

  pauseAll() {
    this.suspended = true;
    this.cancelAllFades();
    this.tracks.forEach(({ audio }) => audio.pause());
    this.emitState();
  }

  async resumeScene() {
    this.suspended = false;
    if (this.unlocked && !this.muted) {
      await this.applyScene(this.currentScene, { replayCues: false });
    }
    this.emitState();
  }

  resetForReplay() {
    this.cancelAllFades();
    this.suspended = false;
    this.currentScene = 1;

    this.tracks.forEach((track) => {
      track.desiredVolume = 0;
      track.audio.volume = 0;
      track.audio.pause();
      track.audio.currentTime = 0;
    });

    this.emitState();
  }

  stopAll({ immediate = false } = {}) {
    this.cancelAllFades();

    this.tracks.forEach(({ audio }, id) => {
      if (immediate) {
        audio.volume = 0;
        audio.pause();
        audio.currentTime = 0;
      } else {
        void this.stop(id, 500);
      }
    });
  }

  fadeTo(id, targetVolume, duration, onComplete) {
    const track = this.tracks.get(id);
    if (!track) {
      onComplete?.();
      return;
    }

    this.cancelFade(id);

    const startVolume = track.audio.volume;
    const safeTarget = this.clampVolume(targetVolume);

    if (duration <= 0 || startVolume === safeTarget) {
      track.audio.volume = safeTarget;
      onComplete?.();
      return;
    }

    const startedAt = performance.now();

    const step = (now) => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      track.audio.volume = this.clampVolume(
        startVolume + (safeTarget - startVolume) * eased
      );

      if (progress < 1) {
        this.fadeFrames.set(id, requestAnimationFrame(step));
      } else {
        this.fadeFrames.delete(id);
        onComplete?.();
      }
    };

    this.fadeFrames.set(id, requestAnimationFrame(step));
  }

  cancelFade(id) {
    const frame = this.fadeFrames.get(id);
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      this.fadeFrames.delete(id);
    }
  }

  cancelAllFades() {
    this.fadeFrames.forEach((frame) => cancelAnimationFrame(frame));
    this.fadeFrames.clear();
  }

  getState() {
    return {
      unlocked: this.unlocked,
      muted: this.muted,
      suspended: this.suspended,
      currentScene: this.currentScene,
      tracks: [...this.tracks.entries()].map(([id, track]) => ({
        id,
        failed: track.failed,
        paused: track.audio.paused,
        currentTime: track.audio.currentTime,
        volume: track.audio.volume
      }))
    };
  }

  emitState() {
    this.onStateChange?.(this.getState());
  }

  clampVolume(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}

export function createIntroAudioManager(options) {
  return new AudioManager(options);
}
