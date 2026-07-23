import { createIntroAudioManager } from "./audio-manager.js";

(() => {
  "use strict";

  const scenes = [
    { name: "黑暗中，大自然甦醒", duration: 5000 },
    { name: "光線慢慢出現", duration: 6000 },
    { name: "線索出現了：腳印", duration: 4000 },
    { name: "一片羽毛飄落", duration: 4000 },
    { name: "草叢晃動", duration: 4000 },
    { name: "水面泛起漣漪", duration: 4000 },
    { name: "花朵旁的動靜", duration: 4000 },
    { name: "停留在同一處", duration: 10000 },
    { name: "一起活動的線索", duration: 6000 },
    { name: "環境恢復安靜", duration: 5000 },
    { name: "你發現了什麼", duration: 7000 },
    { name: "你想知道什麼", duration: null }
  ];

  const totalTimedDuration = scenes.reduce((total, scene) => {
    return total + (scene.duration || 0);
  }, 0);

  const sceneStartTimes = scenes.map((_, index) => {
    return scenes.slice(0, index).reduce((total, scene) => {
      return total + (scene.duration || 0);
    }, 0);
  });

  const stage = document.querySelector("#introStage");
  const sceneElements = [...document.querySelectorAll(".scene")];
  const sceneStatus = document.querySelector("#sceneStatus");
  const progressBar = document.querySelector("#progressBar");
  const prototypeMeta = document.querySelector(".prototype-meta");
  const prototypeProgress = document.querySelector(".prototype-progress");
  const prototypeControls = document.querySelector(".prototype-controls");
  const previousButton = document.querySelector("#previousScene");
  const toggleButton = document.querySelector("#togglePlayback");
  const nextButton = document.querySelector("#nextScene");
  const replayButton = document.querySelector("#replayIntro");
  const soundToggle = document.querySelector("#soundToggle");
  const reviewMode = new URLSearchParams(window.location.search).has("review");

  let currentIndex = -1;
  let currentTimer = null;
  let transitionTimer = null;
  let progressFrame = null;
  let sceneStartedAt = 0;
  let remainingTime = 0;
  let isPlaying = false;
  let wasPlayingBeforeHidden = false;
  const audioManager = createIntroAudioManager({
    onStateChange: updateSoundToggle
  });

  initializeSceneVideos();
  updateSoundToggle();
  void audioManager.setScene(1);

  function initializeSceneVideos() {
    sceneElements.forEach((scene) => {
      const singleSlot = scene.dataset.mediaSlot;
      const slotA = scene.dataset.mediaSlotA;
      const slotB = scene.dataset.mediaSlotB;

      if (singleSlot) {
        mountSceneVideo(scene, singleSlot, ".scene-visual");
      }

      if (slotA) {
        mountSceneVideo(scene, slotA, ".behavior-shot:nth-of-type(1)");
      }

      if (slotB) {
        mountSceneVideo(scene, slotB, ".behavior-shot:nth-of-type(2)");
      }
    });
  }

  function mountSceneVideo(scene, source, selector) {
    const host = scene.querySelector(selector);

    if (!host || host.querySelector("video.scene-media")) {
      return;
    }

    const video = document.createElement("video");
    video.className = "scene-media";
    video.src = source;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.loop = false;
    video.tabIndex = -1;
    video.setAttribute("aria-hidden", "true");
    host.appendChild(video);
  }

  function getSceneMedia(index) {
    if (index < 0 || index >= sceneElements.length) {
      return [];
    }

    return Array.from(sceneElements[index].querySelectorAll("video.scene-media"));
  }

  function pauseSceneMedia(index) {
    getSceneMedia(index).forEach((video) => {
      video.pause();
    });
  }

  function pauseAllSceneMedia() {
    sceneElements.forEach((_, index) => {
      pauseSceneMedia(index);
    });
  }

  function resetSceneMedia(index) {
    getSceneMedia(index).forEach((video) => {
      try {
        video.pause();
        video.currentTime = 0;
      } catch (error) {
        // Ignore videos that are not ready yet.
      }
    });
  }

  function playSceneMedia(index) {
    getSceneMedia(index).forEach((video) => {
      try {
        const playback = video.play();
        if (playback?.catch) {
          playback.catch(() => {});
        }
      } catch (error) {
        // Muted autoplay should work, but we fail silently if the browser blocks it.
      }
    });
  }

  async function requestAudioUnlock(event) {
    if (event?.target?.closest?.("#soundToggle")) {
      return;
    }

    const unlocked = await audioManager.unlock();
    if (unlocked) {
      window.removeEventListener("pointerdown", requestAudioUnlock);
      window.removeEventListener("keydown", requestAudioUnlock);
    }

    updateSoundToggle();
  }

  window.addEventListener("pointerdown", requestAudioUnlock, { passive: true });
  window.addEventListener("keydown", requestAudioUnlock);

  if (reviewMode) {
    prototypeMeta.hidden = false;
    prototypeProgress.hidden = false;
    prototypeControls.hidden = false;
    document.body.classList.add("review-mode");
  }

  function updateSoundToggle() {
    if (!soundToggle) {
      return;
    }

    if (!audioManager) {
      soundToggle.disabled = true;
      soundToggle.textContent = "環境音：載入中";
      soundToggle.setAttribute("aria-label", "自然環境音載入中");
      soundToggle.setAttribute("aria-pressed", "false");
      return;
    }

    soundToggle.disabled = false;

    if (!audioManager.unlocked) {
      soundToggle.textContent = "環境音：待啟動";
      soundToggle.setAttribute("aria-label", "開啟自然環境音");
      soundToggle.setAttribute("aria-pressed", "false");
      return;
    }

    const soundIsOn = !audioManager.muted;
    soundToggle.textContent = soundIsOn ? "環境音：開" : "環境音：關";
    soundToggle.setAttribute(
      "aria-label",
      soundIsOn ? "關閉自然環境音" : "開啟自然環境音"
    );
    soundToggle.setAttribute("aria-pressed", String(soundIsOn));
  }

  async function toggleSound() {
    if (!audioManager.unlocked) {
      const unlocked = await audioManager.unlock();
      if (unlocked) {
        window.removeEventListener("pointerdown", requestAudioUnlock);
        window.removeEventListener("keydown", requestAudioUnlock);
      }
    } else {
      await audioManager.toggleMuted();
    }

    updateSoundToggle();
  }

  function clearPlaybackTimer() {
    if (currentTimer !== null) {
      window.clearTimeout(currentTimer);
      currentTimer = null;
    }
  }

  function clearTransitionTimer() {
    if (transitionTimer !== null) {
      window.clearTimeout(transitionTimer);
      transitionTimer = null;
    }
  }

  function updateControls() {
    previousButton.disabled = currentIndex <= 0;
    nextButton.disabled = currentIndex >= scenes.length - 1;
    toggleButton.disabled = !scenes[currentIndex]?.duration;
    toggleButton.textContent = isPlaying ? "暫停" : "播放";
    toggleButton.setAttribute("aria-label", isPlaying ? "暫停動畫" : "繼續播放動畫");
  }

  function setProgress(percent) {
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function updateProgress() {
    if (currentIndex < 0) {
      setProgress(0);
      return;
    }

    const scene = scenes[currentIndex];
    let elapsedInScene = 0;

    if (scene.duration) {
      elapsedInScene = scene.duration - remainingTime;
      if (isPlaying) {
        elapsedInScene += performance.now() - sceneStartedAt;
      }
    }

    const elapsed = sceneStartTimes[currentIndex] + elapsedInScene;
    setProgress(currentIndex === scenes.length - 1 ? 100 : (elapsed / totalTimedDuration) * 100);

    if (isPlaying) {
      progressFrame = window.requestAnimationFrame(updateProgress);
    }
  }

  function stopProgressFrame() {
    if (progressFrame !== null) {
      window.cancelAnimationFrame(progressFrame);
      progressFrame = null;
    }
  }

  function scheduleCurrentScene() {
    const scene = scenes[currentIndex];

    if (!scene.duration || remainingTime <= 0) {
      isPlaying = false;
      stage.classList.add("is-paused");
      updateControls();
      updateProgress();
      return;
    }

    clearPlaybackTimer();
    stopProgressFrame();
    isPlaying = true;
    stage.classList.remove("is-paused");
    sceneStartedAt = performance.now();
    currentTimer = window.setTimeout(() => {
      showScene(currentIndex + 1, true);
    }, remainingTime);
    updateControls();
    progressFrame = window.requestAnimationFrame(updateProgress);
  }

  function showScene(index, autoplay = true) {
    if (index < 0 || index >= scenes.length) {
      return;
    }

    clearPlaybackTimer();
    clearTransitionTimer();
    stopProgressFrame();

    const previousScene = sceneElements[currentIndex];
    const nextScene = sceneElements[index];

    if (currentIndex >= 0) {
      pauseSceneMedia(currentIndex);
    }

    sceneElements.forEach((element, elementIndex) => {
      if (elementIndex !== currentIndex && elementIndex !== index) {
        element.classList.remove("is-active", "is-leaving");
        element.setAttribute("aria-hidden", "true");
      }
    });

    if (previousScene && previousScene !== nextScene) {
      previousScene.classList.remove("is-active");
      previousScene.classList.add("is-leaving");
      previousScene.setAttribute("aria-hidden", "true");
      transitionTimer = window.setTimeout(() => {
        previousScene.classList.remove("is-leaving");
      }, 950);
    }

    nextScene.classList.remove("is-leaving");

    // Force scene-specific CSS animations to restart when revisiting a scene.
    nextScene.classList.remove("is-active");
    void nextScene.offsetWidth;
    nextScene.classList.add("is-active");
    nextScene.setAttribute("aria-hidden", "false");

    currentIndex = index;
    remainingTime = scenes[index].duration || 0;
    sceneStatus.textContent = `Scene ${index + 1} / ${scenes.length} · ${scenes[index].name}`;
    void audioManager?.setScene(index + 1);
    resetSceneMedia(index);

    if (autoplay && scenes[index].duration) {
      playSceneMedia(index);
      scheduleCurrentScene();
    } else {
      isPlaying = false;
      if (scenes[index].duration) {
        stage.classList.add("is-paused");
      } else {
        // 最終停留畫面沒有倒數計時，但仍要讓淡入動畫自然完成。
        stage.classList.remove("is-paused");
      }
      updateControls();
      updateProgress();
    }
  }

  function pausePlayback() {
    if (!isPlaying) {
      return;
    }

    remainingTime = Math.max(0, remainingTime - (performance.now() - sceneStartedAt));
    isPlaying = false;
    clearPlaybackTimer();
    stopProgressFrame();
    stage.classList.add("is-paused");
    pauseSceneMedia(currentIndex);
    audioManager?.pauseAll();
    updateControls();
    updateProgress();
  }

  function resumePlayback() {
    if (isPlaying || currentIndex < 0 || !scenes[currentIndex].duration) {
      return;
    }

    playSceneMedia(currentIndex);
    scheduleCurrentScene();
    void audioManager?.resumeScene();
  }

  function togglePlayback() {
    if (isPlaying) {
      pausePlayback();
    } else {
      resumePlayback();
    }
  }

  previousButton.addEventListener("click", () => {
    showScene(Math.max(0, currentIndex - 1), true);
  });

  nextButton.addEventListener("click", () => {
    showScene(Math.min(scenes.length - 1, currentIndex + 1), true);
  });

  toggleButton.addEventListener("click", togglePlayback);
  replayButton.addEventListener("click", () => {
    audioManager?.resetForReplay();
    pauseAllSceneMedia();
    sceneElements.forEach((_, index) => resetSceneMedia(index));
    showScene(0, true);
  });
  soundToggle?.addEventListener("click", () => {
    void toggleSound();
  });

  document.addEventListener("keydown", (event) => {
    if (!reviewMode) {
      return;
    }

    if (event.key === " " && event.target === document.body) {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === "ArrowLeft") {
      showScene(Math.max(0, currentIndex - 1), true);
    } else if (event.key === "ArrowRight") {
      showScene(Math.min(scenes.length - 1, currentIndex + 1), true);
    } else if (event.key === "Home") {
      showScene(0, true);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      wasPlayingBeforeHidden = isPlaying || currentIndex === scenes.length - 1;

      if (isPlaying) {
        pausePlayback();
      } else {
        audioManager?.pauseAll();
        pauseSceneMedia(currentIndex);
      }
    } else if (wasPlayingBeforeHidden) {
      wasPlayingBeforeHidden = false;

      if (currentIndex === scenes.length - 1) {
        void audioManager?.resumeScene();
        playSceneMedia(currentIndex);
      } else {
        resumePlayback();
      }
    }
  });

  window.addEventListener("beforeunload", () => {
    clearPlaybackTimer();
    clearTransitionTimer();
    stopProgressFrame();
    pauseAllSceneMedia();
    audioManager?.stopAll({ immediate: true });
  });

  window.requestAnimationFrame(() => {
    showScene(0, true);
  });
})();
