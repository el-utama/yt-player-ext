// Popup Settings - Shuffle, Random Duration, Ad-Skip, Popup Size

import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';
import { $ } from './ui.js';

/**
 * Setup shuffle toggle
 */
export function setupShuffle() {
  const shuffleEnable = $('shuffleEnable');
  if (!shuffleEnable) return;
  
  shuffleEnable.addEventListener('change', async () => {
    await setStorage({ [STORAGE_KEYS.SHUFFLE_ENABLED]: shuffleEnable.checked });
  });
  
  getStorage([STORAGE_KEYS.SHUFFLE_ENABLED]).then(({ shuffleEnabled }) => {
    shuffleEnable.checked = Boolean(shuffleEnabled);
  });
}

/**
 * Setup random duration controls
 */
export function setupRandomDuration() {
  const randomEnable = $('randomEnable');
  const randomMin = $('randomMin');
  const randomMax = $('randomMax');
  
  if (!randomEnable || !randomMin || !randomMax) return;
  
  const updateInputs = () => {
    randomMin.disabled = !randomEnable.checked;
    randomMax.disabled = !randomEnable.checked;
  };
  
  randomEnable.addEventListener('change', async () => {
    await setStorage({ [STORAGE_KEYS.RANDOM_ENABLED]: randomEnable.checked });
    updateInputs();
  });
  
  randomMin.addEventListener('change', async () => {
    const val = parseInt(randomMin.value, 10);
    if (Number.isFinite(val) && val >= 0) {
      await setStorage({ [STORAGE_KEYS.RANDOM_MIN_SECONDS]: val });
    }
  });
  
  randomMax.addEventListener('change', async () => {
    const val = parseInt(randomMax.value, 10);
    if (Number.isFinite(val) && val >= 0) {
      await setStorage({ [STORAGE_KEYS.RANDOM_MAX_SECONDS]: val });
    }
  });
  
  // Load initial values
  getStorage([
    STORAGE_KEYS.RANDOM_ENABLED, 
    STORAGE_KEYS.RANDOM_MIN_SECONDS, 
    STORAGE_KEYS.RANDOM_MAX_SECONDS
  ]).then(({ randomEnabled, randomMinSeconds, randomMaxSeconds }) => {
    randomEnable.checked = Boolean(randomEnabled);
    randomMin.value = Number.isFinite(randomMinSeconds) ? randomMinSeconds : '';
    randomMax.value = Number.isFinite(randomMaxSeconds) ? randomMaxSeconds : '';
    updateInputs();
  });
}

/**
 * Setup ad-skip controls
 */
export function setupAdSkip() {
  const adSkipEnable = $('adSkipEnable');
  const adSkipMinDelay = $('adSkipMinDelay');
  const adSkipMaxWait = $('adSkipMaxWait');
  
  if (!adSkipEnable || !adSkipMinDelay || !adSkipMaxWait) return;
  
  const updateInputs = () => {
    adSkipMinDelay.disabled = !adSkipEnable.checked;
    adSkipMaxWait.disabled = !adSkipEnable.checked;
  };
  
  adSkipEnable.addEventListener('change', async () => {
    await setStorage({ [STORAGE_KEYS.AD_SKIP_ENABLED]: adSkipEnable.checked });
    updateInputs();
  });
  
  adSkipMinDelay.addEventListener('change', async () => {
    const val = parseInt(adSkipMinDelay.value, 10);
    if (Number.isFinite(val) && val >= 0) {
      await setStorage({ [STORAGE_KEYS.AD_SKIP_MIN_DELAY]: val });
    }
  });
  
  adSkipMaxWait.addEventListener('change', async () => {
    const val = parseInt(adSkipMaxWait.value, 10);
    if (Number.isFinite(val) && val >= 0) {
      await setStorage({ [STORAGE_KEYS.AD_SKIP_MAX_WAIT]: val });
    }
  });
  
  // Load initial values
  getStorage([
    STORAGE_KEYS.AD_SKIP_ENABLED,
    STORAGE_KEYS.AD_SKIP_MIN_DELAY,
    STORAGE_KEYS.AD_SKIP_MAX_WAIT,
  ]).then(({ adSkipEnabled, adSkipMinDelay: minDelay, adSkipMaxWait: maxWait }) => {
    adSkipEnable.checked = adSkipEnabled !== false;
    adSkipMinDelay.value = Number.isFinite(minDelay) ? minDelay : 5000;
    adSkipMaxWait.value = Number.isFinite(maxWait) ? maxWait : 30000;
    updateInputs();
  });
}

/**
 * Setup popup size selector
 */
export function setupPopupSize() {
  const sizeButtons = document.querySelectorAll('.size-btn');
  const sizeRadios = document.querySelectorAll('input[name="popupSize"]');
  
  const applySize = (size) => {
    document.body.dataset.popupSize = size;
    sizeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.size === size));
    sizeRadios.forEach((radio) => { radio.checked = radio.value === size; });
  };
  
  sizeButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const size = btn.dataset.size;
      await setStorage({ [STORAGE_KEYS.POPUP_SIZE]: size });
      applySize(size);
    });
  });
  
  sizeRadios.forEach((radio) => {
    radio.addEventListener('change', async () => {
      await setStorage({ [STORAGE_KEYS.POPUP_SIZE]: radio.value });
      applySize(radio.value);
    });
  });
  
  // Load initial size
  getStorage([STORAGE_KEYS.POPUP_SIZE]).then(({ popupSize }) => {
    applySize(popupSize || 'medium');
  });
}