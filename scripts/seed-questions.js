// Run once to populate questions.db
// Usage: node scripts/seed-questions.js
//        node scripts/seed-questions.js --reset   (wipe and re-seed)

const { getDb, save } = require('../questions-db');
const reset = process.argv.includes('--reset');

(async () => {
const db = await getDb();

if (reset) {
  db.run('DELETE FROM translations');
  db.run('DELETE FROM questions');
  console.log('Cleared existing questions.');
}

const existingResult = db.exec('SELECT COUNT(*) AS n FROM questions');
const existing = existingResult[0]?.values[0][0] ?? 0;
if (existing > 0 && !reset) {
  console.log(`DB already has ${existing} questions. Run with --reset to re-seed.`);
  process.exit(0);
}

// ─── Question data ────────────────────────────────────────────────────────────
// Each entry: { category, type, time_limit?, correct_index?, correct_value?, correct_order?, en, de }
// en/de: { question, answers?, words?, hint?, unit? }
//
// word_order: `words` are in CORRECT order — the client shuffles them for display.
// correct_order is therefore always [0,1,2,...] (sequential) unless you need a
// non-sequential correct arrangement.

const questions = [

  // ═══════════════════════════════════════════════════════════ GEOGRAPHY ══════

  {
    category: 'Geography', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'What is the capital of Slovenia?',
      answers: ['Ljubljana', 'Bratislava', 'Zagreb', 'Skopje'],
    },
    de: {
      question: 'Was ist die Hauptstadt Sloweniens?',
      answers: ['Ljubljana', 'Bratislava', 'Zagreb', 'Skopje'],
    },
  },
  {
    category: 'Geography', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which is the longest river in Europe?',
      answers: ['Volga', 'Danube', 'Rhine', 'Thames'],
    },
    de: {
      question: 'Welcher Fluss ist der längste in Europa?',
      answers: ['Wolga', 'Donau', 'Rhein', 'Themse'],
    },
  },
  {
    category: 'Geography', type: 'multiple_choice', correct_index: 1,
    en: {
      question: 'How many countries share a land border with Germany?',
      answers: ['7', '9', '8', '10'],
    },
    de: {
      question: 'Mit wie vielen Ländern hat Deutschland eine gemeinsame Landgrenze?',
      answers: ['7', '9', '8', '10'],
    },
  },
  {
    category: 'Geography', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which sea lies between Italy and Croatia?',
      answers: ['Adriatic Sea', 'Tyrrhenian Sea', 'Ligurian Sea', 'Ionian Sea'],
    },
    de: {
      question: 'Welches Meer liegt zwischen Italien und Kroatien?',
      answers: ['Adriatisches Meer', 'Tyrrhenisches Meer', 'Ligurisches Meer', 'Ionisches Meer'],
    },
  },
  {
    category: 'Geography', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which is the smallest country in the world by area?',
      answers: ['Vatican City', 'Monaco', 'Liechtenstein', 'San Marino'],
    },
    de: {
      question: 'Welches ist das flächenmäßig kleinste Land der Welt?',
      answers: ['Vatikanstadt', 'Monaco', 'Liechtenstein', 'San Marino'],
    },
  },
  {
    category: 'Geography', type: 'multiple_choice', correct_index: 2,
    en: {
      question: 'Which European country has the most UNESCO World Heritage Sites?',
      answers: ['France', 'Spain', 'Italy', 'Germany'],
    },
    de: {
      question: 'Welches europäische Land hat die meisten UNESCO-Welterbestätten?',
      answers: ['Frankreich', 'Spanien', 'Italien', 'Deutschland'],
    },
  },
  {
    category: 'Geography', type: 'estimation', correct_value: 1230,
    en: { question: 'How long is the Rhine river in kilometres?', unit: 'km' },
    de: { question: 'Wie lang ist der Rhein in Kilometern?', unit: 'km' },
  },
  {
    category: 'Geography', type: 'estimation', correct_value: 27,
    en: { question: 'How many member states does the European Union have (as of 2024)?' },
    de: { question: 'Wie viele Mitgliedsstaaten hat die Europäische Union (Stand 2024)?' },
  },
  {
    category: 'Geography', type: 'estimation', correct_value: 4808,
    en: { question: 'How tall is Mont Blanc, the highest peak in the Alps?', unit: 'm' },
    de: { question: 'Wie hoch ist der Mont Blanc, der höchste Gipfel der Alpen?', unit: 'm' },
  },
  {
    category: 'Geography', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these European capitals from west to east:',
      words: ['Lisbon', 'Madrid', 'Paris', 'Berlin'],
      hint: 'From the Iberian Peninsula to Central Europe',
    },
    de: {
      question: 'Ordne diese europäischen Hauptstädte von West nach Ost:',
      words: ['Lissabon', 'Madrid', 'Paris', 'Berlin'],
      hint: 'Von der Iberischen Halbinsel nach Mitteleuropa',
    },
  },
  {
    category: 'Geography', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these Alpine peaks from tallest to shortest:',
      words: ['Mont Blanc', 'Matterhorn', 'Jungfrau', 'Zugspitze'],
      hint: 'Heights: 4808 m, 4478 m, 4158 m, 2962 m',
    },
    de: {
      question: 'Ordne diese Alpengipfel vom höchsten zum niedrigsten:',
      words: ['Mont Blanc', 'Matterhorn', 'Jungfrau', 'Zugspitze'],
      hint: 'Höhen: 4808 m, 4478 m, 4158 m, 2962 m',
    },
  },

  // ═══════════════════════════════════════════════════════════════ SCIENCE ════

  {
    category: 'Science', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which gas makes up about 78% of Earth\'s atmosphere?',
      answers: ['Nitrogen', 'Oxygen', 'Carbon Dioxide', 'Argon'],
    },
    de: {
      question: 'Welches Gas macht etwa 78 % der Erdatmosphäre aus?',
      answers: ['Stickstoff', 'Sauerstoff', 'Kohlendioxid', 'Argon'],
    },
  },
  {
    category: 'Science', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which organ in the human body produces insulin?',
      answers: ['Pancreas', 'Liver', 'Kidney', 'Spleen'],
    },
    de: {
      question: 'Welches Organ im menschlichen Körper produziert Insulin?',
      answers: ['Bauchspeicheldrüse', 'Leber', 'Niere', 'Milz'],
    },
  },
  {
    category: 'Science', type: 'multiple_choice', correct_index: 1,
    en: {
      question: 'Which metal has the highest melting point?',
      answers: ['Iron', 'Tungsten', 'Titanium', 'Platinum'],
    },
    de: {
      question: 'Welches Metall hat den höchsten Schmelzpunkt?',
      answers: ['Eisen', 'Wolfram', 'Titan', 'Platin'],
    },
  },
  {
    category: 'Science', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'How many bones does the adult human body have?',
      answers: ['206', '186', '212', '198'],
    },
    de: {
      question: 'Wie viele Knochen hat ein erwachsener menschlicher Körper?',
      answers: ['206', '186', '212', '198'],
    },
  },
  {
    category: 'Science', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'What colour does litmus paper turn in an acidic solution?',
      answers: ['Red', 'Blue', 'Green', 'Purple'],
    },
    de: {
      question: 'Welche Farbe nimmt Lackmuspapier in einer sauren Lösung an?',
      answers: ['Rot', 'Blau', 'Grün', 'Violett'],
    },
  },
  {
    category: 'Science', type: 'multiple_choice', correct_index: 2,
    en: {
      question: 'What is the approximate speed of light in a vacuum?',
      answers: ['150,000 km/s', '500,000 km/s', '300,000 km/s', '1,000,000 km/s'],
    },
    de: {
      question: 'Wie hoch ist die ungefähre Lichtgeschwindigkeit im Vakuum?',
      answers: ['150.000 km/s', '500.000 km/s', '300.000 km/s', '1.000.000 km/s'],
    },
  },
  {
    category: 'Science', type: 'estimation', correct_value: 384400,
    en: { question: 'Approximately how far is the Moon from Earth?', unit: 'km' },
    de: { question: 'Wie weit ist der Mond ungefähr von der Erde entfernt?', unit: 'km' },
  },
  {
    category: 'Science', type: 'estimation', correct_value: 118,
    en: { question: 'How many elements are currently in the periodic table?' },
    de: { question: 'Wie viele Elemente enthält das Periodensystem derzeit?' },
  },
  {
    category: 'Science', type: 'estimation', correct_value: 1538,
    en: { question: 'At what temperature does iron melt?', unit: '°C' },
    de: { question: 'Bei welcher Temperatur schmilzt Eisen?', unit: '°C' },
  },
  {
    category: 'Science', type: 'word_order', correct_order: [0, 1, 2, 3, 4],
    en: {
      question: 'Order these planets from largest to smallest by diameter:',
      words: ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Earth'],
      hint: 'Jupiter is by far the largest',
    },
    de: {
      question: 'Ordne diese Planeten vom größten zum kleinsten nach ihrem Durchmesser:',
      words: ['Jupiter', 'Saturn', 'Uranus', 'Neptun', 'Erde'],
      hint: 'Jupiter ist bei weitem der größte',
    },
  },
  {
    category: 'Science', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these elements by atomic number, lowest first:',
      words: ['Carbon', 'Oxygen', 'Iron', 'Gold'],
      hint: 'Atomic numbers: 6, 8, 26, 79',
    },
    de: {
      question: 'Ordne diese Elemente nach ihrer Ordnungszahl, kleinste zuerst:',
      words: ['Kohlenstoff', 'Sauerstoff', 'Eisen', 'Gold'],
      hint: 'Ordnungszahlen: 6, 8, 26, 79',
    },
  },

  // ══════════════════════════════════════════════════════════ POP CULTURE ═════

  {
    category: 'Pop Culture', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Who directed the 2023 film "Oppenheimer"?',
      answers: ['Christopher Nolan', 'Steven Spielberg', 'Denis Villeneuve', 'Ridley Scott'],
    },
    de: {
      question: 'Wer hat den Film „Oppenheimer" (2023) gedreht?',
      answers: ['Christopher Nolan', 'Steven Spielberg', 'Denis Villeneuve', 'Ridley Scott'],
    },
  },
  {
    category: 'Pop Culture', type: 'multiple_choice', correct_index: 1,
    en: {
      question: 'In which year did Apple launch the very first iPhone?',
      answers: ['2005', '2007', '2009', '2006'],
    },
    de: {
      question: 'In welchem Jahr stellte Apple das allererste iPhone vor?',
      answers: ['2005', '2007', '2009', '2006'],
    },
  },
  {
    category: 'Pop Culture', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'What is the name of Harry Potter\'s owl?',
      answers: ['Hedwig', 'Errol', 'Pigwidgeon', 'Crookshanks'],
    },
    de: {
      question: 'Wie heißt Harry Potters Eule?',
      answers: ['Hedwig', 'Errol', 'Pigwidgeon', 'Krummbein'],
    },
  },
  {
    category: 'Pop Culture', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'In which country did K-pop originate?',
      answers: ['South Korea', 'Japan', 'China', 'Thailand'],
    },
    de: {
      question: 'In welchem Land entstand K-Pop?',
      answers: ['Südkorea', 'Japan', 'China', 'Thailand'],
    },
  },
  {
    category: 'Pop Culture', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'What is the name of Tony Stark\'s AI assistant in the Iron Man films?',
      answers: ['J.A.R.V.I.S.', 'F.R.I.D.A.Y.', 'E.D.I.T.H.', 'H.A.L.'],
    },
    de: {
      question: 'Wie heißt Tony Starks KI-Assistent in den Iron-Man-Filmen?',
      answers: ['J.A.R.V.I.S.', 'F.R.I.D.A.Y.', 'E.D.I.T.H.', 'H.A.L.'],
    },
  },
  {
    category: 'Pop Culture', type: 'multiple_choice', correct_index: 3,
    en: {
      question: 'Which music artist has won the most Grammy Awards in history?',
      answers: ['Taylor Swift', 'Michael Jackson', 'Georg Solti', 'Beyoncé'],
    },
    de: {
      question: 'Welcher Musiker hat in der Geschichte die meisten Grammy Awards gewonnen?',
      answers: ['Taylor Swift', 'Michael Jackson', 'Georg Solti', 'Beyoncé'],
    },
  },
  {
    category: 'Pop Culture', type: 'estimation', correct_value: 73,
    en: { question: 'How many episodes does Game of Thrones have in total?' },
    de: { question: 'Wie viele Episoden hat Game of Thrones insgesamt?' },
  },
  {
    category: 'Pop Culture', type: 'estimation', correct_value: 2005,
    en: { question: 'In which year was YouTube founded?' },
    de: { question: 'In welchem Jahr wurde YouTube gegründet?' },
  },
  {
    category: 'Pop Culture', type: 'estimation', correct_value: 7,
    en: { question: 'How many books are in the main Harry Potter series?' },
    de: { question: 'Aus wie vielen Büchern besteht die Hauptreihe von Harry Potter?' },
  },
  {
    category: 'Pop Culture', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these films by release year, oldest first:',
      words: ['The Godfather', 'Pulp Fiction', 'The Dark Knight', 'Parasite'],
      hint: 'Years: 1972, 1994, 2008, 2019',
    },
    de: {
      question: 'Ordne diese Filme nach ihrem Erscheinungsjahr (ältestes zuerst):',
      words: ['Der Pate', 'Pulp Fiction', 'The Dark Knight', 'Parasite'],
      hint: 'Jahre: 1972, 1994, 2008, 2019',
    },
  },
  {
    category: 'Pop Culture', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these video game series by their first release year, oldest first:',
      words: ['Pong', 'Pac-Man', 'Super Mario', 'Minecraft'],
      hint: 'Years: 1972, 1980, 1985, 2011',
    },
    de: {
      question: 'Ordne diese Videospielreihen nach dem Jahr ihrer Erstveröffentlichung (ältestes zuerst):',
      words: ['Pong', 'Pac-Man', 'Super Mario', 'Minecraft'],
      hint: 'Jahre: 1972, 1980, 1985, 2011',
    },
  },

  // ═══════════════════════════════════════════════════════════════ SPORTS ═════

  {
    category: 'Sports', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which club has won the most UEFA Champions League titles?',
      answers: ['Real Madrid', 'AC Milan', 'Bayern Munich', 'Liverpool'],
    },
    de: {
      question: 'Welcher Verein hat die meisten UEFA-Champions-League-Titel gewonnen?',
      answers: ['Real Madrid', 'AC Mailand', 'Bayern München', 'FC Liverpool'],
    },
  },
  {
    category: 'Sports', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which country has won the most FIFA World Cup titles?',
      answers: ['Brazil', 'Germany', 'Italy', 'Argentina'],
    },
    de: {
      question: 'Welches Land hat die meisten FIFA-Weltmeistertitel gewonnen?',
      answers: ['Brasilien', 'Deutschland', 'Italien', 'Argentinien'],
    },
  },
  {
    category: 'Sports', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'In which city were the 2016 Summer Olympics held?',
      answers: ['Rio de Janeiro', 'Buenos Aires', 'São Paulo', 'Lima'],
    },
    de: {
      question: 'In welcher Stadt fanden die Olympischen Sommerspiele 2016 statt?',
      answers: ['Rio de Janeiro', 'Buenos Aires', 'São Paulo', 'Lima'],
    },
  },
  {
    category: 'Sports', type: 'multiple_choice', correct_index: 1,
    en: {
      question: 'What is the maximum possible break in snooker?',
      answers: ['155', '147', '180', '134'],
    },
    de: {
      question: 'Was ist das maximal mögliche Break beim Snooker?',
      answers: ['155', '147', '180', '134'],
    },
  },
  {
    category: 'Sports', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'What colour is the leader\'s jersey in the Tour de France?',
      answers: ['Yellow', 'Green', 'Red', 'White'],
    },
    de: {
      question: 'Welche Farbe hat das Trikot des Gesamtführenden bei der Tour de France?',
      answers: ['Gelb', 'Grün', 'Rot', 'Weiß'],
    },
  },
  {
    category: 'Sports', type: 'multiple_choice', correct_index: 2,
    en: {
      question: 'How many players from each team are on the pitch in a standard football match?',
      answers: ['10', '12', '11', '9'],
    },
    de: {
      question: 'Wie viele Spieler jeder Mannschaft stehen beim Fußball auf dem Spielfeld?',
      answers: ['10', '12', '11', '9'],
    },
  },
  {
    category: 'Sports', type: 'estimation', correct_value: 3500,
    en: { question: 'Approximately how many kilometres does the Tour de France cover?', unit: 'km' },
    de: { question: 'Ungefähr wie viele Kilometer umfasst die Tour de France?', unit: 'km' },
  },
  {
    category: 'Sports', type: 'estimation', correct_value: 4,
    en: { question: 'How many times has Germany won the FIFA World Cup?' },
    de: { question: 'Wie oft hat Deutschland die FIFA-Weltmeisterschaft gewonnen?' },
  },
  {
    category: 'Sports', type: 'estimation', correct_value: 2009,
    en: { question: 'In which year did Usain Bolt set the 100m world record of 9.58 seconds?' },
    de: { question: 'In welchem Jahr stellte Usain Bolt den 100-m-Weltrekord von 9,58 Sekunden auf?' },
  },
  {
    category: 'Sports', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these football clubs by UEFA Champions League titles, most first:',
      words: ['Real Madrid', 'AC Milan', 'Bayern Munich', 'Barcelona'],
      hint: 'Titles: 14, 7, 6, 5',
    },
    de: {
      question: 'Ordne diese Fußballklubs nach ihren UEFA-Champions-League-Titeln (meiste zuerst):',
      words: ['Real Madrid', 'AC Mailand', 'Bayern München', 'FC Barcelona'],
      hint: 'Titel: 14, 7, 6, 5',
    },
  },
  {
    category: 'Sports', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these sporting events by year of their first edition, oldest first:',
      words: ['Tour de France', 'FIFA World Cup', 'UEFA Champions League', 'Super Bowl'],
      hint: 'First editions: 1903, 1930, 1955/56, 1967',
    },
    de: {
      question: 'Ordne diese Sportereignisse nach dem Jahr ihrer ersten Austragung (ältestes zuerst):',
      words: ['Tour de France', 'FIFA-Weltmeisterschaft', 'UEFA Champions League', 'Super Bowl'],
      hint: 'Erste Austragung: 1903, 1930, 1955/56, 1967',
    },
  },

  // ═══════════════════════════════════════════════════════════════ HISTORY ════

  {
    category: 'History', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'In which year did the Berlin Wall fall?',
      answers: ['1989', '1991', '1987', '1993'],
    },
    de: {
      question: 'In welchem Jahr fiel die Berliner Mauer?',
      answers: ['1989', '1991', '1987', '1993'],
    },
  },
  {
    category: 'History', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'In which city was Archduke Franz Ferdinand assassinated in 1914?',
      answers: ['Sarajevo', 'Vienna', 'Belgrade', 'Budapest'],
    },
    de: {
      question: 'In welcher Stadt wurde Erzherzog Franz Ferdinand 1914 erschossen?',
      answers: ['Sarajevo', 'Wien', 'Belgrad', 'Budapest'],
    },
  },
  {
    category: 'History', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Who was West Germany\'s first Chancellor after World War II?',
      answers: ['Konrad Adenauer', 'Willy Brandt', 'Ludwig Erhard', 'Helmut Schmidt'],
    },
    de: {
      question: 'Wer war der erste Bundeskanzler Westdeutschlands nach dem Zweiten Weltkrieg?',
      answers: ['Konrad Adenauer', 'Willy Brandt', 'Ludwig Erhard', 'Helmut Schmidt'],
    },
  },
  {
    category: 'History', type: 'multiple_choice', correct_index: 1,
    en: {
      question: 'In which year did women first gain the right to vote in Germany?',
      answers: ['1920', '1918', '1933', '1945'],
    },
    de: {
      question: 'In welchem Jahr erhielten Frauen in Deutschland erstmals das Wahlrecht?',
      answers: ['1920', '1918', '1933', '1945'],
    },
  },
  {
    category: 'History', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'In which present-day country did Johannes Gutenberg invent the printing press?',
      answers: ['Germany', 'Netherlands', 'England', 'France'],
    },
    de: {
      question: 'In welchem heutigen Land erfand Johannes Gutenberg den Buchdruck?',
      answers: ['Deutschland', 'Niederlande', 'England', 'Frankreich'],
    },
  },
  {
    category: 'History', type: 'multiple_choice', correct_index: 1,
    en: {
      question: 'Who was the first person to walk on the Moon?',
      answers: ['Buzz Aldrin', 'Neil Armstrong', 'Yuri Gagarin', 'John Glenn'],
    },
    de: {
      question: 'Wer war der erste Mensch, der den Mond betrat?',
      answers: ['Buzz Aldrin', 'Neil Armstrong', 'Juri Gagarin', 'John Glenn'],
    },
  },
  {
    category: 'History', type: 'estimation', correct_value: 1889,
    en: { question: 'In which year was the Eiffel Tower completed?' },
    de: { question: 'In welchem Jahr wurde der Eiffelturm fertiggestellt?' },
  },
  {
    category: 'History', type: 'estimation', correct_value: 116,
    en: { question: 'How many years did the Hundred Years\' War actually last?', unit: 'years' },
    de: { question: 'Wie viele Jahre dauerte der Hundertjährige Krieg tatsächlich?', unit: 'Jahre' },
  },
  {
    category: 'History', type: 'estimation', correct_value: 476,
    en: { question: 'In which year did the Western Roman Empire fall?' },
    de: { question: 'In welchem Jahr fiel das Weströmische Reich?' },
  },
  {
    category: 'History', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these historical events chronologically, earliest first:',
      words: ['American Independence', 'French Revolution', 'WWI begins', 'Moon Landing'],
      hint: 'Years: 1776, 1789, 1914, 1969',
    },
    de: {
      question: 'Ordne diese historischen Ereignisse chronologisch (frühestes zuerst):',
      words: ['Amerikanische Unabhängigkeit', 'Französische Revolution', 'Beginn des 1. Weltkriegs', 'Mondlandung'],
      hint: 'Jahre: 1776, 1789, 1914, 1969',
    },
  },
  {
    category: 'History', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these European revolutions chronologically, earliest first:',
      words: ['Glorious Revolution', 'French Revolution', 'Russian Revolution', 'Fall of Berlin Wall'],
      hint: 'Years: 1688, 1789, 1917, 1989',
    },
    de: {
      question: 'Ordne diese europäischen Revolutionen chronologisch (früheste zuerst):',
      words: ['Glorious Revolution', 'Französische Revolution', 'Russische Revolution', 'Mauerfall'],
      hint: 'Jahre: 1688, 1789, 1917, 1989',
    },
  },

  // ══════════════════════════════════════════════════════════ FOOD & DRINK ════

  {
    category: 'Food & Drink', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Champagne can only legally be produced in which region of France?',
      answers: ['Champagne', 'Bordeaux', 'Burgundy', 'Alsace'],
    },
    de: {
      question: 'In welcher Region Frankreichs darf Champagner ausschließlich hergestellt werden?',
      answers: ['Champagne', 'Bordeaux', 'Burgund', 'Elsass'],
    },
  },
  {
    category: 'Food & Drink', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which country is the world\'s largest producer of olive oil?',
      answers: ['Spain', 'Italy', 'Greece', 'Tunisia'],
    },
    de: {
      question: 'Welches Land ist der weltweit größte Olivenölproduzent?',
      answers: ['Spanien', 'Italien', 'Griechenland', 'Tunesien'],
    },
  },
  {
    category: 'Food & Drink', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Gouda cheese originates from which country?',
      answers: ['Netherlands', 'Germany', 'Denmark', 'Belgium'],
    },
    de: {
      question: 'Aus welchem Land stammt der Gouda-Käse ursprünglich?',
      answers: ['Niederlande', 'Deutschland', 'Dänemark', 'Belgien'],
    },
  },
  {
    category: 'Food & Drink', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'What is "prosciutto"?',
      answers: ['Italian dry-cured ham', 'A type of hard cheese', 'A pasta shape', 'A creamy dessert'],
    },
    de: {
      question: 'Was ist „Prosciutto"?',
      answers: ['Italienischer Rohschinken', 'Eine Art Hartkäse', 'Eine Nudelform', 'Ein cremiges Dessert'],
    },
  },
  {
    category: 'Food & Drink', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which country consumes the most coffee per capita in the world?',
      answers: ['Finland', 'Italy', 'USA', 'Brazil'],
    },
    de: {
      question: 'Welches Land trinkt pro Kopf am meisten Kaffee weltweit?',
      answers: ['Finnland', 'Italien', 'USA', 'Brasilien'],
    },
  },
  {
    category: 'Food & Drink', type: 'multiple_choice', correct_index: 0,
    en: {
      question: 'Which cheese has a Protected Designation of Origin from Greece?',
      answers: ['Feta', 'Halloumi', 'Ricotta', 'Brie'],
    },
    de: {
      question: 'Welcher Käse hat eine geschützte Ursprungsbezeichnung aus Griechenland?',
      answers: ['Feta', 'Halloumi', 'Ricotta', 'Brie'],
    },
  },
  {
    category: 'Food & Drink', type: 'estimation', correct_value: 125,
    en: { question: 'Approximately how many calories does a standard glass of red wine (150 ml) contain?', unit: 'kcal' },
    de: { question: 'Wie viele Kalorien hat ein normales Glas Rotwein (150 ml) ungefähr?', unit: 'kcal' },
  },
  {
    category: 'Food & Drink', type: 'estimation', correct_value: 70,
    en: { question: 'Approximately how many coffee beans are needed to make a single espresso?', unit: 'beans' },
    de: { question: 'Wie viele Kaffeebohnen werden ungefähr für einen Espresso benötigt?', unit: 'Bohnen' },
  },
  {
    category: 'Food & Drink', type: 'estimation', correct_value: 7,
    en: { question: 'Approximately how many litres of beer are consumed at Oktoberfest each year?', unit: 'million litres' },
    de: { question: 'Wie viele Liter Bier werden beim Oktoberfest jährlich ungefähr getrunken?', unit: 'Millionen Liter' },
  },
  {
    category: 'Food & Drink', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these drinks by alcohol content, highest first:',
      words: ['Port wine', 'Red wine', 'Champagne', 'Light beer'],
      hint: 'Approximate %: 20, 13, 12, 4',
    },
    de: {
      question: 'Ordne diese Getränke nach ihrem Alkoholgehalt (höchster zuerst):',
      words: ['Portwein', 'Rotwein', 'Champagner', 'Leichtbier'],
      hint: 'Ungefähre Prozentzahl: 20, 13, 12, 4',
    },
  },
  {
    category: 'Food & Drink', type: 'word_order', correct_order: [0, 1, 2, 3],
    en: {
      question: 'Order these cheeses alphabetically by their country of origin:',
      words: ['Brie', 'Feta', 'Gouda', 'Manchego'],
      hint: 'Countries: France, Greece, Netherlands, Spain',
    },
    de: {
      question: 'Ordne diese Käsesorten alphabetisch nach ihrem Herkunftsland:',
      words: ['Brie', 'Feta', 'Gouda', 'Manchego'],
      hint: 'Länder: Frankreich, Griechenland, Niederlande, Spanien',
    },
  },
];

// ─── Insert ───────────────────────────────────────────────────────────────────

  db.run('BEGIN TRANSACTION');
  try {
    for (const q of questions) {
      db.run(
        `INSERT INTO questions (category, type, time_limit, correct_index, correct_value, correct_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          q.category,
          q.type,
          q.time_limit ?? 20,
          q.correct_index ?? null,
          q.correct_value ?? null,
          q.correct_order ? JSON.stringify(q.correct_order) : null,
        ]
      );
      const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

      for (const lang of ['en', 'de']) {
        const t = q[lang];
        db.run(
          `INSERT INTO translations (question_id, lang, question_text, answers, words, hint, unit)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            lastId, lang, t.question,
            t.answers ? JSON.stringify(t.answers) : null,
            t.words   ? JSON.stringify(t.words)   : null,
            t.hint    ?? null,
            t.unit    ?? null,
          ]
        );
      }
    }
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }

  save();
  console.log(`Seeded ${questions.length} questions (${questions.length * 2} translation rows).`);
})();
