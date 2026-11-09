/* Quiz Hall — the teacher's pages. Every page starts from what the teacher must do next (memory teacher-help-task-first);
   the words follow the Test System's (Start now, Close now, Unlock, Extra time, Change). */
(function (global) {
  'use strict';
  var T = global.Teacher = {};
  var el = UI.el, $ = UI.$;
  var state = { home: null, classes: null, quizzes: null, liveTimer: null, me: null };

  var NAV = [
    ['home', 'Today'], ['run', 'Run a quiz'], ['mark', 'To mark'], ['results', 'Results'],
    ['quizzes', 'My quizzes'], ['classes', 'My classes'], ['help', 'Help']
  ];
  function drawNav(current) {
    var nav = UI.clear($('nav'));
    nav.hidden = false;
    NAV.forEach(function (n) {
      var a = el('a', { href: '#' + n[0], 'aria-current': current === n[0] ? 'page' : null }, n[1]);
      if (n[0] === 'mark' && state.home && state.home.toMark) a.appendChild(el('span', { class: 'count' }, String(state.home.toMark)));
      nav.appendChild(a);
    });
  }
  /* back: [address, words] — a page inside a list has a way back to that list above its heading (Daniel, 9 Nov 2026) */
  function page(title, current, back) {
    stopLive();
    if (global.Pupil && Pupil.stop) Pupil.stop();     /* leaves a Try it preview: its watchers and lock go */
    drawNav(current);
    var app = UI.clear($('app'));
    if (title) document.title = title + ' · Quiz Hall';
    if (back) app.appendChild(el('a', { class: 'back', href: back[0] }, [el('span', { 'aria-hidden': 'true' }, '←'), ' ' + back[1]]));
    return app;
  }
  function fail(app, e) {
    app.appendChild(el('div', { class: 'notice notice--bad' }, e && e.message ? e.message : String(e)));
  }
  function refreshHome() { return API.call('home', {}, { quiet: true }).then(function (r) { state.home = r.home; drawNav(currentRoute()); return r.home; }, function () {}); }
  function currentRoute() { return (location.hash.replace(/^#/, '').split('/')[0]) || 'home'; }
  function loadClasses(force) {
    if (state.classes && !force) return Promise.resolve(state.classes);
    return API.call('classes.list').then(function (r) { state.classes = r.classes; return r.classes; });
  }
  function loadQuizzes(force) {
    if (state.quizzes && !force) return Promise.resolve(state.quizzes);
    return API.call('quizzes.list').then(function (r) { state.quizzes = r.quizzes; return r.quizzes; });
  }

  T.start = function (me) {
    state.me = me; state.home = me.home; state.classes = null; state.quizzes = null;
    global.removeEventListener('hashchange', route);
    global.addEventListener('hashchange', route);
    route();
  };
  /* signing out: no page of this teacher's keeps asking the back office */
  T.stop = function () { stopLive(); global.removeEventListener('hashchange', route); state = { home: null, classes: null, quizzes: null, liveTimer: null, me: null }; };
  function route() {
    var parts = location.hash.replace(/^#/, '').split('/'), r = parts[0] || 'home';
    var views = { home: home, run: run, live: live, mark: mark, results: results, quizzes: quizzes, quiz: quizPage,
                  add: addQuiz, classes: classes, cls: classPage, help: help, 'try': tryQuiz };
    (views[r] || home).apply(null, parts.slice(1));
    window.scrollTo(0, 0);
  }

  /* ── Today ─────────────────────────────────────────────── */
  function home() {
    var app = page('Today', 'home'), h = state.home || {};
    var full = (state.me && state.me.name) || '', name = /^(Mr|Mrs|Ms|Miss|Dr|Mx)\.?\s/.test(full) ? full : full.split(' ')[0];
    app.appendChild(el('div', { class: 'head' }, [el('h1', {}, name ? 'Hello, ' + name : 'Today'),
      el('a', { class: 'btn btn--primary', href: '#run' }, 'Run a quiz')]));
    if (h.julyNotice) app.appendChild(el('div', { class: 'notice notice--warn' }, h.julyNotice));
    if (!h.classes || !h.quizzes) {
      app.appendChild(el('section', { class: 'panel' }, [el('h2', {}, 'Start here'),
        el('ol', {}, [
          el('li', {}, [h.classes ? '✓ ' : '', el('a', { href: '#classes' }, 'Import a class from Google Classroom'), '.']),
          el('li', {}, [h.quizzes ? '✓ ' : '', el('a', { href: '#add' }, 'Add a quiz from a Google Form'), ' (paste the address of the form you edit).']),
          el('li', {}, [el('a', { href: '#run' }, 'Run the quiz'), ' for the class. Pupils open this website and sign in.'])
        ])]));
    }
    var run = el('section', { class: 'panel' }, [el('h2', {}, 'Running now')]);
    if (!h.running || !h.running.length) run.appendChild(el('p', { class: 'muted' }, 'No quiz is running.'));
    else {
      var list = el('div', { class: 'list' });
      h.running.forEach(function (s) {
        list.appendChild(el('div', { class: 'list__item' }, [
          el('div', { class: 'list__main' }, [el('div', { class: 'list__title' }, s.title + ' · ' + s.className),
            el('div', { class: 'list__sub' }, s.notYet ? 'Starts at ' + UI.dateTime(s.opens) :
              s.handed + ' of ' + s.total + ' handed in · ' + s.begun + ' writing · pupils can begin until ' + UI.time(s.beginBy))]),
          el('a', { class: 'btn', href: '#live/' + s.id }, 'Open live page')]));
      });
      run.appendChild(list);
    }
    app.appendChild(run);
    var mk = el('section', { class: 'panel' }, [el('h2', {}, 'Waiting to be marked')]);
    if (!h.toMark) mk.appendChild(el('p', { class: 'muted' }, 'Nothing is waiting for you.'));
    else {
      var l2 = el('div', { class: 'list' });
      (h.toMarkList || []).forEach(function (m) {
        l2.appendChild(el('div', { class: 'list__item' }, [
          el('div', { class: 'list__main' }, [el('div', { class: 'list__title' }, m.title + ' · ' + m.className),
            el('div', { class: 'list__sub' }, UI.plural(m.count, 'answer') + ' to mark')]),
          el('a', { class: 'btn btn--primary', href: '#mark/' + m.id }, 'Mark now')]));
      });
      mk.appendChild(l2);
    }
    app.appendChild(mk);
    if (h.recent && h.recent.length) {
      var rec = el('section', { class: 'panel' }, [el('h2', {}, 'Recent quizzes')]);
      var l3 = el('div', { class: 'list' });
      h.recent.forEach(function (s) {
        l3.appendChild(el('div', { class: 'list__item' }, [
          el('div', { class: 'list__main' }, [el('div', { class: 'list__title' }, s.title + ' · ' + s.className),
            el('div', { class: 'list__sub' }, UI.dateTime(s.opens) + (s.released ? ' · answers released' : ''))]),
          el('a', { class: 'btn', href: '#live/' + s.id }, 'See it')]));
      });
      rec.appendChild(l3);
      app.appendChild(rec);
    }
    refreshHome();
  }

  /* ── Run a quiz ────────────────────────────────────────── */
  function run(preQuiz) {
    var app = page('Run a quiz', 'run');
    app.appendChild(el('h1', {}, 'Run a quiz'));
    var box = el('section', { class: 'panel' }, el('p', { class: 'muted' }, 'Loading your quizzes and classes…'));
    app.appendChild(box);
    Promise.all([loadQuizzes(true), loadClasses(true)]).then(function (res) {
      var qz = res[0].filter(function (q) { return !q.inBin; }), cl = res[1];
      UI.clear(box);
      if (!qz.length || !cl.length) {
        box.appendChild(el('p', {}, !qz.length ? ['You have no quiz yet. ', el('a', { href: '#add' }, 'Add one from a Google Form'), '.']
                                               : ['You have no class yet. ', el('a', { href: '#classes' }, 'Import one from Google Classroom'), '.']));
        return;
      }
      var quizSel = el('select', { id: 'rq' }, qz.map(function (q) {
        return el('option', { value: q.quizId, selected: q.quizId === preQuiz ? true : null }, q.title + (q.mine ? '' : ' (shared by ' + q.owner.split('@')[0] + ')'));
      }));
      var clsSel = el('select', { id: 'rc' }, cl.map(function (c) { return el('option', { value: c.id }, c.name + ' (' + c.pupils + ')'); }));
      var mins = el('input', { type: 'number', id: 'rm', min: 1, max: 240, value: 20 });
      var when = el('select', { id: 'rw' }, [el('option', { value: 'now' }, 'Now'), el('option', { value: 'later' }, 'At a time I choose')]);
      var at = el('input', { type: 'datetime-local', id: 'ra', hidden: true });
      when.addEventListener('change', function () { at.hidden = when.value !== 'later'; });
      var info = el('p', { class: 'small' });
      function describe() {
        var q = qz.filter(function (x) { return x.quizId === quizSel.value; })[0];
        if (!q) return;
        info.textContent = UI.plural(q.questions, 'question') + ', ' + UI.plural(q.points, 'mark') +
          (q.teacherMarks ? '. You mark ' + UI.plural(q.teacherMarks, 'question') + ' after the quiz; the rest is marked at once.' : '. Every answer is marked at once.') +
          ' Pupils may begin up to 15 minutes after the length has run from the start; extra time is added for the pupils who have it.';
      }
      quizSel.addEventListener('change', describe); describe();
      var go = el('button', { class: 'btn btn--primary', type: 'button' }, 'Start now');
      when.addEventListener('change', function () { go.textContent = when.value === 'later' ? 'Set the start' : 'Start now'; });
      go.addEventListener('click', function () {
        var q = qz.filter(function (x) { return x.quizId === quizSel.value; })[0];
        var opensAt = when.value === 'later' && at.value ? new Date(at.value).getTime() : 0;
        UI.act(go, 'Starting…', API.call('sitting.start', { quizId: q.quizId, version: q.version, classId: clsSel.value, minutes: Number(mins.value), opensAt: opensAt }), 'The quiz is open for the class.')
          .then(function (r) { refreshHome(); location.hash = '#live/' + r.sittingId; }, function () {});
      });
      box.appendChild(el('div', { class: 'fields' }, [
        el('label', { class: 'field' }, ['Quiz', quizSel]), el('label', { class: 'field' }, ['Class', clsSel]),
        el('label', { class: 'field' }, ['Length (minutes)', mins]), el('label', { class: 'field' }, ['Start', when, at])]));
      box.appendChild(info);
      box.appendChild(el('div', { class: 'row' }, [go]));
      box.appendChild(el('p', { class: 'small' }, 'Pupils open nlcsbiology.com/quiz-hall on a laptop in Chrome, sign in, and see this quiz. Pin that address once in each Google Classroom.'));
    }, function (e) { UI.clear(box); fail(box, e); });
  }

  /* ── the live page ─────────────────────────────────────── */
  function stopLive() { if (state.liveTimer) { clearInterval(state.liveTimer); state.liveTimer = null; } }
  var STATUS = { waiting: ['Not begun', ''], writing: ['Writing', 'chip--accent'], locked: ['Locked', 'chip--bad'], handed: ['Handed in', 'chip--good'] };
  var REASON = { tab_switch: 'left the page', long_away: 'left the page for a long time', shift_command: 'Shift + Command', shortcut: 'screenshot key',
                 offline: 'offline 15 s', right_click: 'right-clicks', focus_lost: 'left the window' };
  function live(sid) {
    var app = page('Live', 'home', ['#home', 'Today']);
    var head = el('div', { class: 'head' }), top = el('div'), body = el('div', { class: 'tblwrap' }, el('p', { class: 'empty' }, 'Loading…'));
    app.appendChild(head); app.appendChild(top); app.appendChild(body);
    var last = null;
    function draw(r) {
      last = r;
      var s = r.sitting, now = r.now, open = s.state === 'open';
      UI.clear(head);
      head.appendChild(el('div', {}, [el('h1', {}, s.title), el('p', { class: 'small' }, s.className + ' · ' + s.minutes + ' minutes · ' +
        (open ? (s.opens > now ? 'starts at ' + UI.dateTime(s.opens) : 'pupils can begin until ' + UI.time(s.beginBy)) : 'closed ' + UI.dateTime(s.closed)))]));
      var acts = el('div', { class: 'row' });
      if (open) {
        var close = el('button', { class: 'btn btn--danger', type: 'button' }, 'Close now');
        close.addEventListener('click', function () {
          var writing = r.pupils.filter(function (p) { return p.status === 'writing' || p.status === 'locked'; }).length;
          if (!window.confirm('Close the quiz now?' + (writing ? ' ' + UI.plural(writing, 'pupil is', 'pupils are') + ' still writing: their saved answers are handed in.' : ''))) return;
          UI.act(close, 'Closing…', API.call('sitting.close', { sittingId: sid }), 'The quiz is closed.').then(load, function () {});
        });
        acts.appendChild(close);
      }
      /* the answers are released only after the close: pupils still writing would see them (1_Teacher.gs _sittingRelease_) */
      if (s.released || s.state !== 'open') {
        var rel = el('button', { class: 'btn', type: 'button' }, s.released ? 'Hide the answers again' : 'Release the answers');
        rel.addEventListener('click', function () {
          UI.act(rel, s.released ? 'Hiding…' : 'Releasing…', API.call('sitting.release', { sittingId: sid, release: !s.released }),
                 s.released ? 'Pupils no longer see the answers.' : 'Pupils can now see the right answers and your comments.').then(load, function () {});
        });
        acts.appendChild(rel);
      }
      var toMark = r.pupils.reduce(function (a, p) { return a + (p.toMark || 0); }, 0);
      if (toMark) acts.appendChild(el('a', { class: 'btn btn--primary', href: '#mark/' + sid }, 'Mark ' + UI.plural(toMark, 'answer')));
      head.appendChild(acts);
      UI.clear(top);
      var counts = { waiting: 0, writing: 0, locked: 0, handed: 0 };
      r.pupils.forEach(function (p) { counts[p.status]++; });
      top.appendChild(el('p', { class: 'row' }, [
        el('span', { class: 'chip chip--good' }, counts.handed + ' handed in'), el('span', { class: 'chip chip--accent' }, counts.writing + ' writing'),
        counts.locked ? el('span', { class: 'chip chip--bad' }, counts.locked + ' locked') : null, el('span', { class: 'chip' }, counts.waiting + ' not begun')]));
      var tbl = el('table', { class: 'tbl' }, [el('thead', {}, el('tr', {}, ['Pupil', 'Status', 'Time left', 'Score', 'Locks', ''].map(function (h) { return el('th', {}, h); })))]);
      var tb = el('tbody');
      var order = { locked: 0, writing: 1, waiting: 2, handed: 3 };
      r.pupils.slice().sort(function (a, b) { return order[a.status] - order[b.status] || a.name.localeCompare(b.name); }).forEach(function (p) {
        var st = STATUS[p.status];
        var cells = [el('td', {}, [p.name, p.extra ? el('span', { class: 'small muted' }, ' +' + p.extra + ' %') : null]),
          el('td', {}, [el('span', { class: 'chip ' + st[1] }, st[0]), p.status === 'locked' && REASON[p.reason] ? el('div', { class: 'small' }, REASON[p.reason]) : null]),
          el('td', { class: 'num' }, p.deadline && p.status !== 'handed' ? UI.left(p.deadline - now) : ''),
          el('td', { class: 'num' }, p.status === 'handed' ? p.score + ' / ' + p.max + (p.toMark ? ' (' + p.toMark + ' to mark)' : '') : ''),
          el('td', { class: 'num' }, p.locks ? String(p.locks) : '')];
        var actions = el('td', { class: 'row' });
        if (p.status === 'locked') {
          var ub = el('button', { class: 'btn btn--small btn--primary', type: 'button' }, 'Unlock');
          ub.addEventListener('click', function () { UI.act(ub, 'Unlocking…', API.call('sitting.unlock', { sittingId: sid, email: p.email }), p.name + ' is unlocked.').then(load, function () {}); });
          actions.appendChild(ub);
        }
        if (open && p.status !== 'handed') {
          var eb = el('button', { class: 'btn btn--small', type: 'button' }, '+5 min');
          eb.addEventListener('click', function () { UI.act(eb, 'Adding…', API.call('sitting.extra', { sittingId: sid, email: p.email, minutes: 5 }), p.name + ' has 5 more minutes.').then(load, function () {}); });
          actions.appendChild(eb);
        }
        cells.push(actions);
        tb.appendChild(el('tr', {}, cells));
      });
      tbl.appendChild(tb);
      UI.clear(body); body.appendChild(tbl);
    }
    function load() {
      return API.call('sitting.live', { sittingId: sid }, { quiet: !!last }).then(draw, function (e) { if (!last) { UI.clear(body); fail(body, e); } });
    }
    load();
    state.liveTimer = setInterval(function () { if (!document.hidden) load(); }, 5000);
  }

  /* ── To mark ───────────────────────────────────────────── */
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function mark(sid, qid) {
    var app = page('To mark', 'mark', sid || qid ? ['#mark', 'To mark'] : null);
    var box = el('div', {}, el('p', { class: 'muted' }, 'Loading…'));
    app.appendChild(box);
    API.call('mark.list', sid ? { sittingId: sid } : {}).then(function (r) {
      UI.clear(box);
      var items = r.items || [];
      if (!sid && !qid) return markList(box, items);
      var item = items.filter(function (i) { return !qid || i.qid === qid; }).sort(function (a, b) { return b.pending - a.pending; })[0];
      if (!item) {
        box.appendChild(el('h1', {}, 'Nothing to mark'));
        box.appendChild(el('p', {}, ['Every answer in this quiz is marked. ', el('a', { href: '#mark' }, 'Back to the list'), '.']));
        refreshHome();
        return;
      }
      markScreen(box, item, items.filter(function (i) { return i.sittingId === item.sittingId; }));
    }, function (e) { UI.clear(box); fail(box, e); });
  }
  function markList(box, items) {
    box.appendChild(el('h1', {}, 'To mark'));
    var pending = items.filter(function (i) { return i.pending; });
    if (!pending.length) { box.appendChild(el('p', { class: 'muted' }, 'Nothing is waiting for you.')); return; }
    box.appendChild(el('p', { class: 'small' }, 'One question at a time, for the whole class: faster and fairer than one pupil at a time.'));
    var list = el('div', { class: 'list' });
    pending.forEach(function (i) {
      list.appendChild(el('div', { class: 'list__item' }, [
        el('div', { class: 'list__main' }, [el('div', { class: 'list__title' }, i.title + ' · ' + i.className + ' · Question ' + i.number),
          el('div', { class: 'list__sub' }, i.text.slice(0, 140) + ' · ' + UI.plural(i.pending, 'answer') + ' to mark')]),
        el('a', { class: 'btn btn--primary', href: '#mark/' + i.sittingId + '/' + i.qid }, 'Mark')]));
    });
    box.appendChild(list);
  }
  function markScreen(box, item, siblings) {
    var groups = [], byText = {};
    item.answers.forEach(function (a) {
      var k = norm(a.text) || '(no answer)';
      if (!byText[k]) { byText[k] = { text: a.text, pupils: [], mark: a.mark, comment: a.comment, pending: false, check: false }; groups.push(byText[k]); }
      var g = byText[k];
      g.pupils.push(a);
      if (a.pending) g.pending = true;
      if (a.check) g.check = true;
      if (a.mark !== g.mark) g.mark = null;
    });
    groups.sort(function (a, b) { return (b.pending - a.pending) || b.pupils.length - a.pupils.length; });
    var focus = 0, comments = {};
    item.answers.forEach(function (a) { if (a.comment) comments[a.comment] = 1; });
    var done = function () { return groups.filter(function (g) { return !g.pending; }).length; };
    box.appendChild(el('p', { class: 'small' }, [el('a', { href: '#mark' }, '← To mark'), ' · ' + item.title + ' · ' + item.className]));
    var qbox = el('section', { class: 'panel' }, [
      el('div', { class: 'head' }, [el('h1', {}, 'Question ' + item.number), el('span', { class: 'chip chip--accent' }, UI.plural(item.points, 'mark'))]),
      el('p', { class: 'q__t' }, item.text), item.help ? el('p', { class: 'q__h' }, item.help) : null,
      item.image ? el('img', { src: 'https://lh3.googleusercontent.com/d/' + item.image, alt: '', style: 'max-width:100%;max-height:320px' }) : null,
      (item.correct && item.correct.length) || item.model ? el('div', { class: 'model' }, [
        item.correct && item.correct.length ? el('div', {}, [el('strong', {}, 'Answer key: '), item.correct.join(' · ')]) : null,
        item.model ? el('div', {}, [el('strong', {}, 'From the form: '), item.model]) : null]) : null]);
    box.appendChild(qbox);
    var prog = el('div', { class: 'row' }), bar = el('div', { class: 'progress', style: 'flex:1 1 200px' }, el('span'));
    var progText = el('span', { class: 'small' });
    prog.appendChild(progText); prog.appendChild(bar);
    box.appendChild(prog);
    box.appendChild(el('p', { class: 'keyhelp' }, 'Keys: press 0–' + Math.min(9, item.points) + ' to give the mark (the next answer opens by itself) · ↑ ↓ to move · C to write a comment.'));
    var wrap = el('div', { class: 'mq' });
    box.appendChild(wrap);
    function progress() {
      var d = done();
      progText.textContent = d + ' of ' + groups.length + ' marked' + (groups.length < item.answers.length ? ' (' + item.answers.length + ' pupils)' : '');
      bar.firstChild.style.width = (groups.length ? 100 * d / groups.length : 100) + '%';
    }
    function save(g, markVal, comment) {
      var marks = g.pupils.map(function (p) { return { email: p.email, mark: markVal, comment: comment }; });
      g.saving = true; drawGroups();
      return API.call('mark.save', { sittingId: item.sittingId, qid: item.qid, marks: marks }, { quiet: true }).then(function () {
        g.saving = false;
        if (markVal !== null && markVal !== undefined) { g.mark = markVal; g.pending = false; }
        if (comment !== undefined) { g.comment = comment; if (comment) comments[comment] = 1; }
        g.saved = true; drawGroups(); progress();
        if (!groups.some(function (x) { return x.pending; })) {
          UI.toast('Every answer to this question is marked.');
          refreshHome();
        }
      }, function (e) { g.saving = false; drawGroups(); UI.toast(e.message, true); });
    }
    function drawGroups() {
      UI.clear(wrap);
      groups.forEach(function (g, gi) {
        var marks = el('div', { class: 'marks' });
        for (var m = 0; m <= item.points; m++) (function (mv) {
          var b = el('button', { class: 'markbtn', type: 'button', 'aria-pressed': g.mark === mv && !g.pending ? 'true' : 'false' }, String(mv));
          b.addEventListener('click', function () { focus = gi; save(g, mv).then(next); });
          marks.appendChild(b);
        })(m);
        var status = g.saving ? el('span', { class: 'small' }, 'Saving…') : g.saved ? el('span', { class: 'small', style: 'color:var(--good)' }, '✓ Saved') :
          g.check ? el('span', { class: 'chip chip--warn' }, 'Check: near the key') : g.pending ? el('span', { class: 'chip' }, 'To mark') : el('span', { class: 'chip chip--good' }, 'Marked');
        marks.appendChild(status);
        var cin = el('input', { type: 'text', placeholder: 'A comment for the pupil (optional)', value: g.comment || '', 'aria-label': 'Comment' });
        cin.addEventListener('change', function () { save(g, null, cin.value.trim()); });
        var cbtns = el('div', { class: 'combtns' }, Object.keys(comments).slice(0, 8).map(function (c) {
          return el('button', { class: 'combtn', type: 'button', onclick: function () { cin.value = c; save(g, null, c); } }, c);
        }));
        var card = el('div', { class: 'mgroup' + (gi === focus ? ' is-focus' : '') + (!g.pending ? ' is-done' : ''), tabindex: '-1' }, [
          el('p', { class: 'mgroup__text' }, g.text && g.text.trim() ? g.text : '(no answer)'),
          el('p', { class: 'mgroup__who' }, g.pupils.length > 1 ? g.pupils.length + ' pupils wrote this: ' + g.pupils.map(function (p) { return p.name; }).join(', ') : g.pupils[0].name),
          marks, el('div', { style: 'margin-top:8px' }, cin), cbtns]);
        card.addEventListener('click', function (e) { if (e.target === card || e.target.tagName === 'P') { focus = gi; markFocus(); } });
        g.card = card; g.cin = cin;
        wrap.appendChild(card);
      });
    }
    function markFocus() {
      groups.forEach(function (g, gi) { if (g.card) g.card.classList.toggle('is-focus', gi === focus); });
      var c = groups[focus] && groups[focus].card;
      if (c) { c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
    function next() {
      var n = -1;
      for (var i = 1; i <= groups.length; i++) { var j = (focus + i) % groups.length; if (groups[j].pending) { n = j; break; } }
      if (n >= 0) { focus = n; markFocus(); }
      else {
        var other = siblings.filter(function (s) { return s.qid !== item.qid && s.pending; })[0];
        if (other) UI.toast('Next: question ' + other.number + '.'), setTimeout(function () { location.hash = '#mark/' + other.sittingId + '/' + other.qid; }, 900);
      }
    }
    function onKey(e) {
      if (!document.body.contains(wrap)) { document.removeEventListener('keydown', onKey); return; }
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
      var g = groups[focus];
      if (!g) return;
      if (/^[0-9]$/.test(e.key) && Number(e.key) <= item.points) { e.preventDefault(); save(g, Number(e.key)).then(next); }
      else if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); focus = Math.min(groups.length - 1, focus + 1); markFocus(); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); focus = Math.max(0, focus - 1); markFocus(); }
      else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); g.cin.focus(); }
    }
    document.addEventListener('keydown', onKey);
    drawGroups(); progress();
    if (siblings.length > 1) {
      box.appendChild(el('h3', {}, 'Other questions in this quiz'));
      box.appendChild(el('div', { class: 'row' }, siblings.filter(function (s) { return s.qid !== item.qid; }).map(function (s) {
        return el('a', { class: 'btn btn--small', href: '#mark/' + s.sittingId + '/' + s.qid }, 'Question ' + s.number + (s.pending ? ' (' + s.pending + ')' : ' ✓'));
      })));
    }
  }

  /* ── Results (drawn by analysis.js) ────────────────────── */
  function results(classId, view, extra) {
    var app = page('Results', 'results');
    loadClasses().then(function (cl) {
      if (!cl.length) { app.appendChild(el('h1', {}, 'Results')); app.appendChild(el('p', {}, ['You have no class yet. ', el('a', { href: '#classes' }, 'Import one'), '.'])); return; }
      var id = classId && cl.some(function (c) { return c.id === classId; }) ? classId : cl[0].id;   /* an old link to a removed class opens the first */
      global.Analysis.draw(app, { classes: cl, classId: id, view: view || 'class', extra: extra });
    }, function (e) { fail(app, e); });
  }

  /* ── My quizzes ────────────────────────────────────────── */
  function quizzes() {
    var app = page('My quizzes', 'quizzes');
    app.appendChild(el('div', { class: 'head' }, [el('h1', {}, 'My quizzes'), el('a', { class: 'btn btn--primary', href: '#add' }, 'Add a quiz from a Google Form')]));
    var box = el('div', {}, el('p', { class: 'muted' }, 'Loading…'));
    app.appendChild(box);
    loadQuizzes(true).then(function (qz) {
      UI.clear(box);
      var live = qz.filter(function (q) { return !q.inBin; }), bin = qz.filter(function (q) { return q.inBin; });
      if (!live.length) box.appendChild(el('p', { class: 'muted' }, 'Your library is empty. Add a quiz from a Google Form you edit.'));
      else {
        var list = el('div', { class: 'list' });
        live.forEach(function (q) {
          list.appendChild(el('div', { class: 'list__item' }, [
            el('div', { class: 'list__main' }, [el('div', { class: 'list__title' }, q.title),
              el('div', { class: 'list__sub' }, [UI.plural(q.questions, 'question') + ' · ' + UI.plural(q.points, 'mark') + ' · version ' + q.version +
                (q.topics.length ? ' · ' + q.topics.join(', ') : '') + (q.mine ? '' : ' · shared by ' + q.owner.split('@')[0])])]),
            el('a', { class: 'btn', href: '#quiz/' + q.quizId + '/' + q.version }, 'Open'),
            el('a', { class: 'btn btn--primary', href: '#run/' + q.quizId }, 'Run')]));
        });
        box.appendChild(list);
      }
      if (bin.length) {
        box.appendChild(el('h3', {}, 'In the bin'));
        var bl = el('div', { class: 'list' });
        bin.forEach(function (q) {
          bl.appendChild(el('div', { class: 'list__item' }, [el('div', { class: 'list__main' }, [el('div', { class: 'list__title' }, q.title)]),
            el('a', { class: 'btn', href: '#quiz/' + q.quizId + '/' + q.version }, 'Open')]));
        });
        box.appendChild(bl);
      }
    }, function (e) { UI.clear(box); fail(box, e); });
  }

  /* add a quiz from a Google Form, or import the same form again as a new version */
  function addQuiz(quizId) {
    var app = page('Add a quiz', 'quizzes', ['#quizzes', 'My quizzes']);
    app.appendChild(el('h1', {}, quizId ? 'Import the form again' : 'Add a quiz from a Google Form'));
    var box = el('section', { class: 'panel' });
    app.appendChild(box);
    var link = el('input', { type: 'text', placeholder: 'https://docs.google.com/forms/d/…/edit', 'aria-label': 'The form\'s address' });
    var go = el('button', { class: 'btn btn--primary', type: 'button' }, 'Read the form');
    box.appendChild(el('ol', { class: 'small' }, [
      el('li', {}, 'Open your form in Google Forms, as when you edit it.'),
      el('li', {}, 'Copy the address at the top of the browser and paste it here.'),
      el('li', {}, 'The first time, Google asks you to let Quiz Hall see your forms and classes.')]));
    box.appendChild(el('div', { class: 'row' }, [el('div', { style: 'flex:1 1 360px' }, link), go]));
    var out = el('div');
    app.appendChild(out);
    var existing = null;
    if (quizId) API.call('quiz.get', { quizId: quizId, version: 1 }).then(function (r) {
      existing = r; if (r.formId) link.value = 'https://docs.google.com/forms/d/' + r.formId + '/edit';
    }, function () {});
    go.addEventListener('click', function () {
      var f = GoogleData.formId(link.value);
      if (f.error) { UI.toast(f.error, true); return; }
      UI.clear(out);
      UI.act(go, 'Reading…', GoogleData.form(f.id).then(function (form) {
        var conv = GoogleData.toQuiz(form);
        return copyPictures(conv, out).then(function () { return conv; });
      })).then(function (conv) { checkScreen(out, conv, f.id, quizId); }, function () {});
    });
  }
  /* Google's link to a form picture works only for a short time: each one is copied into Drive now */
  function copyPictures(conv, out) {
    if (!conv.pictures.length) return Promise.resolve();
    var note = el('p', { class: 'small' }, 'Copying ' + UI.plural(conv.pictures.length, 'picture') + '…');
    out.appendChild(note);
    var i = 0, failed = 0;
    function nextPic() {
      if (i >= conv.pictures.length) { note.textContent = failed ? failed + ' picture(s) could not be copied: they are left out.' : 'Pictures copied.'; return Promise.resolve(); }
      var p = conv.pictures[i++];
      note.textContent = 'Copying picture ' + i + ' of ' + conv.pictures.length + '…';
      return API.call('quiz.picture', { url: p.url }, { quiet: true }).then(function (r) {
        var q = conv.quiz.questions[p.q];
        if (p.opt !== undefined) q.options[p.opt].image = r.fileId; else q.image = r.fileId;
      }, function () { failed++; }).then(nextPic);
    }
    return nextPic();
  }
  function howMarked(q) {
    if (q.kind === 'section' || q.kind === 'info' || q.kind === 'image') return '';
    if (!q.points) return 'Not marked (no points)';
    if (q.kind === 'paragraph') return 'You mark this';
    if (!q.correct || !q.correct.length) return 'You mark this (no answer key)';
    if (q.kind === 'short') return 'At once; near misses come to you';
    return 'At once, from the answer key';
  }
  function checkScreen(out, conv, formId, quizId) {
    var quiz = conv.quiz, ans = quiz.questions.filter(function (q) { return ['choice', 'checkbox', 'short', 'paragraph'].indexOf(q.kind) >= 0; });
    var pts = ans.reduce(function (a, q) { return a + (q.points || 0); }, 0);
    var panel = el('section', { class: 'panel' }, [el('h2', {}, quiz.title),
      el('p', { class: 'small' }, UI.plural(ans.length, 'question') + ' came across · ' + UI.plural(pts, 'mark') + ' · ' +
        ans.filter(function (q) { return /You mark/.test(howMarked(q)); }).length + ' for you to mark after the quiz')]);
    if (!conv.isQuiz) panel.appendChild(el('div', { class: 'notice notice--warn' }, 'This form is not a quiz in Google Forms, so it has no points and no answer key. Turn on "Make this a quiz" in the form\'s settings, set the answers, and read it again. Or add it as it is and set the points and answers here afterwards.'));
    var warns = conv.report.filter(function (r) { return r.warn || r.note; });
    if (warns.length) panel.appendChild(el('div', { class: 'notice notice--warn' }, [el('strong', {}, 'Left out:'),
      el('ul', {}, warns.map(function (w) { return el('li', {}, (w.title ? '“' + w.title.slice(0, 80) + '” — ' : '') + (w.warn ? w.how : w.note)); }))]));
    var tb = el('tbody'), n = 0;
    quiz.questions.forEach(function (q) {
      if (q.kind === 'section') { tb.appendChild(el('tr', {}, el('td', { colspan: 6 }, el('strong', {}, 'Section: ' + (q.title || ''))))); return; }
      if (q.kind === 'info' || q.kind === 'image') return;
      n++;
      var topic = el('input', { type: 'text', class: 'topic-in', value: q.topic || '', 'aria-label': 'Topic of question ' + n });
      topic.addEventListener('input', function () { q.topic = topic.value.trim(); });
      tb.appendChild(el('tr', {}, [el('td', { class: 'num' }, String(n)), el('td', { class: 'qtext' }, [q.title, q.image ? el('div', { class: 'small' }, 'with a picture') : null]),
        el('td', { class: 'qkind' }, GoogleData.kindLabel(q.kind)), el('td', { class: 'num' }, String(q.points || 0)),
        el('td', { class: 'small' }, howMarked(q) + (q.correct && q.correct.length ? ' · key: ' + q.correct.join(' · ').slice(0, 80) : '')), el('td', {}, topic)]));
    });
    panel.appendChild(el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, [el('thead', {}, el('tr', {}, ['#', 'Question', 'Kind', 'Marks', 'How it is marked', 'Topic'].map(function (h) { return el('th', {}, h); }))), tb])));
    panel.appendChild(el('p', { class: 'small' }, 'The form\'s sections become topics; change a topic here if you wish. Topics group the results in the analysis.'));
    var save = el('button', { class: 'btn btn--primary', type: 'button' }, quizId ? 'Save as a new version' : 'Add to my library');
    save.addEventListener('click', function () {
      UI.act(save, 'Saving…', API.call('quiz.save', { quiz: quiz, formId: formId, quizId: quizId || undefined }), 'The quiz is in your library.')
        .then(function (r) { state.quizzes = null; refreshHome(); location.hash = '#quiz/' + r.quizId + '/' + r.version; }, function () {});
    });
    panel.appendChild(el('div', { class: 'row' }, [save, el('a', { class: 'btn', href: '#quizzes' }, 'Cancel')]));
    out.appendChild(panel);
  }

  /* one quiz: its questions with the key, its versions, run, edit, share, bin */
  function quizPage(quizId, version) {
    var app = page('Quiz', 'quizzes', ['#quizzes', 'My quizzes']);
    var box = el('div', {}, el('p', { class: 'muted' }, 'Loading…'));
    app.appendChild(box);
    Promise.all([API.call('quiz.get', { quizId: quizId, version: Number(version) }), loadQuizzes()]).then(function (res) {
      var r = res[0], meta = res[1].filter(function (q) { return q.quizId === quizId; })[0] || { versions: [], sharedWith: [] };
      var quiz = r.quiz, v = meta.versions.filter(function (x) { return x.version === Number(version); })[0] || {};
      UI.clear(box);
      var vs = el('select', { 'aria-label': 'Version' }, meta.versions.map(function (x) {
        return el('option', { value: x.version, selected: x.version === Number(version) ? true : null }, 'Version ' + x.version + ' · ' + UI.date(x.saved) + (x.inBin ? ' (bin)' : ''));
      }));
      vs.addEventListener('change', function () { location.hash = '#quiz/' + quizId + '/' + vs.value; });
      var acts = el('div', { class: 'row' }, [v.inBin ? null : el('a', { class: 'btn btn--primary', href: '#run/' + quizId }, 'Run this quiz'),
        el('a', { class: 'btn', href: '#try/' + quizId + '/' + version }, 'Try it as a pupil'), vs]);
      if (r.mine) {
        var edit = el('button', { class: 'btn', type: 'button' }, 'Change the key or points');
        edit.addEventListener('click', function () { editQuiz(box, quiz, quizId); });
        acts.appendChild(edit);
        if (r.formId) acts.appendChild(el('a', { class: 'btn', href: '#add/' + quizId }, 'Import the form again'));
        var share = el('button', { class: 'btn', type: 'button' }, 'Share');
        share.addEventListener('click', function () {
          var now = (meta.sharedWith || []).join(', ');
          var val = window.prompt('Share this quiz with colleagues: type their school addresses or a department\'s name (for example Physics), separated by commas. They can run it; only you can change it. Results are never shared.', now);
          if (val === null) return;
          UI.act(share, 'Sharing…', API.call('quiz.share', { quizId: quizId, sharedWith: val }), val.trim() ? 'Shared.' : 'No longer shared.').then(function () { state.quizzes = null; }, function () {});
        });
        acts.appendChild(share);
        var bin = el('button', { class: 'btn btn--danger', type: 'button' }, v.inBin ? 'Take out of the bin' : 'Move to the bin');
        bin.addEventListener('click', function () {
          UI.act(bin, '…', API.call('quiz.bin', { quizId: quizId, version: Number(version), inBin: !v.inBin }), v.inBin ? 'Back in your library.' : 'Moved to the bin. You can take it out again.')
            .then(function () { state.quizzes = null; location.hash = '#quizzes'; }, function () {});
        });
        acts.appendChild(bin);
        if (v.inBin) {
          var del = el('button', { class: 'btn btn--danger', type: 'button' }, 'Remove for good');
          del.addEventListener('click', function () {
            if (!window.confirm('Remove this version for good? This cannot be undone.')) return;
            UI.act(del, 'Removing…', API.call('quiz.delete', { quizId: quizId, version: Number(version) }), 'Removed.').then(function () { state.quizzes = null; location.hash = '#quizzes'; }, function () {});
          });
          acts.appendChild(del);
        }
      }
      box.appendChild(el('div', { class: 'head' }, [el('div', {}, [el('h1', {}, quiz.title), el('p', { class: 'small' },
        (r.mine ? 'Yours' : 'Shared by ' + meta.owner) + ((meta.sharedWith || []).length && r.mine ? ' · shared with ' + meta.sharedWith.join(', ') : ''))]), acts]));
      box.appendChild(questionList(quiz));
    }, function (e) { UI.clear(box); fail(box, e); });
  }
  function questionList(quiz) {
    var wrap = el('div'), n = 0;
    quiz.questions.forEach(function (q) {
      if (q.kind === 'section') { wrap.appendChild(el('div', { class: 'section-title' }, q.title || 'Section')); return; }
      var isQ = ['choice', 'checkbox', 'short', 'paragraph'].indexOf(q.kind) >= 0;
      if (isQ) n++;
      var card = el('div', { class: 'q' }, [
        isQ ? el('div', { class: 'q__n' }, 'Question ' + n + ' · ' + GoogleData.kindLabel(q.kind) + ' · ' + UI.plural(q.points || 0, 'mark') + (q.topic ? ' · ' + q.topic : '') + ' · ' + howMarked(q)) : null,
        q.title ? el('div', { class: 'q__t' }, q.title) : null, q.help ? el('div', { class: 'q__h' }, q.help) : null,
        q.image ? el('img', { src: 'https://lh3.googleusercontent.com/d/' + q.image, alt: '' }) : null]);
      (q.options || []).forEach(function (o) {
        var right = (q.correct || []).indexOf(o.label) >= 0;
        card.appendChild(el('div', { class: 'opt' + (right ? ' is-on' : '') }, [right ? '✓ ' : '', o.label, o.image ? el('img', { src: 'https://lh3.googleusercontent.com/d/' + o.image, alt: '' }) : null]));
      });
      if (q.kind === 'short' && q.correct && q.correct.length) card.appendChild(el('p', { class: 'small' }, 'Accepted answers: ' + q.correct.join(' · ')));
      wrap.appendChild(card);
    });
    return wrap;
  }
  function editQuiz(box, quiz, quizId) {
    UI.clear(box);
    var copy = JSON.parse(JSON.stringify(quiz));
    box.appendChild(el('div', { class: 'head' }, [el('h1', {}, 'Change: ' + quiz.title)]));
    box.appendChild(el('p', { class: 'small' }, 'Saving makes a new version. Pupils who already sat the quiz keep the version they sat.'));
    var titleIn = el('input', { type: 'text', value: copy.title });
    titleIn.addEventListener('input', function () { copy.title = titleIn.value; });
    box.appendChild(el('label', { class: 'field', style: 'margin-bottom:12px' }, ['Title', titleIn]));
    var n = 0;
    copy.questions.forEach(function (q) {
      if (['choice', 'checkbox', 'short', 'paragraph'].indexOf(q.kind) < 0) return;
      n++;
      var pts = el('input', { type: 'number', min: 0, max: 100, value: q.points || 0 });
      pts.addEventListener('input', function () { q.points = Number(pts.value) || 0; });
      var topic = el('input', { type: 'text', value: q.topic || '' });
      topic.addEventListener('input', function () { q.topic = topic.value; });
      var text = el('textarea', { style: 'min-height:60px' }, q.title);
      text.addEventListener('input', function () { q.title = text.value; });
      var keyBox = el('div');
      if (q.options) q.options.forEach(function (o) {
        var cb = el('input', { type: q.kind === 'choice' ? 'radio' : 'checkbox', name: 'k' + n, checked: (q.correct || []).indexOf(o.label) >= 0 ? true : null });
        cb.addEventListener('change', function () {
          if (q.kind === 'choice') q.correct = [o.label];
          else { q.correct = (q.correct || []).filter(function (x) { return x !== o.label; }); if (cb.checked) q.correct.push(o.label); }
        });
        keyBox.appendChild(el('label', { class: 'opt' }, [cb, el('span', {}, o.label)]));
      });
      else if (q.kind === 'short') {
        var acc = el('input', { type: 'text', value: (q.correct || []).join(' | '), placeholder: 'Accepted answers, separated by |' });
        acc.addEventListener('input', function () { q.correct = acc.value.split('|').map(function (s) { return s.trim(); }).filter(String); });
        keyBox.appendChild(el('label', { class: 'field' }, ['Accepted answers (separate with |; leave empty to mark it yourself)', acc]));
      } else keyBox.appendChild(el('p', { class: 'small' }, 'You mark this question after the quiz.'));
      box.appendChild(el('div', { class: 'q' }, [el('div', { class: 'q__n' }, 'Question ' + n + ' · ' + GoogleData.kindLabel(q.kind)),
        text, el('div', { class: 'fields', style: 'margin:10px 0' }, [el('label', { class: 'field' }, ['Marks', pts]), el('label', { class: 'field' }, ['Topic', topic])]), keyBox]));
    });
    var save = el('button', { class: 'btn btn--primary', type: 'button' }, 'Save as a new version');
    save.addEventListener('click', function () {
      UI.act(save, 'Saving…', API.call('quiz.save', { quiz: copy, quizId: quizId }), 'Saved as a new version.')
        .then(function (r) { state.quizzes = null; location.hash = '#quiz/' + r.quizId + '/' + r.version; }, function () {});
    });
    box.appendChild(el('div', { class: 'row' }, [save, el('a', { class: 'btn', href: location.hash, onclick: function () { setTimeout(route, 0); } }, 'Cancel')]));
  }

  /* ── Try it as a pupil (pupil.js Pupil.preview): the pupil's page, saving nothing ── */
  function tryQuiz(quizId, version) {
    page('Try it as a pupil', 'quizzes');
    global.Pupil.preview({ quizId: quizId, version: Number(version), back: '#quiz/' + quizId + '/' + version });
  }

  /* ── My classes ────────────────────────────────────────── */
  function classes() {
    var app = page('My classes', 'classes');
    var imp = el('button', { class: 'btn btn--primary', type: 'button' }, 'Import from Google Classroom');
    app.appendChild(el('div', { class: 'head' }, [el('h1', {}, 'My classes'), imp]));
    var pick = el('div');
    app.appendChild(pick);
    var box = el('div', {}, el('p', { class: 'muted' }, 'Loading…'));
    app.appendChild(box);
    imp.addEventListener('click', function () {
      UI.act(imp, 'Asking Google…', GoogleData.courses()).then(function (courses) {
        UI.clear(pick);
        if (!courses.length) { pick.appendChild(el('div', { class: 'notice' }, 'Google Classroom shows no active class that you teach.')); return; }
        var have = {};
        (state.classes || []).forEach(function (c) { if (c.courseId) have[c.courseId] = c; });
        var list = el('div', { class: 'list' });
        courses.forEach(function (c) {
          var b = el('button', { class: 'btn btn--small' + (have[c.id] ? '' : ' btn--primary'), type: 'button' }, have[c.id] ? 'Check again' : 'Import');
          b.addEventListener('click', function () {
            UI.act(b, 'Importing…', GoogleData.students(c.id).then(function (pupils) {
              return API.call('class.save', { classId: have[c.id] ? have[c.id].id : undefined, name: have[c.id] ? have[c.id].name : (c.name + (c.section ? ' ' + c.section : '')), courseId: c.id, pupils: pupils })
                .then(function (r) { return { r: r, n: pupils.length }; });
            })).then(function (x) { UI.toast(UI.plural(x.n, 'pupil') + ' imported.'); state.classes = null; refreshHome(); location.hash = '#cls/' + x.r.classId; }, function () {});
          });
          list.appendChild(el('div', { class: 'list__item' }, [el('div', { class: 'list__main' }, [el('div', { class: 'list__title' }, c.name), el('div', { class: 'list__sub' }, c.section)]), b]));
        });
        pick.appendChild(el('section', { class: 'panel' }, [el('h2', {}, 'Your classes in Google Classroom'), list]));
      }, function () {});
    });
    loadClasses(true).then(function (cl) {
      UI.clear(box);
      if (!cl.length) box.appendChild(el('p', { class: 'muted' }, 'No class yet. Import one from Google Classroom.'));
      else {
        var tb = el('tbody');
        cl.forEach(function (c) {
          var rm = el('button', { class: 'btn btn--small', type: 'button', 'aria-label': 'Remove ' + c.name }, 'Remove');
          rm.addEventListener('click', function (ev) { ev.stopPropagation(); removeClass(c, rm, classes); });
          tb.appendChild(el('tr', { class: 'is-click', onclick: function () { location.hash = '#cls/' + c.id; } }, [el('td', {}, c.name), el('td', { class: 'num' }, String(c.pupils)),
            el('td', { class: 'small' }, c.checked ? 'Checked against Classroom ' + UI.date(c.checked) : ''), el('td', { class: 'act' }, rm)]));
        });
        box.appendChild(el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, [el('thead', {}, el('tr', {}, [el('th', {}, 'Class'), el('th', { class: 'num' }, 'Pupils'), el('th', {}, ''), el('th', {}, '')])), tb])));
      }
      API.call('classes.list', { archived: true }, { quiet: true }).then(function (r) {
        var gone = r.classes || [];
        if (!gone.length) return;
        var list = el('div', { class: 'list' });
        gone.forEach(function (c) {
          var b = el('button', { class: 'btn btn--small', type: 'button' }, 'Bring back');
          b.addEventListener('click', function () { bringBack(c, b, classes); });
          var x = el('button', { class: 'btn btn--small btn--danger', type: 'button', 'aria-label': 'Delete ' + c.name + ' for good' }, 'Delete for good');
          x.addEventListener('click', function () { deleteClass(c, x, classes); });
          list.appendChild(el('div', { class: 'list__item' }, [el('div', { class: 'list__main' }, [el('div', { class: 'list__title' }, c.name), el('div', { class: 'list__sub' }, UI.plural(c.pupils, 'pupil'))]),
            el('div', { class: 'row' }, [b, x])]));
        });
        box.appendChild(el('section', { class: 'panel', style: 'margin-top:16px' }, [el('h2', {}, 'Removed classes'),
          el('p', { class: 'small' }, 'Their results are kept. Bring a class back to run a quiz for it or to see its results. Delete for good empties it from Quiz Hall.'), list]));
      }, function () {});
    }, function (e) { UI.clear(box); fail(box, e); });
  }
  /* Remove puts a class aside (the Classes tab's "archived" column, class.archive): nothing is deleted, its results stay
     in the Sheet, a quiz already running for it goes on, and Bring back undoes it */
  function removeClass(c, btn, after) {
    if (!window.confirm('Remove ' + c.name + ' from My classes?\n\nNothing is deleted: its results are kept, and you can bring it back under "Removed classes" at the bottom of My classes. Google Classroom does not change.')) return;
    UI.act(btn, 'Removing…', API.call('class.archive', { classId: c.id, archived: true }), c.name + ' is removed from My classes.')
      .then(function () { state.classes = null; refreshHome(); after(); }, function () {});
  }
  /* Delete for good: only from Removed classes (class.delete refuses any other); the class, its pupil list and every
     result of its quizzes leave the Sheet; the quizzes stay in the library */
  function deleteClass(c, btn, after) {
    if (!window.confirm('Delete ' + c.name + ' for good?\n\nThis deletes its pupil list and every result of its quizzes from Quiz Hall: scores, written answers and comments. It cannot be undone. Your quizzes stay in My quizzes.')) return;
    UI.act(btn, 'Deleting…', API.call('class.delete', { classId: c.id }), c.name + ' is deleted for good.')
      .then(function () { state.classes = null; refreshHome(); after(); }, function () {});
  }
  function bringBack(c, btn, after) {
    UI.act(btn, 'Bringing back…', API.call('class.archive', { classId: c.id, archived: false }), c.name + ' is back in My classes.')
      .then(function () { state.classes = null; refreshHome(); after(); }, function () {});
  }
  function classPage(classId) {
    var app = page('Class', 'classes', ['#classes', 'My classes']);
    var box = el('div', {}, el('p', { class: 'muted' }, 'Loading…'));
    app.appendChild(box);
    function load() {
      API.call('class.get', { classId: classId }).then(function (r) {
        UI.clear(box);
        var c = r.cls;
        var acts = el('div', { class: 'row' }, [el('a', { class: 'btn btn--primary', href: '#run' }, 'Run a quiz'), el('a', { class: 'btn', href: '#results/' + c.id }, 'Results')]);
        if (c.courseId) {
          var chk = el('button', { class: 'btn', type: 'button' }, 'Check against Classroom');
          chk.addEventListener('click', function () {
            UI.act(chk, 'Checking…', GoogleData.students(c.courseId).then(function (pupils) {
              return API.call('class.save', { classId: c.id, name: c.name, subject: c.subject, courseId: c.courseId, pupils: pupils }).then(function () { return pupils.length; });
            })).then(function (n) { UI.toast('The list now matches Google Classroom: ' + UI.plural(n, 'pupil') + '.'); load(); }, function () {});
          });
          acts.appendChild(chk);
        }
        box.appendChild(el('div', { class: 'head' }, [el('div', {}, [el('h1', {}, c.name), el('p', { class: 'small' }, UI.plural(r.pupils.length, 'pupil') +
          (c.checked ? ' · checked against Google Classroom ' + UI.date(c.checked) : ''))]), acts]));
        var tb = el('tbody');
        r.pupils.forEach(function (p) {
          var ex = el('select', { 'aria-label': 'Extra time for ' + p.name }, [0, 10, 25, 50].map(function (v) { return el('option', { value: v, selected: p.extra === v ? true : null }, v ? '+' + v + ' %' : 'None'); }));
          if ([0, 10, 25, 50].indexOf(p.extra) < 0) ex.appendChild(el('option', { value: p.extra, selected: true }, '+' + p.extra + ' %'));
          ex.addEventListener('change', function () {
            API.call('class.pupil', { classId: c.id, op: 'extra', email: p.email, extra: Number(ex.value) }).then(function () { UI.toast('Extra time saved for ' + p.name + '.'); }, function (e) { UI.toast(e.message, true); });
          });
          var rm = el('button', { class: 'btn btn--small', type: 'button' }, 'Remove');
          rm.addEventListener('click', function () {
            if (!window.confirm('Take ' + p.name + ' off this class in Quiz Hall? Google Classroom does not change.')) return;
            UI.act(rm, 'Removing…', API.call('class.pupil', { classId: c.id, op: 'remove', email: p.email }), p.name + ' is off the list.').then(load, function () {});
          });
          tb.appendChild(el('tr', {}, [el('td', {}, p.name), el('td', { class: 'small' }, p.email), el('td', {}, ex), el('td', {}, rm)]));
        });
        box.appendChild(el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, [el('thead', {}, el('tr', {}, ['Pupil', 'Address', 'Extra time', ''].map(function (h) { return el('th', {}, h); }))), tb])));
        var em = el('input', { type: 'email', placeholder: 'pupil@…' }), nm = el('input', { type: 'text', placeholder: 'Name' });
        var add = el('button', { class: 'btn', type: 'button' }, 'Add a pupil');
        add.addEventListener('click', function () {
          UI.act(add, 'Adding…', API.call('class.pupil', { classId: c.id, op: 'add', email: em.value, name: nm.value }), 'Added.').then(load, function () {});
        });
        box.appendChild(el('section', { class: 'panel', style: 'margin-top:16px' }, [el('h3', {}, 'Add a pupil by hand'),
          el('div', { class: 'fields' }, [el('label', { class: 'field' }, ['School address', em]), el('label', { class: 'field' }, ['Name', nm]), add]),
          el('p', { class: 'small' }, 'Changes here change Quiz Hall\'s list only. Google Classroom stays as it is.')]));
        var gone = el('button', { class: 'btn btn--small' + (c.archived ? '' : ' btn--danger'), type: 'button' }, c.archived ? 'Bring back this class' : 'Remove this class');
        gone.addEventListener('click', function () {
          if (c.archived) bringBack(c, gone, load);
          else removeClass(c, gone, function () { location.hash = '#classes'; });
        });
        box.appendChild(el('div', { class: 'row', style: 'margin-top:16px' }, gone));
      }, function (e) { UI.clear(box); fail(box, e); });
    }
    load();
  }

  /* ── Help, task first ──────────────────────────────────── */
  function help() {
    var app = page('Help', 'help');
    app.appendChild(el('h1', {}, 'Run your first quiz'));
    app.appendChild(el('ol', { class: 'panel stack' }, [
      el('li', {}, [el('strong', {}, 'Import your class. '), 'My classes ▸ Import from Google Classroom. Google asks once for permission.']),
      el('li', {}, [el('strong', {}, 'Add your quiz. '), 'My quizzes ▸ Add a quiz from a Google Form. Paste the address of the form as you see it when you edit it. Check what came across, then add it.']),
      el('li', {}, [el('strong', {}, 'Run it. '), 'Run a quiz: choose the quiz, the class and the length, then Start now.']),
      el('li', {}, [el('strong', {}, 'Pupils sit it. '), 'They open nlcsbiology.com/quiz-hall in Chrome on a laptop and sign in. If one leaves the page, the quiz locks: press Unlock on the live page.']),
      el('li', {}, [el('strong', {}, 'Mark and look. '), 'Answers the key cannot mark wait in To mark: one key press per mark. Results shows the class, each question, each topic and each pupil over time.'])]));
    app.appendChild(el('h2', {}, 'Good to know'));
    app.appendChild(el('ul', { class: 'panel stack small' }, [
      el('li', {}, 'Pupils see their total score when they hand in. They see the right answers and your comments only when you press Release the answers, after the quiz is closed.'),
      el('li', {}, 'Written (paragraph) answers are kept until 31 July, the end of the school year. On 1 August the words are deleted; the marks stay. Download any you want to keep before then.'),
      el('li', {}, 'Changing a quiz makes a new version. Pupils who already sat it keep the version they sat.'),
      el('li', {}, 'To see a quiz as your pupils will: My quizzes ▸ the quiz ▸ Try it as a pupil. Answer, try the lock, hand in, and see the score and the answers page. Nothing is saved.'),
      el('li', {}, 'A class you no longer teach: My classes ▸ Remove. Nothing is deleted: its results are kept, and Bring back (at the bottom of My classes) undoes it. Delete for good, beside Bring back, deletes the class and all its results; it cannot be undone.'),
      el('li', {}, 'A quiz you share can be run by your colleagues. Only you can change it, and nobody else sees your results.'),
      el('li', {}, 'Pupils need Google Chrome on a laptop or a Chromebook. Phones, iPads and other browsers are refused.')]));
  }
})(window);
