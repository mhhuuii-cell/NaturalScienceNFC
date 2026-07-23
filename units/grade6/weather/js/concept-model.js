(() => {
  const model = document.querySelector('#concept-model');
  const controls = document.querySelector('#concept-model-controls');
  const playToggle = document.querySelector('#model-play-toggle');
  const replayButton = document.querySelector('#model-replay');
  const previousButton = document.querySelector('#model-previous-step');
  const nextButton = document.querySelector('#model-next-step');
  const currentStageLabel = document.querySelector('#cycle-current-stage');
  const progressDots = [...document.querySelectorAll('#cycle-progress-dots li')];
  const stageTitle = document.querySelector('#cycle-stage-title');
  const stageNote = document.querySelector('#cycle-stage-note');
  const playbackStatus = document.querySelector('#model-playback-status');
  const vaporLayer = document.querySelector('#cycle-vapor-layer');
  const cloudDropletLayer = document.querySelector('#cycle-cloud-droplets');
  const cloudCrystalLayer = document.querySelector('#cycle-cloud-crystals');
  const rainLayer = document.querySelector('#cycle-rain-layer');
  const summary = document.querySelector('#cycle-summary');
  const evidenceLinks = document.querySelector('#cycle-evidence-links');
  const evidenceButtons = [...document.querySelectorAll('[data-cycle-evidence]')];
  const evidencePrompt = document.querySelector('#cycle-evidence-prompt');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (
    !model
    || !controls
    || !playToggle
    || !previousButton
    || !nextButton
    || !replayButton
  ) {
    return;
  }

  const normalStageData = [
    {
      name: '地表水受熱',
      title: '地表的水受到太陽加熱',
      note: '',
      duration: 2500
    },
    {
      name: '蒸發',
      title: '一部分液態水變成水蒸氣，進入空氣中',
      note: '',
      duration: 3000
    },
    {
      name: '水蒸氣上升',
      title: '含有水蒸氣的空氣上升，越往高空溫度越低',
      note: '',
      duration: 3000
    },
    {
      name: '形成水滴或冰晶',
      title: '水蒸氣遇冷後，可能形成微小水滴或冰晶',
      note: '',
      duration: 3000
    },
    {
      name: '形成雲',
      title: '許多微小水滴或冰晶聚集，形成雲',
      note: '雲量增加時，天空與天氣也可能發生變化',
      duration: 3000
    },
    {
      name: '水滴或冰晶變大',
      title: '雲中的水滴或冰晶持續聚集、變大',
      note: '',
      duration: 3000
    },
    {
      name: '降水',
      title: '當它們大到空氣無法支撐時，就會形成降水',
      note: '降雨會改變當時的天氣',
      duration: 3000
    },
    {
      name: '回到地表並循環',
      title: '水回到地表後，再次受熱、蒸發，持續循環',
      note: '',
      duration: 3000
    }
  ];

  const reducedDurations = [1200, 1500, 1500, 1500, 1500, 1500, 1500, 1500];
  const evidenceCopy = {
    cloud: '高空中的水蒸氣遇冷，形成微小水滴或冰晶並聚集。',
    fog: '接近地面的空氣變冷，形成許多微小水滴。',
    dew: '物體表面較冷，附近水蒸氣形成小水滴附著在表面。',
    frost: '表面溫度很低時，水蒸氣可能直接形成冰晶。',
    steam: '熱水產生的水蒸氣進入較冷空氣後，形成許多微小水滴。'
  };
  const defaultEvidencePrompt = '選擇一個證據，看看模型提供了什麼解釋線索。';
  const evidenceQuestion = '這個模型還有哪些地方需要用證據確認？';
  const VAPOR_COUNT = 26;
  const CLOUD_DROPLET_COUNT = 18;
  const CLOUD_CRYSTAL_COUNT = 11;
  const RAIN_COUNT = 20;
  const vaporParticles = [];
  const cloudDroplets = [];
  const cloudCrystals = [];
  const raindrops = [];

  let stages = [];
  let summaryStart = 0;
  let totalDuration = 0;
  let elapsed = 0;
  let startedAt = 0;
  let frameId = 0;
  let playing = false;
  let visible = false;
  let lastStageIndex = -1;

  const clamp = (value, minimum = 0, maximum = 1) => (
    Math.min(maximum, Math.max(minimum, value))
  );

  const smoothstep = (start, end, value) => {
    if (start === end) {
      return value >= end ? 1 : 0;
    }

    const progress = clamp((value - start) / (end - start));
    return progress * progress * (3 - (2 * progress));
  };

  const seededValue = (index, salt) => {
    const value = Math.sin((index + 1) * (12.9898 + salt * 21.713)) * 43758.5453;
    return value - Math.floor(value);
  };

  const buildTimeline = () => {
    const isReduced = reducedMotion.matches;
    let cursor = 0;

    stages = normalStageData.map((stage, index) => {
      const duration = isReduced ? reducedDurations[index] : stage.duration;
      const timedStage = {
        ...stage,
        duration,
        start: cursor,
        end: cursor + duration
      };
      cursor += duration;
      return timedStage;
    });

    summaryStart = cursor;
    totalDuration = cursor + (isReduced ? 1200 : 2500);
  };

  const createParticles = () => {
    const vaporFragment = document.createDocumentFragment();
    const dropletFragment = document.createDocumentFragment();
    const crystalFragment = document.createDocumentFragment();
    const rainFragment = document.createDocumentFragment();

    for (let index = 0; index < VAPOR_COUNT; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'cycle-vapor-particle';
      vaporFragment.append(particle);
      vaporParticles.push({
        element: particle,
        sourceX: 63 + (seededValue(index, 1) * 27),
        midX: 43 + (seededValue(index, 2) * 38),
        highX: 49 + (seededValue(index, 3) * 33),
        highY: 20 + (seededValue(index, 4) * 29),
        delay: seededValue(index, 5) * 0.46,
        phase: seededValue(index, 6) * Math.PI * 2
      });
    }

    for (let index = 0; index < CLOUD_DROPLET_COUNT; index += 1) {
      const droplet = document.createElement('span');
      droplet.className = 'cycle-cloud-droplet';
      droplet.style.left = `${8 + (seededValue(index, 7) * 84)}%`;
      droplet.style.top = `${42 + (seededValue(index, 8) * 48)}%`;
      dropletFragment.append(droplet);
      cloudDroplets.push({
        element: droplet,
        delay: seededValue(index, 9) * 0.52,
        growFactor: index % 3 === 0 ? 1 : 0.3,
        shiftX: (seededValue(index, 10) - 0.5) * 10,
        shiftY: (seededValue(index, 11) - 0.5) * 8
      });
    }

    for (let index = 0; index < CLOUD_CRYSTAL_COUNT; index += 1) {
      const crystal = document.createElement('span');
      crystal.className = 'cycle-cloud-crystal';
      crystal.style.left = `${12 + (seededValue(index, 12) * 76)}%`;
      crystal.style.top = `${8 + (seededValue(index, 13) * 42)}%`;
      crystalFragment.append(crystal);
      cloudCrystals.push({
        element: crystal,
        delay: seededValue(index, 14) * 0.5,
        growFactor: index % 3 === 1 ? 1 : 0.26,
        shiftX: (seededValue(index, 15) - 0.5) * 9,
        shiftY: (seededValue(index, 16) - 0.5) * 7
      });
    }

    for (let index = 0; index < RAIN_COUNT; index += 1) {
      const raindrop = document.createElement('span');
      raindrop.className = 'cycle-raindrop';
      raindrop.style.left = `${52 + (seededValue(index, 17) * 32)}%`;
      rainFragment.append(raindrop);
      raindrops.push({
        element: raindrop,
        delay: seededValue(index, 18) * 1400,
        duration: 900 + (seededValue(index, 19) * 650)
      });
    }

    vaporLayer.append(vaporFragment);
    cloudDropletLayer.append(dropletFragment);
    cloudCrystalLayer.append(crystalFragment);
    rainLayer.append(rainFragment);
  };

  const stageIndexForTime = (time) => {
    const index = stages.findIndex((stage) => time < stage.end);
    return index === -1 ? stages.length - 1 : index;
  };

  const stageProgressForTime = (time, index) => {
    const stage = stages[index];
    return clamp((time - stage.start) / stage.duration);
  };

  const completed = () => elapsed >= totalDuration;

  const updateProgressUI = (stageIndex) => {
    const stage = stages[stageIndex];
    currentStageLabel.textContent = `${stageIndex + 1} / ${stages.length} ${stage.name}`;

    progressDots.forEach((dot, index) => {
      const isComplete = completed() || index < stageIndex;
      const isCurrent = !completed() && index === stageIndex;
      dot.classList.toggle('completed', isComplete);
      dot.classList.toggle('current', isCurrent);

      const states = [];
      if (isComplete) states.push('已完成');
      if (isCurrent) states.push('目前位置');
      dot.setAttribute('aria-label', `階段 ${index + 1}${states.length ? `，${states.join('，')}` : ''}`);
    });

    previousButton.disabled = stageIndex === 0;
    nextButton.disabled = completed();
  };

  const updateVaporParticles = (stageIndex, stageProgress) => {
    const isReduced = reducedMotion.matches;

    vaporParticles.forEach((particle, index) => {
      let x = particle.sourceX;
      let y = 102;
      let opacity = 0;
      let scale = 1;
      const staggered = clamp((stageProgress - particle.delay) / (1 - particle.delay));

      if (stageIndex === 1) {
        x += Math.sin((stageProgress * 4) + particle.phase) * (isReduced ? 0 : 1.4);
        y = 100 - (staggered * 48);
        opacity = smoothstep(0, 0.16, staggered) * 0.72;
      } else if (stageIndex === 2) {
        const drift = Math.sin((stageProgress * 4.6) + particle.phase) * (isReduced ? 0 : 1.6);
        x = particle.sourceX + ((particle.midX - particle.sourceX) * stageProgress) + drift;
        y = 52 + ((particle.highY - 52) * stageProgress);
        opacity = 0.72;
      } else if (stageIndex === 3) {
        x = particle.midX + ((particle.highX - particle.midX) * stageProgress);
        y = particle.highY;
        opacity = (1 - smoothstep(0.22, 0.92, stageProgress)) * 0.72;
        scale = 1 - (stageProgress * 0.42);
      } else if (stageIndex === 7 && index < 12) {
        const cycleProgress = clamp((stageProgress - (particle.delay * 0.56)) / 0.56);
        x = particle.sourceX + (Math.sin((cycleProgress * 3) + particle.phase) * (isReduced ? 0 : 0.8));
        y = 100 - (cycleProgress * 30);
        opacity = Math.sin(Math.PI * cycleProgress) * 0.58;
      }

      particle.element.style.left = `${x.toFixed(2)}%`;
      particle.element.style.top = `${y.toFixed(2)}%`;
      particle.element.style.opacity = opacity.toFixed(3);
      particle.element.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
    });
  };

  const updateCloudParticles = (stageIndex, stageProgress) => {
    const formationProgress = stageIndex < 3 ? 0 : stageIndex === 3 ? stageProgress : 1;
    const cloudProgress = stageIndex < 4 ? 0 : stageIndex === 4 ? stageProgress : 1;
    const growthProgress = stageIndex < 5 ? 0 : stageIndex === 5 ? stageProgress : 1;
    const rainProgress = stageIndex < 6 ? 0 : stageIndex === 6 ? stageProgress : 1;

    cloudDroplets.forEach((particle) => {
      const appear = smoothstep(particle.delay, Math.min(1, particle.delay + 0.42), formationProgress);
      const gather = smoothstep(0, 1, cloudProgress);
      const growth = smoothstep(particle.delay * 0.4, Math.min(1, 0.48 + (particle.delay * 0.4)), growthProgress);
      const precipitationGrowth = particle.growFactor > 0.8 ? rainProgress * 0.28 : 0;
      const scale = 0.25
        + (appear * 0.75)
        + (growth * particle.growFactor * 0.72)
        + precipitationGrowth;
      const shiftX = particle.shiftX * gather * 0.22;
      const shiftY = particle.shiftY * gather * 0.22;

      particle.element.style.opacity = (appear * 0.92).toFixed(3);
      particle.element.style.transform = `translate(calc(-50% + ${shiftX.toFixed(2)}px), calc(-50% + ${shiftY.toFixed(2)}px)) scale(${scale.toFixed(3)})`;
    });

    cloudCrystals.forEach((particle) => {
      const appear = smoothstep(particle.delay, Math.min(1, particle.delay + 0.44), formationProgress);
      const gather = smoothstep(0, 1, cloudProgress);
      const growth = smoothstep(particle.delay * 0.42, Math.min(1, 0.5 + (particle.delay * 0.4)), growthProgress);
      const scale = 0.25 + (appear * 0.75) + (growth * particle.growFactor * 0.65);
      const shiftX = particle.shiftX * gather * 0.22;
      const shiftY = particle.shiftY * gather * 0.22;

      particle.element.style.opacity = (appear * 0.88).toFixed(3);
      particle.element.style.transform = `translate(calc(-50% + ${shiftX.toFixed(2)}px), calc(-50% + ${shiftY.toFixed(2)}px)) scale(${scale.toFixed(3)}) rotate(${(-15 + (gather * 15)).toFixed(2)}deg)`;
    });
  };

  const updateRain = (stageIndex, stageProgress, time) => {
    const rainStrength = stageIndex === 6
      ? smoothstep(0.08, 0.42, stageProgress)
      : stageIndex === 7
        ? 1 - (stageProgress * 0.72)
        : 0;
    const stageTime = stageIndex >= 6 ? time - stages[6].start : 0;

    raindrops.forEach((raindrop) => {
      const rawProgress = (stageTime - raindrop.delay) / raindrop.duration;
      const cycle = rawProgress < 0 ? 0 : rawProgress % 1;
      const visibleCycle = rawProgress < 0 ? 0 : Math.sin(Math.PI * cycle);
      const y = 39 + (cycle * 58);

      raindrop.element.style.top = `${y.toFixed(2)}%`;
      raindrop.element.style.opacity = (visibleCycle * rainStrength * 0.86).toFixed(3);
    });
  };

  const updateSceneVariables = (stageIndex, stageProgress, time) => {
    const after = (index) => stageIndex > index ? 1 : stageIndex === index ? stageProgress : 0;
    const sunProgress = stageIndex === 0
      ? stageProgress
      : stageIndex === 7
        ? 0.45 + (stageProgress * 0.45)
        : 0.52;
    const summaryProgress = smoothstep(summaryStart, totalDuration, time);

    model.style.setProperty('--sun-progress', sunProgress.toFixed(3));
    model.style.setProperty('--vapor-progress', after(1).toFixed(3));
    model.style.setProperty('--rise-progress', after(2).toFixed(3));
    model.style.setProperty('--cold-progress', after(2).toFixed(3));
    model.style.setProperty('--formation-progress', after(3).toFixed(3));
    model.style.setProperty('--cloud-progress', after(4).toFixed(3));
    model.style.setProperty('--growth-progress', after(5).toFixed(3));
    model.style.setProperty('--rain-progress', after(6).toFixed(3));
    model.style.setProperty('--return-progress', after(7).toFixed(3));
    model.style.setProperty('--summary-progress', summaryProgress.toFixed(3));
    summary.setAttribute('aria-hidden', summaryProgress < 0.5 ? 'true' : 'false');
  };

  const updateEvidenceVisibility = () => {
    evidenceLinks.hidden = !completed();

    if (!completed()) {
      evidenceButtons.forEach((button) => button.classList.remove('selected'));
      evidencePrompt.textContent = defaultEvidencePrompt;
    }
  };

  const render = (time) => {
    const stageIndex = stageIndexForTime(time);
    const stageProgress = time >= summaryStart ? 1 : stageProgressForTime(time, stageIndex);
    const stage = stages[stageIndex];

    if (stageIndex !== lastStageIndex) {
      lastStageIndex = stageIndex;
      stageTitle.textContent = stage.title;
      stageNote.textContent = stage.note;
      playbackStatus.textContent = `階段 ${stageIndex + 1}：${stage.name}`;
    }

    updateProgressUI(stageIndex);
    updateSceneVariables(stageIndex, stageProgress, time);
    updateVaporParticles(stageIndex, stageProgress);
    updateCloudParticles(stageIndex, stageProgress);
    updateRain(stageIndex, stageProgress, time);
    updateEvidenceVisibility();
  };

  const updatePlayButton = () => {
    playToggle.textContent = playing ? '暫停' : '播放';
    playToggle.setAttribute('aria-label', playing ? '暫停水循環概念模型' : '播放水循環概念模型');
  };

  const animationLoop = (timestamp) => {
    if (!playing) {
      return;
    }

    elapsed = Math.min(totalDuration, timestamp - startedAt);
    render(elapsed);

    if (elapsed >= totalDuration) {
      playing = false;
      frameId = 0;
      playbackStatus.textContent = '水循環概念模型播放完成';
      updatePlayButton();
      return;
    }

    frameId = window.requestAnimationFrame(animationLoop);
  };

  const play = () => {
    if (!visible || playing) {
      return;
    }

    if (completed()) {
      elapsed = 0;
      lastStageIndex = -1;
      render(0);
    }

    playing = true;
    startedAt = performance.now() - elapsed;
    playbackStatus.textContent = '水循環概念模型播放中';
    updatePlayButton();
    frameId = window.requestAnimationFrame(animationLoop);
  };

  const pause = () => {
    if (!playing) {
      return;
    }

    elapsed = Math.min(totalDuration, performance.now() - startedAt);
    playing = false;

    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }

    render(elapsed);
    playbackStatus.textContent = '水循環概念模型已暫停';
    updatePlayButton();
  };

  const reset = () => {
    pause();
    elapsed = 0;
    lastStageIndex = -1;
    render(0);
    playbackStatus.textContent = '水循環概念模型尚未播放';
    updatePlayButton();
  };

  const replay = () => {
    reset();
    play();
  };

  const moveToStage = (index) => {
    pause();
    const nextIndex = clamp(index, 0, stages.length - 1);
    elapsed = stages[nextIndex].start;
    lastStageIndex = -1;
    render(elapsed);
    playbackStatus.textContent = `已移到階段 ${nextIndex + 1}：${stages[nextIndex].name}`;
  };

  const previousStep = () => {
    const currentIndex = stageIndexForTime(elapsed);
    moveToStage(currentIndex - 1);
  };

  const nextStep = () => {
    const currentIndex = stageIndexForTime(elapsed);

    if (currentIndex < stages.length - 1) {
      moveToStage(currentIndex + 1);
      return;
    }

    pause();
    elapsed = totalDuration;
    render(elapsed);
    playbackStatus.textContent = '已顯示完整水循環整理';
  };

  const show = () => {
    visible = true;
    model.hidden = false;
    controls.hidden = false;
    reset();
  };

  const hide = () => {
    pause();
    visible = false;
    model.hidden = true;
    controls.hidden = true;
  };

  const focus = () => {
    model.focus({ preventScroll: true });
  };

  playToggle.addEventListener('click', () => {
    if (playing) {
      pause();
    } else {
      play();
    }
  });

  replayButton.addEventListener('click', replay);
  previousButton.addEventListener('click', previousStep);
  nextButton.addEventListener('click', nextStep);

  evidenceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      evidenceButtons.forEach((item) => item.classList.toggle('selected', item === button));
      evidencePrompt.textContent = `${evidenceCopy[button.dataset.cycleEvidence]} ${evidenceQuestion}`;
    });
  });

  reducedMotion.addEventListener?.('change', () => {
    const stageIndex = stageIndexForTime(elapsed);
    const wasPlaying = playing;
    pause();
    buildTimeline();
    elapsed = stages[stageIndex].start;
    lastStageIndex = -1;
    render(elapsed);

    if (wasPlaying) {
      play();
    }
  });

  window.addEventListener('pagehide', pause);

  buildTimeline();
  createParticles();
  render(0);
  updatePlayButton();

  window.conceptModelController = {
    show,
    hide,
    focus,
    play,
    pause,
    reset,
    replay,
    previousStep,
    nextStep,
    getState: () => {
      const stageIndex = stageIndexForTime(elapsed);
      return {
        visible,
        playing,
        elapsed: Math.round(elapsed),
        stageIndex,
        stageName: stages[stageIndex].name,
        complete: completed()
      };
    }
  };
})();
