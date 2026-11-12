/* Quiz Hall — the pupil's page. Chrome on a laptop or a Chromebook only (memory assessments-laptop-only); the lock rules are
   the Test System's (TestForm.html: leaving the page, Shift + Command, a screenshot key, 15 seconds offline, five
   right-clicks), each one strike, and the teacher unlocks. Every answer is kept in this browser at once and a copy goes to
   the back office about every 90 seconds, so a dropped connection loses nothing. */
(function (global) {
  'use strict';
  var P = global.Pupil = {};
  var el = UI.el, $ = UI.$;
  var S = null;            /* the quiz being sat */

  /* the browser, as the Test System reads it (TestForm.html _detectBrowser_, copied: Chrome on a laptop only) */
  P.detectBrowser = function () {
    var ua = navigator.userAgent || '', uaData = navigator.userAgentData;
    var ios = /iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ios) return { kind: 'ios', label: 'an iPhone or iPad' };
    var touch = Number(navigator.maxTouchPoints) || 0, fine = true;
    try { fine = !!window.matchMedia('(any-pointer: fine)').matches; } catch (e) { fine = true; }
    var hand = /Android/.test(ua) ? 'Android' : (/Mobile|Windows Phone|Silk\/|Kindle/.test(ua) || (uaData && uaData.mobile === true)) ? 'a mobile browser'
             : (touch > 1 && !fine) ? 'a touch screen with no mouse or trackpad' : '';
    if (hand && !/CrOS/.test(ua)) return { kind: 'handheld', label: 'a phone or a tablet (' + hand + ')' };
    if (/Edg\//.test(ua)) return { kind: 'edge', label: 'Microsoft Edge' };
    if (/OPR\//.test(ua)) return { kind: 'opera', label: 'Opera' };
    if (/YaBrowser|Vivaldi|SamsungBrowser|DuckDuckGo|UCBrowser|Maxthon|QQBrowser/.test(ua)) return { kind: 'other', label: 'another browser' };
    try { if (navigator.brave && typeof navigator.brave.isBrave === 'function') return { kind: 'brave', label: 'Brave' }; } catch (e) {}
    if (/Firefox\//.test(ua)) return { kind: 'firefox', label: 'Firefox' };
    if (/Safari\//.test(ua) && !/Chrome|Chromium/.test(ua)) return { kind: 'safari', label: 'Safari' };
    if (uaData && Array.isArray(uaData.brands)) {
      var brands = uaData.brands.map(function (b) { return String(b.brand || ''); });
      if (brands.indexOf('Google Chrome') >= 0) return { kind: 'chrome', label: 'Google Chrome' };
      if (brands.length) return { kind: 'chromium_fork', label: brands.join(' / ') };
    }
    if (/Chrome\//.test(ua)) return { kind: 'chrome', label: 'Google Chrome' };
    return { kind: 'unknown', label: 'an unknown browser' };
  };

  /* ── the run's test mode: the Test System's four switches, set by the teacher (2_Pupil.gs answers carry it; Daniel,
     10 Nov 2026: "it should mimic the test mode"). track: leaving the page, Shift + Command and going offline are
     watched (off: open book); block: no copy, paste or right-click; lock: what is watched locks the quiz (off: the
     teacher is told and the pupil warned); full: Begin opens full screen, and out of it the quiz waits for the pupil to
     return (the Test System's "Return to fullscreen"). A change reaches the page at its next save or check. ── */
  var MODE0 = { track: true, block: true, lock: true, full: false };
  function modeOf(m) { var o = {}; Object.keys(MODE0).forEach(function (k) { o[k] = m && typeof m[k] === 'boolean' ? m[k] : MODE0[k]; }); return o; }

  /* ── full screen (Daniel, 10 Nov 2026): the Full screen button in the quiz's bar shows whenever the page is not in
     full screen; Begin asks for it when the teacher requires it (a browser allows it only straight after a click).
     Leaving full screen is never a lock. Full screen ends with the quiz. ── */
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  var fsAt = 0;            /* when full screen last began or ended: a Mac may move the window then (see watch) */
  function goFull() {
    if (isFull()) return Promise.resolve(true);
    var d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!req) return Promise.resolve(false);
    fsAt = Date.now();
    try {
      var p = req.call(d);
      return p && p.then ? p.then(function () { return true; }, function () { return false; }) : Promise.resolve(isFull());
    } catch (e) { return Promise.resolve(false); }
  }
  function leaveFull() {
    if (!isFull()) return;
    var x = document.exitFullscreen || document.webkitExitFullscreen;
    try { var p = x.call(document); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  function fullButton() { var b = $('qfull'); if (b) b.hidden = isFull(); }
  function isMac() { return /Macintosh|Mac OS X/.test(navigator.userAgent || ''); }

  P.start = function (me) {
    var b = P.detectBrowser();
    if (b.kind !== 'chrome') return wall(b);
    home(me.home);
  };
  function wall(b) {
    var app = UI.clear($('app'));
    app.appendChild(el('section', { class: 'panel wall' }, [el('h1', {}, 'Please use Google Chrome on a laptop or a Chromebook'),
      el('p', {}, 'Quizzes open only in Google Chrome on a laptop or a Chromebook. Open this page there: nlcsbiology.com/quiz-hall'),
      el('p', { class: 'small muted' }, 'This page found ' + b.label + '.')]));
  }

  /* ── the pupil's first page ── */
  function home(h) {
    stopAll();
    var app = UI.clear($('app'));
    document.title = 'Quiz Hall';
    app.appendChild(el('h1', {}, 'Your quizzes'));
    var open = (h && h.open) || [];
    if (!open.length) {
      app.appendChild(el('section', { class: 'panel' }, [el('p', {}, 'No quiz is open for you now.'),
        el('button', { class: 'btn', type: 'button', onclick: refresh }, 'Check again')]));
    }
    open.forEach(function (q) {
      var go = el('button', { class: 'btn btn--primary', type: 'button', disabled: q.state === 'soon' ? true : null }, q.state === 'writing' || q.state === 'locked' ? 'Continue' : 'Begin');
      go.addEventListener('click', function () { begin(q, go); });
      app.appendChild(el('section', { class: 'panel' }, [
        el('h2', {}, q.title),
        el('p', { class: 'small' }, q.teacher + ' · ' + q.className + ' · ' + UI.plural(q.questions, 'question') + ' · ' + q.minutes + ' minutes' +
          (q.state === 'soon' ? ' · starts at ' + UI.time(q.opens) : '')),
        beginBox(q.mode),
        q.hasWritten ? el('p', { class: 'small' }, 'Your written answers are kept until ' + q.writtenUntil + '. On 1 August they are deleted. Your marks are kept.') : null,
        el('div', { class: 'row' }, [go])]));
    });
    var done = (h && h.done) || [];
    if (done.length) {
      var tb = el('tbody');
      done.forEach(function (d) {
        var see = d.released ? el('button', { class: 'btn btn--small', type: 'button', onclick: function (ev) { feedback(d.id, ev.currentTarget); } }, 'See your answers') : el('span', { class: 'small muted' }, 'Answers not released yet');
        tb.appendChild(el('tr', {}, [el('td', {}, d.title), el('td', { class: 'num' }, d.score + ' / ' + d.max + (d.toMark ? ' so far' : '')), el('td', {}, see)]));
      });
      app.appendChild(el('h2', {}, 'Your results'));
      app.appendChild(el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, [el('thead', {}, el('tr', {}, [el('th', {}, 'Quiz'), el('th', { class: 'num' }, 'Score'), el('th', {}, '')])), tb])));
    }
    watchHome(open);
  }
  /* A quiz started after this page was drawn shows within seconds (Daniel, 10 Nov 2026: "it needs to be almost instant"):
     pupil.now, a light check that writes nothing, every 10 seconds while this page is in front (every 30 after a quarter of
     an hour), and at once when the pupil comes back to it. The page is drawn again, from pupil.home, only when what is open
     has changed (a new quiz, or one whose start time has come). A back office before 10 Nov 2026: pupil.home every minute. */
  var homeGen = 0, homeOpen = [];
  /* the first page's checks stop the moment the pupil leaves it (Begin, Continue, See your answers): left running, a
     check that saw the quiz change from ready to writing drew the first page over the quiz (found 10 Nov 2026, the day
     v1.5 went live; check_quizhall_pages.mjs H7) */
  function stopHome() {
    homeGen++; clearTimeout(P.homeTimer);
    if (P.homeVis) { document.removeEventListener('visibilitychange', P.homeVis); P.homeVis = null; }
  }
  function sigOf(list) { return (list || []).map(function (q) { return q.id + ':' + q.state; }).join('|'); }
  function watchHome(open) {
    homeOpen = open || [];
    var gen = ++homeGen, drawn = sigOf(open), since = Date.now(), asking = false, old = false;
    function next() {
      clearTimeout(P.homeTimer);
      if (gen !== homeGen) return;
      var gap = old ? 60000 : Date.now() - since > 15 * 60000 ? 30000 : 10000;
      P.homeTimer = setTimeout(check, gap * (0.8 + Math.random() * 0.4));   /* ± 20 %, so a class does not ask at the same second */
    }
    function check() {
      if (gen !== homeGen || asking) return;
      if (document.hidden) return next();
      asking = true;
      var p = old ? API.call('pupil.home', {}, { quiet: true }).then(function (r) { return r.home; }) : API.call('pupil.now', {}, { quiet: true });
      p.then(function (r) {
        asking = false;
        if (gen !== homeGen) return;
        if (sigOf(r.open) === drawn) return next();
        if (old) return home(r);
        API.call('pupil.home', {}, { quiet: true }).then(function (h) { if (gen === homeGen) home(h.home); }, function () { next(); });
      }, function (e) {
        asking = false;
        if (!old && /unknown action/.test(e && e.message || '')) old = true;
        next();
      });
    }
    P.homeVis = function () { if (!document.hidden && gen === homeGen) { since = Date.now(); check(); } };
    document.addEventListener('visibilitychange', P.homeVis);
    next();
  }
  /* a button that asks says so until the page comes, then the page changes in one step (Daniel, 10 Nov 2026) */
  function noop() {}
  /* what to do before Begin and what the quiz watches, as the teacher set it (memory before-begin-box: the blue box) */
  function beginBox(raw) {
    var m = modeOf(raw);
    if (!m.track) return el('div', { class: 'notice' }, [el('strong', {}, 'Open book. '), 'Nothing is watched and the quiz does not lock.' + (m.block ? ' Copy, paste and right-click do not work.' : '')]);
    return el('div', { class: 'notice' }, [el('strong', {}, 'Before you press Begin:'),
      el('ol', { class: 'rules' }, [el('li', {}, 'Turn off every grammar or AI extension, especially Grammarly: open chrome://extensions in a new tab and switch each one off.'),
        isMac() ? el('li', {}, 'On a Mac: in Chrome\'s menu bar, open View and untick “Always Show Toolbar in Full Screen”.') : null]),
      m.full ? 'The quiz opens in full screen. If you leave full screen, the quiz waits until you return to it; the time goes on. ' : '',
      m.lock ? 'The quiz locks if you:' : 'Your teacher is told if you:',
      el('ul', { class: 'rules' }, [el('li', {}, 'leave this page or this window'), el('li', {}, 'press Shift and Command together'),
        el('li', {}, 'are offline for 15 seconds')]),
      (m.lock ? 'If it locks, ask your teacher to unlock it. Your answers are kept.' : 'The quiz does not lock.') + (m.block ? ' Copy, paste and right-click do not work.' : '')]);
  }
  function refresh(ev) {
    var btn = ev && ev.currentTarget && ev.currentTarget.tagName === 'BUTTON' ? ev.currentTarget : null;
    var asking = API.call('pupil.home', {});
    (btn ? UI.act(btn, btn.textContent === 'Check again' ? 'Checking…' : 'Opening…', asking) : asking)
      .then(function (r) { home(r.home); }, function (e) { if (!btn) UI.toast(e.message, true); });
  }

  /* ── sitting the quiz ── */
  function key(sid) { var w = global.SignIn && SignIn.who(); return 'quizhall.ans.' + sid + '.' + (w ? w.email : ''); }
  function loadLocal(sid) { try { return JSON.parse(localStorage.getItem(key(sid)) || 'null'); } catch (e) { return null; } }
  function saveLocal() { if (!S || S.preview) return; try { localStorage.setItem(key(S.sid), JSON.stringify({ answers: S.answers, at: Date.now() })); } catch (e) {} }
  function dropLocal(sid) { try { localStorage.removeItem(key(sid)); } catch (e) {} }

  /* ── Try it as a pupil: a teacher's preview (quiz.try / quiz.tryMark write no row; nothing is kept in this browser).
     The page, the lock rules and Hand in are the pupil's own; the teacher unlocks the lock themself. ── */
  P.preview = function (o) {
    stopAll(); S = null;
    var app = UI.clear($('app'));
    app.appendChild(el('p', { class: 'muted' }, 'Opening the quiz as a pupil sees it…'));
    API.call('quiz.try', { quizId: o.quizId, version: o.version }).then(function (r) {
      S = { preview: o, sid: 'preview', quiz: r.quiz, answers: {}, deadline: 0, skew: r.now - Date.now(), locked: false,
            reasons: r.reasons || {}, reasonText: '', graceUntil: 0, dirty: false, lastSent: 0, rightClicks: 0, hasWritten: r.hasWritten };
      S.mode = modeOf(null);
      drawQuiz();
      watch();
    }, function (e) { UI.clear(app).appendChild(el('div', { class: 'notice notice--bad' }, e && e.message ? e.message : String(e))); });
  };
  function previewBanner(o, done) {
    var b = P.detectBrowser();
    return el('div', { class: 'notice notice--preview' }, [el('strong', {}, 'Try it as a pupil. '),
      done ? 'Nothing was saved. ' : 'Nothing is saved. The quiz locks as it would for a pupil; here you unlock it yourself. ',
      !done && b.kind !== 'chrome' ? 'Pupils must use Chrome on a laptop. ' : '', el('a', { href: o.back }, done ? 'Back to the quiz' : 'End the preview')]);
  }
  function begin(q, btn) {
    var m = modeOf(q.mode);
    if (m.track && m.full && !isFull()) {          /* asked in this click, as the Test System's Begin does */
      goFull().then(function (ok) { if (ok) start(); else UI.toast('Your teacher asks for full screen. Allow full screen, then press Begin again.', true); });
      return;
    }
    start();
    function start() {
    stopHome();
    UI.act(btn, 'Opening…', API.call('sit.begin', { sittingId: q.id })).then(function (r) {
      if (r.handed) return handedIn(r, q.title, q.id);
      var local = loadLocal(q.id);
      var answers = Object.assign({}, r.answers || {}, local && local.answers ? local.answers : {});
      S = { sid: q.id, quiz: r.quiz, answers: answers, deadline: r.deadline, skew: r.now - Date.now(), locked: !!r.locked,
            reasonText: r.reasonText, graceUntil: 0, dirty: true, lastSent: 0, rightClicks: 0, writtenUntil: r.writtenUntil, hasWritten: r.hasWritten,
            mode: modeOf(r.mode || q.mode) };
      drawQuiz();
      watch();
      checkFull();
      if (S.locked) showLock();
      sendSoon(2000);
    }, function () { if (!S) watchHome(homeOpen); });                      /* Begin failed: still on the first page */
    }
  }
  /* a new mode from the back office: the watchers, the Open book mark and the full-screen wait follow it */
  function applyMode(raw) {
    if (!S || !raw) return;
    var m = modeOf(raw);
    if (JSON.stringify(m) === JSON.stringify(S.mode)) return;
    S.mode = m;
    if (!m.track && S.locked) { S.locked = false; hideLock(); }
    watch(); modeMark(); checkFull();
  }
  function modeMark() { var k = $('qmode'); if (k) { k.textContent = S && !S.mode.track ? 'Open book' : ''; k.hidden = !(S && !S.mode.track); } }
  /* Require full screen: out of full screen, the quiz waits behind this until the pupil returns (never a lock) */
  function checkFull() {
    var need = !!(S && !S.handing && S.mode.track && S.mode.full && !isFull()), o = $('fsOverlay');
    if (!need) { if (o) o.remove(); return; }
    if (o) return;
    var b = el('button', { class: 'btn btn--primary', type: 'button' }, 'Return to full screen');
    b.addEventListener('click', function () { goFull(); });
    document.body.appendChild(el('div', { class: 'overlay', id: 'fsOverlay', role: 'alertdialog', 'aria-modal': 'true' }, el('div', { class: 'overlay__box' }, [
      el('h2', {}, 'Return to full screen to go on'), el('p', {}, 'Your teacher asks for full screen. Your answers are kept; the time goes on.'),
      el('div', { class: 'row', style: 'justify-content:center' }, b)])));
  }
  function now() { return Date.now() + (S ? S.skew : 0); }
  function drawQuiz() {
    var app = UI.clear($('app'));
    var picFetch = S.preview ? previewPics(S.preview) : sittingPics(S.sid);
    document.title = S.quiz.title + ' · Quiz Hall';
    var timer = el('span', { class: 'timer', id: 'qtimer' }), saved = el('span', { class: 'saved', id: 'qsaved' }, '');
    var hand = el('button', { class: 'btn btn--primary', type: 'button' }, 'Hand in');
    hand.addEventListener('click', confirmHandIn);
    var full = el('button', { class: 'btn', type: 'button', id: 'qfull', hidden: isFull() ? true : null }, 'Full screen');
    full.addEventListener('click', goFull);
    var mark = el('span', { class: 'chip chip--accent', id: 'qmode', hidden: S.mode && !S.mode.track ? null : true }, S.mode && !S.mode.track ? 'Open book' : '');
    app.appendChild(el('div', { class: 'quizhead' }, [el('strong', {}, S.quiz.title), mark, timer, saved, el('span', { style: 'flex:1' }), full, hand]));
    if (S.preview) app.insertBefore(previewBanner(S.preview, false), app.firstChild);
    if (S.quiz.description) app.appendChild(el('p', { class: 'q__h' }, S.quiz.description));
    var n = 0;
    S.quiz.questions.forEach(function (q) {
      if (q.kind === 'section') { app.appendChild(el('div', { class: 'section-title' }, q.title || '')); if (q.help) app.appendChild(el('p', { class: 'q__h' }, q.help)); return; }
      var isQ = ['choice', 'checkbox', 'short', 'paragraph'].indexOf(q.kind) >= 0;
      if (isQ) n++;
      var card = el('div', { class: 'q' }, [
        isQ ? el('div', { class: 'q__n' }, 'Question ' + n + (q.points ? ' · ' + UI.plural(q.points, 'mark') : '')) : null,
        q.title ? el('div', { class: 'q__t' }, q.title) : null, q.help ? el('div', { class: 'q__h' }, q.help) : null,
        q.image ? UI.picture(q.image, { fetch: picFetch }) : null]);
      if (q.kind === 'choice' || q.kind === 'checkbox') {
        (q.options || []).forEach(function (o, i) {
          var checked = q.kind === 'choice' ? S.answers[q.id] === i : Array.isArray(S.answers[q.id]) && S.answers[q.id].indexOf(i) >= 0;
          var input = el('input', { type: q.kind === 'choice' ? 'radio' : 'checkbox', name: 'q_' + q.id, checked: checked ? true : null });
          var row = el('label', { class: 'opt' + (checked ? ' is-on' : '') }, [input, el('span', {}, [o.label, o.image ? UI.picture(o.image, { fetch: picFetch }) : null])]);
          input.addEventListener('change', function () {
            if (q.kind === 'choice') S.answers[q.id] = i;
            else {
              var list = Array.isArray(S.answers[q.id]) ? S.answers[q.id].slice() : [];
              if (input.checked) { if (list.indexOf(i) < 0) list.push(i); } else list = list.filter(function (x) { return x !== i; });
              S.answers[q.id] = list;
            }
            card.querySelectorAll('.opt').forEach(function (lab) { lab.classList.toggle('is-on', lab.querySelector('input').checked); });
            changed();
          });
          card.appendChild(row);
        });
      } else if (q.kind === 'short') {
        var inp = el('input', { type: 'text', value: S.answers[q.id] || '', 'aria-label': 'Your answer', autocomplete: 'off', spellcheck: 'false' });
        inp.addEventListener('input', function () { S.answers[q.id] = inp.value; changed(); });
        card.appendChild(inp);
      } else if (q.kind === 'paragraph') {
        var ta = el('textarea', { 'aria-label': 'Your answer', spellcheck: 'false' }, S.answers[q.id] || '');
        ta.addEventListener('input', function () { S.answers[q.id] = ta.value; changed(); });
        card.appendChild(ta);
      }
      app.appendChild(card);
    });
    app.appendChild(el('div', { class: 'row', style: 'justify-content:flex-end' }, [el('button', { class: 'btn btn--primary', type: 'button', onclick: confirmHandIn }, 'Hand in')]));
    tick();
  }
  function changed() { saveLocal(); S.dirty = !S.preview; var s = $('qsaved'); if (s) s.textContent = S.preview ? 'Preview: not saved' : 'Kept on this computer'; }
  function tick() {
    if (!S) return;
    if (S.preview) { var pt = $('qtimer'); if (pt) { pt.textContent = 'No time limit in the preview'; pt.classList.add('timer--quiet'); } return; }
    var t = $('qtimer'), left = S.deadline - now();
    if (t) { t.textContent = UI.left(left) + ' left'; t.classList.toggle('is-low', left < 120000); }
    if (left <= 0 && !S.handing) handIn(true);
  }
  /* a copy to the back office about every 90 seconds (± 20 %, so a class does not send at the same second) */
  function sendSoon(ms) {
    clearTimeout(P.sendTimer);
    P.sendTimer = setTimeout(send, ms === undefined ? 72000 + Math.random() * 36000 : ms);
  }
  function send() {
    if (!S || S.handing || S.preview) return;
    if (!S.dirty && Date.now() - S.lastSent < 80000) { sendSoon(); return; }
    var body = { sittingId: S.sid, answers: S.answers };
    S.dirty = false;
    API.call('sit.save', body, { quiet: true }).then(function (r) {
      S.lastSent = Date.now();
      if (r.handed) return handedIn(r, S.quiz.title);
      if (r.deadline) S.deadline = r.deadline;
      if (r.now) S.skew = r.now - Date.now();
      var s = $('qsaved'); if (s) s.textContent = '✓ Saved ' + UI.time(r.now);
      applyMode(r.mode);
      if (r.locked && !S.locked) { S.locked = true; S.reasonText = r.reasonText; showLock(); }
      sendSoon();
    }, function () { S.dirty = true; var s = $('qsaved'); if (s) s.textContent = 'Kept on this computer (not sent yet)'; sendSoon(15000); });
  }

  /* ── the lock ── */
  /* The page locks at once; the lock is then told to the back office, again and again until it arrives (offline, it
     cannot arrive until the connection is back), and only then does the page ask whether the teacher has unlocked it. */
  var TOLD = { tab_switch: 'You left the quiz page.', long_away: 'You left the quiz page.', focus_lost: 'You left the quiz window.',
               shift_command: 'You pressed Shift and Command.', shortcut: 'You pressed a screenshot key.', offline: 'You were offline for 15 seconds.',
               right_click: 'You right-clicked five times.' };
  function event(kind) {
    if (!S || S.locked || S.handing || Date.now() < S.graceUntil || !S.mode.track) return;
    if (!S.mode.lock) {                            /* record only: the teacher is told, the pupil warned, nothing locks */
      if (Date.now() - (S.warnedAt || 0) > 3000) UI.toast((TOLD[kind] || '') + ' Your teacher is told.', true);
      S.warnedAt = Date.now();
      if (!S.preview) API.call('sit.event', { sittingId: S.sid, kind: kind }, { quiet: true, noRetry: true }).then(function (r) { applyMode(r.mode); }, function () {});
      return;
    }
    S.locked = true; S.reasonText = S.preview ? (S.reasons[kind] || '') : ''; S.pendingEvent = S.preview ? null : kind;
    showLock();
    if (!S.preview) sendEvent();
  }
  function sendEvent() {
    if (!S || !S.pendingEvent) return Promise.resolve();
    var kind = S.pendingEvent;
    return API.call('sit.event', { sittingId: S.sid, kind: kind }, { quiet: true, noRetry: true }).then(function (r) {
      if (!S) return;
      S.pendingEvent = null;
      applyMode(r.mode);
      if (!r.locked) { S.locked = false; hideLock(); return; }          /* the 45 seconds after an unlock, open book, record only */
      S.reasonText = r.reasonText; showLock();
    }, function () { /* kept: the next poll sends it again */ });
  }
  function showLock() {
    if (S && S.preview) return showPreviewLock();
    var o = $('lockOverlay');
    if (!o) {
      o = el('div', { class: 'overlay', id: 'lockOverlay', role: 'alertdialog', 'aria-modal': 'true' }, el('div', { class: 'overlay__box' }, [
        el('h2', {}, 'Your quiz is locked'), el('p', { id: 'lockWhy' }, ''), el('p', {}, 'Ask your teacher to unlock it. Your answers are kept.'),
        el('p', { class: 'small muted' }, 'This page checks every few seconds.')]));
      document.body.appendChild(o);
    }
    $('lockWhy').textContent = S && S.reasonText ? S.reasonText : '';
    clearInterval(P.lockPoll);
    P.lockPoll = setInterval(function () {
      if (!S) return;
      if (S.pendingEvent) { sendEvent(); return; }
      API.call('sit.status', { sittingId: S.sid }, { quiet: true }).then(function (r) {
        if (r.handed) return handedIn(r, S.quiz.title);
        if (r.reasonText) { S.reasonText = r.reasonText; $('lockWhy').textContent = r.reasonText; }
        if (r.deadline) S.deadline = r.deadline;
        if (!r.locked) { S.locked = false; S.graceUntil = Date.now() + 45000; hideLock(); UI.toast('Your teacher unlocked your quiz.'); }
        applyMode(r.mode);
      }, function () {});
    }, 7000);
  }
  function hideLock() { clearInterval(P.lockPoll); var o = $('lockOverlay'); if (o) o.remove(); }
  function showPreviewLock() {
    if ($('lockOverlay')) return;
    var un = el('button', { class: 'btn btn--primary', type: 'button' }, 'Unlock (preview)');
    un.addEventListener('click', function () { if (!S) return; S.locked = false; S.graceUntil = Date.now() + 45000; hideLock(); });
    document.body.appendChild(el('div', { class: 'overlay', id: 'lockOverlay', role: 'alertdialog', 'aria-modal': 'true' }, el('div', { class: 'overlay__box' }, [
      el('h2', {}, 'Your quiz is locked'), el('p', { id: 'lockWhy' }, S.reasonText || ''), el('p', {}, 'Ask your teacher to unlock it. Your answers are kept.'),
      el('p', { class: 'small muted' }, 'This is what a pupil sees. In a real quiz they wait until you press Unlock on the live page.'),
      el('div', { class: 'row', style: 'justify-content:center' }, un)])));
  }

  var watchers = [];
  function on(target, type, fn, cap) { target.addEventListener(type, fn, cap); watchers.push([target, type, fn, cap]); }
  function watch() {
    stopWatch();
    var blurAt = 0, offlineAt = 0;
    /* an absence that began within 1.5 s of full screen starting or ending, and lasted under 3 s, is the Mac moving the
       window to or from its full-screen space, not the pupil leaving */
    function away(ms) { if (ms > 600 && !(Date.now() - ms - fsAt < 1500 && ms < 3000)) event(ms > 20000 ? 'long_away' : 'tab_switch'); }
    function fsChange() { fsAt = Date.now(); fullButton(); checkFull(); }
    on(document, 'fullscreenchange', fsChange);
    on(document, 'webkitfullscreenchange', fsChange);
    on(window, 'beforeunload', function (e) { if (S && !S.handing && !S.preview) { saveLocal(); e.preventDefault(); e.returnValue = ''; } });
    P.offlineTimer = setInterval(function () {
      if (S && S.mode.track && offlineAt && Date.now() - offlineAt >= 15000) { event('offline'); if (S && !S.locked) offlineAt = 0; }
      tick();
    }, 1000);
    var m = S.mode;
    if (m.block) {                                 /* Block actions */
      on(document, 'contextmenu', function (e) {
        e.preventDefault();
        if (!S.mode.track) return;
        S.rightClicks++;
        if (S.rightClicks === 3) UI.toast('Right-clicking is not allowed. Two more and ' + (S.mode.lock ? 'the quiz locks.' : 'your teacher is told.'), true);
        if (S.rightClicks >= 5) { event('right_click'); if (!S.mode.lock) S.rightClicks = 0; }
      });
      ['copy', 'cut', 'paste', 'drop'].forEach(function (t) { on(document, t, function (e) { e.preventDefault(); }, true); });
    }
    if (!m.track) return;                          /* open book: nothing more is watched */
    on(document, 'visibilitychange', function () { if (document.hidden) { if (!blurAt) blurAt = Date.now(); } else if (blurAt) { var a = Date.now() - blurAt; blurAt = 0; away(a); } });
    on(window, 'blur', function () { if (!blurAt) blurAt = Date.now(); });
    on(window, 'focus', function () { if (blurAt) { var a = Date.now() - blurAt; blurAt = 0; away(a); } });
    on(window, 'offline', function () { if (!offlineAt) offlineAt = Date.now(); });
    on(window, 'online', function () { offlineAt = 0; if (S && S.pendingEvent) sendEvent(); });
    /* Shift + Command (a Mac's screenshot keys): Command and Shift held together, ending with no other key the page saw */
    var armed = false, other = false, since = 0;
    function chordKey(e) { return e.key === 'Meta' || e.key === 'OS' || e.key === 'Shift'; }
    function ended() { var fire = armed && !other && since && Date.now() - since >= 80; armed = false; other = false; since = 0; if (fire) event('shift_command'); }
    function sync(e) { if (armed && !(e.metaKey && e.shiftKey)) ended(); }
    on(document, 'keydown', function (e) {
      if (chordKey(e)) { if (armed && !e.repeat) ended(); if (e.metaKey && e.shiftKey && !armed) { armed = true; other = false; since = Date.now(); } return; }
      if (/^(Control|Alt|AltGraph|CapsLock|Fn)$/.test(e.key)) return;
      sync(e); if (armed) other = true;
    }, true);
    on(document, 'keyup', function (e) { if (e.key === 'PrintScreen') { event('shortcut'); return; } if (chordKey(e) && armed) ended(); }, true);
    on(document, 'mousedown', function (e) { if (armed && e.metaKey && e.shiftKey) other = true; else sync(e); }, true);
    on(document, 'mousemove', sync, true);
    on(window, 'blur', function () { if (armed) ended(); });
  }
  function stopWatch() { watchers.forEach(function (w) { w[0].removeEventListener(w[1], w[2], w[3]); }); watchers = []; clearInterval(P.offlineTimer); }
  P.stop = function () { stopAll(); S = null; leaveFull(); };
  function stopAll() {
    stopWatch(); clearTimeout(P.sendTimer); clearInterval(P.lockPoll); clearTimeout(P.homeTimer); hideLock(); var f = $('fsOverlay'); if (f) f.remove();
    stopHome();                                                            /* the first page's checks stop with it */
  }

  /* ── handing in ── */
  function confirmHandIn() {
    if (!S || S.handing) return;
    var o = el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' });
    var unanswered = S.quiz.questions.filter(function (q) {
      if (['choice', 'checkbox', 'short', 'paragraph'].indexOf(q.kind) < 0) return false;
      var a = S.answers[q.id]; return a === undefined || a === '' || (Array.isArray(a) && !a.length);
    }).length;
    var yes = el('button', { class: 'btn btn--primary', type: 'button' }, 'Hand in now'), no = el('button', { class: 'btn', type: 'button' }, 'Go back');
    S.graceUntil = Date.now() + 2000;
    o.appendChild(el('div', { class: 'overlay__box' }, [el('h2', {}, 'Hand in now?'),
      el('p', {}, unanswered ? 'You have not answered ' + UI.plural(unanswered, 'question') + '. ' : ''), el('p', {}, 'After this you cannot change your answers.'),
      el('div', { class: 'row', style: 'justify-content:center' }, [no, yes])]));
    no.addEventListener('click', function () { o.remove(); });
    yes.addEventListener('click', function () { o.remove(); handIn(false); });
    document.body.appendChild(o);
  }
  function handIn(timeUp) {
    if (!S || S.handing) return;
    if (S.preview) return previewHandIn();
    S.handing = true; saveLocal();
    var app = UI.clear($('app'));
    app.appendChild(el('section', { class: 'panel' }, [el('h1', {}, timeUp ? 'Time is up: handing in…' : 'Handing in…'), el('p', { class: 'muted' }, 'Please wait.')]));
    stopWatch(); clearInterval(P.lockPoll); hideLock();
    var title = S.quiz.title, sid = S.sid, answers = S.answers, tries = 0;
    (function attempt() {
      API.call('sit.handin', { sittingId: sid, answers: answers }, { quiet: true }).then(function (r) { dropLocal(sid); handedIn(r, title); }, function () {
        tries++;
        UI.clear(app).appendChild(el('section', { class: 'panel' }, [el('h1', {}, 'Your answers are kept on this computer'),
          el('p', {}, 'The hand-in did not reach Quiz Hall yet. This page tries again by itself. Do not close it.')]));
        setTimeout(attempt, Math.min(30000, 3000 * tries));
      });
    })();
  }
  function previewHandIn() {
    var o = S.preview, answers = S.answers, app = UI.clear($('app'));
    S.handing = true; stopWatch(); hideLock();
    app.appendChild(el('section', { class: 'panel' }, [el('h1', {}, 'Handing in…'), el('p', { class: 'muted' }, 'Preview: nothing is saved.')]));
    API.call('quiz.tryMark', { quizId: o.quizId, version: o.version, answers: answers }).then(function (r) {
      S = null; leaveFull();
      UI.clear(app);
      app.appendChild(previewBanner(o, true));
      var res = r.result;
      app.appendChild(el('section', { class: 'panel' }, [el('h2', {}, 'What a pupil sees when they hand in'),
        el('p', { style: 'font-size:22px;font-weight:700' }, 'Your score: ' + res.score + ' of ' + res.max + (res.toMark ? ' so far' : '')),
        res.toMark ? el('p', {}, 'Your teacher marks ' + UI.plural(res.toMark, 'more answer') + '. Your score can still go up.') : null,
        el('p', { class: 'small' }, 'Pupils see the right answers straight after they hand in, or when you release them: you choose on Run a quiz.')]));
      app.appendChild(el('h2', { style: 'margin-top:20px' }, 'What a pupil sees with the right answers'));
      feedbackQuestions(app, r.questions, previewPics(o));
    }, function (e) { if (S) { S.handing = false; drawQuiz(); watch(); } UI.toast(e && e.message ? e.message : String(e), true); });
  }
  function handedIn(r, title, sidAsked) {
    var sid = (S && S.sid) || sidAsked;
    stopAll(); S = null; leaveFull();
    if (sid) dropLocal(sid);
    var app = UI.clear($('app')), res = r.result;
    var lines = [el('h1', {}, 'Handed in'), el('p', {}, title || '')];
    if (res) {
      lines.push(el('p', { style: 'font-size:22px;font-weight:700' }, 'Your score: ' + res.score + ' of ' + res.max + (res.toMark ? ' so far' : '')));
      if (res.toMark) lines.push(el('p', {}, 'Your teacher marks ' + UI.plural(res.toMark, 'more answer') + '. Your score can still go up.'));
    } else lines.push(el('p', {}, 'Your answers are in. Your score appears on your first page in a moment.'));
    /* the run shows the answers at hand-in (0_Core.gs ANSWERS_AT_HANDIN): they came with this answer, drawn at once */
    var fb = r.feedback && r.feedback.released ? r.feedback : null;
    if (fb) lines.push(el('p', {}, 'Below are the right answers. Look at each question: your answer, the right answer and the feedback.'));
    else if (!r.queued) lines.push(el('p', { class: 'small' }, 'You see the right answers when your teacher releases them.'));
    if (r.writtenUntil) lines.push(el('p', { class: 'small' }, 'Your written answers are kept until ' + r.writtenUntil + '. On 1 August they are deleted. Your marks are kept.'));
    lines.push(el('button', { class: 'btn', type: 'button', onclick: refresh }, 'Back to your quizzes'));
    app.appendChild(el('section', { class: 'panel' }, lines));
    if (fb) {
      app.appendChild(el('h2', { style: 'margin-top:20px' }, 'The right answers'));
      feedbackQuestions(app, fb.questions, sittingPics(sid));
      app.appendChild(el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: refresh }, 'Back to your quizzes')));
    }
  }

  /* a picture Google refuses to this browser comes through Quiz Hall (js/ui.js UI.picture): the pupil's own run, or the
     teacher's Try it */
  function sittingPics(sid) { return function (id) { return API.call('sit.picture', { sittingId: sid, id: id }, { quiet: true }); }; }
  function previewPics(o) { return function (id) { return API.call('quiz.pictureData', { quizId: o.quizId, version: o.version, id: id }, { quiet: true }); }; }

  /* ── after release (or at hand-in): the right answers and the teacher's comments ── */
  function feedback(sid, btn) {
    UI.act(btn, 'Opening…', API.call('sit.feedback', { sittingId: sid })).then(function (r) {
      stopHome();
      var app = UI.clear($('app'));
      app.appendChild(el('p', {}, el('button', { class: 'link', type: 'button', onclick: refresh }, '← Your quizzes')));
      if (!r.released) { app.appendChild(el('p', {}, 'Your teacher has not released the answers yet.')); return; }
      app.appendChild(el('h1', {}, r.title));
      app.appendChild(el('p', { style: 'font-size:20px;font-weight:700' }, 'Your score: ' + r.result.score + ' of ' + r.result.max + (r.result.toMark ? ' so far' : '')));
      app.appendChild(el('p', { class: 'small' }, 'Your written answers are kept until ' + r.writtenUntil + '. On 1 August they are deleted. Your marks are kept.'));
      feedbackQuestions(app, r.questions, sittingPics(sid));
    }, noop);
  }
  /* each question after release: the pupil's answer, the right answer, the form's feedback, the teacher's comment */
  function feedbackQuestions(app, questions, fetchPic) {
      questions.forEach(function (q, i) {
        var mine = q.answer, shown;
        if (q.kind === 'choice' || q.kind === 'checkbox') {
          var letters = String(mine || '').split('');
          shown = letters.length ? letters.map(function (L) { return q.options[L.charCodeAt(0) - 65] || L; }).join(' · ') : '(no answer)';
        } else shown = mine ? String(mine) : '(no answer)';
        app.appendChild(el('div', { class: 'q' }, [
          el('div', { class: 'q__n' }, 'Question ' + (i + 1) + ' · ' + (q.pending ? 'not marked yet' : (q.mark === null ? '' : q.mark + ' of ' + q.points))),
          el('div', { class: 'q__t' }, q.title),
          q.image ? UI.picture(q.image, { fetch: fetchPic }) : null,
          el('p', {}, [el('strong', {}, 'Your answer: '), shown]),
          q.correct && q.correct.length ? el('p', {}, [el('strong', {}, 'Right answer: '), q.correct.join(' · ')]) : null,
          q.feedback ? el('p', { class: 'q__h' }, q.feedback) : null,
          q.comment ? el('div', { class: 'model' }, [el('strong', {}, 'Your teacher: '), q.comment]) : null]));
      });
  }
})(window);
