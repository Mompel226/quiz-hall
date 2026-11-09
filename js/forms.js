/* Quiz Hall — reading a teacher's Google Classroom and Google Forms, in the teacher's own browser, with the teacher's own
   permission (Google asks once). Nothing here reaches the back office except what the teacher then chooses to save: a class
   list, or a quiz turned into Quiz Hall's own shape. */
(function (global) {
  'use strict';
  var G = global.GoogleData = {};
  var CFG = global.QH_CONFIG || {};
  var access = null;            /* { token, until } */

  /* Google's permission for Classroom and Forms, asked for only when the teacher imports something */
  G.token = function () {
    if (access && access.until > Date.now() + 60000) return Promise.resolve(access.token);
    return new Promise(function (resolve, reject) {
      if (!(global.google && google.accounts && google.accounts.oauth2)) return reject(new Error('Google is still loading. Try again in a moment.'));
      var who = global.SignIn && SignIn.who();
      var client = google.accounts.oauth2.initTokenClient({
        client_id: CFG.googleClientId, scope: (CFG.googleScopes || []).join(' '), hint: who ? who.email : undefined,
        callback: function (r) {
          if (!r || r.error || !r.access_token) return reject(new Error(r && r.error === 'access_denied' ? 'Quiz Hall needs your permission to read your classes and forms.' : 'Google did not give permission.'));
          access = { token: r.access_token, until: Date.now() + (Number(r.expires_in) || 3000) * 1000 };
          resolve(access.token);
        },
        error_callback: function () { reject(new Error('The Google window was closed.')); }
      });
      client.requestAccessToken({ prompt: '' });
    });
  };
  function get(url) {
    return G.token().then(function (tok) {
      return fetch(url, { headers: { Authorization: 'Bearer ' + tok } }).then(function (r) {
        return r.json().then(function (j) {
          if (r.status === 403 || r.status === 404) throw new Error(j && j.error && j.error.message ? explain(j.error) : 'Google refused: you may not have access to this.');
          if (!r.ok) throw new Error('Google answered with an error (' + r.status + ').');
          return j;
        });
      });
    });
  }
  function explain(e) {
    if (/has not been used|is disabled/i.test(e.message)) return 'This Google service is not switched on for Quiz Hall yet. Tell Dr Mompel Riera.';
    if (e.status === 'PERMISSION_DENIED') return 'Google says you may not open this. You must be an editor of the form.';
    if (e.status === 'NOT_FOUND') return 'Google cannot find it. Paste the address from the form\'s edit page.';
    return e.message;
  }

  /* ── Classroom ── */
  G.courses = function () {
    return get('https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE&pageSize=100')
      .then(function (j) { return (j.courses || []).map(function (c) { return { id: c.id, name: c.name, section: c.section || '' }; }); });
  };
  G.students = function (courseId) {
    var out = [];
    function page(tokenPart) {
      return get('https://classroom.googleapis.com/v1/courses/' + encodeURIComponent(courseId) + '/students?pageSize=100' + (tokenPart ? '&pageToken=' + encodeURIComponent(tokenPart) : ''))
        .then(function (j) {
          (j.students || []).forEach(function (s) {
            var p = s.profile || {};
            if (p.emailAddress) out.push({ email: p.emailAddress, name: (p.name && p.name.fullName) || p.emailAddress });
          });
          return j.nextPageToken ? page(j.nextPageToken) : out;
        });
    }
    return page('');
  };

  /* ── Forms ── */
  /* the form's id from the address of its EDIT page (…/forms/d/<id>/edit); the pupils' link (…/forms/d/e/…) cannot be read */
  G.formId = function (link) {
    link = String(link || '').trim();
    if (/\/forms\/d\/e\//.test(link)) return { error: 'That is the pupils\' link. Open the form to edit it, and copy the address from there.' };
    var m = /\/forms\/d\/([A-Za-z0-9_-]{20,})/.exec(link);
    if (m) return { id: m[1] };
    if (/^[A-Za-z0-9_-]{25,}$/.test(link)) return { id: link };
    return { error: 'That does not look like a Google Form address.' };
  };
  G.form = function (id) { return get('https://forms.googleapis.com/v1/forms/' + encodeURIComponent(id)); };

  var KIND_LABEL = { choice: 'One answer', checkbox: 'Tick boxes', short: 'Short answer', paragraph: 'Paragraph', info: 'Text', image: 'Picture', section: 'Section' };
  G.kindLabel = function (k) { return KIND_LABEL[k] || k; };

  /* A Google Form turned into Quiz Hall's own quiz, with a line for every part saying what came across.
     → { quiz: {title, description, questions}, report: [{n, title, kind, how, warn}], pictures: [{q, opt, url}], isQuiz } */
  G.toQuiz = function (form) {
    var info = form.info || {}, items = form.items || [], isQuiz = !!(form.settings && form.settings.quizSettings && form.settings.quizSettings.isQuiz);
    var questions = [], report = [], pictures = [], topic = '', n = 0;
    function text(t) { return t && t.text ? t.text : ''; }
    function push(q, line) { questions.push(q); if (line) report.push(line); }
    items.forEach(function (it, i) {
      var title = it.title || '', desc = it.description || '';
      if (it.pageBreakItem) { topic = title || topic; push({ id: 'p' + i, kind: 'section', title: title, help: desc }); return; }
      if (it.textItem) { push({ id: 'p' + i, kind: 'info', title: title, help: desc }); return; }
      if (it.imageItem) {
        var q0 = { id: 'p' + i, kind: 'image', title: title, help: desc, image: '' };
        if (it.imageItem.image && it.imageItem.image.contentUri) pictures.push({ q: questions.length, url: it.imageItem.image.contentUri });
        push(q0); return;
      }
      if (it.videoItem) { report.push({ n: '', title: title || 'A video', kind: 'Video', how: 'Not copied: a video cannot play in a locked quiz', warn: true }); return; }
      if (it.questionGroupItem) { report.push({ n: '', title: title || 'A grid', kind: 'Grid', how: 'Not copied: grids are not in this version', warn: true }); return; }
      var qi = it.questionItem;
      if (!qi || !qi.question) return;
      var qq = qi.question, gr = qq.grading || {}, q = { id: (qq.questionId || ('q' + i)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || ('q' + i), title: title, help: desc, topic: topic, image: '' };
      if (qi.image && qi.image.contentUri) pictures.push({ q: questions.length, url: qi.image.contentUri });
      q.points = isQuiz ? Number(gr.pointValue || 0) : 0;
      q.correct = isQuiz && gr.correctAnswers ? (gr.correctAnswers.answers || []).map(function (a) { return String(a.value); }) : [];
      q.fbRight = text(gr.whenRight); q.fbWrong = text(gr.whenWrong); q.fb = text(gr.generalFeedback);
      var line = { title: title, warn: false };
      if (qq.choiceQuestion) {
        var cq = qq.choiceQuestion;
        q.kind = cq.type === 'CHECKBOX' ? 'checkbox' : 'choice';
        q.options = [];
        (cq.options || []).forEach(function (o) {
          if (o.isOther) { line.note = 'The "Other" box is left out'; return; }
          if (o.image && o.image.contentUri) pictures.push({ q: questions.length, opt: q.options.length, url: o.image.contentUri });
          q.options.push({ label: String(o.value || ''), image: '' });
        });
      } else if (qq.textQuestion) {
        q.kind = qq.textQuestion.paragraph ? 'paragraph' : 'short';
      } else {
        var what = qq.scaleQuestion ? 'Linear scale' : qq.ratingQuestion ? 'Rating' : qq.dateQuestion ? 'Date' : qq.timeQuestion ? 'Time' : qq.fileUploadQuestion ? 'File upload' : 'This kind of question';
        report.push({ n: '', title: title, kind: what, how: 'Not copied: not in this version', warn: true });
        return;
      }
      n++;
      line.n = n; line.kind = KIND_LABEL[q.kind];
      if (!q.points) line.how = 'Not marked (no points)';
      else if (q.kind === 'paragraph') line.how = 'You mark this';
      else if (q.kind === 'short' && !q.correct.length) line.how = 'You mark this (no answer key)';
      else if (q.kind === 'short') line.how = 'At once; near misses come to you';
      else if (!q.correct.length) { line.how = 'You mark this (no answer key)'; }
      else line.how = 'At once, from the answer key';
      push(q, line);
    });
    return { quiz: { title: info.title || info.documentTitle || 'Untitled quiz', description: info.description || '', questions: questions },
             report: report, pictures: pictures, isQuiz: isQuiz };
  };
})(window);
