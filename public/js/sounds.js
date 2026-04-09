// Synthetic sound effects via Web Audio API — no audio files required.
// All functions are safe to call before user interaction; they silently skip
// if the AudioContext cannot start (browser autoplay policy).

const Sounds = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Low-level: play a simple tone
  function tone(freq, type, startTime, duration, gainStart, gainEnd) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(gainStart, startTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.001), startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (_) {}
  }

  function now() { return getCtx().currentTime; }

  return {
    // Countdown tick — 3, 2, 1
    countdownTick() {
      const t = now();
      tone(440, 'sine', t, 0.12, 0.4, 0.001);
    },

    // GO! — bright rising chord
    countdownGo() {
      const t = now();
      tone(523, 'sine', t,        0.12, 0.5, 0.001);
      tone(659, 'sine', t + 0.05, 0.12, 0.5, 0.001);
      tone(784, 'sine', t + 0.1,  0.18, 0.5, 0.001);
    },

    // Question appears — rising two-note chime
    questionStart() {
      const t = now();
      tone(440, 'sine', t,       0.15, 0.3, 0.001);
      tone(660, 'sine', t + 0.1, 0.2,  0.3, 0.001);
    },

    // Timer tick — quiet click each second in warning zone
    tick() {
      try {
        const c = getCtx();
        const buf = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = c.createBufferSource();
        const gain = c.createGain();
        src.buffer = buf;
        gain.gain.value = 0.15;
        src.connect(gain);
        gain.connect(c.destination);
        src.start();
      } catch (_) {}
    },

    // Last 3 seconds — urgent high tick
    urgentTick() {
      const t = now();
      tone(880, 'square', t, 0.06, 0.2, 0.001);
    },

    // Answer locked in
    submit() {
      const t = now();
      tone(300, 'sine', t, 0.08, 0.25, 0.001);
    },

    // Correct answer
    correct() {
      const t = now();
      tone(523, 'sine', t,       0.15, 0.4, 0.001);
      tone(659, 'sine', t + 0.1, 0.15, 0.4, 0.001);
      tone(784, 'sine', t + 0.2, 0.25, 0.4, 0.001);
    },

    // Wrong answer
    wrong() {
      const t = now();
      tone(300, 'sawtooth', t,       0.15, 0.35, 0.001);
      tone(220, 'sawtooth', t + 0.12, 0.2, 0.35, 0.001);
    },

    // First-correct buzz fanfare
    buzz() {
      const t = now();
      [523, 659, 784, 1047].forEach((f, i) => {
        tone(f, 'sine', t + i * 0.08, 0.18, 0.5, 0.001);
      });
    },

    // Victory fanfare — rising arpeggio + sustained top note
    victory() {
      const t = now();
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        tone(f, 'sine', t + i * 0.1, 0.25, 0.5, 0.001);
      });
      tone(1047, 'sine', t + 0.65, 0.5, 0.35, 0.001);
    },

    // Confetti particle burst — pure DOM, no audio
    launchConfetti() {
      const colors = ['#7c3aed','#a855f7','#f59e0b','#10b981','#3b82f6','#ef4444','#fff','#fbbf24'];
      for (let i = 0; i < 110; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.cssText = `
          left:${Math.random() * 100}%;
          background:${colors[i % colors.length]};
          width:${5 + Math.random() * 8}px;
          height:${8 + Math.random() * 12}px;
          border-radius:${Math.random() > 0.4 ? '2px' : '50%'};
          animation-duration:${1.8 + Math.random() * 2.2}s;
          animation-delay:${Math.random() * 1.8}s;
          transform:rotate(${Math.random() * 360}deg);
        `;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
      }
    },
  };
})();
