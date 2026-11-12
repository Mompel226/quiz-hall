/* Quiz Hall — small page helpers: making elements, the toast, the working bar, dates, the bright/dark switch. */
(function (global) {
  'use strict';
  var UI = global.UI = {};

  /* el('div', {class: 'x', onclick: fn}, [children or text]) */
  UI.el = function (tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, String(v));
    });
    (Array.isArray(kids) ? kids : kids === undefined || kids === null ? [] : [kids]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return n;
  };
  UI.clear = function (n) { while (n && n.firstChild) n.removeChild(n.firstChild); return n; };
  UI.$ = function (id) { return document.getElementById(id); };

  /* the message that appears means it is done (memory dashboard-busy-states) */
  var toastTimer = null;
  UI.toast = function (msg, bad) {
    var t = UI.$('toast');
    t.textContent = msg; t.className = 'toast' + (bad ? ' is-bad' : ''); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, bad ? 6000 : 3200);
  };

  /* the thin bar under the header while anything is asked of the back office */
  var busyCount = 0;
  UI.busy = function (on) {
    busyCount = Math.max(0, busyCount + (on ? 1 : -1));
    UI.$('busyBar').hidden = busyCount === 0;
  };

  /* a button that says what it is doing until the answer comes, then the toast says it is done */
  UI.act = function (btn, working, promise, done) {
    var label = btn.textContent;
    btn.disabled = true; btn.classList.add('is-busy'); btn.textContent = working;
    return promise.then(function (r) {
      btn.disabled = false; btn.classList.remove('is-busy'); btn.textContent = label;
      if (done) UI.toast(done);
      return r;
    }, function (e) {
      btn.disabled = false; btn.classList.remove('is-busy'); btn.textContent = label;
      UI.toast(e && e.message ? e.message : String(e), true);
      throw e;
    });
  };

  var TZ = 'Asia/Seoul';
  UI.time = function (ms) {
    if (!ms) return '';
    return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  };
  UI.date = function (ms) {
    if (!ms) return '';
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
  };
  UI.dateTime = function (ms) { return ms ? UI.date(ms) + ', ' + UI.time(ms) : ''; };
  UI.left = function (ms) {
    if (ms <= 0) return '0:00';
    var s = Math.ceil(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    s = s % 60;
    if (h) return h + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  };
  UI.mins = function (secs) {
    if (!secs) return '';
    var m = Math.floor(secs / 60), s = secs % 60;
    return m ? m + ' min ' + (s ? s + ' s' : '') : s + ' s';
  };
  UI.pct = function (a, b) { return b ? Math.round(100 * a / b) : null; };
  /* ── A quiz picture (12 Nov 2026: one pupil's laptop showed none of a quiz's pictures while the class saw them). The
     browser loads Google's link first (the Drive file, shared with the school). Google refuses it to a Chrome whose first
     account is personal, an Incognito window, third-party cookies blocked or an ad blocker; then the page asks Quiz Hall
     for the same picture (`o.fetch(id)` → {type, data}: 2_Pupil.gs _sitPicture_, 1_Teacher.gs _teacherPicture_), one at a
     time so a whole class never floods it, and keeps it for this page load. Once one picture has needed Quiz Hall, the
     next go to Quiz Hall at once. Only when that fails too does the picture's place say so, with Try again: the pupil
     sees no message while the picture can still be shown. o.teacher: the teacher's words. ── */
  var picKept = {}, picAsked = {}, picQueue = [], picBusy = false, googleRefused = false;
  function picPump() {
    if (picBusy || !picQueue.length) return;
    var job = picQueue.shift(); picBusy = true;
    var done = function () { picBusy = false; picPump(); };
    Promise.resolve().then(function () { return job.fetch(job.id); }).then(function (r) {
      if (!r || !r.data) throw new Error('no picture');
      picKept[job.id] = 'data:' + (r.type || 'image/png') + ';base64,' + r.data;
      job.ok(picKept[job.id]); done();
    }, function (e) { delete picAsked[job.id]; job.no(e); done(); });
  }
  function picFromQuizHall(id, fetch) {
    if (picKept[id]) return Promise.resolve(picKept[id]);
    if (!picAsked[id]) picAsked[id] = new Promise(function (ok, no) { picQueue.push({ id: id, fetch: fetch, ok: ok, no: no }); picPump(); });
    return picAsked[id];
  }
  UI.picture = function (id, o) {
    o = o || {};
    var box = UI.el('span', { class: 'qpic' }), img = UI.el('img', { alt: '' });
    function missing() {
      UI.clear(box);
      var again = UI.el('button', { class: 'btn btn--small', type: 'button' }, 'Try again');
      again.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); start(true); });   /* inside an answer's label: never ticks it */
      box.appendChild(UI.el('span', { class: 'qpic__miss', role: 'status' }, [UI.el('strong', {}, 'This picture did not load.'),
        UI.el('span', {}, o.teacher ? 'Check that you are online, then press Try again.' : 'Check that your laptop is online, then press Try again. If it still does not show, tell your teacher.'), again]));
    }
    function viaQuizHall() {
      if (!o.fetch) return missing();
      picFromQuizHall(id, o.fetch).then(function (url) { img.src = url; }, missing);
    }
    img.addEventListener('error', function () {
      if (/^data:/.test(img.getAttribute('src') || '')) return missing();
      googleRefused = true; viaQuizHall();
    });
    function start(again) {
      UI.clear(box); box.appendChild(img);
      if (picKept[id]) img.src = picKept[id];
      else if (o.fetch && (googleRefused || again)) viaQuizHall();
      else img.src = 'https://lh3.googleusercontent.com/d/' + id + (again ? '?again=' + Date.now() : '');
    }
    start(false);
    return box;
  };

  UI.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };

  /* a file to download, made on the page (a spreadsheet file the teacher opens in Excel or Sheets) */
  UI.download = function (name, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = UI.el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  /* bright or dark */
  function applyTheme() {
    var t = null;
    try { t = localStorage.getItem('quizhall.theme'); } catch (e) {}
    var dark = t === 'dark' || (t !== 'light' && global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
    var b = UI.$('themeBtn');
    if (b) { b.textContent = dark ? '☀' : '☾'; b.setAttribute('aria-label', dark ? 'Bright version' : 'Dark version'); }
  }
  document.addEventListener('DOMContentLoaded', function () {
    applyTheme();
    var b = UI.$('themeBtn');
    if (b) b.addEventListener('click', function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') && global.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = dark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('quizhall.theme', next); } catch (e) {}
      applyTheme();
    });
  });
})(window);
