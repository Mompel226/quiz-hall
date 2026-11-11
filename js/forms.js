/* Quiz Hall — reading a teacher's Google Classroom and Google Forms, in the teacher's own browser, with the teacher's own
   permission (Google asks once). Nothing here reaches the back office except what the teacher then chooses to save: a class
   list, or a quiz turned into Quiz Hall's own shape. */
(function (global) {
  'use strict';
  var G = global.GoogleData = {};
  var CFG = global.QH_CONFIG || {};
  var access = {};              /* the scopes asked for → { token, until } */
  /* Making a Google Form from a quiz (11 Nov 2026) needs one permission more, asked for only then: drive.file, which reaches
     only the files Quiz Hall itself makes (never the teacher's other forms or files) */
  var MAKE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];
  G.MAKE_SCOPES = MAKE_SCOPES;

  /* Google's permission for Classroom and Forms, asked for only when the teacher imports something; `extra` adds scopes for
     one job (Google asks only for what was not given before) */
  G.token = function (extra) {
    var scope = (CFG.googleScopes || []).concat(extra || []).join(' '), a = access[scope];
    if (a && a.until > Date.now() + 60000) return Promise.resolve(a.token);
    return new Promise(function (resolve, reject) {
      if (!(global.google && google.accounts && google.accounts.oauth2)) return reject(new Error('Google is still loading. Try again in a moment.'));
      var who = global.SignIn && SignIn.who();
      var client = google.accounts.oauth2.initTokenClient({
        client_id: CFG.googleClientId, scope: scope, hint: who ? who.email : undefined, include_granted_scopes: true,
        callback: function (r) {
          if (!r || r.error || !r.access_token) return reject(new Error(r && r.error === 'access_denied' ? (extra ? 'Quiz Hall needs your permission to make the form in your Google Drive.' : 'Quiz Hall needs your permission to read your classes and forms.') : 'Google did not give permission.'));
          /* Google lets a teacher untick a box: without the extra one the form cannot be made */
          if (extra && google.accounts.oauth2.hasGrantedAllScopes && !google.accounts.oauth2.hasGrantedAllScopes.apply(null, [r].concat(extra)))
            return reject(new Error('Quiz Hall needs your permission to make the form in your Google Drive. Press the button again and tick that box.'));
          access[scope] = { token: r.access_token, until: Date.now() + (Number(r.expires_in) || 3000) * 1000 };
          resolve(r.access_token);
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

  /* ── a quiz made into a new Google Form (Daniel, 11 Nov 2026: share it "outside … creating a new Google form" for a
     teacher who does not use Quiz Hall) ──
     In the teacher's own Drive, with their own permission (drive.file). The form is made, then filled in ONE batch, which
     Google applies whole or not at all: first with the pictures; if Google cannot fetch them (they are shared with the
     school only), again without them; if that fails too, the empty form is deleted and the reason given. The form is a
     quiz in Google Forms: points, the answer key and the feedback come across; changes to it never come back to Quiz Hall.
     → { formId, editUrl, pictures: 'all' | 'none' | 'left out', count } */
  function send(method, url, body) {
    return G.token(MAKE_SCOPES).then(function (tok) {
      return fetch(url, { method: method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
        .then(function (r) {
          return r.text().then(function (t) {
            var j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; }
            if (!r.ok) {
              var m = j && j.error && j.error.message ? j.error.message : 'error ' + r.status;
              if (/has not been used|is disabled/i.test(m)) m = 'This Google service is not switched on for Quiz Hall yet. Tell Dr Mompel Riera.';
              var e = new Error('Google did not make the form: ' + m); e.google = true;   /* Google answered: nothing of that request went in */
              throw e;
            }
            return j;
          });
        });
    });
  }
  var PIC = function (id) { return 'https://lh3.googleusercontent.com/d/' + id; };
  /* the requests that fill the form, with or without pictures */
  G.formRequests = function (quiz, withPictures) {
    var reqs = [], at = 0, pics = 0;
    if (quiz.description) reqs.push({ updateFormInfo: { info: { description: String(quiz.description) }, updateMask: 'description' } });
    reqs.push({ updateSettings: { settings: { quizSettings: { isQuiz: true } }, updateMask: 'quizSettings.isQuiz' } });
    function words(q) {                               /* an item's title is one line: the rest goes in its description */
      var t = String(q.title || '').replace(/\r/g, ''), i = t.indexOf('\n'), d = String(q.help || '');
      if (i >= 0) { d = t.slice(i + 1).trim() + (d ? '\n\n' + d : ''); t = t.slice(0, i); }
      var o = { title: t.trim() }; if (d.trim()) o.description = d.trim();
      return o;
    }
    function add(item) { reqs.push({ createItem: { item: item, location: { index: at++ } } }); }
    (quiz.questions || []).forEach(function (q) {
      var item = words(q);
      if (q.kind === 'section') { item.pageBreakItem = {}; return add(item); }
      if (q.kind === 'info') { if (!item.title && !item.description) return; item.textItem = {}; return add(item); }
      if (q.kind === 'image') {
        if (!q.image) return;
        pics++; if (!withPictures) return;
        item.imageItem = { image: { sourceUri: PIC(q.image) } }; return add(item);
      }
      if (['choice', 'checkbox', 'short', 'paragraph'].indexOf(q.kind) < 0) return;
      var question = { required: false }, grading = q.points ? { pointValue: Math.round(q.points) } : null, correct = q.correct || [];
      if (q.kind === 'choice' || q.kind === 'checkbox') {
        var seen = {}, as = {}, opts = (q.options || []).map(function (o, i) {
          var v = String(o.label || '').replace(/\s+/g, ' ').trim() || ('Option ' + (i + 1)), base = v, n = 2;
          while (seen[v.toLowerCase()]) v = base + ' (' + (n++) + ')';      /* Google refuses two options alike */
          seen[v.toLowerCase()] = 1; as[o.label] = as[o.label] || v;
          var opt = { value: v };
          if (o.image) { pics++; if (withPictures) opt.image = { sourceUri: PIC(o.image) }; }
          return opt;
        });
        if (!opts.length) return;
        question.choiceQuestion = { type: q.kind === 'checkbox' ? 'CHECKBOX' : 'RADIO', options: opts };
        var keys = correct.map(function (c) { return as[c]; }).filter(Boolean);
        if (q.kind === 'choice') keys = keys.slice(0, 1);                   /* one right answer in a multiple choice */
        if (grading && keys.length) {
          grading.correctAnswers = { answers: keys.map(function (v) { return { value: v }; }) };
          if (q.fbRight || q.fb) grading.whenRight = { text: String(q.fbRight || q.fb) };
          if (q.fbWrong || q.fb) grading.whenWrong = { text: String(q.fbWrong || q.fb) };
        } else if (grading && (q.fb || q.fbRight)) grading.generalFeedback = { text: String(q.fb || q.fbRight) };
      } else {
        question.textQuestion = { paragraph: q.kind === 'paragraph' };
        if (grading && q.kind === 'short' && correct.length) grading.correctAnswers = { answers: correct.map(function (v) { return { value: String(v) }; }) };
        if (grading && (q.fb || q.fbRight)) grading.generalFeedback = { text: String(q.fb || q.fbRight) };
      }
      if (grading) question.grading = grading;
      item.questionItem = { question: question };
      if (q.image) { pics++; if (withPictures) item.questionItem.image = { sourceUri: PIC(q.image) }; }
      add(item);
    });
    return { requests: reqs, pictures: pics };
  };
  G.makeForm = function (quiz) {
    var title = String(quiz.title || 'Quiz').slice(0, 300);
    return send('POST', 'https://forms.googleapis.com/v1/forms', { info: { title: title, documentTitle: title } }).then(function (f) {
      var id = f.formId, url = 'https://forms.googleapis.com/v1/forms/' + encodeURIComponent(id) + ':batchUpdate';
      var full = G.formRequests(quiz, true), done = { formId: id, editUrl: 'https://docs.google.com/forms/d/' + id + '/edit', count: full.pictures };
      return send('POST', url, { requests: full.requests }).then(function () { done.pictures = full.pictures ? 'all' : 'none'; return done; }, function (e) {
        if (!full.pictures || !e.google) throw e;
        return send('POST', url, { requests: G.formRequests(quiz, false).requests }).then(function () { done.pictures = 'left out'; return done; });
      }).catch(function (e) {
        /* Google refused: nothing went in, so the empty form is deleted (drive.file reaches it, as Quiz Hall made it). The
           connection dropped instead: it may have gone in, so nothing is sent again and nothing deleted. */
        if (!e.google) throw new Error('The connection dropped while Google was making the form. Look in your Google Drive for “' + title + '” before you try again.');
        return send('DELETE', 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id)).catch(function () {}).then(function () { throw e; });
      });
    });
  };

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
      if (it.questionGroupItem) { report.push({ n: '', title: title || 'A grid', kind: 'Grid', how: 'Not copied: Quiz Hall cannot run a grid question', warn: true }); return; }
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
        report.push({ n: '', title: title, kind: what, how: 'Not copied: Quiz Hall cannot run this kind of question', warn: true });
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
