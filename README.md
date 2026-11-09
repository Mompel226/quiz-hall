# Quiz Hall

Made by Dr Daniel Mompel Riera.

**Run your Google Forms quizzes as locked quizzes in class, and see how every pupil is doing.**
Open it at <https://nlcsbiology.com/quiz-hall/>.

## For teachers

1. **Import a class** from Google Classroom.
2. **Add a quiz** by pasting the address of a Google Form you edit. Quiz Hall copies it once: questions, points, the
   answer key and the pictures.
3. **Run it** for a class: choose the length and press Start now. Pupils open this website on a laptop in Chrome, sign in
   with their school account, and see the quiz.
4. **The quiz locks** if a pupil leaves the page; you unlock them on the live page.
5. **Marking**: choice questions and short answers are marked at once from the form's key. Paragraph answers, and short
   answers close to the key, wait for you on one screen, one key press per mark.
6. **Results**: your class quiz by quiz, each question, each topic, each pupil over time, and who to check on.

Only teachers on the Quiz Hall list can open the teacher pages, and each teacher sees only their own classes and
results. Written answers are kept until 31 July, the end of the school year; then only the marks are kept.

Something wrong, or a suggestion? Please contact me: dmompelriera@nlcsjeju.kr

<details>
<summary>Behind the scenes</summary>

The website is plain HTML, CSS and JavaScript. It keeps nothing about pupils itself: every request goes to Quiz Hall's
back office, a Google Apps Script with its own spreadsheet, which checks each request again. Teachers read their own
Google Classroom and Google Forms in their own browser, with their own permission. The answer key never reaches a
pupil's page.

Licences: the software is under the GNU Affero General Public License v3.0 (`LICENSE`); see `NOTICE`.
</details>
