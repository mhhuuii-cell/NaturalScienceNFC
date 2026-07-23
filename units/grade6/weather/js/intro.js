const intro = document.querySelector('.intro');
const startButton = document.querySelector('#start-exploration');
const rainLayer = document.querySelector('.rain-layer');
const debugOutput = document.querySelector('#intro-debug');
const activationScreen = document.querySelector('#activation-screen');
const activationError = document.querySelector('#activation-error');
const audioDebugPanel = document.querySelector('#audio-debug-panel');
const audioDebugStatus = document.querySelector('#audio-debug-status');
const audioTestButtons = document.querySelectorAll('[data-audio-test]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const debugValue = new URLSearchParams(window.location.search).get('debug');
const debugMode = debugValue === 'intro' || debugValue === 'visual';
const visualDebugMode = debugValue === 'visual';
const audioDebugMode = debugValue === 'audio';
const audioTracks = {
  drop: document.querySelector('#audio-drop'),
  wind: document.querySelector('#audio-wind'),
  birds: document.querySelector('#audio-birds')
};
const plannedVolumes = {
  drop: 0.65,
  wind: 0.2,
  birds: 0.15
};
const animationClasses = [
  'drop-fall',
  'splash',
  'ripple',
  'sky-transition',
  'cloud-pass',
  'light-rain',
  'rain-stopping',
  'sunlight-through',
  'mist-pass',
  'calm-sky',
  'narration-one',
  'narration-one-end',
  'narration-two',
  'narration-two-end',
  'explore-button'
];
const audioFadeTokens = new WeakMap();
const activeTimeouts = new Set();
const activeAnimationFrames = new Set();
const audioTestTimers = new Map();

let hasStarted = false;
let isStarting = false;
let isNavigating = false;
let lastPointerUpAt = 0;
let audioDebugTimer = 0;

const audioState = {
  startedAt: 0,
  unlocked: false,
  introStarted: false,
  dropPlayed: false,
  windTarget: 0,
  birdsTarget: 0,
  playErrors: {
    drop: '',
    wind: '',
    birds: ''
  }
};

const introState = {
  stages: [],
  rainCreated: 0,
  rainCompleted: 0
};

window.__introState = introState;
window.__introAudioState = audioState;

if (visualDebugMode) {
  intro.classList.add('visual-debug');
}

audioTracks.drop.loop = false;
audioTracks.wind.loop = true;
audioTracks.birds.loop = true;
audioTracks.drop.volume = plannedVolumes.drop;
audioTracks.wind.volume = 0;
audioTracks.birds.volume = 0;

const clampVolume = (volume) => Math.min(1, Math.max(0, volume));

const describeError = (error) => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
};

const recordAudioError = (trackName, error) => {
  const message = describeError(error);
  audioState.playErrors[trackName] = message;
  console.error(`[intro audio] ${trackName} play() failed`, error);
  return message;
};

const getLoadState = (audio) => {
  if (audio.error) {
    return `failed (${audio.error.code})`;
  }

  if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return 'loaded';
  }

  return 'loading';
};

const formatTrackState = (trackName) => {
  const audio = audioTracks[trackName];
  const error = audioState.playErrors[trackName];

  return [
    `${trackName} ${getLoadState(audio)}`,
    `  paused=${audio.paused}`,
    `volume=${audio.volume.toFixed(2)}`,
    `currentTime=${audio.currentTime.toFixed(2)}`,
    error ? `\n  play error: ${error}` : ''
  ].join(' ');
};

const updateAudioDebug = () => {
  if (!audioDebugMode || !audioDebugStatus) {
    return;
  }

  audioDebugStatus.textContent = [
    `audio ${audioState.unlocked ? 'unlocked' : 'locked'}`,
    `intro ${audioState.introStarted ? 'started' : 'not started'}`,
    formatTrackState('drop'),
    formatTrackState('wind'),
    formatTrackState('birds')
  ].join('\n');
};

const trackedTimeout = (callback, milliseconds) => {
  const timeoutId = window.setTimeout(() => {
    activeTimeouts.delete(timeoutId);
    callback();
  }, milliseconds);

  activeTimeouts.add(timeoutId);
  return timeoutId;
};

const delay = (milliseconds) => new Promise((resolve) => {
  trackedTimeout(resolve, milliseconds);
});

const trackedAnimationFrame = (callback) => {
  const frameId = window.requestAnimationFrame((timestamp) => {
    activeAnimationFrames.delete(frameId);
    callback(timestamp);
  });

  activeAnimationFrames.add(frameId);
  return frameId;
};

const playAudio = async (trackName, audio = audioTracks[trackName]) => {
  try {
    await audio.play();
    audioState.playErrors[trackName] = '';
    updateAudioDebug();
    return true;
  } catch (error) {
    recordAudioError(trackName, error);
    updateAudioDebug();
    return false;
  }
};

const fadeAudio = async (trackName, targetVolume, duration) => {
  const audio = audioTracks[trackName];
  const target = clampVolume(targetVolume);
  const fadeToken = Symbol('audio-fade');
  audioFadeTokens.set(audio, fadeToken);

  if (document.hidden || isNavigating && target > 0) {
    return false;
  }

  const canPlay = target === 0 && audio.paused
    ? true
    : await playAudio(trackName, audio);

  if (!canPlay || audioFadeTokens.get(audio) !== fadeToken) {
    return false;
  }

  const startVolume = audio.volume;

  if (duration <= 0 || startVolume === target) {
    audio.volume = target;
    updateAudioDebug();
    return true;
  }

  const startedAt = performance.now();

  return new Promise((resolve) => {
    const updateVolume = (timestamp) => {
      if (audioFadeTokens.get(audio) !== fadeToken) {
        resolve(false);
        return;
      }

      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const easedProgress = progress * progress * (3 - (2 * progress));
      audio.volume = clampVolume(startVolume + ((target - startVolume) * easedProgress));

      if (progress < 1) {
        trackedAnimationFrame(updateVolume);
        return;
      }

      updateAudioDebug();
      resolve(true);
    };

    trackedAnimationFrame(updateVolume);
  });
};

const playDrop = async () => {
  if (audioState.dropPlayed || document.hidden || isNavigating) {
    return;
  }

  audioTracks.drop.pause();
  audioTracks.drop.currentTime = 0;
  audioTracks.drop.volume = plannedVolumes.drop;
  audioState.dropPlayed = await playAudio('drop');
};

const setWindLevel = (volume, duration) => {
  audioState.windTarget = clampVolume(volume);
  return fadeAudio('wind', audioState.windTarget, duration);
};

const setBirdLevel = (volume, duration) => {
  audioState.birdsTarget = clampVolume(volume);
  return fadeAudio('birds', audioState.birdsTarget, duration);
};

const pauseAndResetAudio = ({ resetTargets = true } = {}) => {
  Object.entries(audioTracks).forEach(([trackName, audio]) => {
    audioFadeTokens.delete(audio);
    audio.pause();

    try {
      audio.currentTime = 0;
    } catch (error) {
      recordAudioError(trackName, error);
    }
  });

  audioTracks.drop.volume = plannedVolumes.drop;
  audioTracks.wind.volume = 0;
  audioTracks.birds.volume = 0;
  audioState.dropPlayed = false;

  if (resetTargets) {
    audioState.windTarget = 0;
    audioState.birdsTarget = 0;
  }
};

const stopAllAudio = () => {
  Object.values(audioTracks).forEach((audio) => {
    audioFadeTokens.delete(audio);
    audio.pause();
    audio.currentTime = 0;
  });

  audioTracks.wind.volume = 0;
  audioTracks.birds.volume = 0;
};

const resetIntroExperience = () => {
  animationClasses.forEach((className) => intro.classList.remove(className));
  delete intro.dataset.stage;
  rainLayer.replaceChildren();
  introState.stages.length = 0;
  introState.rainCreated = 0;
  introState.rainCompleted = 0;
  pauseAndResetAudio();
};

const unlockAudioTracks = async () => {
  const entries = Object.entries(audioTracks);

  entries.forEach(([trackName, audio]) => {
    audioState.playErrors[trackName] = '';
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0;
  });

  // All play() calls happen synchronously inside the same trusted pointer/click event.
  const unlockAttempts = entries.map(([trackName, audio]) => {
    try {
      const playPromise = audio.play();

      return Promise.resolve(playPromise)
        .then(() => ({ trackName, ok: true }))
        .catch((error) => {
          recordAudioError(trackName, error);
          return { trackName, ok: false };
        });
    } catch (error) {
      recordAudioError(trackName, error);
      return Promise.resolve({ trackName, ok: false });
    }
  });

  const results = await Promise.all(unlockAttempts);

  entries.forEach(([, audio]) => {
    audio.pause();
    audio.currentTime = 0;
  });

  audioTracks.drop.volume = plannedVolumes.drop;
  audioTracks.wind.volume = 0;
  audioTracks.birds.volume = 0;

  const unlocked = results.every((result) => result.ok);
  audioState.unlocked = unlocked;
  updateAudioDebug();
  return unlocked;
};

const setStage = (stageName) => {
  intro.dataset.stage = stageName;
  introState.stages.push({
    name: stageName,
    at: Math.round(performance.now() - audioState.startedAt)
  });

  if (debugMode) {
    debugOutput.hidden = false;
    debugOutput.textContent = stageName;
  }

  console.info(`[intro] ${stageName}`);
};

const createRainDrops = (count = 15) => {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < count; index += 1) {
    const rainDrop = document.createElement('span');
    const horizontalPosition = 2 + (Math.random() * 22);
    const animationDelay = Math.random() * 2.1;
    const animationDuration = 1.2 + (Math.random() * 0.8);
    const dropLength = 8 + (Math.random() * 8);
    const dropWidth = 1 + Math.random();

    rainDrop.className = 'rain-drop';
    rainDrop.style.setProperty('--rain-x', `${horizontalPosition.toFixed(2)}vw`);
    rainDrop.style.setProperty('--rain-delay', `${animationDelay.toFixed(2)}s`);
    rainDrop.style.setProperty('--rain-duration', `${animationDuration.toFixed(2)}s`);
    rainDrop.style.setProperty('--rain-height', `${dropLength.toFixed(1)}px`);
    rainDrop.style.setProperty('--rain-width', `${dropWidth.toFixed(1)}px`);

    rainDrop.addEventListener('animationend', () => {
      introState.rainCompleted += 1;
      rainDrop.remove();
    }, { once: true });

    fragment.append(rainDrop);
  }

  introState.rainCreated += count;
  rainLayer.append(fragment);
};

const runReducedMotionIntro = async () => {
  intro.classList.add('sky-transition', 'cloud-pass', 'calm-sky');
  void setWindLevel(0.2, 3000);
  void setBirdLevel(0.15, 2000);

  setStage('narration-1');
  void setWindLevel(0.14, 1000);
  void setBirdLevel(0.08, 1000);
  intro.classList.add('narration-one');
  await delay(1500);
  intro.classList.add('narration-one-end');

  setStage('narration-2');
  void setWindLevel(0.08, 1000);
  void setBirdLevel(0.04, 1000);
  intro.classList.add('narration-two');
  await delay(1500);
  intro.classList.add('narration-two-end');

  setStage('button');
  intro.classList.add('explore-button');
};

const runIntro = async () => {
  setStage('water-drop');
  intro.classList.add('drop-fall');

  // The file's impact peak is about 0.05 s after playback begins.
  // The visual drop touches the surface at 1.5 s.
  trackedTimeout(() => {
    void playDrop();
  }, 1450);
  await delay(1500);

  setStage('water-impact');
  intro.classList.add('splash', 'ripple');
  await delay(5000);

  setStage('sky-transition');
  intro.classList.add('sky-transition');
  void setWindLevel(0.2, 3000);
  await delay(4000);

  setStage('cloud-pass');
  intro.classList.add('cloud-pass');
  void setBirdLevel(0.15, 2000);
  await delay(1500);

  setStage('light-rain');
  intro.classList.add('light-rain');
  createRainDrops(15);
  await delay(3000);

  setStage('rain-stopping');
  intro.classList.add('rain-stopping');
  await delay(1500);

  setStage('sunlight');
  intro.classList.add('sunlight-through');
  await delay(5500);

  setStage('mist');
  intro.classList.add('mist-pass');
  await delay(6000);

  setStage('calm');
  intro.classList.add('calm-sky');
  await delay(2000);

  setStage('narration-1');
  void setWindLevel(0.14, 1000);
  void setBirdLevel(0.08, 1000);
  intro.classList.add('narration-one');
  await delay(2000);
  intro.classList.add('narration-one-end');
  await delay(500);

  setStage('narration-2');
  void setWindLevel(0.08, 1000);
  void setBirdLevel(0.04, 1000);
  intro.classList.add('narration-two');
  await delay(2000);
  intro.classList.add('narration-two-end');
  await delay(500);

  setStage('button');
  intro.classList.add('explore-button');
};

const startIntro = async () => {
  try {
    if (reduceMotion.matches) {
      await runReducedMotionIntro();
    } else {
      await runIntro();
    }
  } catch (error) {
    console.error('[intro] animation failed', error);

    if (debugMode) {
      debugOutput.hidden = false;
      debugOutput.textContent = 'error';
    }

    intro.classList.add(
      'sky-transition',
      'cloud-pass',
      'calm-sky',
      'narration-one-end',
      'narration-two-end',
      'explore-button'
    );
  }
};

const showActivationError = () => {
  activationError.hidden = false;
  activationScreen.setAttribute('aria-label', '請再輕觸一次以開啟聲音');
};

const hideActivationError = () => {
  activationError.hidden = true;
  activationScreen.setAttribute('aria-label', '輕觸，啟動探索');
};

const startIntroExperience = async () => {
  if (hasStarted || isStarting || isNavigating) {
    return;
  }

  isStarting = true;
  hideActivationError();
  resetIntroExperience();

  const unlocked = await unlockAudioTracks();

  if (!unlocked) {
    showActivationError();
    isStarting = false;
    updateAudioDebug();
    return;
  }

  audioState.startedAt = performance.now();
  audioState.introStarted = true;
  hasStarted = true;
  isStarting = false;
  activationScreen.classList.add('is-hidden');
  updateAudioDebug();
  void startIntro();
};

window.startIntroExperience = startIntroExperience;

activationScreen.addEventListener('pointerup', () => {
  lastPointerUpAt = performance.now();
  void startIntroExperience();
});

activationScreen.addEventListener('click', () => {
  if (performance.now() - lastPointerUpAt < 700) {
    return;
  }

  void startIntroExperience();
});

activationScreen.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  void startIntroExperience();
});

const testAudioTrack = async (trackName) => {
  const audio = audioTracks[trackName];
  const existingTimer = audioTestTimers.get(trackName);

  if (existingTimer) {
    window.clearTimeout(existingTimer);
    activeTimeouts.delete(existingTimer);
  }

  audio.pause();
  audio.currentTime = 0;
  audio.volume = plannedVolumes[trackName];
  const played = await playAudio(trackName, audio);

  if (!played || trackName === 'drop') {
    return;
  }

  const timer = trackedTimeout(() => {
    if (!audioState.introStarted) {
      audio.pause();
      audio.currentTime = 0;
    }

    audioTestTimers.delete(trackName);
    updateAudioDebug();
  }, 3000);
  audioTestTimers.set(trackName, timer);
};

if (audioDebugMode) {
  audioDebugPanel.hidden = false;

  Object.values(audioTracks).forEach((audio) => {
    audio.addEventListener('loadeddata', updateAudioDebug);
    audio.addEventListener('canplay', updateAudioDebug);
    audio.addEventListener('error', updateAudioDebug);
  });

  audioDebugPanel.addEventListener('pointerup', (event) => {
    event.stopPropagation();
  });
  audioDebugPanel.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  audioTestButtons.forEach((button) => {
    button.addEventListener('click', () => {
      void testAudioTrack(button.dataset.audioTest);
    });
  });

  updateAudioDebug();
  audioDebugTimer = window.setInterval(updateAudioDebug, 250);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Object.values(audioTracks).forEach((audio) => {
      audioFadeTokens.delete(audio);
      audio.pause();
    });
    updateAudioDebug();
    return;
  }

  if (!hasStarted || isNavigating) {
    return;
  }

  audioTracks.wind.volume = 0;
  audioTracks.birds.volume = 0;
  void setWindLevel(audioState.windTarget, 700);
  void setBirdLevel(audioState.birdsTarget, 700);
});

const clearScheduledWork = () => {
  activeTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  activeTimeouts.clear();

  activeAnimationFrames.forEach((frameId) => window.cancelAnimationFrame(frameId));
  activeAnimationFrames.clear();

  if (audioDebugTimer) {
    window.clearInterval(audioDebugTimer);
    audioDebugTimer = 0;
  }

  audioTestTimers.clear();
};

window.addEventListener('pagehide', () => {
  clearScheduledWork();
  stopAllAudio();
});

startButton.addEventListener('click', async () => {
  if (isNavigating) {
    return;
  }

  isNavigating = true;
  startButton.disabled = true;
  audioState.windTarget = 0;
  audioState.birdsTarget = 0;

  await Promise.all([
    fadeAudio('wind', 0, 800),
    fadeAudio('birds', 0, 800)
  ]);

  stopAllAudio();
  window.location.href = 'pages/01-cloud.html';
});
