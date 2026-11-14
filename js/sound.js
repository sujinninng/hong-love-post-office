/* 사랑 우체국 — 소리. 음악과 효과음을 브라우저에서 직접 합성합니다 (오디오 파일 없음).
   window.LpoSound: unlock(), toggle(), isOn(), sfx(name), render(seconds) */
(function () {
  'use strict';
  var AC = window.AudioContext || window.webkitAudioContext;
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  var BPM = 92, EIGHTH = 60 / BPM / 2, MUSIC = 1.7;
  var N = { A3: 220, B3: 246.94, C4: 261.63, E4: 329.63, F4: 349.23, G4: 392, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
    A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, C7: 2093 };
  // 8-bar loop in C major: C | G/B | Am | F/A | C | F/A | G/B | C.  a = arpeggio (8 eighths), m = melody [note, start eighth, length in eighths]
  var C_ = ['C4', 'G4', 'E5', 'G4', 'C5', 'G4', 'E5', 'G4'], G_ = ['B3', 'G4', 'D5', 'G4', 'B3', 'G4', 'D5', 'G4'],
    Am = ['A3', 'E4', 'C5', 'E4', 'A3', 'E4', 'C5', 'E4'], F_ = ['A3', 'F4', 'C5', 'F4', 'A3', 'F4', 'C5', 'F4'];
  var BARS = [
    { a: C_, m: [['E5', 0, 2], ['G5', 2, 2], ['C6', 4, 4]] },
    { a: G_, m: [['B5', 0, 2], ['G5', 2, 2], ['D5', 4, 4]] },
    { a: Am, m: [['C5', 0, 2], ['E5', 2, 2], ['A5', 4, 4]] },
    { a: F_, m: [['A5', 0, 2], ['F5', 2, 2], ['C5', 4, 4]] },
    { a: C_, m: [['E5', 0, 2], ['G5', 2, 2], ['C6', 4, 2], ['E6', 6, 2]] },
    { a: F_, m: [['C6', 0, 2], ['A5', 2, 2], ['F5', 4, 4]] },
    { a: G_, m: [['G5', 0, 2], ['A5', 2, 2], ['B5', 4, 2], ['D6', 6, 2]] },
    { a: C_, m: [['C6', 0, 6]] }
  ];

  function tone(ctx, dest, freq, t, dur, vol, bell) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    if (bell) { // a quiet octave on top gives the music-box colour
      var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.22, t); g2.connect(g);
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(freq * 2, t);
      o2.connect(g2); o2.start(t); o2.stop(t + dur + 0.05);
    }
  }
  function playStep(ctx, dest, step, t) {
    var loop = Math.floor(step / 64), barIdx = Math.floor((step % 64) / 8), i = step % 8, bar = BARS[barIdx];
    tone(ctx, dest, N[bar.a[i]], t, 0.6, i === 0 ? 0.06 : 0.042, false);
    if (loop % 2 === 1 && barIdx < 4) return; // every second pass the melody rests for four bars
    for (var k = 0; k < bar.m.length; k++) if (bar.m[k][1] === i) tone(ctx, dest, N[bar.m[k][0]], t, 0.35 + bar.m[k][2] * EIGHTH * 1.25, 0.11, true);
  }
  function graph(ctx) {
    var master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    var music = ctx.createGain(); music.gain.value = MUSIC;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    var delay = ctx.createDelay(1); delay.delayTime.value = EIGHTH * 1.5;
    var fb = ctx.createGain(); fb.gain.value = 0.22; var wet = ctx.createGain(); wet.gain.value = 0.25;
    music.connect(lp); lp.connect(master); lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    var fx = ctx.createGain(); fx.gain.value = 2.2; fx.connect(master);
    return { master: master, music: music, fx: fx };
  }

  var on = true, ctx = null, G = null, timer = null, nextT = 0, step = 0;
  try { var v = localStorage.getItem('lpo.sound'); if (v != null) on = JSON.parse(v) !== false; } catch (e) {}
  function mark() { try { document.documentElement.setAttribute('data-sound', on ? (ctx ? ctx.state : 'waiting') : 'off'); } catch (e) {} }
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.08;
    while (nextT < ctx.currentTime + 0.6) { playStep(ctx, G.music, step, nextT); nextT += EIGHTH; step = (step + 1) % 128; }
  }
  function start() {
    if (!on || !AC) return;
    try {
      if (!ctx) {
        ctx = new AC(); G = graph(ctx);
        G.music.gain.setValueAtTime(0.0001, ctx.currentTime);
        G.music.gain.exponentialRampToValueAtTime(MUSIC, ctx.currentTime + 1.6);
        nextT = ctx.currentTime + 0.25; step = 0;
        ctx.onstatechange = mark;
      }
      if (ctx.state !== 'running' && !document.hidden) { var p = ctx.resume(); if (p && p.then) p.then(mark, function () {}); }
      if (!timer) timer = setInterval(tick, 150);
    } catch (e) { ctx = null; }
    mark();
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    try { if (ctx && ctx.state === 'running') { var p = ctx.suspend(); if (p && p.then) p.then(mark, function () {}); } } catch (e) {}
    mark();
  }
  var SFX = {
    tap: [['E6', 0, 0.16, 0.07], ['A6', 0.07, 0.2, 0.06]],
    pop: [['C6', 0, 0.3, 0.09], ['E6', 0.07, 0.3, 0.09], ['G6', 0.14, 0.3, 0.09], ['C7', 0.21, 0.6, 0.09]],
    open: [['G5', 0, 0.4, 0.09], ['C6', 0.1, 0.4, 0.09], ['E6', 0.2, 0.7, 0.09]]
  };
  function sfx(name, delay) {
    if (!on || !ctx || ctx.state !== 'running' || !SFX[name]) return;
    try {
      var t0 = ctx.currentTime + 0.01 + (delay || 0);
      SFX[name].forEach(function (n) { tone(ctx, G.fx, N[n[0]], t0 + n[1], n[2], n[3], true); });
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (on && ctx) start(); });
  mark();

  window.LpoSound = {
    isOn: function () { return on; },
    unlock: start, // call from a tap: browsers only allow sound after a user gesture
    toggle: function () {
      on = !on;
      try { localStorage.setItem('lpo.sound', JSON.stringify(on)); } catch (e) {}
      if (on) start(); else stop();
      return on;
    },
    sfx: sfx,
    // offline render of the music loop, used only to check levels: resolves {peak, rms, seconds}
    render: function (seconds) {
      if (!OAC) return Promise.reject(new Error('no OfflineAudioContext'));
      var c = new OAC(1, Math.floor(44100 * seconds), 44100), g = graph(c), t = 0.05, s = 0;
      while (t < seconds) { playStep(c, g.music, s, t); t += EIGHTH; s = (s + 1) % 128; }
      return c.startRendering().then(function (buf) {
        var d = buf.getChannelData(0), peak = 0, sum = 0;
        for (var i = 0; i < d.length; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
        return { peak: peak, rms: Math.sqrt(sum / d.length), seconds: seconds };
      });
    }
  };
})();
