/* Quiz Hall — start: sign in once (the site-wide sign-in of nlcsbiology.com), ask the back office who this is, then open
   the teacher's pages or the pupil's. One address for everyone: nlcsbiology.com/quiz-hall. */
(function (global) {
  'use strict';
  var CFG = global.QH_CONFIG || {};
  var el = UI.el, $ = UI.$;
  var started = false;

  function showSignIn(note) {
    if (global.Teacher && Teacher.stop) Teacher.stop();
    if (global.Pupil && Pupil.stop) Pupil.stop();
    if (location.hash) history.replaceState(null, '', location.pathname);
    $('nav').hidden = true; $('who').hidden = true; $('signOut').hidden = true;
    var app = UI.clear($('app'));
    app.appendChild(el('section', { class: 'panel signin', id: 'signinPanel' }, [
      el('h1', {}, 'Quiz Hall'),
      el('p', { class: 'lead' }, 'Teachers run their Google Forms quizzes here as locked quizzes. Pupils sit them here.'),
      el('div', { id: 'gbtn', class: 'gbtn' }),
      el('p', { class: 'small', id: 'signinNote' }, note || 'Sign in with your school Google account.')]));
    SignIn.loaded(function (ok) {
      if (!ok) { $('signinNote').textContent = 'Google\'s sign-in did not load. Check the internet connection, then reload this page.'; return; }
      SignIn.button($('gbtn'), CFG.googleClientId, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'en-GB' });
    }, 12000);
  }

  function enter() {
    if (!API.ready()) { showSignIn('Quiz Hall is not set up yet: its back office address is missing.'); return; }
    var who = SignIn.who();
    if (!who) { showSignIn(); return; }
    $('who').textContent = who.name || who.email; $('who').hidden = false; $('signOut').hidden = false;
    var app = UI.clear($('app'));
    app.appendChild(el('p', { class: 'muted' }, 'Opening Quiz Hall…'));
    API.call('me', {}).then(function (me) {
      started = true;
      if (me.role === 'teacher') { global.Teacher.start(me); return; }
      if (me.role === 'pupil') { API.refreshPass(); global.Pupil.start(me); return; }
      UI.clear(app).appendChild(el('section', { class: 'panel signin' }, [el('h1', {}, 'Quiz Hall'),
        el('p', {}, 'This address (' + me.email + ') is not on a Quiz Hall class list or the teachers\' list.'),
        el('p', { class: 'small' }, 'Pupils: ask your teacher to add you to the class in Quiz Hall. Teachers: ask Dr Mompel Riera to add your school address.'),
        el('button', { class: 'btn', type: 'button', onclick: function () { SignIn.out(); } }, 'Use another account')]));
    }, function (e) {
      if (e.signin) { showSignIn('Your sign-in has run out. Please sign in again.'); return; }
      UI.clear(app).appendChild(el('div', { class: 'notice notice--bad' }, [e.message, ' ', el('button', { class: 'btn btn--small', type: 'button', onclick: enter }, 'Try again')]));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    SignIn.setUp(CFG.googleClientId);
    SignIn.on(function (v, here) {
      if (v && !started) enter();
      else if (!v) { started = false; API.dropPass(); showSignIn(); }
    });
    $('signOut').addEventListener('click', function () { SignIn.out(); });
    if (SignIn.who()) {
      /* a remembered sign-in: renew it first when Google allows (a pupil may also go on with Quiz Hall's own pass) */
      if (SignIn.live()) enter();
      else SignIn.loaded(function () { SignIn.renew(CFG.googleClientId, function () { enter(); }); }, 8000);
    } else showSignIn();
  });
})(window);
