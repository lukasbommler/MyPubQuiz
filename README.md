# MyPubQuiz

A free, real-time pub quiz platform that runs entirely in the browser. A host creates a game in seconds; teams join by scanning a QR code or typing a short code on any phone, tablet or laptop — no app download, no account required.

---

## Features

- **Three question types** — Multiple Choice, Estimation (closest value wins), Word Ordering
- **Speed bonus** — first team to answer correctly earns extra points
- **Live leaderboard** — scores update in real time after every question
- **Answer distribution** — see how the room answered after each reveal
- **Team selfies** — photo shown on screen when a team gets the first correct answer
- **Animated podium ceremony** — confetti and ranked podium at game end
- **Host-plays mode** — the host can participate as a team while still running the quiz
- **Multi-round games** — configure categories, question type and point values per round
- **Manual score adjustment** — host can ±1 point any team at any time
- **Auto-reconnect** — players rejoin automatically if they lose signal
- **EN / DE UI** — full English and German interface, switchable per user
- **EN / DE questions** — separate question catalogue per language, selectable per game
- **Sound effects** — countdown, buzz, correct/wrong, victory (Web Audio API, no files)
- **No dependencies for players** — works on any modern browser

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express |
| Real-time | Socket.io |
| Question DB | SQLite via sql.js (pure JS, no native build) |
| Game state | In-memory (`gameState` object) |
| Persistence | JSON file (`quiz-data.json`) — survives restarts for lobby/scores |
| Frontend | Vanilla JS, no framework |
| Styles | Plain CSS with CSS custom properties |
| QR codes | qrcode.js (client-side) |

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org) LTS (v18 or newer recommended)

### Install
```bash
git clone <repo-url>
cd Quizapp
npm install
```

Download the QR code library (one-time):
```bash
curl -o public/js/qrcode.min.js https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
```

### Run
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

For development with auto-restart on file changes:
```bash
npm run dev
```

---

## How to play

### As host
1. Open [http://localhost:3000](http://localhost:3000) → click **Start a Game**
2. You'll get a 6-digit code and QR code — share them with your players
3. Click **Open Host Panel** to enter the lobby
4. Wait for teams to join, then configure the first round:
   - Pick one or more **categories**
   - Choose a **question type** (Multiple Choice / Estimation / Word Ordering)
   - Set **points per correct answer** and an optional **speed bonus**
   - Set the **time limit** per question
5. Click **Start Game** — then for each question:
   - **Send Question** → players see the question text
   - **Show Answers** → the countdown starts, players can answer
   - **Reveal Answer** → correct answer + answer distribution shown
   - **Next Question** → repeat, or **End Round** to go to standings
6. After a round, configure the next round or click **End Game & Final Results**

### As a player
1. Scan the QR code or go to the game URL and enter the 6-digit code
2. Enter a team name and optionally take a team selfie
3. Answer questions on your phone when the countdown starts
4. Watch the leaderboard update after each reveal

---

## Adding / updating questions

Questions are stored in a SQLite database (`questions.db`) and managed via a Google Sheet.

### Google Sheet format
Each row is one question in one language. Columns:

| Column | Description |
|--------|-------------|
| `type` | `multiple_choice`, `estimation`, or `word_order` |
| `language` | `en` or `de` |
| `category` | e.g. `Geography`, `Science`, `Pop Culture` |
| `question` | The question text |
| `answer_a` … `answer_d` | Multiple choice options (MC only) |
| `correct` | Correct option letter: `A`, `B`, `C`, or `D` (MC only) |
| `correct_value` | Numeric answer (estimation only) |
| `unit` | Unit label, e.g. `km` (estimation only) |
| `words` | Pipe-separated words in correct order, e.g. `Paris\|London\|Berlin` (word_order only) |
| `time_limit` | Seconds per question (e.g. `20`) |

### Seeding the database
Publish the sheet as CSV (File → Share → Publish to web → CSV), then run:
```bash
node scripts/seed-questions.js
```

This wipes and rebuilds `questions.db` from the sheet. Restart the server afterwards.

---

## Project structure

```
Quizapp/
├── app.js                  Server — Express + Socket.io + all game logic
├── db.js                   In-memory store for events/teams/answers
├── questions-db.js         SQLite interface via sql.js
├── scripts/
│   └── seed-questions.js   Import questions from Google Sheets CSV
├── questions.db            SQLite question catalogue
├── quiz-data.json          Persisted game/team/answer data
├── package.json
└── public/
    ├── index.html          Landing page
    ├── host.html           Host panel
    ├── play.html           Player screen
    ├── faq.html            FAQ (EN/DE)
    ├── blog.html           Blog (EN/DE)
    ├── impressum.html      Legal notice
    ├── datenschutz.html    Privacy policy
    ├── js/
    │   ├── i18n.js         UI language system (EN/DE)
    │   ├── host.js         Host panel logic
    │   ├── play.js         Player screen logic
    │   ├── index.js        Landing page logic
    │   ├── sounds.js       Web Audio API sound effects
    │   └── qrcode.min.js   QR code generator
    ├── css/
    │   ├── main.css        Shared styles + design tokens
    │   ├── host.css        Host panel styles
    │   ├── play.css        Player screen styles
    │   └── landing.css     Landing + content page styles
    └── uploads/            Team selfie images (auto-created, purged after 24h)
```

---

## Multiplayer on a local network

To let other devices on the same Wi-Fi join:

1. Find your local IP address:
   - Windows: run `ipconfig` in a terminal, look for **IPv4 Address** (e.g. `192.168.1.42`)
   - macOS/Linux: run `ifconfig` or `ip addr`
2. Players open `http://192.168.1.42:3000` on their phones
3. Host keeps using `http://localhost:3000`

---

## Environment notes

- **Single process** — no clustering. All state is in-memory; a server restart during a game will lose `gameState` (lobby/score data in `quiz-data.json` survives).
- **No database server** — sql.js runs SQLite entirely in Node.js, no installation needed.
- **Uploads** — selfie images are saved to `public/uploads/` and automatically deleted 24 hours after game creation.
- **Port** — defaults to `3000`. Set the `PORT` environment variable to change it.

---

## License

MIT
