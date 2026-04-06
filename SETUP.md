# QuizNight — Setup Guide

## 1. Install Node.js
Download and install from: https://nodejs.org (choose LTS version)

After installing, open a new terminal and verify:
```
node --version
npm --version
```

## 2. Install dependencies
Open a terminal in this folder and run:
```
npm install
```

## 3. Download QR code library
Run this in the terminal (requires Node):
```
curl -o public/js/qrcode.min.js https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
```
Or manually download from that URL and save to `public/js/qrcode.min.js`

## 4. Start the app
```
npm start
```
Then open: http://localhost:3000

## 5. Test with multiple devices
- Find your local IP: run `ipconfig` in Windows terminal, look for IPv4 address (e.g. 192.168.1.42)
- Teams on the same WiFi open: http://192.168.1.42:3000
- Host opens: http://localhost:3000

## Dev mode (auto-restart on file changes)
```
npm run dev
```

## Project structure
```
Quizapp/
├── app.js              — Server (Express + Socket.io)
├── db.js               — SQLite database setup
├── questions.json      — Question catalogue (22 questions, 5 categories)
├── quiz.db             — Auto-created on first run
├── public/
│   ├── index.html      — Landing page (create game)
│   ├── host.html       — Host control panel
│   ├── play.html       — Team view
│   ├── css/
│   │   ├── main.css
│   │   ├── host.css
│   │   └── play.css
│   ├── js/
│   │   ├── index.js
│   │   ├── host.js
│   │   ├── play.js
│   │   └── qrcode.min.js
│   └── uploads/        — Team selfies (auto-created)
└── package.json
```

## How to play
1. Host opens http://localhost:3000 → clicks "Create Game"
2. Host shares the game link or QR code with teams
3. Teams open the link on their phones → enter team name → take selfie
4. Host clicks "Start Game"
5. Questions flow automatically — host controls pace
6. Host clicks "Reveal Answer" after each question, then "Next Question"

## Questions
Edit `questions.json` to add/change questions.
Types supported: `multiple_choice`, `estimation`, `word_order`
