/* Quiz Hall — talking to the back office.
   Every request is text/plain JSON (no browser pre-flight), carrying Google's sign-in while it is fresh and, for a pupil,
   Quiz Hall's own pass (kept under quizhall.pass, apart from the labs' biology.pass). The back office decides everything;
   nothing here is trusted. */
(function (global) {
  'use strict';
  var API = global.API = {};
  var CFG = global.QH_CONFIG || {};
  var PASS_KEY = 'quizhall.pass';

  function store() { try { return global.localStorage; } catch (e) { return null; } }
  function getPass() {
    var s = store(); if (!s) return null;
    try { var v = JSON.parse(s.getItem(PASS_KEY) || 'null'); return v && v.pass && v.email && v.exp > Date.now() ? v : null; } catch (e) { return null; }
  }
  API.dropPass = function () { var s = store(); if (s) try { s.removeItem(PASS_KEY); } catch (e) {} };
  function setPass(email, p) { var s = store(); if (s) try { s.setItem(PASS_KEY, JSON.stringify({ email: email, pass: p.pass, exp: p.exp, got: Date.now() })); } catch (e) {} }

  API.ready = function () { return !!CFG.backOfficeUrl; };

  function post(body) {
    return fetch(CFG.backOfficeUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('The back office did not answer (' + r.status + ').'); return r.json(); });
  }
  function renew() {
    return new Promise(function (resolve) {
      if (!global.SignIn) return resolve(null);
      SignIn.renew(CFG.googleClientId, function (v) { resolve(v); }, 5 * 60 * 1000);
    });
  }

  /* API.call('classes.list', {…}) → the answer, or an Error with the reason the back office gave.
     A stale Google sign-in is renewed once without a click when Google allows; "busy" is tried again. */
  API.call = function (action, data, opts) {
    opts = opts || {};
    var tries = 0;
    function attempt() {
      var live = global.SignIn ? SignIn.live() : null, who = global.SignIn ? SignIn.who() : null, pass = getPass();
      var body = Object.assign({}, data || {}, { action: action });
      if (live) body.token = live.token;
      if (pass && who && pass.email === who.email) body.pass = pass.pass;
      if (!opts.quiet) UI.busy(true);
      return post(body).then(function (r) {
        if (!opts.quiet) UI.busy(false);
        if (r && r.ok) return r;
        if (r && r.busy && tries < 4) { tries++; return new Promise(function (res) { setTimeout(res, 1500 + Math.random() * 2000); }).then(attempt); }
        if (r && r.signin && tries < 1) {
          tries++;
          return renew().then(function (v) {
            if (v) return attempt();
            var e = new Error('Please sign in again.'); e.signin = true; throw e;
          });
        }
        var err = new Error((r && r.why) || 'Something went wrong. Please try again.');
        if (r && r.signin) err.signin = true;
        throw err;
      }, function (e) {
        if (!opts.quiet) UI.busy(false);
        if (tries < 2 && !opts.noRetry) { tries++; return new Promise(function (res) { setTimeout(res, 1200); }).then(attempt); }
        var err = new Error('No connection to Quiz Hall. Check the internet and try again.'); err.offline = true; throw err;
      });
    }
    return attempt();
  };

  /* a pupil's pass, asked for while Google's sign-in is fresh, once a day */
  API.refreshPass = function () {
    if (!global.SignIn) return;
    var live = SignIn.live(), p = getPass();
    if (!live) return;
    if (p && p.email === live.email && p.got && Date.now() - p.got < 864e5) return;
    API.call('pass', {}, { quiet: true, noRetry: true }).then(function (r) { setPass(live.email, r); }, function () {});
  };
})(window);
