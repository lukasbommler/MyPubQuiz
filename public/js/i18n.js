/* ── MyPubQuiz i18n ─────────────────────────────────────────────────────────
 * Reads localStorage('mpq_lang') → 'en' | 'de'. Defaults to 'en'.
 * Exposes: window.t(key, vars), window.setLang(lang), window.applyI18n()
 * ────────────────────────────────────────────────────────────────────────── */
(function () {
  const T = {
    en: {
      // ── Landing ────────────────────────────────────────────────────────────
      hero_badge:      '🎉 Free & no account needed',
      hero_title:      'The pub quiz<br>on every phone',
      hero_sub:        'Create a game in seconds. Teams join by scanning a QR code. Live scoring, sound effects, podium ceremony — all in the browser.',
      hero_cta:        'Start a Game →',
      join_placeholder:'Enter code…',
      join_btn:        'Join',
      creating:        'Creating…',

      how_title:    'How it works',
      step1_title:  'Host creates a game',
      step1_desc:   'Pick categories, question type, and points — then share the code or QR with your group.',
      step2_title:  'Teams join on their phones',
      step2_desc:   'No app, no login. Scan the QR or type the code — in the lobby in under 10 seconds.',
      step3_title:  'Play and see who wins',
      step3_desc:   'Live leaderboard, speed bonuses, answer distribution after each question, and a podium ceremony at the end.',

      features_title: 'Everything you need',
      feat1: 'Multiple choice, estimation & word ordering',
      feat2: 'Speed bonus for fastest correct answer',
      feat3: 'Answer distribution shown after each reveal',
      feat4: 'Countdown, buzz & result sound effects',
      feat5: 'Questions in English and German',
      feat6: 'Reconnects automatically if you lose signal',
      feat7: 'Team selfies shown on first correct answer',
      feat8: 'Animated podium ceremony at game end',

      cta_title: 'Ready to play?',
      cta_sub:   'Free to use. Works on any phone, tablet or laptop.',
      cta_btn:   'Start a Game →',

      created_title:   'Game Ready!',
      game_code_label: 'Game Code',
      copy_btn:        'Copy Link',
      copied_btn:      'Copied!',
      qr_hint:         'Teams scan this or enter the code above',
      host_panel_link: 'Open Host Panel →',

      // ── Play ───────────────────────────────────────────────────────────────
      join_title:    'Join the Game',
      team_name_ph:  'Your team name',
      join_game_btn: 'Join Game',

      selfie_title: 'Take a team photo! 📸',
      selfie_hint:  'When your team answers first, this photo shows on everyone\'s screen',
      take_photo:   'Take Photo',
      continue_btn: 'Continue →',

      lobby_waiting: 'Waiting for host to start...',
      youre_in:      'You\'re in!',
      teams_joined:  'Teams joined',

      est_placeholder: 'Your estimate...',
      submit_btn:      'Submit',
      submit_order:    'Submit Order',
      drag_hint:       'Drag words here in order →',

      first_correct_label:   'First correct! ⚡',
      best_estimate_label:   'Best estimate! 🎯',
      solo_subtitle:       'The only team who got it right',
      precise_subtitle:    'Exactly correct!',
      solo_correct_title:  'Solo Correct!',
      spot_on_title:       'Spot On!',

      round_waiting: 'Waiting for host to select next round...',
      reconnecting:  'Reconnecting...',
      game_over:     'Game Over!',
      new_game_btn:  'New Game',

      // play — dynamic (use t())
      locked_in_play:     '✓ Answer locked in! Waiting for results...',
      submitted_play:     'Submitted: {val} {unit}',
      place_all_words:    'Place all words before submitting!',
      waiting_answers:    'Answer options coming soon...',
      waiting_input:      'Answer input coming soon...',
      waiting_words:      'Words coming soon...',
      tap_words_play:     'Tap words to add them in order',
      got_right:          '✓ {n} got it right',
      got_wrong:          '✗ {n} wrong',
      round_starting:       'Round {num} starting — {total} questions. Get ready!',
      round_complete_badge: 'Round {num} complete!',
      round_standings:      'Round {num} — Standings',
      not_answered:         '— Not answered',
      correct_str:          '✓ Correct!',
      wrong_str:            '✗ Wrong',
      correct_label:        'Correct: {answer}',
      answer_label:         'Answer: {value} {unit}',
      order_label:          'Order: {order}',

      // ── Host ───────────────────────────────────────────────────────────────
      waiting_teams:    'Waiting for teams...',
      share_hint:       'Share this link or QR code:',
      copy_host_btn:    'Copy',
      configure_round:  'Configure Round',
      categories_label: 'Categories',
      select_hint:      '(select one or more)',
      question_type:    'Question Type',
      points_label:     'Points',
      correct_closest:  'Correct / Closest',
      fastest_bonus:    'Fastest bonus',
      sole_correct_pts: 'Sole correct / Precise',
      time_limit_label: 'Time limit',
      seconds_per_q:    'Seconds per question',
      host_label:       'Host',
      playing_too:      'I\'m playing too',
      host_name_ph:     'Your team name',
      add_photo_btn:    'Add Photo',
      start_game:       'Start Game',
      need_team_hint:   'Need at least 1 team to start',
      scoreboard_label: 'Scoreboard',
      answers_label:    'Answers',

      keep_playing_btn:    'Keep Playing →',
      end_game_btn:        'End Game',
      confirm_end_game:    'End the game and show final results?',

      next_round_header:   'Next Round',
      show_scoreboard_btn: 'Show Scoreboard to Players',
      next_round_btn:      'Start Next Round',
      final_end_btn:       'End Game & Final Results',

      send_question_btn: 'Send Question to Players →',
      replace_btn:       'Replace Question ↺',
      show_answers_btn:  'Show Answer Options →',
      next_question_btn: 'Next Question →',
      end_round_btn:     'End Round →',
      end_game_btn:      'End Game',

      correct_answer_label: 'Correct Answer',
      your_answer_label:    'Your answer',
      solo_correct_title_h: 'Solo Correct!',
      only_team_right:      'The only team who got it right',
      spot_on_title_h:      'Spot On!',
      within_2pct:          'Within 2% of the correct answer',

      // host — dynamic
      round_complete:   'Round {num} Complete!',
      locked_in_host:   '✓ Locked in! Waiting for reveal...',
      submitted_val:    '✓ Submitted: {val} {unit}',
      order_submitted:  '✓ Order submitted!',
      tap_words:        'Tap words to order them',
      coming_soon:      'coming soon',
      no_submissions:   'No submissions',

      // type labels (used in buildConfigPanel + q-type-badge)
      type_multiple_choice: 'Multiple Choice',
      type_estimation:      'Estimation',
      type_word_order:      'Word Ordering',

      back_to_home: '← Back to Homepage',

      // ── FAQ ────────────────────────────────────────────────────────────────
      faq_title:       'Frequently Asked Questions',
      faq_subtitle:    'Everything you need to know about MyPubQuiz.',
      faq_cat_general: 'General',
      faq_cat_create:  'Creating & Joining a Game',
      faq_cat_modes:   'Questions & Game Modes',
      faq_cat_privacy: 'Privacy & Security',

      faq_q1:  'What is MyPubQuiz?',
      faq_a1:  'MyPubQuiz is a free, browser-based pub quiz platform. A host creates a game and shares a code or QR code with players. Teams answer in real time on their smartphones — no app download or account needed.',
      faq_q2:  'Is MyPubQuiz free?',
      faq_a2:  'Yes, completely. There are no premium plans, no hidden fees and no ads.',
      faq_q3:  'Do I need to create an account?',
      faq_a3:  'No. Neither the host nor the players need an account. The host creates a game with one click, teams join via the code — and you\'re off.',
      faq_q4:  'Which devices are supported?',
      faq_a4:  'MyPubQuiz runs in any modern browser — on smartphones, tablets and laptops. Chrome, Firefox, Safari and Edge are fully supported. An internet connection is required.',
      faq_q5:  'How do I create a game?',
      faq_a5:  'Click <strong>"Start a Game"</strong> on the home page. You\'ll instantly get a 6-digit code and a QR code. Open the host panel, configure the round (category, question type, points) and wait for teams to join.',
      faq_q6:  'How do teams join a game?',
      faq_a6:  'Teams can either scan the QR code or enter the 6-digit code on the home page and click <strong>"Join"</strong>. They choose a team name, optionally take a selfie — and they\'re in.',
      faq_q7:  'How many teams can play?',
      faq_a7:  'There is no fixed limit. In practice we recommend up to 20 teams for a smooth experience, as answers and scores are synced in real time.',
      faq_q8:  'Can the host also play?',
      faq_a8:  'Yes. The host panel has an option to register the host as a participating team, so the person running the quiz can play along at the same time.',
      faq_q9:  'What question types are there?',
      faq_a9:  'MyPubQuiz supports three types:<ul style="margin-top:0.5rem;padding-left:1.25rem;line-height:2"><li><strong>Multiple Choice</strong> — four options, one is correct.</li><li><strong>Estimation</strong> — numerical input; the team closest to the target wins.</li><li><strong>Word Ordering</strong> — arrange given words into the correct sequence.</li></ul>',
      faq_q10: 'In which languages are questions available?',
      faq_a10: 'The question catalogue is available in German and English. The host can choose the language in the lobby screen before the game starts.',
      faq_q11: 'How does the scoring system work?',
      faq_a11: 'The host sets before each round how many points a correct answer is worth and whether there is a speed bonus for the fastest correct answer. For estimation questions, the team closest to the target value wins.',
      faq_q12: 'What happens if I lose my connection?',
      faq_a12: 'MyPubQuiz reconnects you automatically once the connection is restored. Your team\'s progress is preserved because the team ID is stored in your browser.',
      faq_q13: 'What data is stored?',
      faq_a13: 'We only store game-related data: team names, submitted answers, scores and optionally a team selfie. Games are automatically deleted 24 hours after creation. See our <a href="/datenschutz.html">Privacy Policy</a> for details.',
      faq_q14: 'Are team selfies publicly visible?',
      faq_a14: 'Selfies are only shown within the active game — to the host and all teams participating in that game. After 24 hours, images are automatically deleted from the server.',

      // ── Blog ───────────────────────────────────────────────────────────────
      blog_subtitle: 'Tips, ideas and news about MyPubQuiz and pub quizzes.',

      // footer
      footer_faq:         'FAQ',
      footer_blog:        'Blog',
      footer_impressum:   'Impressum',
      footer_datenschutz: 'Datenschutz',
    },

    de: {
      // ── Landing ────────────────────────────────────────────────────────────
      hero_badge:      '🎉 Kostenlos & kein Account nötig',
      hero_title:      'Das Pub-Quiz<br>für jedes Smartphone',
      hero_sub:        'Erstelle ein Spiel in Sekunden. Teams treten per QR-Code bei. Live-Punkte, Soundeffekte, Siegerehrung — alles im Browser.',
      hero_cta:        'Spiel starten →',
      join_placeholder:'Code eingeben…',
      join_btn:        'Beitreten',
      creating:        'Wird erstellt…',

      how_title:    'So funktioniert\'s',
      step1_title:  'Host erstellt ein Spiel',
      step1_desc:   'Kategorien, Fragetyp und Punkte auswählen — dann Code oder QR-Code teilen.',
      step2_title:  'Teams treten per Smartphone bei',
      step2_desc:   'Keine App, keine Anmeldung. QR scannen oder Code eingeben — in unter 10 Sekunden in der Lobby.',
      step3_title:  'Spielen und gewinnen',
      step3_desc:   'Live-Rangliste, Schnelligkeitsbonus, Antwortverteilung nach jeder Frage und eine Siegerehrung am Ende.',

      features_title: 'Alles, was du brauchst',
      feat1: 'Multiple Choice, Schätzfragen & Wörter sortieren',
      feat2: 'Schnelligkeitsbonus für die schnellste richtige Antwort',
      feat3: 'Antwortverteilung nach jeder Auflösung',
      feat4: 'Countdown-, Buzz- und Ergebnis-Soundeffekte',
      feat5: 'Fragen auf Englisch und Deutsch',
      feat6: 'Automatische Wiederverbindung bei Verbindungsabbruch',
      feat7: 'Team-Selfies bei der ersten richtigen Antwort',
      feat8: 'Animierte Siegerehrung am Spielende',

      cta_title: 'Bereit zu spielen?',
      cta_sub:   'Kostenlos. Auf jedem Smartphone, Tablet oder Laptop.',
      cta_btn:   'Spiel starten →',

      created_title:   'Spiel bereit!',
      game_code_label: 'Spielcode',
      copy_btn:        'Link kopieren',
      copied_btn:      'Kopiert!',
      qr_hint:         'Teams scannen oder geben den Code oben ein',
      host_panel_link: 'Host-Panel öffnen →',

      // ── Play ───────────────────────────────────────────────────────────────
      join_title:    'Spiel beitreten',
      team_name_ph:  'Dein Teamname',
      join_game_btn: 'Beitreten',

      selfie_title: 'Teamfoto aufnehmen! 📸',
      selfie_hint:  'Wenn dein Team als Erstes antwortet, wird dieses Foto auf allen Bildschirmen gezeigt',
      take_photo:   'Foto aufnehmen',
      continue_btn: 'Weiter →',

      lobby_waiting: 'Warte auf den Host...',
      youre_in:      'Du bist dabei!',
      teams_joined:  'Beigetretene Teams',

      est_placeholder: 'Deine Schätzung...',
      submit_btn:      'Absenden',
      submit_order:    'Reihenfolge abgeben',
      drag_hint:       'Wörter hier in Reihenfolge einordnen →',

      first_correct_label:  'Erster! ⚡',
      best_estimate_label:  'Beste Schätzung! 🎯',
      solo_subtitle:       'Das einzige Team mit richtiger Antwort',
      precise_subtitle:    'Exakt richtig!',
      solo_correct_title:  'Einzig Richtig!',
      spot_on_title:       'Genau Richtig!',

      round_waiting: 'Warte auf Host...',
      reconnecting:  'Verbindung wird wiederhergestellt...',
      game_over:     'Spiel vorbei!',
      new_game_btn:  'Neues Spiel',

      // play — dynamic
      locked_in_play:     '✓ Antwort gespeichert! Warte auf Auflösung...',
      submitted_play:     'Eingereicht: {val} {unit}',
      place_all_words:    'Ordne alle Wörter vor dem Absenden!',
      waiting_answers:    'Antwortoptionen kommen gleich...',
      waiting_input:      'Eingabe kommt gleich...',
      waiting_words:      'Wörter kommen gleich...',
      tap_words_play:     'Wörter antippen, um sie einzuordnen',
      got_right:          '✓ {n} richtig',
      got_wrong:          '✗ {n} falsch',
      round_starting:       'Runde {num} beginnt — {total} Fragen. Macht euch bereit!',
      round_complete_badge: 'Runde {num} abgeschlossen!',
      round_standings:      'Runde {num} — Punktestand',
      not_answered:         '— Nicht beantwortet',
      correct_str:          '✓ Richtig!',
      wrong_str:            '✗ Falsch',
      correct_label:        'Richtig: {answer}',
      answer_label:         'Antwort: {value} {unit}',
      order_label:          'Reihenfolge: {order}',

      // ── Host ───────────────────────────────────────────────────────────────
      waiting_teams:    'Warte auf Teams...',
      share_hint:       'Link oder QR-Code teilen:',
      copy_host_btn:    'Kopieren',
      configure_round:  'Runde konfigurieren',
      categories_label: 'Kategorien',
      select_hint:      '(eine oder mehrere)',
      question_type:    'Fragetyp',
      points_label:     'Punkte',
      correct_closest:  'Richtig / Nächster',
      fastest_bonus:    'Schnelligkeits-bonus',
      sole_correct_pts: 'Einzig Richtig / Präzise',
      time_limit_label: 'Zeitlimit',
      seconds_per_q:    'Sekunden pro Frage',
      host_label:       'Host',
      playing_too:      'Ich spiele mit',
      host_name_ph:     'Dein Teamname',
      add_photo_btn:    'Foto hinzufügen',
      start_game:       'Spiel starten',
      need_team_hint:   'Mindestens 1 Team zum Starten nötig',
      scoreboard_label: 'Punktestand',
      answers_label:    'Antworten',

      keep_playing_btn:    'Weiterspielen →',
      end_game_btn:        'Spiel beenden',
      confirm_end_game:    'Spiel beenden und Endergebnis anzeigen?',

      next_round_header:   'Nächste Runde',
      show_scoreboard_btn: 'Punktestand anzeigen',
      next_round_btn:      'Nächste Runde starten',
      final_end_btn:       'Spiel beenden & Ergebnis',

      send_question_btn: 'Frage senden →',
      replace_btn:       'Frage ersetzen ↺',
      show_answers_btn:  'Antwortoptionen zeigen →',
      next_question_btn: 'Nächste Frage →',
      end_round_btn:     'Runde beenden →',
      end_game_btn:      'Spiel beenden',

      correct_answer_label: 'Richtige Antwort',
      your_answer_label:    'Deine Antwort',
      solo_correct_title_h: 'Einzig Richtig!',
      only_team_right:      'Das einzige Team mit richtiger Antwort',
      spot_on_title_h:      'Genau Richtig!',
      within_2pct:          'Innerhalb von 2 % der richtigen Antwort',

      // host — dynamic
      round_complete:  'Runde {num} abgeschlossen!',
      locked_in_host:  '✓ Gespeichert! Warte auf Auflösung...',
      submitted_val:   '✓ Eingereicht: {val} {unit}',
      order_submitted: '✓ Reihenfolge eingereicht!',
      tap_words:       'Wörter antippen zum Sortieren',
      coming_soon:     'demnächst',
      no_submissions:  'Keine Einreichungen',

      // type labels
      type_multiple_choice: 'Multiple Choice',
      type_estimation:      'Schätzfrage',
      type_word_order:      'Wörter sortieren',

      back_to_home: '← Zurück zur Startseite',

      // ── FAQ ────────────────────────────────────────────────────────────────
      faq_title:       'Häufige Fragen',
      faq_subtitle:    'Alles, was du über MyPubQuiz wissen musst.',
      faq_cat_general: 'Allgemeines',
      faq_cat_create:  'Spiel erstellen & beitreten',
      faq_cat_modes:   'Fragen & Spielmodi',
      faq_cat_privacy: 'Datenschutz & Sicherheit',

      faq_q1:  'Was ist MyPubQuiz?',
      faq_a1:  'MyPubQuiz ist eine kostenlose, browserbasierte Pub-Quiz-Plattform. Ein Host erstellt ein Spiel und teilt einen Code oder QR-Code mit den Mitspielerinnen und Mitspielern. Die Teams antworten in Echtzeit über ihr Smartphone – ganz ohne App-Download oder Account.',
      faq_q2:  'Kostet MyPubQuiz etwas?',
      faq_a2:  'Nein. MyPubQuiz ist vollständig kostenlos. Es gibt keine Premium-Pläne, keine versteckten Gebühren und keine Werbung.',
      faq_q3:  'Muss ich ein Konto erstellen?',
      faq_a3:  'Nein. Weder der Host noch die Spielerinnen und Spieler brauchen einen Account. Der Host erstellt ein Spiel per Klick, Teams treten über den Code bei – fertig.',
      faq_q4:  'Welche Geräte werden unterstützt?',
      faq_a4:  'MyPubQuiz läuft in jedem modernen Browser – auf Smartphones, Tablets und Laptops. Chrome, Firefox, Safari und Edge sind vollständig unterstützt. Eine Internetverbindung ist erforderlich.',
      faq_q5:  'Wie erstelle ich ein Spiel?',
      faq_a5:  'Klicke auf der Startseite auf <strong>„Spiel starten"</strong>. Du erhältst sofort einen 6-stelligen Code und einen QR-Code. Öffne das Host-Panel, konfiguriere die Runde (Kategorie, Fragetyp, Punkte) und warte auf die Teams.',
      faq_q6:  'Wie treten Teams einem Spiel bei?',
      faq_a6:  'Teams können entweder den QR-Code scannen oder auf der Startseite den 6-stelligen Code eingeben und auf <strong>„Beitreten"</strong> klicken. Sie wählen einen Teamnamen, machen optional ein Selfie – und sind dabei.',
      faq_q7:  'Wie viele Teams können mitspielen?',
      faq_a7:  'Es gibt keine feste Obergrenze. In der Praxis empfehlen wir bis zu 20 Teams für ein flüssiges Spielerlebnis, da Antworten und Punktestände in Echtzeit synchronisiert werden.',
      faq_q8:  'Kann der Host auch mitspielen?',
      faq_a8:  'Ja. Im Host-Panel gibt es eine Option, den Host als teilnehmendes Team einzutragen. So kann die moderierende Person gleichzeitig spielen.',
      faq_q9:  'Welche Fragetypen gibt es?',
      faq_a9:  'MyPubQuiz unterstützt drei Typen:<ul style="margin-top:0.5rem;padding-left:1.25rem;line-height:2"><li><strong>Multiple Choice</strong> – vier Antwortmöglichkeiten, eine ist richtig.</li><li><strong>Schätzfrage</strong> – numerische Eingabe; das Team mit dem nächsten Wert gewinnt.</li><li><strong>Wörter sortieren</strong> – vorgegebene Wörter in die richtige Reihenfolge bringen.</li></ul>',
      faq_q10: 'In welchen Sprachen sind Fragen verfügbar?',
      faq_a10: 'Der Fragenkatalog ist auf Deutsch und Englisch verfügbar. Die Sprache kann der Host vor dem Spielstart im Lobby-Bildschirm wählen.',
      faq_q11: 'Wie funktioniert das Punktesystem?',
      faq_a11: 'Der Host legt vor jeder Runde fest, wie viele Punkte eine richtige Antwort gibt und ob es einen Geschwindigkeitsbonus für die schnellste korrekte Antwort gibt. Bei Schätzfragen gewinnt das Team, das dem Zielwert am nächsten liegt.',
      faq_q12: 'Was passiert, wenn ich die Verbindung verliere?',
      faq_a12: 'MyPubQuiz verbindet dich automatisch wieder, sobald die Verbindung wiederhergestellt ist. Dein Teamfortschritt bleibt erhalten, da die Team-ID im Browser gespeichert wird.',
      faq_q13: 'Welche Daten werden gespeichert?',
      faq_a13: 'Wir speichern nur spielbezogene Daten: Teamnamen, abgegebene Antworten, Punktestände und optional ein Team-Selfie. Spiele werden 24 Stunden nach Erstellung automatisch gelöscht. Weitere Details findest du in unserer <a href="/datenschutz.html">Datenschutzerklärung</a>.',
      faq_q14: 'Sind Team-Selfies öffentlich sichtbar?',
      faq_a14: 'Selfies werden nur innerhalb des aktiven Spiels angezeigt – für den Host und alle Teammitglieder, die am selben Spiel teilnehmen. Nach 24 Stunden werden Bilder automatisch vom Server gelöscht.',

      // ── Blog ───────────────────────────────────────────────────────────────
      blog_subtitle: 'Tipps, Ideen und Neuigkeiten rund um MyPubQuiz und Pub Quiz.',

      // footer
      footer_faq:         'FAQ',
      footer_blog:        'Blog',
      footer_impressum:   'Impressum',
      footer_datenschutz: 'Datenschutz',
    },
  };

  const saved = localStorage.getItem('mpq_lang');
  window.MPQ_LANG = (saved === 'en' || saved === 'de') ? saved : 'en';

  /** Translate a key, optionally interpolating {var} placeholders. */
  window.t = function (key, vars) {
    const dict = T[window.MPQ_LANG] || T.en;
    let str = (dict[key] !== undefined) ? dict[key] : (T.en[key] !== undefined ? T.en[key] : key);
    if (vars) str = str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
    return str;
  };

  /** Persist language choice and reload. */
  window.setLang = function (lang) {
    if (lang !== 'en' && lang !== 'de') return;
    localStorage.setItem('mpq_lang', lang);
    location.reload();
  };

  /**
   * Apply translations to the current page.
   * data-i18n          → element.textContent
   * data-i18n-html     → element.innerHTML (for strings containing <br> etc.)
   * data-i18n-placeholder → input.placeholder
   */
  window.applyI18n = function () {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = window.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = window.t(el.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = window.t(el.dataset.i18nPlaceholder);
    });
    // Sync toggle button active state
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('lang-btn-active', btn.dataset.lang === window.MPQ_LANG);
    });
  };
})();
