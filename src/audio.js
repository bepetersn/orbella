/**
 * @fileoverview Audio and vibration feedback for game events.
 *
 * Wraps the Web Audio API to generate short tonal cues for correct guesses,
 * incorrect guesses, and round losses.  Device vibration is triggered alongside
 * each cue on browsers that support `navigator.vibrate`.
 *
 * Exported as {@link window.audioFeedback}.
 */
(() => {
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playTone(freq, type, duration, volume = 0.1) {
    initAudio();

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  /**
   * Initialise the `AudioContext` after a user gesture so that subsequent
   * tone calls are not blocked by the browser's auto-play policy.
   * Safe to call multiple times.
   */
  function primeAudio() {
    initAudio();
  }

  /**
   * Play a short ascending two-tone win cue (C5 → E5) and fire a brief
   * double-pulse vibration on devices that support the Vibration API.
   */
  function correct() {
    playTone(523.25, "sine", 0.5);
    playTone(659.25, "sine", 0.5);

    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
  }

  /**
   * Play a low-frequency triangle-wave buzz and trigger a single 100 ms
   * vibration on devices that support the Vibration API.
   */
  function wrong() {
    playTone(150, "triangle", 0.3, 0.2);

    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  }

  /**
   * Play a descending four-note loss cue and fire a double-pulse vibration on
   * devices that support the Vibration API.
   */
  function loss() {
    const frequencies = [392.0, 349.23, 311.13, 261.63];
    frequencies.forEach((frequency, index) => {
      setTimeout(() => {
        playTone(frequency, "triangle", 0.45, 0.12);
      }, index * 140);
    });

    if (navigator.vibrate) {
      navigator.vibrate([80, 60, 80]);
    }
  }

  window.audioFeedback = {
    primeAudio,
    correct,
    wrong,
    loss
  };
})();
