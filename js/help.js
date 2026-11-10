/* Quiz Hall — the Help page. Daniel, 10 Nov 2026: teachers "cannot test it" without pupils, so Help shows what they and
   their pupils will see, with pictures of a made-up class (Ms Rivera's 10A and 11B Physics; every name invented) taken
   from the website itself by the harness's quizhall_help_shots.mjs and cut to the part each sentence is about. Every
   orange pin on a picture is a (n) in its text (memory figures-must-earn-their-place). Task first (memory
   teacher-help-task-first): the first quiz in seven steps, each with "Show me", then what pupils see, then a card per job,
   problems, and what is rarely needed last. Every button name is copied from the pages' code; change a page, change its
   card here and take the pictures again. */
(function (global) {
  'use strict';
  var H = global.Help = {};
  var el = UI.el;
  var V = '2';                      /* raise when the pictures in assets/help/ are taken again */

  /* "Press **Start now** (6)." → text, bold names, and (n) drawn like the pin it points to */
  function rich(s) {
    var out = [];
    String(s).split(/(\*\*[^*]+\*\*|\(\d\))/).forEach(function (part) {
      if (!part) return;
      var b = /^\*\*([^*]+)\*\*$/.exec(part), n = /^\((\d)\)$/.exec(part);
      if (b) out.push(el('strong', {}, b[1]));
      else if (n) out.push(el('span', { class: 'pinref', 'aria-label': 'mark ' + n[1] + ' on the picture' }, n[1]));
      else out.push(part);
    });
    return out;
  }
  function p(s, cls) { return el('p', { class: cls || null }, rich(s)); }
  function list(items, ordered) { return el(ordered ? 'ol' : 'ul', { class: 'hlist' }, items.map(function (s) { return el('li', {}, rich(s)); })); }
  function example(lines) { return el('div', { class: 'hexample' }, [el('strong', {}, 'For example'), list(lines)]); }
  function lock(s) { return el('p', { class: 'hlock' }, [el('span', { 'aria-hidden': 'true' }, '🔒 ')].concat(rich(s))); }

  /* a picture, pressed to see it full size */
  function pic(name, alt, caption) {
    var img = el('img', { src: 'assets/help/' + name + '.webp?v=' + V, alt: alt, loading: 'lazy', decoding: 'async' });
    var btn = el('button', { class: 'shot__btn', type: 'button', 'aria-label': 'See it full size: ' + alt }, img);
    btn.addEventListener('click', function () { zoom(img.src, alt); });
    return el('figure', { class: 'shot' }, [btn, caption ? el('figcaption', {}, rich(caption)) : null]);
  }
  function zoom(src, alt) {
    var back = el('div', { class: 'zoom', role: 'dialog', 'aria-modal': 'true', 'aria-label': alt });
    var close = el('button', { class: 'btn zoom__close', type: 'button' }, 'Close');
    back.appendChild(close);
    back.appendChild(el('img', { src: src, alt: alt }));
    function done() { back.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') done(); }
    close.addEventListener('click', done);
    back.addEventListener('click', function (e) { if (e.target === back) done(); });
    document.addEventListener('keydown', key);
    document.body.appendChild(back);
    close.focus();
  }
  /* a job: its name, where it is, then the words beside the picture (the picture on the right on a wide screen) */
  function card(id, title, where, words, figure) {
    var d = el('details', { class: 'hcard', id: id });
    d.appendChild(el('summary', {}, [el('span', { class: 'hcard__t' }, title), where ? el('span', { class: 'hcard__w' }, where) : null]));
    d.appendChild(el('div', { class: 'hcard__body' + (figure ? ' hcard__body--pic' : '') }, [el('div', { class: 'hcard__words' }, words), figure || null]));
    return d;
  }
  /* several pictures of one page, one at a time: a button for each, its own words under the picture */
  function views(items) {
    var wrap = el('div', { class: 'hviews' }), bar = el('div', { class: 'hviews__bar', role: 'group', 'aria-label': 'Which view' }), stage = el('div');
    function show(i) {
      Array.prototype.forEach.call(bar.children, function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
      UI.clear(stage);
      stage.appendChild(p(items[i].words));
      stage.appendChild(pic(items[i].pic, items[i].alt));
    }
    items.forEach(function (it, i) {
      var b = el('button', { class: 'btn btn--small', type: 'button' }, it.label);
      b.addEventListener('click', function () { show(i); });
      bar.appendChild(b);
    });
    wrap.appendChild(bar); wrap.appendChild(stage);
    show(0);
    return wrap;
  }
  /* a kind of section (Daniel, 10 Nov 2026: "easier to see the different kind of sections"): its own colour, a tinted
     band, its name and what it covers; the cards go inside it */
  function section(app, kind, id, title, sub) {
    var sec = el('section', { class: 'hsec hsec--' + kind, id: id, 'aria-labelledby': id + '-t' });
    sec.appendChild(el('div', { class: 'hsec__head' }, [el('h2', { id: id + '-t' }, title), el('p', {}, sub)]));
    app.appendChild(sec);
    return sec;
  }
  function openCard(id) {
    var d = document.getElementById(id);
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var s = d.querySelector('summary'); if (s) s.focus({ preventScroll: true });
  }

  H.draw = function (app) {
    app.appendChild(el('div', { class: 'head' }, el('h1', {}, 'Help')));
    var toc = el('nav', { class: 'htoc', 'aria-label': 'On this page' });
    [['start', 'h-s-start', 'Your first quiz'], ['pupils', 'h-s-pupils', 'What pupils see'], ['before', 'h-s-before', 'Before'],
     ['during', 'h-s-during', 'During'], ['after', 'h-s-after', 'After'], ['classes', 'h-s-classes', 'Your classes'],
     ['trouble', 'h-s-trouble', 'Problems'], ['know', 'h-s-know', 'Good to know']].forEach(function (t) {
      var a = el('button', { class: 'htoc__a htoc__a--' + t[0], type: 'button' }, t[2]);
      a.addEventListener('click', function () { var x = document.getElementById(t[1]); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      toc.appendChild(a);
    });
    app.appendChild(p('What you and your pupils will see, page by page. The pictures show a made-up teacher, Ms Rivera, with two made-up classes, so you can see every page before your first real quiz. Press a picture to see it full size.', 'hlede'));
    app.appendChild(toc);

    /* ── the first quiz ── */
    var steps = [
      ['Import your class', '**My classes** ▸ **Import from Google Classroom**. Google asks once for permission.', 'h-classes'],
      ['Add your quiz', '**My quizzes** ▸ **Add a quiz from a Google Form**: paste the address of the form as you see it when you edit it.', 'h-add'],
      ['Try it as a pupil', 'Open the quiz ▸ **Try it as a pupil**. You sit it exactly as a pupil will. Nothing is saved.', 'h-quiz'],
      ['Run it', '**Run a quiz**: the quiz, the class, the length and the test mode, then **Start now**.', 'h-run'],
      ['Watch it live', 'The live page opens by itself: who is writing, who is locked, who has handed in.', 'h-live'],
      ['Mark the written answers', '**To mark**: one question at a time for the whole class, one key press per mark.', 'h-mark'],
      ['Release the answers, then look at the results', '**Release the answers** on the live page once the quiz is closed. **Results**: the class, each question, each topic, each pupil.', 'h-results']
    ];
    var ol = el('ol', { class: 'hsteps' });
    steps.forEach(function (s) {
      var more = el('button', { class: 'btn btn--small', type: 'button' }, 'Show me');
      more.addEventListener('click', function () { openCard(s[2]); });
      ol.appendChild(el('li', {}, [el('div', {}, [el('span', { class: 'hsteps__t' }, s[0]), el('span', { class: 'hsteps__d' }, rich(s[1]))]), more]));
    });
    app.appendChild(el('section', { class: 'panel hstart', id: 'h-s-start' }, [el('h2', {}, 'Your first quiz in seven steps'), ol]));
    var box = null;

    /* ── what pupils see ── */
    box = section(app, 'pupils', 'h-s-pupils', 'What your pupils see', 'From the card on nlcsbiology.com to their answers, in six steps.');
    var flow = [
      ['p-hub-card', 'On nlcsbiology.com', 'Signed in on nlcsbiology.com with their school account, a pupil sees this card within about ten seconds of **Start now**, with no reload. **Open Quiz Hall** takes them to step 2. A pupil who opens your Google Classroom link, or a bookmark of nlcsbiology.com/quiz-hall, goes straight to step 2.', 'The front page of nlcsbiology.com with the Quiz open now card'],
      ['p-home', 'Their quizzes', 'Your quiz with your name, the class, the number of questions and the time. The blue box says what to do before **Begin** (switch off Grammarly and any AI extension; on a Mac, one setting in Chrome) and what makes the quiz lock. It follows your test mode: in open book it says that nothing is watched.', 'A pupil\'s first page in Quiz Hall: the quiz, the blue box and Begin'],
      ['p-quiz', 'The quiz', 'The time left and the last save stay at the top, with **Hand in**. Each answer is kept on the pupil\'s computer at once and sent to Quiz Hall about every 90 seconds, so a dropped connection loses nothing.', 'The quiz page: the time left, Saved, Full screen and Hand in above the questions'],
      ['p-lock', 'Locked', 'If the pupil leaves the quiz page (another tab or window, Shift and Command together, 15 seconds offline), the quiz locks and the live page shows it. Their answers are kept. When you press **Unlock**, their quiz opens again within a few seconds.', 'The quiz page behind a box: Your quiz is locked'],
      ['p-handed', 'Handed in', 'Their score comes at once. If some answers are yours to mark, it says "so far" and that the score can still go up.', 'Handed in: Your score: 5 of 5'],
      ['p-answers', 'After you release the answers', 'Each pupil sees every question, their answer, the right answer and your comment. Until you press **Release the answers**, they see only their score.', 'A pupil\'s answers page: each question with their answer and the right answer']
    ];
    var fl = el('ol', { class: 'pflow' });
    flow.forEach(function (f) {
      fl.appendChild(el('li', { class: 'pflow__step' }, [el('div', { class: 'pflow__words' }, [el('h3', {}, f[1]), p(f[2])]), pic(f[0], f[3])]));
    });
    box.appendChild(fl);

    /* ── before the quiz ── */
    box = section(app, 'before', 'h-s-before', 'Before the quiz', 'Once for each class and each quiz.');
    box.appendChild(card('h-classes', 'Import a class from Google Classroom', 'My classes', [
      p('**My classes** ▸ **Import from Google Classroom** lists your classes in Google Classroom. Choose one and it comes with its pupils. Google asks you once to let Quiz Hall read your classes.'),
      p('Press a class to open its page:'),
      list(['(1) **Extra time** for a pupil: None, +10 %, +25 % or +50 %. Quiz Hall adds it to every quiz they sit, and the live page shows it beside their name.',
            '(2) **Check against Classroom** makes the list match Google Classroom again: new pupils in, leavers out.',
            '**Add a pupil by hand**, under the list, for a pupil not yet in Google Classroom. This changes Quiz Hall\'s list only.']),
      lock('Only you see and change your classes, and only your classes appear when you run a quiz.')
    ], pic('t-class', 'A class page: the pupils, their extra time, Check against Classroom and Add a pupil by hand')));

    box.appendChild(card('h-add', 'Add a quiz from a Google Form', 'My quizzes', [
      list(['Open your form in Google Forms, as when you edit it, and copy the address at the top of the browser.',
            '**My quizzes** ▸ **Add a quiz from a Google Form**: paste it and press **Read the form**.',
            'Check what came across, then **Add to my library**.'], true),
      p('Quiz Hall copies the form once: the questions, the points, the answer key and the pictures. The table shows how each question will be marked:'),
      list(['**One answer** and **Tick boxes**: at once, from the form\'s answer key.',
            '**Short answer**: at once; an answer close to the key (a near miss) comes to you to decide.',
            '**Paragraph**: you mark it after the quiz.']),
      p('**Left out:** lists anything Quiz Hall cannot run, such as a grid, a linear scale or an "Other" box. The form\'s sections become topics; change a topic here if you wish, because topics group the results.'),
      example(['You changed the form after adding it: open the quiz ▸ **Import the form again**. It becomes version 2; pupils who sat version 1 keep it.']),
      lock('Quiz Hall can read only a form you can edit. The pupils\' link (…/forms/d/e/…) does not work: copy the address of the editing page.')
    ], pic('t-add', 'Add a quiz from a Google Form: the form\'s address, then each question with how it is marked and its topic')));

    box.appendChild(card('h-quiz', 'Your quiz: try it, share it, change it', 'My quizzes ▸ a quiz', [
      list(['(1) **Run this quiz** opens Run a quiz with this quiz chosen.',
            '(2) **Try it as a pupil**: answer, try the lock, hand in, and see the score and the answers page, as a pupil will. Nothing is saved.',
            '(3) The versions: each change keeps the old version. Pupils always keep the version they sat.',
            '(4) **Change the key or points** fixes a wrong key or a mark; it saves a new version.',
            '(5) **Share**: type a colleague\'s school address, or your department (for example Physics). They can run the quiz for their own classes and see only their own results. Only you can change it.',
            '(6) **Move to the bin** takes it out of your list; open it from **In the bin** and press **Take out of the bin** to bring it back.']),
      p('Below the buttons, every question with its key, its points, its topic and how it is marked.')
    ], pic('t-quiz', 'A quiz\'s page: Run this quiz, Try it as a pupil, the versions, Change the key or points, Share, Move to the bin')));

    box.appendChild(card('h-groups', 'Put your quizzes into groups', 'My quizzes ▸ Organise', [
      p('Press **Organise** (the first time: **Organise into groups**):'),
      list(['(1) Type a name, for example "Topic 1 · Motion", and press **Add the group**.',
            '(2) Change a group\'s name here.',
            '(3) Move a group up or down.',
            '(4) **Delete group**: its quizzes go to "Not in a group". No quiz is ever deleted.',
            '(5) Choose each quiz\'s group.']),
      p('Press **Done**. Press a group\'s name to fold it away; this computer remembers it. **Run a quiz** lists your quizzes in the same groups.'),
      lock('Your groups are your own. A colleague\'s shared quiz goes into your group without changing theirs.')
    ], pic('t-organise', 'My quizzes while organising: a new group, each group\'s name, up and down, Delete group, and each quiz\'s Group')));

    /* ── during the quiz ── */
    box = section(app, 'during', 'h-s-during', 'During the quiz', 'Starting a quiz and watching it live.');
    box.appendChild(card('h-today', 'Today, your first page', 'Today', [
      p('Each time you open Quiz Hall:'),
      list(['(1) **Running now**: each quiz that is open, how many have handed in and are writing, and until when pupils can begin. **Open live page**.',
            '(2) **Waiting to be marked**: each quiz with answers for you. **Mark now**.',
            '(3) The number beside **To mark** in the menu is how many answers wait, in all your quizzes.']),
      p('Below them, **Recent quizzes**: press **See it** for a quiz\'s results.')
    ], pic('t-today', 'Today: Running now, Waiting to be marked, and the number of answers to mark in the menu')));
    box.appendChild(card('h-run', 'Run a quiz and choose the test mode', 'Run a quiz', [
      list(['(1) The quiz, (2) the class, (3) the length in minutes.',
            '(4) **Start**: **Now**, or **At a time I choose**: until then pupils see it as "soon", with no way in.',
            '(5) **Test mode**: the Test System\'s four switches. **Track + warn** watches leaving the page, Shift + Command and going offline, and warns the pupil; off, it is open book. **Block actions** stops copy, paste and right-click. **Auto-lock** locks a pupil who leaves the page until you unlock them; off, leaving is only recorded for you. **Require full screen** opens the quiz in full screen and waits while a pupil is out of it.',
            '(6) **Start now**: the live page opens.',
            '(7) **Copy the link for pupils**, to paste into Google Classroom.']),
      example(['An end-of-topic test: all four switches on.',
               'A quick check in class, where looking at notes does not matter: Track + warn off (open book).',
               'A class with weak Wi-Fi: Auto-lock off. Nobody is locked; you still see who left the page.']),
      p('This computer remembers your last test mode for the next quiz.', 'small')
    ], pic('t-run', 'Run a quiz: the quiz, the class, the length, the start, the four test mode switches, Start now and Copy the link for pupils')));

    box.appendChild(card('h-live', 'The live page', 'Opens after Start now · later: Today ▸ Running now ▸ Open live page', [
      p('It checks every few seconds. Each row is a pupil: **Writing**, **Locked** (with the reason, for example "left the page"), **Not begun** or **Handed in**, with their time left, score and number of locks.'),
      list(['(1) **Test mode** can change while the quiz runs. Pupils\' pages take the change at their next save, within two minutes.',
            '(2) How many have handed in, are writing, are locked and have not begun.',
            '(3) **Unlock** opens a locked pupil\'s quiz again. They have 45 seconds in which leaving does not lock again.',
            '(4) **+5 min**: five more minutes for that pupil.',
            '(5) **Close now** ends the quiz; the saved answers of pupils still writing are handed in.',
            '(6) **Copy the link for pupils**.'])
    ], pic('t-live', 'The live page: the test mode, the counts, and each pupil with Unlock and +5 min')));

    /* ── after the quiz ── */
    box = section(app, 'after', 'h-s-after', 'After the quiz', 'Marking, releasing the answers, and the results.');
    box.appendChild(card('h-mark', 'Mark the written answers', 'To mark (the number beside it is how many wait)', [
      p('**To mark** lists each question with answers waiting: paragraphs, and short answers close to the key. Press **Mark**.'),
      list(['The model answer from your form is at the top.',
            'The same answer written by several pupils is marked once: "11 pupils wrote this".',
            'Keys: press 0–3 to give the mark (the next answer opens by itself); ↑ and ↓ to move; C to write a comment. A mark or a comment goes to every pupil who wrote that answer.']),
      p('Each mark is saved as you give it. The pupils\' scores and Results follow.')
    ], pic('t-mark', 'Marking one question: the model answer, then each different answer with the pupils who wrote it, the marks and a comment')));

    box.appendChild(card('h-release', 'Release the answers', 'The live page, once the quiz is closed', [
      p('**Release the answers** lets each pupil see every question, their answer, the right answer and your comments (step 6 of what pupils see). **Hide the answers again** undoes it.'),
      lock('Only after the quiz is closed, so that pupils still writing never see the answers.')
    ]));

    box.appendChild(card('h-results', 'Results', 'Results ▸ choose the class', [
      views([
        { label: 'Class', pic: 't-results-class', alt: 'Results, Class: each pupil\'s percentage in each quiz, and the class average over time',
          words: 'Each pupil\'s score in each quiz as a percentage: the darker, the higher. A * means answers are still to mark, and the percentage counts only the marks given so far. Point at a cell for the details; press a name or a quiz to open it. Below: the class average over time.' },
        { label: 'Quiz', pic: 't-results-quiz', alt: 'Results, Quiz: each question with the share of marks the class earned and the most common wrong answer',
          words: 'One quiz: who handed in, the class average and the typical time, then each question from the lowest share of marks, with the wrong answer most pupils chose. **Mark the rest** opens To mark.' },
        { label: 'Topics', pic: 't-results-topics', alt: 'Results, Topics: the share of marks in each topic, weakest first',
          words: 'Every quiz this class has sat, by topic, weakest first. Topics come from your form\'s sections, or what you typed when you added the quiz.' },
        { label: 'Pupil', pic: 't-results-pupil', alt: 'Results, Pupil: one pupil against the class average, quiz by quiz',
          words: 'One pupil against the class, quiz by quiz, their weakest topics, and the marks they lost in the last three quizzes, with what they answered.' },
        { label: 'Who to check on', pic: 't-results-check', alt: 'Results, Who to check on: pupils whose recent quizzes stand out, with the reason',
          words: 'Pupils whose recent quizzes stand out: well below the class, further down against the class in three quizzes running, or two quizzes not handed in. A reason to look, never a verdict.' }
      ]),
      p('**Download** gives the view you are on as a spreadsheet file (CSV).', 'small')
    ]));

    /* ── classes ── */
    box = section(app, 'classes', 'h-s-classes', 'Your classes', 'When a class ends.');
    box.appendChild(card('h-remove', 'Remove a class, bring it back, or delete it for good', 'My classes', [
      list(['**Remove** (or **Remove this class** on its page) takes a class you no longer teach off your lists. Nothing is deleted: its results stay, and a quiz already running for it goes on.',
            '**Bring back**, under **Removed classes** at the bottom of My classes, undoes it.',
            '**Delete for good**, beside Bring back, deletes the class with all its results. It cannot be undone.'])
    ]));

    /* ── problems ── */
    box = section(app, 'trouble', 'h-s-trouble', 'When something goes wrong', 'The usual reasons, and what to do.');
    [['A pupil says no quiz is showing', ['Check, in this order: they are signed in with their school account, not a personal Gmail; they are on the class list (My classes ▸ the class); the quiz has started (Today ▸ Running now); the time to begin has not passed (the live page says until when).', 'Their page checks every ten seconds or so; a reload checks at once.']],
     ['A pupil is locked again and again', ['Usually Grammarly or another extension, or a Mac showing its toolbar in full screen: the two steps in the blue box before Begin.', 'For that quiz, turn **Auto-lock** off on the live page. Leaving the page is still recorded for you.']],
     ['A pupil\'s internet dropped', ['Their answers are kept on their computer and sent when the connection comes back. After 15 seconds offline the quiz locks (with Auto-lock on): unlock them when they are back online.']],
     ['A pupil is on a phone, an iPad or Safari', ['Quiz Hall does not open a quiz there: pupils need Google Chrome on a laptop or a Chromebook.']],
     ['The form will not come in', ['Copy the address of the form\'s editing page (…/forms/d/…/edit), not the pupils\' link (…/forms/d/e/…). You must be able to edit the form.']],
     ['A colleague\'s quiz is not in My quizzes', ['Ask them to open the quiz ▸ **Share** and type your address or your department.']]
    ].forEach(function (q, i) { box.appendChild(card('h-p' + i, q[0], '', q[1].map(function (s) { return p(s); }))); });

    /* ── rarely needed ── */
    box = section(app, 'know', 'h-s-know', 'Good to know', 'Rarely needed.');
    box.appendChild(card('h-kept', 'What is kept, who sees it, and for how long', '', [
      list(['Marks are kept. Written answers are kept until 31 July, the end of the school year; on 1 August the words are deleted and the marks stay. Download any you want to keep before then (**Results** ▸ **Download**).',
            'You see only your own classes and results. A pupil sees only their own. A colleague who runs your shared quiz sees only their own results.',
            'Changing a quiz makes a new version. Pupils who already sat it keep the version they sat.',
            'Pupils\' pages save every 90 seconds or so, and at once on Hand in.'])
    ]));
  };
})(window);
