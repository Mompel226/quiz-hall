/* Quiz Hall settings. Both values are safe to publish: the back office checks every request itself.
   backOfficeUrl   the /exec address of the Quiz Hall Apps Script web app (Deploy > Manage deployments)
   googleClientId  the Google sign-in client the nlcsbiology.com sites share (labs js/config.js googleClientId) */
window.QH_CONFIG = {
  backOfficeUrl: 'https://script.google.com/macros/s/AKfycbwamfMr92H_S5DRXoGBkz6bJMTI7ohsLqKEIqgdYD6ZRI2gT5CZISoCZpAIIWt7N_sfUg/exec',
  googleClientId: '749068441640-jgh9s0rbg8ed9hl14mtv6kdhg5jg6ddf.apps.googleusercontent.com',
  /* the permissions a teacher gives once, to import a class from Google Classroom and a quiz from Google Forms */
  googleScopes: [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    'https://www.googleapis.com/auth/classroom.profile.emails',
    'https://www.googleapis.com/auth/forms.body.readonly'
  ]
};
