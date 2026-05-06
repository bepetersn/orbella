/**
 * @fileoverview Audio and vibration feedback for game events.
 *
 * Wraps the Web Audio API to generate short tonal cues for correct guesses,
 * incorrect guesses, and round losses.  Device vibration is triggered alongside
 * each cue on browsers that support `navigator.vibrate`.
 *
 * Exported as {@link window.audioFeedback}.
 */
let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playTone(freq, type, duration, volume = 0.1) {
    initAudio();

    if (!audioCtx) {
      return;
    }

    // Resume audio context if it's suspended (due to browser autoplay policy)
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(err => {
        console.warn('Failed to resume audio context:', err);
      });
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  }

  /**
   * Initialise the `AudioContext` after a user gesture so that subsequent
   * tone calls are not blocked by the browser's auto-play policy.
   * Safe to call multiple times.
   */
export function primeAudio() {
    initAudio();
  }

  /**
   * Play a cheerful ascending major-chord arpeggio (C5 → E5 → G5 → C6) with
   * a short shimmer on the final note, then fire a triple-pulse vibration.
   */
export function correct() {
    initAudio();
    if (!audioCtx) return;

    // Each note: [frequency Hz, start offset ms, duration s, volume]
    const notes = [
      [392.00, 0,   0.18, 0.12],   // G4
      [493.88, 130, 0.18, 0.13],   // B4
      [587.33, 250, 0.18, 0.13],   // D5
      [783.99, 370, 0.45, 0.11],   // G5  — held longer
    ];

    notes.forEach(([freq, offsetMs, dur, vol]) => {
      setTimeout(() => {
        // Primary sine tone
        playTone(freq, "sine", dur, vol);
        // Subtle triangle shimmer one octave up for sparkle on the last note
        if (offsetMs === 370) {
          playTone(freq * 2, "triangle", dur * 0.6, 0.03);
        }
      }, offsetMs);
    });

    if (navigator.vibrate) {
      navigator.vibrate([40, 25, 40, 25, 60]);
    }
  }

  /**
   * Play a low-frequency triangle-wave buzz and trigger a single 100 ms
   * vibration on devices that support the Vibration API.
   */
export function wrong() {
    playTone(150, "triangle", 0.3, 0.2);

    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  }

  /**
   * Play a descending four-note loss cue and fire a double-pulse vibration on
   * devices that support the Vibration API.
   */
export function loss() {
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

// Backward-compat shim — remove once all callers use import
window.audioFeedback = {
  primeAudio,
  correct,
  wrong,
  loss
};
