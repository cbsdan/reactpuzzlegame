/**
 * Game Registry
 *
 * To add a new game:
 * 1. Create a folder under src/games/<YourGame>/
 * 2. Export PlayerComponent  – what players see during the game
 * 3. Export AdminDashboard   – what the admin sees while the game runs
 * 4. Add an entry below following the same shape
 */

import NumberMysteryGame from "../components/NumberMysteryGame";
import NumberMysteryAdminDashboard from "./NumberMystery/AdminDashboard";
import StickmanMysteryGame from "./StickmanMystery/StickmanMysteryGame";
import StickmanMysteryAdminDashboard from "./StickmanMystery/AdminDashboard";
import TriviaChallengeGame from "./TriviaChallenge/TriviaChallengeGame";
import TriviaChallengeAdminDashboard from "./TriviaChallenge/TriviaChallengeAdminDashboard";

export const GAMES = [
  {
    id: "trivia-challenge",
    name: "Trivia Challenge",
    icon: "🧠",
    description:
      "A fast-paced trivia game with rounds, categories, and a live leaderboard.",
    PlayerComponent: TriviaChallengeGame,
    AdminDashboard: TriviaChallengeAdminDashboard,
  },
  {
    id: "stickman-mystery",
    name: "Stickman Mystery",
    icon: "🏃",
    description:
      "Explore a 3D world as a stickman, collect 5 clues from mysterious objects, and solve the riddle before time runs out.",
    PlayerComponent: StickmanMysteryGame,
    AdminDashboard: StickmanMysteryAdminDashboard,
  },
  {
    id: "number-mystery",
    name: "Number Mystery",
    icon: "🔍",
    description:
      "Players guess a secret 4-digit code using Bulls & Cows clues. Score is based on speed and fewest guesses.",
    PlayerComponent: NumberMysteryGame,
    AdminDashboard: NumberMysteryAdminDashboard,
  },
];

/** Look up a game config by its id. Returns undefined if not found. */
export const getGame = (id) => GAMES.find((g) => g.id === id);
