/* 석범이와 수진이의 사랑 우체국 — vanilla JS, no build step.
   Data: data/messages.json, data/config.json. Device-local state: localStorage ("lpo." prefix). */
(function () {
  'use strict';

  var APP = document.getElementById('app');
  var IMG = 'assets/img/';
  var S = { ready: false, today: '', messages: [], byId: {}, byDate: {}, welcome: null, config: {}, offline: false };
  var timers = [];
  var welcomeStep = 1;
  var lbPushed = false, keepY = null, prevHash = '';

  /* ---------- storage (works even when localStorage is unavailable) ---------- */
  var mem = {};
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('lpo.' + k); if (v != null) return JSON.parse(v); } catch (e) {}
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : d;
    },
    set: function (k, v) {
      mem[k] = v;
      try { localStorage.setItem('lpo.' + k, JSON.stringify(v)); } catch (e) {}
    },
    clear: function () {
      mem = {};
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('lpo.') === 0) keys.push(k); }
        keys.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
    }
  };

  /* ---------- dates (always Asia/Seoul, UTC+9, no daylight saving) ---------- */
  var YMD = /^\d{4}-\d{2}-\d{2}$/;
  function testDate() {
    try {
      var q = new URLSearchParams(location.search).get('date');
      if (q && YMD.test(q)) return q;
      var s = sessionStorage.getItem('lpo.testDate');
      if (s && YMD.test(s)) return s;
    } catch (e) {}
    return null;
  }
  function kstToday() {
    return testDate() || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }
  function parseYMD(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function fmtDate(s) {
    var d = parseYMD(s);
    return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일 ' + '일월화수목금토'.charAt(d.getUTCDay()) + '요일';
  }
  function weekKey(s) { // Monday of that week
    var d = parseYMD(s); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function heart(sz, fill) {
    return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><path d="M12 20.5 C2.5 13.5 7 5 12 10 C17 5 21.5 13.5 12 20.5Z" fill="' + (fill || '#FF85AE') + '" stroke="#84506F" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  }
  function gear() {
    var t = '';
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; t += '<path d="M' + (12 + 7.4 * Math.cos(a)).toFixed(2) + ' ' + (12 + 7.4 * Math.sin(a)).toFixed(2) + ' L' + (12 + 10 * Math.cos(a)).toFixed(2) + ' ' + (12 + 10 * Math.sin(a)).toFixed(2) + '"/>'; }
    return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#84506F" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' + t + '</svg>';
  }
  var SND = window.LpoSound || { isOn: function () { return false; }, unlock: function () {}, toggle: function () { return false; }, sfx: function () {} };
  function sndIcon(on) {
    return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#84506F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5l4.5 4V5.5l-4.5 4H4z" fill="#FFC2D6"/>' +
      (on ? '<path d="M15.5 9.5a3.6 3.6 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>' : '<path d="M16 9.5l5 5M21 9.5l-5 5"/>') + '</svg>';
  }
  function sndBtn() {
    var on = SND.isOn();
    return '<button class="roundbtn press" data-action="sound" aria-pressed="' + on + '" aria-label="' + (on ? '소리 끄기' : '소리 켜기') + '">' + sndIcon(on) + '</button>';
  }
  function tapHearts(x, y) {
    [[0, 22, '#FF85AE'], [-18, 14, '#FFC2D6'], [16, 12, '#FFE78A']].forEach(function (h, i) {
      var el = document.createElement('span'); el.className = 'tapfx'; el.innerHTML = heart(h[1], h[2]);
      el.style.left = (x + h[0] * 0.5) + 'px'; el.style.top = (y - i * 6) + 'px'; el.style.setProperty('--dx', h[0] + 'px'); el.style.animationDelay = (i * 0.05) + 's';
      document.body.appendChild(el); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
    });
  }
  var META = { postoffice: [300, 266], mailbox: [90, 150], envelope: [200, 136], 'gift-body': [200, 140], 'gift-lid': [220, 110], cake: [190, 186], 'cake-off': [190, 186], balloons: [130, 200] };
  ['seok', 'sujin'].forEach(function (n) { ['wave', 'cheer', 'letter'].forEach(function (p) { META[n + '-' + p] = [150, 176]; }); });
  // absolutely placed sticker image; left/top/width describe the artwork without its white border
  function im(key, left, top, width, cls, alt, extra) {
    var w = META[key][0], s = width / w, p = 6 * s;
    return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + IMG + key + '.svg" alt="' + esc(alt || '') + '" style="left:' + (left - p).toFixed(1) + 'px;top:' + (top - p).toFixed(1) + 'px;width:' + (width + 2 * p).toFixed(1) + 'px;' + (extra || '') + '">';
  }
  function logo(small) {
    return '<h1 class="logo' + (small ? ' sm' : '') + '" aria-label="석범이와 수진이의 사랑 우체국"><span class="logo-rib" aria-hidden="true">석범이와 수진이의</span>' +
      '<span class="logo-main" aria-hidden="true"><span class="st c-pink' + (small ? ' thin' : '') + '" data-t="사랑">사랑</span> <span class="st c-blue' + (small ? ' thin' : '') + '" data-t="우체국">우체국</span></span></h1>';
  }
  function confetti(n) {
    var cols = ['#FF85AE', '#FFC2D6', '#FFE78A', '#FFC94A', '#A7E9D1', '#6FD3B0', '#B7CCFF', '#8FA8F0'], h = '';
    for (var i = 0; i < n; i++) {
      var k = i % 3 === 0 ? ' class="r"' : (i % 3 === 1 ? ' class="s"' : '');
      h += '<i' + k + ' style="left:' + ((i * 37 + 11) % 97) + '%;background:' + cols[i % cols.length] + ';animation-duration:' + (3.6 + (i % 5) * 0.7) + 's;animation-delay:-' + ((i * 0.83) % 5).toFixed(2) + 's"></i>';
    }
    return '<div class="confetti" aria-hidden="true">' + h + '</div>';
  }
  var NAMES = { seok: '석범이', sujin: '수진이', both: '석범이와 수진이' };
  var SUBJ = { seok: '석범이가', sujin: '수진이가', both: '석범이와 수진이가' };
  function hash32(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // courier is separate from the author ("from"); same date + id gives the same courier on every device
  function courierOf(m) {
    if (m.courier === 'seok' || m.courier === 'sujin' || m.courier === 'both') return m.courier;
    return ['seok', 'sujin', 'both'][hash32((m.date || '') + '|' + m.id) % 3];
  }
  function who(c) { return c === 'both' ? ['seok', 'sujin'] : [c]; }
  function faces(c) { return who(c).map(function (n) { return '<span class="face"><img src="' + IMG + n + '-wave.svg" alt=""></span>'; }).join(''); }

  /* ---------- data ---------- */
  function loadJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }
  function normalize(raw, cfg) {
    var list = [], byId = {}, byDate = {};
    (raw && Array.isArray(raw.messages) ? raw.messages : []).forEach(function (m, i) {
      if (m && m.draft === true) return; // draft: never shown until the flag is removed
      if (!m || typeof m.text !== 'string' || !m.text.trim() || !YMD.test(m.date || '') || !/^[A-Za-z0-9_-]+$/.test(m.id || '') || m.id === 'welcome') { console.warn('[사랑 우체국] 건너뛴 메시지 #' + (i + 1)); return; }
      if (byId[m.id] || byDate[m.date]) { console.warn('[사랑 우체국] 중복된 id 또는 날짜: ' + m.id + ' / ' + m.date); return; }
      m.photos = (Array.isArray(m.photos) ? m.photos : []).filter(function (p) { return p && typeof p.src === 'string' && p.src; }).slice(0, 3);
      list.push(m); byId[m.id] = m; byDate[m.date] = m;
    });
    list.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var w = raw && raw.welcome && typeof raw.welcome.text === 'string' ? raw.welcome : { text: '엄마 아빠, 생신 축하드려요!', from: 'both', courier: 'both' };
    w.id = 'welcome'; w.photos = (Array.isArray(w.photos) ? w.photos : []).slice(0, 3);
    S.messages = list; S.byId = byId; S.byDate = byDate; S.welcome = w;
    S.config = cfg && typeof cfg === 'object' ? cfg : {};
  }
  function boot() {
    Promise.all([loadJSON('data/messages.json'), loadJSON('data/config.json')]).then(function (res) {
      store.set('cache', { m: res[0], c: res[1] });
      start(res[0], res[1], false);
    }).catch(function (err) {
      console.warn('[사랑 우체국] 데이터를 불러오지 못했어요:', err && err.message);
      var c = store.get('cache', null);
      if (c && c.m) start(c.m, c.c, true); else viewError();
    });
  }
  function start(m, c, offline) {
    normalize(m, c); S.offline = offline; S.ready = true; S.today = kstToday();
    route();
  }
  function published() { return S.messages.filter(function (m) { return m.date <= S.today; }); }
  function specialToday() {
    var md = S.today.slice(5), list = Array.isArray(S.config.specialDays) ? S.config.specialDays : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].draft !== true && list[i].date === md) return list[i];
    return null;
  }

  /* ---------- router (plain #names so it also works inside previews) ---------- */
  function go(name, replace) {
    var target = '#' + name;
    if (location.hash === target) { route(); return; }
    if (replace) { try { location.replace(target); return; } catch (e) {} }
    location.hash = name;
  }
  function route() {
    if (!S.ready) return;
    clearTimers();
    var h = (location.hash || '').replace(/^#/, ''), m;
    if (!store.get('welcomed', false) && (h === '' || h === 'home')) { welcomeStep = 1; go('welcome', true); return; }
    if (h === 'welcome') { viewWelcome(); }
    else if (h === 'archive') viewArchive();
    else if (h === 'gacha') viewGacha();
    else if (h === 'setup') viewSetup();
    else if (h === 'special') viewSpecial();
    else if ((m = /^photo-(.+)-(\d+)$/.exec(h))) viewLetter(m[1], +m[2]);
    else if ((m = /^letter-(.+)$/.exec(h))) viewLetter(m[1], null);
    else viewHome();
    if (!/^photo-/.test(h)) {
      lbPushed = false;
      var back = /^photo-(.+)-\d+$/.exec(prevHash);
      window.scrollTo(0, back && h === 'letter-' + back[1] && keepY != null ? keepY : 0);
      keepY = null;
    }
    prevHash = h;
    fit();
  }
  function show(html) { APP.innerHTML = html; }

  /* ---------- layout fitting ---------- */
  function fit() {
    var els = APP.querySelectorAll('.stage');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], box = el.parentNode, w = +el.getAttribute('data-w'), h = +el.getAttribute('data-h');
      var s = Math.min(box.clientWidth / w, box.clientHeight / h, +el.getAttribute('data-max') || 1.35);
      if (!(s > 0)) s = 1;
      el.style.width = w + 'px'; el.style.height = h + 'px'; el.style.marginLeft = (-w / 2) + 'px';
      el.style.transform = 'scale(' + s.toFixed(4) + ')';
    }
    var st = APP.querySelector('.stamps');
    if (st) { // stamp width must be a multiple of 12px so the perforation lines up
      var sw = Math.floor(((st.clientWidth - 14) / 2) / 12) * 12;
      st.style.setProperty('--stamp-w', Math.max(120, Math.min(sw, 204)) + 'px');
    }
  }

  /* ---------- home ---------- */
  function viewHome() {
    var sp = specialToday();
    if (sp && store.get('specialSeen', '') !== S.today + ':' + sp.id) { go('special', true); return; }
    var msg = S.byDate[S.today], opened = store.get('opened', {}), pub = published(), card;
    if (msg) {
      var c = courierOf(msg), isNew = !opened[msg.id];
      card = '<a class="mail press" href="#letter-' + esc(msg.id) + '">' +
        '<span class="mail-in"><img class="mail-env' + (isNew ? ' sway' : '') + '" src="' + IMG + 'envelope.svg" alt="">' +
        '<span class="mail-txt"><span class="mail-title">오늘도 사랑<br>배달 왔어요!</span>' +
        '<span class="mail-sub">' + faces(c) + '<span>배달원 ' + NAMES[c] + '</span></span>' +
        '<span class="mail-go">' + (isNew ? '편지 열기' : '다시 읽기') + '</span></span></span>' +
        (isNew ? '<span class="mail-badge">새 편지!</span>' : '') + '</a>';
    } else if (!pub.length) {
      var first = S.messages[0];
      card = '<a class="mail press" href="#letter-welcome">' +
        '<span class="mail-in"><img class="mail-env" src="' + IMG + 'envelope.svg" alt="">' +
        '<span class="mail-txt"><span class="mail-title">첫 배달을<br>준비하고 있어요!</span>' +
        '<span class="mail-sub">' + (first ? fmtDate(first.date) + '에 도착해요' : '조금만 기다려 주세요') + '</span>' +
        '<span class="mail-go">첫 편지 보기</span></span></span></a>';
    } else {
      card = '<a class="mail press" href="#archive">' +
        '<span class="mail-in"><img class="mail-env" src="' + IMG + 'envelope.svg" alt="">' +
        '<span class="mail-txt"><span class="mail-title">새로운 사랑을<br>준비하고 있어요!</span>' +
        '<span class="mail-sub">오늘은 우체부들이 편지를 쓰는 날이에요</span>' +
        '<span class="mail-go">지난 편지 보기</span></span></span></a>';
    }
    var puffs = [['0s', 0, 0, 16, '#FF85AE'], ['-.8s', 10, -12, 13, '#FFC2D6'], ['-1.6s', -6, -20, 11, '#FFE78A']].map(function (p) {
      return '<span class="puff" style="left:' + (222 + p[1]) + 'px;top:' + (14 + p[2]) + 'px;animation-delay:' + p[0] + '">' + heart(p[3], p[4]) + '</span>';
    }).join('');
    show('<main class="view home">' +
      '<div class="scene">' +
        '<div class="topbar"><span class="pill small">' + heart(20) + esc(fmtDate(S.today)) + '</span>' +
        '<span class="grp">' + sndBtn() + '<a class="roundbtn press" href="#setup" aria-label="설정">' + gear() + '</a></span></div>' +
        logo(false) +
        '<div class="stagebox"><div class="stage" data-w="350" data-h="290" data-max="1.3">' +
          '<button class="ch" data-action="hop" aria-label="우체국 건물" style="left:52.3px;top:-4.7px;width:245.4px"><img src="' + IMG + 'postoffice.svg" alt=""></button>' + puffs +
          im('mailbox', 300, 203, 50) +
          '<button class="ch" data-action="hop" data-heart="1" aria-label="석범이에게 인사하기" style="left:28.6px;top:154.6px;width:118.8px"><img class="bob" src="' + IMG + 'seok-wave.svg" alt="우체부 석범이"></button>' +
          '<button class="ch" data-action="hop" data-heart="1" aria-label="수진이에게 인사하기" style="left:191.8px;top:161.8px;width:112.3px"><img class="bob2" src="' + IMG + 'sujin-wave.svg" alt="우체부 수진이"></button>' +
        '</div></div>' +
      '</div>' +
      '<div class="dock">' +
        (sp ? '<a class="banner press" href="#special">' + heart(20) + esc(sp.headline || '오늘은 특별한 날!') + '</a>' : '') +
        card +
        '<div class="stamps">' +
          '<a class="stamp press" href="#archive" style="--c:#B7CCFF"><span class="stamp-in"><img src="' + IMG + 'icon-album.svg" alt=""><span class="stamp-l">추억 보관함</span><span class="stamp-s">지난 편지 보기</span></span></a>' +
          '<a class="stamp press" href="#gacha" style="--c:#FFE78A"><span class="stamp-in"><img src="' + IMG + 'icon-gift.svg" alt=""><span class="stamp-l">효도 뽑기</span><span class="stamp-s">두근두근 선물</span></span></a>' +
        '</div>' +
      '</div></main>');
  }

  /* ---------- first-visit birthday surprise ---------- */
  function wlFrame(step, bubble, art, foot) {
    var d = ''; for (var i = 1; i <= 4; i++) d += '<i' + (i === step ? ' class="on"' : '') + '></i>';
    return '<main class="view party">' +
      '<div class="topbar"><span class="dots" role="img" aria-label="4장면 중 ' + step + '번째">' + d + '</span>' +
      '<span class="grp">' + sndBtn() + '<button class="pill press" data-action="wl-skip">건너뛰기</button></span></div>' +
      '<div class="bubble" aria-live="polite">' + bubble + '</div>' +
      '<div class="art"><div class="stage" data-w="375" data-h="440" data-max="1.25">' + art + '</div></div>' +
      '<div class="foot">' + foot + '</div></main>';
  }
  function viewWelcome() {
    var st = welcomeStep, bubble, art, foot;
    if (st === 1) {
      bubble = '<p class="big">띵동~!<img class="inl" src="' + IMG + 'icon-gift.svg" alt=""></p><p>엄마 아빠 앞으로<br>특별한 선물이 도착했어요!</p>';
      art = '<button class="giftbtn abs pop" data-action="wl-gift" aria-label="선물 상자 열기" style="left:67.5px;top:128px;width:240px;height:262px">' +
        '<span class="ring"></span><span class="shadow" style="left:34px;bottom:0;width:172px;height:20px"></span>' +
        '<span class="wrap sway">' + im('gift-body', 11, 100, 218) + im('gift-lid', 0, 0, 240, 'lid', '리본이 묶인 큰 선물 상자') + '</span></button>';
      foot = '<span class="tap-hint bob">' + heart(22) + '선물 상자를 톡! 눌러 주세요</span>';
    } else if (st === 2) {
      bubble = '<p class="big">짜잔~!</p><p>엄마 아빠,<br>생신 축하드려요!!<span class="hrt">' + heart(26) + '</span></p>';
      art = confetti(22) + im('gift-lid', 244, 310, 124, '', '', 'transform:rotate(18deg);') +
        im('seok-cheer', 42, 100, 146, 'rise', '상자에서 나온 석범이') + im('sujin-cheer', 191, 106, 138, 'rise', '상자에서 나온 수진이', 'animation-delay:.12s;') +
        '<span class="shadow-el abs" style="left:102px;top:376px;width:172px;height:20px"></span>' + im('gift-body', 78.5, 228, 218, '', '열린 선물 상자');
      foot = '<button class="btn press" data-action="wl-next">케이크 받으러 가기</button>';
    } else if (st === 3) {
      bubble = '<p>오늘의 주인공은 바로</p><p class="big">우리 엄마 아빠!<img class="inl" src="' + IMG + 'cake.svg" alt=""></p>';
      art = confetti(14) + im('balloons', 10, 68, 104, 'bob') + im('balloons', 261, 68, 104, 'bob2') +
        im('cake-off', 92.5, 180, 190, 'pop', '') + im('cake', 92.5, 180, 190, 'pop lit', '촛불이 켜진 생일 케이크') +
        im('seok-cheer', 0, 256, 118, 'rise', '축하하는 석범이') + im('sujin-cheer', 261, 264, 112, 'rise', '축하하는 수진이', 'animation-delay:.12s;');
      foot = '<button class="btn press" data-action="wl-blow">후~ 촛불 끄기</button>';
    } else {
      bubble = '<p>엄마 아빠를 위해 저희가 준비한<br>작은 선물이에요!</p><p>앞으로 사랑을 가득<br>배달해 드릴게요.<span class="hrt">' + heart(24) + '</span></p>';
      art = '<div class="abs pop" style="left:0;top:8px;width:375px;display:flex;justify-content:center">' + logo(true) + '</div>' +
        im('postoffice', 52.5, 122, 270, 'pop', '작은 사랑 우체국', 'animation-delay:.15s;') +
        im('seok-wave', 4, 282, 118, 'rise', '손 흔드는 석범이', 'animation-delay:.3s;') + im('sujin-wave', 263, 290, 112, 'rise', '손 흔드는 수진이', 'animation-delay:.4s;');
      foot = '<button class="btn press" data-action="wl-finish">첫 번째 사랑 배달 받기</button>';
    }
    show(wlFrame(st, bubble, art, foot));
  }

  /* ---------- special day ---------- */
  function viewSpecial() {
    var sp = specialToday();
    if (!sp) { go('home', true); return; }
    store.set('specialSeen', S.today + ':' + sp.id);
    var photo = sp.photo ? '<div class="special-photo"><img src="' + esc(sp.photo) + '" alt="" data-hide-on-error="1"></div>' : '';
    show('<main class="view party">' +
      '<div class="topbar"><span class="pill small">' + heart(20) + esc(fmtDate(S.today)) + '</span><a class="pill press" href="#home">닫기</a></div>' +
      '<div class="bubble"><p class="big">' + esc(sp.headline || '축하드려요!') + '</p><p style="white-space:pre-line">' + esc(sp.text || '') + '</p>' + photo + '</div>' +
      '<div class="art"><div class="stage" data-w="375" data-h="440" data-max="1.25">' + confetti(20) +
        im('balloons', 10, 68, 104, 'bob') + im('balloons', 261, 68, 104, 'bob2') +
        im('cake', 92.5, 180, 190, 'pop', '생일 케이크') +
        im('seok-cheer', 0, 256, 118, 'rise', '축하하는 석범이') + im('sujin-cheer', 261, 264, 112, 'rise', '축하하는 수진이', 'animation-delay:.12s;') +
      '</div></div>' +
      '<div class="foot"><a class="btn press" href="#home">우체국으로 가기</a></div></main>');
  }

  /* ---------- letter ---------- */
  function getLetter(id) {
    if (id === 'welcome') return S.welcome;
    var m = S.byId[id];
    return m && m.date <= S.today ? m : null; // never reveal future letters
  }
  function viewLetter(id, photoIdx) {
    var m = getLetter(id);
    if (!m) {
      show('<main class="view letter"><div class="topbar"><a class="pill press" href="#home">‹ 우체국</a></div>' +
        '<div class="empty" style="margin-top:60px"><img src="' + IMG + 'mailbox.svg" alt="" width="70">아직 도착하지 않은 편지예요.<br>도착하는 날 다시 만나요!<a class="btn small press" href="#home">우체국으로</a></div></main>');
      return;
    }
    var c = courierOf(m), opened = store.get('opened', {});
    var dateTxt = id === 'welcome' ? '첫 번째 사랑 배달' : fmtDate(m.date);
    var top = '<div class="topbar"><a class="pill press" href="#home">‹ 우체국</a><span class="pill small">' + heart(20) + esc(dateTxt) + '</span></div>';
    if (!opened[id] && photoIdx == null) {
      show('<main class="view letter">' + top +
        '<div class="env-stage">' +
          '<div class="env-couriers">' + who(c).map(function (n, i) { return '<img class="' + (i ? 'bob2' : 'bob') + '" src="' + IMG + n + '-letter.svg" alt="편지를 든 ' + NAMES[n] + '">'; }).join('') + '</div>' +
          '<p class="env-say">' + SUBJ[c] + ' 편지를 가져왔어요!</p>' +
          '<button class="env closed" data-action="open-env" data-id="' + esc(id) + '" aria-label="봉투 열기">' +
            '<span class="env-back"></span><span class="env-paper"></span><span class="env-front"></span><span class="env-flap"></span><span class="env-seal">' + heart(26, '#fff') + '</span></button>' +
          '<button class="btn press" data-action="open-env" data-id="' + esc(id) + '" style="max-width:300px">봉투 열기</button>' +
        '</div></main>');
      return;
    }
    var n = m.photos.length, photos = '';
    if (n) {
      photos = '<div class="photos n' + n + '">' + m.photos.map(function (p, i) {
        return '<button class="pola press" data-action="photo" data-id="' + esc(id) + '" data-i="' + i + '" aria-label="사진 크게 보기">' +
          '<img src="' + esc(p.src) + '" alt="' + esc(p.alt || p.caption || '편지에 담긴 사진') + '" loading="lazy" data-pola="1">' +
          (p.caption ? '<span class="pola-cap">' + esc(p.caption) + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    }
    var from = m.from === 'seok' || m.from === 'sujin' ? m.from : 'both';
    var html = '<main class="view letter">' + top +
      '<div class="peek">' + who(c).map(function (nm) { return '<img src="' + IMG + nm + '-wave.svg" alt="">'; }).join('') + '</div>' +
      '<span class="by">' + faces(c) + '<span>' + SUBJ[c] + ' 배달했어요</span></span>' +
      '<article class="paper">' +
        '<p class="paper-to">' + esc(m.to || '엄마 아빠께') + '</p>' +
        '<p class="paper-text">' + esc(m.text) + '</p>' + photos +
        '<p class="paper-from">' + NAMES[from] + ' 올림</p>' +
      '</article>' +
      '<div class="actions"><a class="btn press" href="#home">우체국으로</a><a class="btn white press" href="#archive">추억 보관함</a></div>';
    if (photoIdx != null && m.photos[photoIdx]) {
      var p = m.photos[photoIdx];
      html += '</main><div class="lightbox" data-action="lb-close" role="dialog" aria-modal="true" aria-label="사진 크게 보기">' +
        '<button class="roundbtn press lb-close" data-action="lb-close" aria-label="닫기"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#84506F" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg></button>' +
        '<figure data-stop="1"><img src="' + esc(p.src) + '" alt="' + esc(p.alt || p.caption || '편지에 담긴 사진') + '" data-hide-on-error="1">' + (p.caption ? '<figcaption>' + esc(p.caption) + '</figcaption>' : '') + '</figure>' +
        (n > 1 ? '<div class="lb-nav" data-stop="1"><button class="mini press" data-action="lb-go" data-id="' + esc(id) + '" data-i="' + ((photoIdx + n - 1) % n) + '">‹ 이전</button><span>' + (photoIdx + 1) + ' / ' + n + '</span><button class="mini press" data-action="lb-go" data-id="' + esc(id) + '" data-i="' + ((photoIdx + 1) % n) + '">다음 ›</button></div>' : '') +
        '</div>';
    } else html += '</main>';
    show(html);
    var imgs = APP.querySelectorAll('img[data-pola],img[data-hide-on-error]');
    for (var i = 0; i < imgs.length; i++) bindImgError(imgs[i]);
    var lb = APP.querySelector('.lightbox'), li = lb && lb.querySelector('img');
    if (li) {
      var tall = function () { if (li.naturalWidth && li.naturalHeight / li.naturalWidth > 1.9) lb.classList.add('tall'); };
      if (li.complete) tall(); else li.addEventListener('load', tall);
    }
  }
  function bindImgError(img) {
    function bad() {
      if (img.getAttribute('data-pola')) {
        var b = img.parentNode; b.removeAttribute('data-action'); b.disabled = true;
        var d = document.createElement('span'); d.className = 'pola-miss'; d.textContent = '사진을 불러오지 못했어요';
        b.replaceChild(d, img);
      } else { var f = img.parentNode; f.innerHTML = '<span class="pola-miss" style="min-width:220px">사진을 불러오지 못했어요</span>'; }
    }
    img.addEventListener('error', bad);
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) bad();
  }

  /* ---------- archive ---------- */
  function viewArchive() {
    var pub = published().slice().reverse(), opened = store.get('opened', {}), rows = '';
    pub.forEach(function (m) {
      var d = parseYMD(m.date), c = courierOf(m);
      rows += '<a class="row press" href="#letter-' + esc(m.id) + '">' +
        '<span class="row-date"><span>' + (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '</span><small>' + '일월화수목금토'.charAt(d.getUTCDay()) + '요일</small></span>' +
        '<span class="row-main"><span class="row-text">' + esc(m.text.split('\n')[0]) + '</span>' +
        '<span class="row-meta">' + NAMES[c] + ' 배달' + (m.photos.length ? '<span class="chip">사진 ' + m.photos.length + '장</span>' : '') + (opened[m.id] ? '' : '<span class="chip" style="background:#FFE78A">아직 안 열었어요</span>') + '</span></span></a>';
    });
    if (store.get('welcomed', false)) {
      rows += '<a class="row press" href="#letter-welcome"><span class="row-date first">' + heart(26) + '</span>' +
        '<span class="row-main"><span class="row-text">' + esc(S.welcome.text.split('\n')[0]) + '</span><span class="row-meta">첫 번째 사랑 배달</span></span></a>';
    }
    show('<main class="view sub-view">' +
      '<div class="topbar"><a class="pill press" href="#home">‹ 우체국</a></div>' +
      '<div class="head"><h1 class="title">추억 보관함</h1><p class="hint-note">지금까지 도착한 편지를 다시 볼 수 있어요</p></div>' +
      (rows ? '<div class="list">' + rows + '</div>' : '<div class="empty"><img src="' + IMG + 'icon-album.svg" alt="" width="64">아직 도착한 편지가 없어요.<br>첫 편지가 오면 여기에 모아 둘게요!</div>') +
      '</main>');
  }

  /* ---------- gacha (weekly, device-local) ---------- */
  function coupons() { return Array.isArray(S.config.coupons) && S.config.coupons.length ? S.config.coupons : [{ id: 'wish', name: '소원권', desc: '소원 하나, 무엇이든 말씀만 하세요' }]; }
  function ticket(cp, used) {
    return '<div class="ticket' + (used ? ' used' : '') + '"><span class="ticket-stub"><img src="' + IMG + 'icon-gift.svg" alt=""></span>' +
      '<span class="ticket-body"><span class="ticket-k">효도 쿠폰</span><span class="ticket-n">' + esc(cp.name) + '</span><span class="ticket-d">' + esc(cp.desc || '') + '</span></span>' +
      (used ? '<span class="ticket-stamp">사용 완료</span>' : '') + '</div>';
  }
  function viewGacha(justDrew) {
    var mine = store.get('coupons', []), can = store.get('drawWeek', '') !== weekKey(S.today), byId = {};
    coupons().forEach(function (c) { byId[c.id] = c; });
    var art, msg;
    if (can) {
      art = '<button class="giftbtn abs" data-action="draw" aria-label="선물 상자를 눌러 쿠폰 뽑기" style="left:30px;top:24px;width:240px;height:262px">' +
        '<span class="ring"></span><span class="shadow" style="left:34px;bottom:0;width:172px;height:20px"></span>' +
        '<span class="wrap sway">' + im('gift-body', 11, 100, 218) + im('gift-lid', 0, 0, 240, 'lid') + '</span></button>';
      msg = '선물 상자를 톡! 눌러 보세요<small>이번 주 선물이 기다리고 있어요</small>';
    } else {
      art = '<span class="shadow-el abs" style="left:64px;top:266px;width:172px;height:20px"></span>' + im('gift-body', 41, 134, 218, '', '열린 선물 상자') + im('gift-lid', 176, 196, 118, '', '', 'transform:rotate(18deg);');
      msg = (justDrew ? '쿠폰이 쿠폰함에 쏙 들어갔어요!' : '이번 주 선물은 이미 뽑았어요!') + '<small>다음 선물은 다음 주 월요일부터 열려요. 천천히 오셔도 기다리고 있을게요.</small>';
    }
    var list = mine.slice().reverse().map(function (it) {
      var cp = byId[it.c] || { name: it.n || '효도 쿠폰', desc: '' };
      return '<div class="coupon">' + ticket(cp, it.used) + '<div class="coupon-ctl"><span>' + esc(fmtDate(it.d)) + '에 뽑았어요</span>' +
        '<button class="mini press" data-action="use" data-k="' + esc(it.k) + '">' + (it.used ? '다시 살리기' : '사용했어요') + '</button></div></div>';
    }).join('');
    show('<main class="view sub-view">' +
      '<div class="topbar"><a class="pill press" href="#home">‹ 우체국</a></div>' +
      '<div class="head"><h1 class="title">두근두근 효도 뽑기</h1></div>' +
      '<div class="gacha-art"><div class="stage" data-w="300" data-h="300" data-max="1.1">' + art + '</div></div>' +
      '<p class="gacha-msg" aria-live="polite">' + msg + '</p>' +
      '<div class="list"><h2 class="sect">' + heart(20) + '내 쿠폰함</h2>' +
      (list || '<p class="hint-note empty-note" style="padding:8px 0 4px">아직 쿠폰이 없어요. 상자를 눌러 첫 쿠폰을 뽑아 보세요!</p>') +
      '<p class="hint-note">쿠폰은 이 휴대폰에만 저장돼요.<br>쓰실 때 석범이와 수진이에게 이 화면을 보여 주세요!</p></div></main>');
  }
  function draw(btn) {
    if (store.get('drawWeek', '') === weekKey(S.today)) { viewGacha(); fit(); return; }
    var all = coupons(), cp = all[Math.floor(Math.random() * all.length)];
    var mine = store.get('coupons', []);
    mine.push({ k: S.today + '-' + Date.now().toString(36), c: cp.id, n: cp.name, d: S.today, used: false });
    store.set('coupons', mine); store.set('drawWeek', weekKey(S.today));
    btn.removeAttribute('data-action'); btn.classList.add('shake');
    var ring = btn.querySelector('.ring'); if (ring) ring.style.display = 'none';
    var wrap = btn.querySelector('.wrap'); if (wrap) wrap.classList.remove('sway');
    later(function () { btn.classList.add('open'); SND.sfx('pop'); }, 520);
    later(function () {
      var stage = btn.parentNode, box = stage.parentNode;
      box.insertAdjacentHTML('beforeend', confetti(18) + '<div class="result">' + ticket(cp, false) + '</div>');
      var en = APP.querySelector('.empty-note'); if (en) en.parentNode.removeChild(en);
      var msg = APP.querySelector('.gacha-msg');
      if (msg) msg.innerHTML = '<span style="color:#F0508C">' + esc(cp.name) + '</span> 당첨!<small>' + esc(cp.desc || '') + '</small><button class="btn small press" data-action="draw-done" style="margin:14px auto 0;max-width:260px">쿠폰함에 넣기</button>';
    }, 1050);
  }

  /* ---------- setup ---------- */
  function viewSetup(showTest, askReset) {
    var t = testDate();
    show('<main class="view sub-view">' +
      '<div class="topbar"><a class="pill press" href="#home">‹ 우체국</a></div>' +
      '<div class="head"><h1 class="title">설정</h1></div>' +
      '<div class="list">' +
        '<button class="btn white press" data-action="replay">생일 선물 이벤트 다시 보기</button>' +
        '<a class="btn white press" href="#letter-welcome">첫 번째 편지 다시 읽기</a>' +
        '<div class="panel"><h2>소리</h2><p>배경음악과 버튼 효과음이에요. 아이폰은 옆면 무음 스위치가 켜져 있으면 소리가 나지 않아요.</p>' +
          '<button class="btn small ' + (SND.isOn() ? 'white' : 'lemon') + ' press" data-action="sound-setup">' + (SND.isOn() ? '소리 끄기' : '소리 켜기') + '</button></div>' +
        '<div class="panel"><h2>홈 화면에 우체국 놓기</h2><ol><li>아이폰: 사파리 아래쪽 공유 버튼을 누르고 "홈 화면에 추가"</li><li>갤럭시: 크롬이나 삼성 인터넷의 메뉴(점 세 개 또는 줄 세 개)에서 "홈 화면에 추가"</li></ol></div>' +
        '<div class="panel"><h2>이 휴대폰의 기록</h2><p>열어 본 편지 표시와 뽑은 쿠폰은 이 휴대폰에만 저장돼요. 다른 휴대폰과는 따로 기록됩니다.</p>' +
          (askReset ? '<p style="color:#F0508C">정말 지울까요? 쿠폰함도 함께 비워져요.</p><div style="display:flex;gap:10px"><button class="btn small press" data-action="reset-do">네, 지울게요</button><button class="btn small white press" data-action="reset-cancel">아니요</button></div>'
            : '<button class="mini press" data-action="reset-ask" style="align-self:flex-start">기록 지우고 처음부터 보기</button>') + '</div>' +
        (S.offline ? '<p class="hint-note">인터넷 연결이 불안정해서 저장해 둔 편지를 보여 드리고 있어요.</p>' : '') +
        (showTest || t ? '<div class="panel"><h2>미리보기 날짜 (석범·수진용)</h2><p>다른 날짜의 화면을 확인할 때만 사용하세요. 앱을 닫으면 원래대로 돌아가요.</p>' +
          '<label for="testdate">확인할 날짜</label><input type="date" id="testdate" value="' + esc(t || S.today) + '">' +
          '<div style="display:flex;gap:10px"><button class="btn small lemon press" data-action="test-set">이 날짜로 보기</button><button class="btn small white press" data-action="test-clear">오늘로 되돌리기</button></div></div>' : '') +
        '<button class="ver" data-action="ver">사랑 우체국 ' + esc(S.config.appVersion || '1.0.0') + ' · 오늘 ' + esc(S.today) + '</button>' +
      '</div></main>');
  }

  function viewError() {
    show('<main class="view sub-view" style="justify-content:center"><div class="empty"><img src="' + IMG + 'mailbox.svg" alt="" width="70">편지를 가져오는 길에 문제가 생겼어요.<br>인터넷 연결을 확인하고 다시 눌러 주세요.' +
      '<button class="btn small press" data-action="retry">다시 시도</button></div></main>');
  }

  /* ---------- actions ---------- */
  var verTaps = 0;
  var actions = {
    hop: function (el) {
      el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
      if (el.getAttribute('data-heart')) {
        var h = document.createElement('span'); h.className = 'heartfx'; h.innerHTML = heart(26);
        h.style.left = (el.offsetLeft + el.offsetWidth / 2) + 'px'; h.style.top = (el.offsetTop - 6) + 'px';
        el.parentNode.appendChild(h); setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 850);
      }
    },
    sound: function () {
      var on = SND.toggle(), list = document.querySelectorAll('[data-action="sound"]');
      for (var i = 0; i < list.length; i++) { list[i].innerHTML = sndIcon(on); list[i].setAttribute('aria-pressed', on); list[i].setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기'); }
    },
    'sound-setup': function () { SND.toggle(); var y = window.pageYOffset; viewSetup(); window.scrollTo(0, y); },
    'wl-skip': function () { store.set('welcomed', true); welcomeStep = 1; go('home', true); },
    'wl-gift': function (el) {
      el.removeAttribute('data-action'); el.classList.add('shake');
      var ring = el.querySelector('.ring'); if (ring) ring.style.display = 'none';
      var wrap = el.querySelector('.wrap'); if (wrap) wrap.classList.remove('sway');
      later(function () { el.classList.add('open'); SND.sfx('pop'); }, 480);
      later(function () { welcomeStep = 2; viewWelcome(); fit(); }, 980);
    },
    'wl-next': function () { welcomeStep = 3; viewWelcome(); fit(); },
    'wl-blow': function (el) {
      el.removeAttribute('data-action');
      var lit = APP.querySelector('img.lit'); if (lit) { lit.style.animation = 'none'; lit.classList.add('fadeout'); }
      el.textContent = '후~~~';
      later(function () { welcomeStep = 4; viewWelcome(); fit(); }, 1000);
    },
    'wl-finish': function () { store.set('welcomed', true); welcomeStep = 1; go('letter-welcome', true); },
    'open-env': function (el) {
      var id = el.getAttribute('data-id'), env = APP.querySelector('.env');
      if (!env || env.classList.contains('open')) return;
      env.classList.remove('closed'); env.classList.add('open'); SND.sfx('open', 0.25);
      var stg = APP.querySelector('.env-stage'); if (stg) stg.classList.add('opening');
      var o = store.get('opened', {}); o[id] = S.today; store.set('opened', o);
      later(function () { viewLetter(id, null); fit(); window.scrollTo(0, 0); }, 1350);
    },
    photo: function (el) { lbPushed = true; keepY = window.pageYOffset; go('photo-' + el.getAttribute('data-id') + '-' + el.getAttribute('data-i')); },
    'lb-go': function (el) { go('photo-' + el.getAttribute('data-id') + '-' + el.getAttribute('data-i'), true); },
    'lb-close': function () {
      var m = /^#photo-(.+)-\d+$/.exec(location.hash); if (!m) return;
      if (lbPushed) { lbPushed = false; history.back(); } else go('letter-' + m[1], true);
    },
    draw: function (el) { draw(el); },
    'draw-done': function () { viewGacha(true); fit(); },
    use: function (el) {
      var k = el.getAttribute('data-k'), mine = store.get('coupons', []);
      mine.forEach(function (it) { if (it.k === k) it.used = !it.used; });
      store.set('coupons', mine); var y = window.pageYOffset; viewGacha(); fit(); window.scrollTo(0, y);
    },
    replay: function () { welcomeStep = 1; go('welcome'); },
    'reset-ask': function () { viewSetup(false, true); },
    'reset-cancel': function () { viewSetup(); },
    'reset-do': function () { store.clear(); try { sessionStorage.removeItem('lpo.testDate'); } catch (e) {} S.today = kstToday(); welcomeStep = 1; go('home', true); },
    ver: function () { verTaps++; if (verTaps >= 5) { verTaps = 0; viewSetup(true); } },
    'test-set': function () {
      var v = (document.getElementById('testdate') || {}).value;
      if (v && YMD.test(v)) { try { sessionStorage.setItem('lpo.testDate', v); } catch (e) {} S.today = kstToday(); go('home'); }
    },
    'test-clear': function () { try { sessionStorage.removeItem('lpo.testDate'); } catch (e) {} S.today = kstToday(); go('home'); },
    retry: function () { show('<div class="boot" role="status"><img src="' + IMG + 'envelope.svg" alt="" width="120"><p>다시 가져오는 중이에요</p></div>'); boot(); }
  };
  APP.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== APP) {
      if (t.getAttribute) {
        if (t.getAttribute('data-stop')) return;
        var a = t.getAttribute('data-action');
        if (a && actions[a]) { e.preventDefault(); actions[a](t, e); return; }
      }
      t = t.parentNode;
    }
  });

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('a,button') : null;
    if (!t || !APP.contains(t)) return;
    var a = t.getAttribute('data-action'), toggling = a === 'sound' || a === 'sound-setup';
    if (!toggling) SND.unlock();
    var x = e.clientX, y = e.clientY;
    if (!x && !y) { var r = t.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    tapHearts(x, y);
    if (!toggling) SND.sfx('tap');
  }, true);

  window.addEventListener('hashchange', route);
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 250); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && /^#photo-/.test(location.hash)) actions['lb-close'](); });
  document.addEventListener('visibilitychange', function () { // crossing midnight (KST) while the app stays open
    if (document.visibilityState !== 'visible' || !S.ready) return;
    var t = kstToday();
    if (t !== S.today) { S.today = t; if (!/^#(welcome|photo-|letter-)/.test(location.hash)) route(); }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  boot();
})();
