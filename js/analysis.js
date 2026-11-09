/* Quiz Hall — the teacher's analysis: one class at a time, five views, each answering one question.
     Class            How is my class doing?            pupils × quizzes, coloured by score; the class average over time
     Quiz             Which questions did they find hard? share right per question, lowest first; the wrong answer most chose
     Topics           Where are they struggling?        share of marks earned per topic, weakest first
     Pupil            Is this pupil improving?          every quiz against the class average, with the trend
     Who to check on  Who needs help now?               falling, below the class, or missing quizzes, in neutral words
   Progress is measured against the class on the same quiz, because quizzes differ in difficulty. Everything is worked out
   here from one answer of the back office (results.class): nothing extra is stored. */
(function (global) {
  'use strict';
  var A = global.Analysis = {};
  var el = UI.el;
  var VIEWS = [['class', 'Class'], ['quiz', 'Quiz'], ['topics', 'Topics'], ['pupil', 'Pupil'], ['check', 'Who to check on']];

  /* ── a tooltip that shows at once on hover, focus and tap (never the title attribute) ── */
  var tipEl = null;
  function tip(node, text) {
    node.setAttribute('tabindex', node.getAttribute('tabindex') || '0');
    function show(e) {
      if (!tipEl) { tipEl = el('div', { class: 'tip', role: 'tooltip' }); document.body.appendChild(tipEl); }
      tipEl.textContent = text; tipEl.hidden = false;
      var r = node.getBoundingClientRect(), w = Math.min(280, tipEl.offsetWidth || 200);
      tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      tipEl.style.top = Math.max(8, r.top - (tipEl.offsetHeight || 30) - 8) + 'px';
    }
    function hide() { if (tipEl) tipEl.hidden = true; }
    node.addEventListener('mouseenter', show); node.addEventListener('focus', show);
    node.addEventListener('mouseleave', hide); node.addEventListener('blur', hide);
    node.addEventListener('touchstart', show, { passive: true });
  }

  /* ── the numbers ── */
  function model(r) {
    var pupils = r.pupils.slice(), byEmail = {};
    pupils.forEach(function (p) { byEmail[p.email] = p; });
    var rowsBy = {};
    r.rows.forEach(function (x) {
      x.pct = x.max ? 100 * x.score / x.max : null;
      (rowsBy[x.sid] = rowsBy[x.sid] || {})[x.email] = x;
      if (!byEmail[x.email]) { byEmail[x.email] = { email: x.email, name: x.email.split('@')[0], left: true }; pupils.push(byEmail[x.email]); }
    });
    var sittings = r.sittings.filter(function (s) { return rowsBy[s.id] || s.state === 'open'; }).map(function (s) {
      var rows = rowsBy[s.id] || {}, list = Object.keys(rows).map(function (e) { return rows[e]; });
      var pcts = list.map(function (x) { return x.pct; }).filter(function (v) { return v !== null; });
      return { id: s.id, title: s.title, quiz: s.quiz, opens: s.opens, state: s.state, released: s.released, rows: rows, list: list,
               avg: pcts.length ? pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length : null,
               partial: list.some(function (x) { return x.toMark > 0; }) };
    });
    pupils.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { cls: r.cls, pupils: pupils, sittings: sittings, quizzes: r.quizzes, writtenUntil: r.writtenUntil };
  }
  function heatClass(p) { return p === null || p === undefined ? 'hx' : p < 40 ? 'h1' : p < 55 ? 'h2' : p < 70 ? 'h3' : p < 85 ? 'h4' : 'h5'; }
  function round(v) { return v === null || v === undefined ? '' : String(Math.round(v)); }
  function short(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

  /* per question of one sitting: share right (of marked answers), the wrong answer most chose, still to mark */
  function questionStats(m, s) {
    var quiz = m.quizzes[s.quiz];
    if (!quiz) return [];
    return quiz.questions.map(function (q, qi) {
      var marked = 0, right = 0, earned = 0, pending = 0, wrongCounts = {};
      s.list.forEach(function (x) {
        var tok = x.marks[qi];
        if (tok === '?' || tok === '~') { pending++; return; }
        if (tok === '' || tok === undefined) return;
        var v = Number(tok);
        marked++; earned += v;
        if (q.points && v >= q.points) right++;
        else if (q.kind === 'choice' || q.kind === 'checkbox') { var a = x.answers[qi] || '(no answer)'; wrongCounts[a] = (wrongCounts[a] || 0) + 1; }
      });
      var top = Object.keys(wrongCounts).sort(function (a, b) { return wrongCounts[b] - wrongCounts[a]; })[0];
      var topLabel = '';
      if (top && top !== '(no answer)') {
        topLabel = top.split('').map(function (L) { var o = q.options[L.charCodeAt(0) - 65]; return L + (o ? ': ' + short(o, 40) : ''); }).join(' + ');
      }
      return { n: qi + 1, q: q, marked: marked, right: right, share: marked && q.points ? 100 * earned / (marked * q.points) : null,
               pending: pending, wrongTop: top ? { label: topLabel || 'no answer', count: wrongCounts[top] } : null };
    });
  }

  /* ── the page ── */
  A.draw = function (app, o) {
    var head = el('div', { class: 'head' }), tabs = el('div', { class: 'tabs', role: 'tablist' }), body = el('div');
    var clsSel = el('select', { 'aria-label': 'Class' }, o.classes.map(function (c) { return el('option', { value: c.id, selected: c.id === o.classId ? true : null }, c.name); }));
    clsSel.addEventListener('change', function () { location.hash = '#results/' + clsSel.value + '/' + o.view; });
    var dl = el('button', { class: 'btn', type: 'button' }, 'Download');
    head.appendChild(el('h1', {}, 'Results'));
    head.appendChild(el('div', { class: 'row' }, [clsSel, dl]));
    VIEWS.forEach(function (v) {
      tabs.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': v[0] === o.view ? 'true' : 'false',
        onclick: function () { location.hash = '#results/' + o.classId + '/' + v[0]; } }, v[1]));
    });
    app.appendChild(head); app.appendChild(tabs); app.appendChild(body);
    /* o.data is the class's results.class answer, kept by teacher.js: the heading, the tabs and the view are drawn in one
       piece (Daniel, 10 Nov 2026), and a tab drawn again from the kept copy, without asking */
    var m = model(o.data);
    UI.clear(body);
    if (!m.sittings.length) { body.appendChild(el('p', { class: 'muted' }, 'This class has not sat a quiz yet.')); dl.hidden = true; return; }
    var view = { class: classView, quiz: quizView, topics: topicsView, pupil: pupilView, check: checkView }[o.view] || classView;
    var csv = view(body, m, o.extra, o);
    dl.onclick = function () { if (csv) UI.download(csv.name, csv.rows()); };
  };

  /* ── Class ── */
  function classView(body, m, extra, o) {
    body.appendChild(el('p', { class: 'small' }, 'Each cell is the pupil\'s score as a percentage. Point at a cell for the details; press a name or a quiz to open it.'));
    var legend = el('div', { class: 'legend' }, ['Score:', el('i', { style: 'background:var(--heat-1)' }), el('span', {}, 'under 40 %'),
      el('i', { style: 'background:var(--heat-2)' }), el('span', {}, '40–54'), el('i', { style: 'background:var(--heat-3)' }), el('span', {}, '55–69'),
      el('i', { style: 'background:var(--heat-4)' }), el('span', {}, '70–84'), el('i', { style: 'background:var(--heat-5)' }), el('span', {}, '85 and over'),
      el('i', { class: 'none' }), el('span', {}, '— not sat'), el('span', {}, '* still being marked')]);
    body.appendChild(legend);
    var thead = el('tr', {}, [el('th', { class: 'name' }, 'Pupil')]);
    m.sittings.forEach(function (s) {
      var th = el('th', {}, el('a', { href: '#results/' + o.classId + '/quiz/' + s.id }, [UI.date(s.opens), el('br'), short(s.title, 14)]));
      thead.appendChild(th);
    });
    var tb = el('tbody');
    m.pupils.forEach(function (p) {
      var tr = el('tr', {}, [el('td', { class: 'name' }, el('a', { href: '#results/' + o.classId + '/pupil/' + encodeURIComponent(p.email) }, p.name + (p.left ? ' (left)' : '')))]);
      m.sittings.forEach(function (s) {
        var x = s.rows[p.email], td = el('td', { class: heatClass(x ? x.pct : null) }, x ? round(x.pct) + (x.toMark ? '*' : '') : '—');
        tip(td, p.name + ' · ' + s.title + ' · ' + (x ? x.score + ' of ' + x.max + ' (' + round(x.pct) + ' %)' + (x.toMark ? ', ' + x.toMark + ' still to mark' : '') +
          (x.secs ? ' · ' + UI.mins(x.secs) : '') + (x.locks ? ' · locked ' + x.locks + '×' : '') : 'not sat'));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    var avg = el('tr', { class: 'avg' }, [el('td', { class: 'name' }, 'Class average')]);
    m.sittings.forEach(function (s) { avg.appendChild(el('td', { class: heatClass(s.avg) }, s.avg === null ? '' : round(s.avg) + (s.partial ? '*' : ''))); });
    tb.appendChild(avg);
    body.appendChild(el('div', { class: 'tblwrap', style: 'padding:8px' }, el('table', { class: 'heat' }, [el('thead', {}, thead), tb])));
    var pts = m.sittings.filter(function (s) { return s.avg !== null; });
    if (pts.length >= 2) {
      body.appendChild(el('h3', {}, 'The class average over time'));
      body.appendChild(lineChart([{ cls: '', name: 'Class average', points: pts.map(function (s, i) { return { i: i, y: s.avg, tip: s.title + ' · ' + UI.date(s.opens) + ' · ' + round(s.avg) + ' %' }; }) }],
        pts.map(function (s) { return UI.date(s.opens); })));
      body.appendChild(el('p', { class: 'small muted' }, 'Quizzes differ in difficulty, so a dip can be a harder quiz. The Pupil view compares each pupil with the class on the same quiz.'));
    }
    return { name: m.cls.name + ' results.csv', rows: function () {
      var rows = [['Pupil', 'Address'].concat(m.sittings.map(function (s) { return UI.date(s.opens) + ' ' + s.title + ' (%)'; }))];
      m.pupils.forEach(function (p) { rows.push([p.name, p.email].concat(m.sittings.map(function (s) { var x = s.rows[p.email]; return x ? round(x.pct) : ''; }))); });
      rows.push(['Class average', ''].concat(m.sittings.map(function (s) { return round(s.avg); })));
      return rows;
    } };
  }

  /* ── Quiz ── */
  function quizView(body, m, sid, o) {
    var s = m.sittings.filter(function (x) { return x.id === sid; })[0] || m.sittings[m.sittings.length - 1];
    var sel = el('select', { 'aria-label': 'Quiz' }, m.sittings.slice().reverse().map(function (x) {
      return el('option', { value: x.id, selected: x.id === s.id ? true : null }, UI.date(x.opens) + ' · ' + x.title);
    }));
    sel.addEventListener('change', function () { location.hash = '#results/' + o.classId + '/quiz/' + sel.value; });
    body.appendChild(el('div', { class: 'row', style: 'margin-bottom:12px' }, [sel, el('a', { class: 'btn btn--small', href: '#live/' + s.id }, 'Live page'),
      s.partial ? el('a', { class: 'btn btn--small btn--primary', href: '#mark/' + s.id }, 'Mark the rest') : null]));
    var secs = s.list.map(function (x) { return x.secs; }).filter(Boolean).sort(function (a, b) { return a - b; });
    body.appendChild(el('p', {}, [el('strong', {}, s.list.length + ' of ' + m.pupils.filter(function (p) { return !p.left; }).length + ' pupils handed in'),
      ' · class average ' + round(s.avg) + ' %' + (secs.length ? ' · typical time ' + UI.mins(secs[Math.floor(secs.length / 2)]) : '') + (s.partial ? ' · some answers still to mark' : '')]));
    var stats = questionStats(m, s).sort(function (a, b) { return (a.share === null) - (b.share === null) || a.share - b.share; });
    body.appendChild(el('h3', {}, 'Each question: the share of marks the class earned, lowest first'));
    var list = el('div', { class: 'barlist' });
    stats.forEach(function (st) {
      var label = 'Q' + st.n + ' · ' + short(st.q.title, 70);
      var fill = el('div', { class: 'barrow__fill', style: 'width:' + (st.share === null ? 0 : st.share) + '%' });
      var row = el('div', { class: 'barrow' }, [el('div', { class: 'barrow__label' }, label), el('div', { class: 'barrow__track' }, fill),
        el('div', { class: 'barrow__val' }, st.share === null ? '–' : round(st.share) + ' %')]);
      tip(row, label + ' · ' + (st.share === null ? 'not marked yet' : round(st.share) + ' % of the marks · ' + st.right + ' of ' + st.marked + ' fully right') + (st.q.topic ? ' · ' + st.q.topic : ''));
      list.appendChild(row);
      var notes = [];
      if (st.wrongTop && st.wrongTop.count > 1) notes.push('Most common wrong answer: ' + st.wrongTop.label + ' (' + st.wrongTop.count + ' pupils)');
      if (st.pending) notes.push(st.pending + ' still to mark');
      if (notes.length) list.appendChild(el('div', { class: 'barrow__note' }, notes.join(' · ')));
    });
    body.appendChild(list);
    return { name: m.cls.name + ' ' + s.title + '.csv', rows: function () {
      var quiz = m.quizzes[s.quiz] || { questions: [] };
      var rows = [['Pupil', 'Score', 'Out of', '%', 'Time (s)', 'Locks'].concat(quiz.questions.map(function (q, i) { return 'Q' + (i + 1) + ' answer'; }), quiz.questions.map(function (q, i) { return 'Q' + (i + 1) + ' mark'; }))];
      m.pupils.forEach(function (p) {
        var x = s.rows[p.email]; if (!x) return;
        rows.push([p.name, x.score, x.max, round(x.pct), x.secs, x.locks].concat(quiz.questions.map(function (q, i) { return x.answers[i] === '¶' ? '(written)' : x.answers[i]; }), x.marks));
      });
      return rows;
    } };
  }

  /* ── Topics ── */
  function topicTotals(m, emailOnly) {
    var t = {};
    m.sittings.forEach(function (s) {
      var quiz = m.quizzes[s.quiz]; if (!quiz) return;
      quiz.questions.forEach(function (q, qi) {
        if (!q.points) return;
        var name = q.topic || 'No topic';
        s.list.forEach(function (x) {
          if (emailOnly && x.email !== emailOnly) return;
          var tok = x.marks[qi];
          if (tok === '?' || tok === '~' || tok === '' || tok === undefined) return;
          var o = t[name] = t[name] || { name: name, earned: 0, possible: 0, qs: {} };
          o.earned += Number(tok); o.possible += q.points; o.qs[s.quiz + qi] = 1;
        });
      });
    });
    return Object.keys(t).map(function (k) { var o = t[k]; o.share = o.possible ? 100 * o.earned / o.possible : null; o.questions = Object.keys(o.qs).length; return o; })
      .sort(function (a, b) { return a.share - b.share; });
  }
  function topicBars(list) {
    var box = el('div', { class: 'barlist' });
    list.forEach(function (t) {
      var row = el('div', { class: 'barrow' }, [el('div', { class: 'barrow__label' }, t.name), el('div', { class: 'barrow__track' }, el('div', { class: 'barrow__fill', style: 'width:' + round(t.share) + '%' })),
        el('div', { class: 'barrow__val' }, round(t.share) + ' %')]);
      tip(row, t.name + ' · ' + round(t.share) + ' % of ' + t.possible + ' marks · ' + UI.plural(t.questions, 'question'));
      box.appendChild(row);
    });
    return box;
  }
  function topicsView(body, m) {
    var list = topicTotals(m);
    body.appendChild(el('h3', {}, 'The share of marks the class earned in each topic, weakest first'));
    if (list.length === 1 && list[0].name === 'No topic') body.appendChild(el('div', { class: 'notice' }, 'These quizzes have no topics yet. Topics come from the form\'s sections; you can set them when you add a quiz, or with "Change the key or points".'));
    body.appendChild(topicBars(list));
    body.appendChild(el('p', { class: 'small muted' }, 'Across every quiz this class has sat. Answers still to mark are left out until they are marked.'));
    return { name: m.cls.name + ' topics.csv', rows: function () { return [['Topic', '% of marks', 'Marks possible', 'Questions']].concat(list.map(function (t) { return [t.name, round(t.share), t.possible, t.questions]; })); } };
  }

  /* ── Pupil ── */
  function pupilView(body, m, email, o) {
    email = email ? decodeURIComponent(email) : '';
    var p = m.pupils.filter(function (x) { return x.email === email; })[0] || m.pupils[0];
    var sel = el('select', { 'aria-label': 'Pupil' }, m.pupils.map(function (x) { return el('option', { value: x.email, selected: x.email === p.email ? true : null }, x.name); }));
    sel.addEventListener('change', function () { location.hash = '#results/' + o.classId + '/pupil/' + encodeURIComponent(sel.value); });
    body.appendChild(el('div', { class: 'row', style: 'margin-bottom:12px' }, [sel]));
    var tb = el('tbody'), mine = [], others = [];
    m.sittings.forEach(function (s, i) {
      var x = s.rows[p.email];
      if (x && x.pct !== null && s.avg !== null) { mine.push({ i: i, y: x.pct, tip: p.name + ' · ' + s.title + ' · ' + round(x.pct) + ' %' }); }
      if (s.avg !== null) others.push({ i: i, y: s.avg, tip: 'Class average · ' + s.title + ' · ' + round(s.avg) + ' %' });
      var diff = x && s.avg !== null ? x.pct - s.avg : null;
      tb.appendChild(el('tr', {}, [el('td', {}, UI.date(s.opens)), el('td', {}, s.title), el('td', { class: 'num' }, x ? x.score + ' / ' + x.max + (x.toMark ? '*' : '') : 'not sat'),
        el('td', { class: 'num' }, x ? round(x.pct) + ' %' : ''), el('td', { class: 'num' }, round(s.avg) + ' %'),
        el('td', { class: 'num' }, diff === null ? '' : (diff >= 0 ? '+' : '−') + Math.abs(Math.round(diff)))]));
    });
    if (mine.length >= 2) {
      body.appendChild(el('h3', {}, p.name + ' and the class, quiz by quiz'));
      body.appendChild(el('div', { class: 'legend' }, [el('i', { class: 'sw1' }), p.name, el('i', { class: 'sw2' }), 'Class average']));
      body.appendChild(lineChart([{ cls: '', name: p.name, points: mine }, { cls: '-2', name: 'Class average', points: others }], m.sittings.map(function (s) { return UI.date(s.opens); })));
      var rel = mine.map(function (pt) { return pt.y - m.sittings[pt.i].avg; });
      var last3 = rel.slice(-3), first = rel.slice(0, Math.max(1, rel.length - 3));
      var nowAvg = last3.reduce(function (a, b) { return a + b; }, 0) / last3.length, before = first.reduce(function (a, b) { return a + b; }, 0) / first.length;
      body.appendChild(el('p', {}, rel.length >= 4 ? 'In the last three quizzes ' + p.name + ' was ' + Math.abs(Math.round(nowAvg)) + ' points ' + (nowAvg >= 0 ? 'above' : 'below') +
        ' the class average; before that, ' + Math.abs(Math.round(before)) + ' points ' + (before >= 0 ? 'above' : 'below') + '.' : 'More quizzes will show a trend.'));
    }
    body.appendChild(el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, [el('thead', {}, el('tr', {}, ['Date', 'Quiz', 'Score', '%', 'Class', 'Against the class'].map(function (h, i) { return el('th', { class: i > 1 ? 'num' : null }, h); }))), tb])));
    var tops = topicTotals(m, p.email);
    if (tops.length) { body.appendChild(el('h3', {}, 'Topics, weakest first')); body.appendChild(topicBars(tops.slice(0, 8))); }
    var wrong = el('ul', { class: 'small' });
    m.sittings.slice(-3).forEach(function (s) {
      var x = s.rows[p.email], quiz = m.quizzes[s.quiz]; if (!x || !quiz) return;
      quiz.questions.forEach(function (q, qi) {
        var tok = x.marks[qi];
        if (tok !== '' && tok !== undefined && tok !== '?' && tok !== '~' && q.points && Number(tok) < q.points) {
          var ans = x.answers[qi];
          if (ans && (q.kind === 'choice' || q.kind === 'checkbox')) ans = ans.split('').map(function (L) { return q.options[L.charCodeAt(0) - 65] || L; }).join(' + ');
          wrong.appendChild(el('li', {}, s.title + ' · Q' + (qi + 1) + ' ' + short(q.title, 80) + ' — ' + Number(tok) + ' of ' + q.points + (ans && ans !== '¶' ? ' (answered: ' + short(ans, 60) + ')' : '')));
        }
      });
    });
    if (wrong.childNodes.length) { body.appendChild(el('h3', {}, 'Marks lost in the last three quizzes')); body.appendChild(wrong); }
    return { name: p.name + ' quizzes.csv', rows: function () {
      return [['Date', 'Quiz', 'Score', 'Out of', '%', 'Class average %']].concat(m.sittings.map(function (s) { var x = s.rows[p.email]; return [UI.date(s.opens), s.title, x ? x.score : '', x ? x.max : '', x ? round(x.pct) : '', round(s.avg)]; }));
    } };
  }

  /* ── Who to check on: neutral words, never a label ── */
  function checkView(body, m, extra, o) {
    var out = [];
    var closed = m.sittings.filter(function (s) { return s.state !== 'open'; });
    m.pupils.filter(function (p) { return !p.left; }).forEach(function (p) {
      var rel = [];
      m.sittings.forEach(function (s) { var x = s.rows[p.email]; if (x && x.pct !== null && s.avg !== null) rel.push(x.pct - s.avg); });
      var why = [];
      var l3 = rel.slice(-3);
      if (l3.length === 3 && l3[0] - l3[1] >= 3 && l3[1] - l3[2] >= 3 && l3[0] - l3[2] >= 10) why.push('Lower against the class in each of the last three quizzes');   /* each step at least 3 points, so a tiny wobble is no reason */
      if (l3.length >= 2) { var a = l3.reduce(function (s, v) { return s + v; }, 0) / l3.length; if (a <= -15) why.push('About ' + Math.round(-a) + ' points below the class average in recent quizzes'); }
      var missed = closed.slice(-2).filter(function (s) { return !s.rows[p.email]; }).length;
      if (missed === 2) why.push('Did not hand in the last two quizzes');
      if (why.length) out.push({ p: p, why: why });
    });
    body.appendChild(el('p', { class: 'small' }, 'Pupils whose recent quizzes stand out. A reason to look, never a verdict: a pupil may have been ill, or a quiz harder.'));
    if (!out.length) { body.appendChild(el('p', { class: 'muted' }, 'Nobody stands out in the recent quizzes.')); return null; }
    var list = el('div', { class: 'list' });
    out.forEach(function (x) {
      list.appendChild(el('div', { class: 'list__item' }, [el('div', { class: 'list__main' }, [el('div', { class: 'list__title' }, x.p.name), el('div', { class: 'list__sub' }, x.why.join(' · '))]),
        el('a', { class: 'btn btn--small', href: '#results/' + o.classId + '/pupil/' + encodeURIComponent(x.p.email) }, 'Open')]));
    });
    body.appendChild(list);
    return { name: m.cls.name + ' to check on.csv', rows: function () { return [['Pupil', 'Why']].concat(out.map(function (x) { return [x.p.name, x.why.join('; ')]; })); } };
  }

  /* ── a line chart, 0–100 %, one or two series (two: legend above, names at the ends) ── */
  function lineChart(series, xLabels) {
    var W = 720, H = 240, L = 54, R = 110, Tp = 14, B = 34, n = xLabels.length;
    var x = function (i) { return L + (n <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)); };
    var y = function (v) { return Tp + (100 - v) * (H - Tp - B) / 100; };
    var NS = 'http://www.w3.org/2000/svg';
    function s(tag, attrs, text) { var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text !== undefined) e.textContent = text; return e; }
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': series.map(function (z) { return z.name; }).join(' and ') + ', percentage by quiz' });
    [0, 25, 50, 75, 100].forEach(function (v) {
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid' }));
      svg.appendChild(s('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, v + ' %'));
    });
    var step = Math.max(1, Math.ceil(n / 8));
    xLabels.forEach(function (lab, i) { if (i % step === 0 || i === n - 1) svg.appendChild(s('text', { x: x(i), y: H - 12, 'text-anchor': 'middle' }, lab)); });
    series.forEach(function (z) {
      if (!z.points.length) return;
      svg.appendChild(s('path', { d: z.points.map(function (pt, k) { return (k ? 'L' : 'M') + x(pt.i).toFixed(1) + ' ' + y(pt.y).toFixed(1); }).join(' '), class: 'series' + z.cls }));
      z.points.forEach(function (pt) {
        svg.appendChild(s('circle', { cx: x(pt.i), cy: y(pt.y), r: 4.5, class: 'dot' + z.cls }));
        var hit = s('circle', { cx: x(pt.i), cy: y(pt.y), r: 12, class: 'hit' });
        tip(hit, pt.tip);
        svg.appendChild(hit);
      });
      var last = z.points[z.points.length - 1];
      if (series.length > 1) svg.appendChild(s('text', { x: x(last.i) + 10, y: y(last.y) + 4, class: 'endlabel' }, short(z.name, 14)));
    });
    return el('div', { class: 'panel panel--flat' }, svg);
  }
})(window);
