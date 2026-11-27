/* ============================================================
   Aayush TV — Upgrade Pack v1 (27 Nov 2026)
   Easier watching for every section page:
   - Player toolbar: Fullscreen / Theater / Mini-player / PiP
   - Auto mini-player: keep watching while you scroll the list
   - Keyboard shortcuts for videos (K, F, M, J/L, arrows, 0-9)
   - Double-click / double-tap sides of a video to seek -/+10s
   - Remembers your volume across pages
   - Back-to-top button + header shadow on scroll
   Everything is defensive: if a page has no player, or anything
   fails, the page's own player keeps working untouched.
   Companion stylesheet: upgrade.css
   ============================================================ */
(function () {
  'use strict';

  /* ---------- config: player container per page ---------- */
  var WRAP_BY_PAGE = {
    'channels.html': '#player-wrap',
    'entertainment.html': '#playerWrap',
    'movies.html': '#watch-wrap',
    'biggboss.html': '#bb-player',
    'india.html': '#bb-player'
  };
  var WRAP_PROBE = ['#player-wrap', '#playerWrap', '#watch-wrap', '#bb-player'];

  var state = {
    wrap: null, toolbar: null, spacer: null, miniBar: null,
    mini: false, autoMini: true, tickTimer: null, volApplied: {}
  };

  function $(sel, root) { try { return (root || document).querySelector(sel); } catch (e) { return null; } }
  function pageName() {
    var p = (location.pathname || '').split('/').pop();
    return p || 'index.html';
  }
  function findWrap() {
    var sel = WRAP_BY_PAGE[pageName()];
    var el = sel ? $(sel) : null;
    if (el) return el;
    for (var i = 0; i < WRAP_PROBE.length; i++) { el = $(WRAP_PROBE[i]); if (el) return el; }
    return null;
  }
  function isShown(el) {
    if (!el || !el.getClientRects().length) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function mediaIn(wrap) { return wrap ? wrap.querySelector('video, iframe') : null; }
  function mainVideo() {
    if (state.wrap) { var v = state.wrap.querySelector('video'); if (v) return v; }
    var all = document.querySelectorAll('video');
    for (var i = 0; i < all.length; i++) if (isShown(all[i])) return all[i];
    return all[0] || null;
  }
  function isActive(wrap) {
    if (!wrap || !isShown(wrap)) return false;
    var m = mediaIn(wrap);
    if (!m) return false;
    if (m.tagName === 'VIDEO') return !m.paused && !m.ended && m.readyState >= 2;
    /* iframe embed: counts as active when it is shown and has a real src */
    return isShown(m) && !!m.src && m.src !== 'about:blank';
  }
  function playerTitle() {
    var sels = ['#playerTitle', '#now-playing', '#bb-title'];
    for (var i = 0; i < sels.length; i++) {
      var el = $(sels[i]);
      if (el && el.textContent.trim()) return el.textContent.trim().slice(0, 60);
    }
    return document.title.replace(/\s*[—|].*$/, '');
  }

  /* ---------- toast ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    try {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'atv-toast';
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 950);
    } catch (e) {}
  }

  /* ---------- toolbar ---------- */
  function buildToolbar(wrap) {
    var bar = document.createElement('div');
    bar.className = 'atv-toolbar';
    bar.innerHTML =
      '<span class="atv-tlabel">PLAYER</span>' +
      '<button type="button" class="atv-tbtn" data-act="fs">⛶ Fullscreen</button>' +
      '<button type="button" class="atv-tbtn" data-act="theater">🎬 Theater</button>' +
      '<button type="button" class="atv-tbtn" data-act="mini">📌 Mini player</button>' +
      '<button type="button" class="atv-tbtn" data-act="pip" style="display:none">🖼 Pop-out</button>';
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.atv-tbtn') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'fs') doFullscreen();
      else if (act === 'theater') { document.body.classList.toggle('atv-theater'); btn.classList.toggle('on', document.body.classList.contains('atv-theater')); }
      else if (act === 'mini') { state.autoMini = true; if (state.mini) exitMini(true); else enterMini(); }
      else if (act === 'pip') doPiP();
    });
    wrap.parentNode.insertBefore(bar, wrap);
    return bar;
  }
  function syncToolbar() {
    if (!state.toolbar || !state.wrap) return;
    var show = isShown(state.wrap);
    state.toolbar.style.display = show ? 'flex' : 'none';
    var pipBtn = state.toolbar.querySelector('[data-act="pip"]');
    if (pipBtn) {
      var v = state.wrap.querySelector('video');
      pipBtn.style.display = (v && document.pictureInPictureEnabled && v.requestPictureInPicture) ? '' : 'none';
    }
  }
  function doFullscreen() {
    var el = state.wrap || mainVideo();
    var v = mainVideo();
    try {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      if (el && el.requestFullscreen) { var p = el.requestFullscreen(); if (p && p.catch) p.catch(function () {}); }
      else if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    } catch (e) {}
  }
  function doPiP() {
    var v = mainVideo();
    if (!v) return;
    try {
      if (document.pictureInPictureElement) document.exitPictureInPicture();
      else if (v.requestPictureInPicture) v.requestPictureInPicture();
    } catch (e) {}
  }

  /* ---------- mini player ---------- */
  function tagKeepChain(wrap) {
    var m = mediaIn(wrap);
    /* clear old tags */
    var old = wrap.querySelectorAll('.atv-keep');
    for (var i = 0; i < old.length; i++) old[i].classList.remove('atv-keep');
    var el = m;
    while (el && el !== wrap) { el.classList.add('atv-keep'); el = el.parentElement; }
  }
  function enterMini() {
    var wrap = state.wrap;
    if (!wrap || state.mini) return;
    tagKeepChain(wrap);
    var spacer = document.createElement('div');
    spacer.className = 'atv-spacer';
    spacer.style.height = wrap.offsetHeight + 'px';
    wrap.parentNode.insertBefore(spacer, wrap);
    state.spacer = spacer;

    var bar = document.createElement('div');
    bar.className = 'atv-mini-bar';
    bar.innerHTML = '<span class="atv-mini-title"></span>' +
      '<button type="button" data-mact="back" title="Back to player">⤢</button>' +
      '<button type="button" data-mact="close" title="Close mini player">✕</button>';
    bar.querySelector('.atv-mini-title').textContent = playerTitle();
    bar.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      e.stopPropagation();
      if (b.getAttribute('data-mact') === 'close') state.autoMini = false;
      exitMini(true);
    });
    wrap.insertBefore(bar, wrap.firstChild);
    state.miniBar = bar;

    wrap.classList.add('atv-mini');
    document.body.classList.add('atv-mini-on');
    state.mini = true;
  }
  function exitMini(scrollBack) {
    var wrap = state.wrap;
    if (!wrap || !state.mini) return;
    wrap.classList.remove('atv-mini');
    document.body.classList.remove('atv-mini-on');
    if (state.miniBar) { state.miniBar.remove(); state.miniBar = null; }
    if (state.spacer) { state.spacer.remove(); state.spacer = null; }
    state.mini = false;
    if (scrollBack) { try { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
  }
  function outOfView(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.bottom < 60 || r.top > (window.innerHeight || 0);
  }

  /* ---------- main tick: keep toolbar + mini in sync ---------- */
  function tick() {
    try {
      if (!state.wrap) {
        state.wrap = findWrap();
        if (state.wrap) state.toolbar = buildToolbar(state.wrap);
        if (!state.wrap) return;
      }
      syncToolbar();
      hookVideos();
      var active = isActive(state.wrap);
      if (state.mini) {
        if (!active || !outOfView(state.spacer)) exitMini(false);
        else if (state.miniBar) state.miniBar.querySelector('.atv-mini-title').textContent = playerTitle();
      } else if (active && state.autoMini && outOfView(state.wrap)
                 && !document.fullscreenElement && !document.body.classList.contains('atv-theater')) {
        enterMini();
      }
    } catch (e) {}
  }

  /* ---------- volume memory ---------- */
  function loadVol() {
    try { return JSON.parse(localStorage.getItem('atv-vol') || 'null'); } catch (e) { return null; }
  }
  function saveVol(v) {
    try { localStorage.setItem('atv-vol', JSON.stringify({ v: v.volume, m: v.muted })); } catch (e) {}
  }
  function hookVideos() {
    var vids = document.querySelectorAll('video');
    for (var i = 0; i < vids.length; i++) {
      (function (v) {
        if (v.dataset.atvHooked) return;
        v.dataset.atvHooked = '1';
        v.addEventListener('loadedmetadata', function () {
          var saved = loadVol();
          if (saved) { try { v.volume = saved.v; v.muted = !!saved.m; } catch (e) {} }
        });
        v.addEventListener('volumechange', function () { saveVol(v); });
        attachSeekGestures(v);
      })(vids[i]);
    }
  }

  /* ---------- seek gestures: double-click / double-tap ---------- */
  function seekFlash(v, text, leftSide) {
    try {
      var host = v.parentElement;
      if (!host) return;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      var f = document.createElement('div');
      f.className = 'atv-seekflash';
      f.textContent = text;
      if (leftSide) f.style.left = '12%'; else f.style.right = '12%';
      host.appendChild(f);
      requestAnimationFrame(function () { f.classList.add('show'); });
      setTimeout(function () { f.classList.remove('show'); setTimeout(function () { f.remove(); }, 300); }, 450);
    } catch (e) {}
  }
  function seekBy(v, secs) {
    try {
      v.currentTime = Math.max(0, Math.min((v.duration || 0) || 1e9, v.currentTime + secs));
      seekFlash(v, (secs > 0 ? '⏩ +' : '⏪ ') + Math.abs(secs) + 's', secs < 0);
    } catch (e) {}
  }
  function attachSeekGestures(v) {
    v.addEventListener('dblclick', function (e) {
      var r = v.getBoundingClientRect();
      seekBy(v, (e.clientX - r.left) < r.width / 2 ? -10 : 10);
    });
    var lastTap = 0, lastX = 0;
    v.addEventListener('touchend', function (e) {
      var now = Date.now();
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      if (now - lastTap < 320) {
        var r = v.getBoundingClientRect();
        seekBy(v, (t.clientX - r.left) < r.width / 2 ? -10 : 10);
        lastTap = 0;
      } else { lastTap = now; lastX = t.clientX; }
    }, { passive: true });
  }

  /* ---------- keyboard shortcuts ---------- */
  document.addEventListener('keydown', function (e) {
    try {
      var t = e.target;
      if (!t) return;
      var tag = (t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
      var v = mainVideo();
      if (!v) return;
      var key = e.key;
      var toggle = function () { if (v.paused) { v.play(); toast('▶ Playing'); } else { v.pause(); toast('⏸ Paused'); } };
      if (key === 'k' || key === 'K') { toggle(); }
      else if (key === ' ') {
        var ae = document.activeElement;
        if (ae && ((ae.tagName || '').toLowerCase() === 'button' || (ae.tagName || '').toLowerCase() === 'a')) return;
        e.preventDefault(); toggle();
      }
      else if (key === 'f' || key === 'F') doFullscreen();
      else if (key === 'm' || key === 'M') { v.muted = !v.muted; toast(v.muted ? '🔇 Muted' : '🔊 Sound on'); }
      else if (key === 'j' || key === 'J') seekBy(v, -10);
      else if (key === 'l' || key === 'L') seekBy(v, 10);
      else if (key === 'ArrowLeft') { e.preventDefault(); seekBy(v, -10); }
      else if (key === 'ArrowRight') { e.preventDefault(); seekBy(v, 10); }
      else if (key === 'ArrowUp') { e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); toast('🔊 ' + Math.round(v.volume * 100) + '%'); }
      else if (key === 'ArrowDown') { e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); toast('🔉 ' + Math.round(v.volume * 100) + '%'); }
      else if (key === 'p' || key === 'P') doPiP();
      else if (/^[0-9]$/.test(key) && isFinite(v.duration) && v.duration > 0) {
        v.currentTime = v.duration * (parseInt(key, 10) / 10);
        toast('⏱ ' + key + '0%');
      }
    } catch (err) {}
  });

  /* ---------- chrome: header shadow + back-to-top ---------- */
  function initChrome() {
    var top = document.createElement('button');
    top.type = 'button';
    top.className = 'atv-top';
    top.title = 'Back to top';
    top.textContent = '↑';
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(top);
    var header = $('header');
    window.addEventListener('scroll', function () {
      var y = window.scrollY || 0;
      top.classList.toggle('show', y > 700);
      if (header) header.classList.toggle('atv-scrolled', y > 10);
    }, { passive: true });
  }

  /* ---------- go ---------- */
  function init() {
    try { initChrome(); } catch (e) {}
    state.wrap = findWrap();
    if (state.wrap) { try { state.toolbar = buildToolbar(state.wrap); } catch (e) {} }
    state.tickTimer = setInterval(tick, 900);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
