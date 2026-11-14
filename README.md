# Quiz Hall

Made by Dr Daniel Mompel Riera.

**Run your Google Forms quizzes as locked quizzes in class, and see how every pupil is doing.**
Open it at <https://nlcsbiology.com/quiz-hall/>.

## For teachers

1. **Import a class** from Google Classroom, or all your classes at once; a class already in Quiz Hall is never added twice.
2. **Add a quiz** by pasting the address of a Google Form you edit, or several addresses at once. Quiz Hall copies it once:
   questions, points, the answer key and the pictures. One box can give every question the same topic.
3. **Try it as a pupil** first, if you like: you see it exactly as pupils will, and nothing is saved.
4. **Organise** My quizzes in your own groups (Topic 1, Topic 2 …): press a group's name to fold it away. A colleague's
   shared quiz goes in your group without changing theirs, and deleting a group keeps its quizzes. Each quiz has Open,
   Run, Share and Move to the bin. **Share** with colleagues or a department in Quiz Hall, or as a new Google Form in your
   own Drive for a teacher who does not use Quiz Hall.
5. **Run it** for a class: choose the length and the test mode (as in the Test System: Track + warn, Block actions,
   Auto-lock, Require full screen) and when pupils see the right answers (as soon as they hand in, or when you release
   them), and press Start now. Pupils signed in on nlcsbiology.com see a Quiz card on its
   front page within a few seconds, or they open this website (Copy the link for pupils, to paste into Google Classroom),
   on a laptop in Chrome, with their school account.
6. **The quiz locks** if a pupil leaves the page (unless you turned Auto-lock or Track + warn off): another tab or window, or closing the page or going to another page and then opening the quiz again. A reload of the page goes straight back in. You unlock them on the live page.
7. **Marking**: choice questions and short answers are marked at once from the form's key. Paragraph answers, and short
   answers close to the key, wait for you on one screen, one key press per mark.
8. **Results**: your class quiz by quiz, each question, each topic, each pupil over time, and who to check on. The × under
   a quiz removes that quiz's results for that class, after asking; nothing else changes.

**Help** (in the menu) shows every page you and your pupils will see, with pictures of a made-up class, so you can see it
all before your first real quiz.

Only teachers on the Quiz Hall list can open the teacher pages, and each teacher sees only their own classes and
results. Written answers are kept until 31 July, the end of the school year; then only the marks are kept.

Something wrong, or a suggestion? Please contact me: dmompelriera@nlcsjeju.kr

<details>
<summary>Behind the scenes</summary>

The website is plain HTML, CSS and JavaScript. It keeps nothing about pupils itself: every request goes to Quiz Hall's
back office, a Google Apps Script with its own spreadsheet, which checks each request again. Teachers read their own
Google Classroom and Google Forms in their own browser, with their own permission. The answer key reaches a pupil's
page only after their own hand-in, when their teacher lets them see the answers. Quiz pictures are kept in Drive and
shared with the school; when a browser cannot load one from Google, Quiz Hall sends the same picture itself.

Licences: the software is under the GNU Affero General Public License v3.0 (`LICENSE`); see `NOTICE`.
</details>
