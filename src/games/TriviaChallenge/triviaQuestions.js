/**
 * Default Trivia Questions Bank
 *
 * Structure:
 *   { [categoryName]: { icon, questions: [ { difficulty, question, choices, answer } ] } }
 *
 * - `answer` is the 0-based index of the correct choice.
 * - `difficulty` ranges from 1 (easy) to 5 (hard).
 *
 * Admin can override with custom JSON via the TriviaSettings modal.
 */

const DEFAULT_TRIVIA_QUESTIONS = {
  Movies: {
    icon: "🎬",
    questions: [
      {
        difficulty: 1,
        question: "Who directed Titanic?",
        choices: ["James Cameron", "Steven Spielberg", "Christopher Nolan", "Ridley Scott"],
        answer: 0,
      },
      {
        difficulty: 2,
        question: "Which movie features the fictional world of Pandora?",
        choices: ["Avatar", "Alien", "Dune", "Thor"],
        answer: 0,
      },
      {
        difficulty: 3,
        question: "Who played the Joker in The Dark Knight?",
        choices: ["Joaquin Phoenix", "Heath Ledger", "Jared Leto", "Jack Nicholson"],
        answer: 1,
      },
      {
        difficulty: 4,
        question: "What year was Jurassic Park released?",
        choices: ["1991", "1992", "1993", "1994"],
        answer: 2,
      },
      {
        difficulty: 5,
        question: "Which film won the first Academy Award for Best Picture?",
        choices: ["Sunrise", "Wings", "The Jazz Singer", "All Quiet on the Western Front"],
        answer: 1,
      },
    ],
  },

  Gaming: {
    icon: "🎮",
    questions: [
      {
        difficulty: 1,
        question: "What is Mario's brother's name?",
        choices: ["Luigi", "Yoshi", "Wario", "Toad"],
        answer: 0,
      },
      {
        difficulty: 2,
        question: "Master Chief is the protagonist of which franchise?",
        choices: ["Halo", "Call of Duty", "Battlefield", "Destiny"],
        answer: 0,
      },
      {
        difficulty: 3,
        question: "Geralt of Rivia is the main character of which series?",
        choices: ["Skyrim", "The Witcher", "Dragon Age", "World of Warcraft"],
        answer: 1,
      },
      {
        difficulty: 4,
        question: "What year did the original Nintendo Entertainment System launch in North America?",
        choices: ["1983", "1985", "1987", "1990"],
        answer: 1,
      },
      {
        difficulty: 5,
        question: "In the original God of War, which mythology did Kratos fight against?",
        choices: ["Norse", "Greek", "Roman", "Egyptian"],
        answer: 1,
      },
    ],
  },

  Science: {
    icon: "🔬",
    questions: [
      {
        difficulty: 1,
        question: "What is the chemical formula for water?",
        choices: ["H2O", "CO2", "NaCl", "O2"],
        answer: 0,
      },
      {
        difficulty: 2,
        question: "Which planet is closest to the Sun?",
        choices: ["Earth", "Venus", "Mercury", "Mars"],
        answer: 2,
      },
      {
        difficulty: 3,
        question: "What is the approximate speed of light?",
        choices: ["300,000 km/s", "30,000 km/s", "3,000 km/s", "500,000 km/s"],
        answer: 0,
      },
      {
        difficulty: 4,
        question: "What is the chemical symbol for Gold?",
        choices: ["Ag", "Au", "Gd", "Go"],
        answer: 1,
      },
      {
        difficulty: 5,
        question: "What is the name of the phenomenon where particles appear to communicate instantly across any distance?",
        choices: ["Superposition", "Quantum Entanglement", "Wave Collapse", "Tunneling"],
        answer: 1,
      },
    ],
  },

  History: {
    icon: "📜",
    questions: [
      {
        difficulty: 1,
        question: "Who was the first President of the United States?",
        choices: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"],
        answer: 0,
      },
      {
        difficulty: 2,
        question: "In which year did World War II end?",
        choices: ["1943", "1944", "1945", "1946"],
        answer: 2,
      },
      {
        difficulty: 3,
        question: "Which ancient civilization built the Machu Picchu complex?",
        choices: ["Aztec", "Maya", "Inca", "Olmec"],
        answer: 2,
      },
      {
        difficulty: 4,
        question: "The Rosetta Stone helped decode which writing system?",
        choices: ["Cuneiform", "Egyptian Hieroglyphs", "Linear A", "Sanskrit"],
        answer: 1,
      },
      {
        difficulty: 5,
        question: "Which treaty ended the Thirty Years' War in 1648?",
        choices: ["Treaty of Versailles", "Treaty of Tordesillas", "Peace of Westphalia", "Treaty of Utrecht"],
        answer: 2,
      },
    ],
  },

  Technology: {
    icon: "💻",
    questions: [
      {
        difficulty: 1,
        question: "What does 'CPU' stand for?",
        choices: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Unit"],
        answer: 0,
      },
      {
        difficulty: 2,
        question: "Who is the co-founder of Apple Inc.?",
        choices: ["Bill Gates", "Steve Jobs", "Mark Zuckerberg", "Jeff Bezos"],
        answer: 1,
      },
      {
        difficulty: 3,
        question: "What programming language is known as the 'language of the web'?",
        choices: ["Python", "Java", "JavaScript", "C++"],
        answer: 2,
      },
      {
        difficulty: 4,
        question: "In what year was the World Wide Web invented?",
        choices: ["1985", "1989", "1993", "1995"],
        answer: 1,
      },
      {
        difficulty: 5,
        question: "Which company developed the first commercially successful graphical user interface?",
        choices: ["IBM", "Xerox PARC", "Apple", "Microsoft"],
        answer: 2,
      },
    ],
  },
};

export default DEFAULT_TRIVIA_QUESTIONS;
