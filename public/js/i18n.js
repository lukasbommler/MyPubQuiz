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

      first_correct_label: 'First correct! ⚡',
      solo_subtitle:       'The only team who got it right',
      precise_subtitle:    'Within 2% of the correct answer',
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
      start_game:       'Start Game',
      need_team_hint:   'Need at least 1 team to start',
      scoreboard_label: 'Scoreboard',
      answers_label:    'Answers',

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

      first_correct_label: 'Erster! ⚡',
      solo_subtitle:       'Das einzige Team mit richtiger Antwort',
      precise_subtitle:    'Innerhalb von 2 % der richtigen Antwort',
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
      fastest_bonus:    'Schnelligkeitsbonus',
      sole_correct_pts: 'Einzig Richtig / Präzise',
      time_limit_label: 'Zeitlimit',
      seconds_per_q:    'Sekunden pro Frage',
      host_label:       'Host',
      playing_too:      'Ich spiele mit',
      host_name_ph:     'Dein Teamname',
      start_game:       'Spiel starten',
      need_team_hint:   'Mindestens 1 Team zum Starten nötig',
      scoreboard_label: 'Punktestand',
      answers_label:    'Antworten',

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
