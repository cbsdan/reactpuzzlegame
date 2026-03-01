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

export const GAMES = [
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
