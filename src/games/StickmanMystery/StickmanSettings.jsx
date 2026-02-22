import { useState } from "react";
import { AVAILABLE_OBJECTS } from "./StickmanMysteryGame";
import "./StickmanSettings.css";

const STORAGE_KEY = "stickman_custom_config";

/* ── Theme colours per stage ── */
const THEME_FOR_STAGE = [
  { color: 0x00e5ff, emissive: 0x006b80, beacon: 0x00e5ff, label: "#00e5ff" },
  { color: 0xbb86fc, emissive: 0x5d4380, beacon: 0xbb86fc, label: "#bb86fc" },
  { color: 0xff5252, emissive: 0x802929, beacon: 0xff5252, label: "#ff5252" },
  { color: 0xffab00, emissive: 0x805500, beacon: 0xffab00, label: "#ffab00" },
  { color: 0x00e676, emissive: 0x00733b, beacon: 0x00e676, label: "#00e676" },
];

/* ── Default stage data (mirrors DEFAULT_STAGES in the game file) ── */
const DEFAULT_STAGES = [
  {
    name: "The Awakening",
    answer: "23",
    question: "You found two numbers hidden in the chamber. Solve: First Number + Second Number = ?",
    hint: "Simply add the two values you collected from the clues.",
    storyline: "You awaken in an ancient dungeon. The air is damp and cold. Two glowing ledgers catch your eye. Each holds a secret number — add them together to break the first seal!",
    objective: "Collect both number clues, then walk to the Answer Cart. Add the two values together and type the total.",
    clueCount: 2,
    trashCount: 1,
    clues: [
      { name: "Worn Ledger", clue: "First Number = 14", objectShape: "tome" },
      { name: "Crystal Flask", clue: "Second Number = 9", objectShape: "orb" },
    ],
    trash: [
      { name: "Cracked Urn", msg: "The urn crumbles to dust… worthless trash!" },
    ],
    altAnswers: [
      { answer: "12", question: "You found two numbers hidden in the chamber. Solve: First Number + Second Number = ?", clues: [
        { name: "Stone Tablet", clue: "First Number = 7", objectShape: "pillar" },
        { name: "Rune Orb", clue: "Second Number = 5", objectShape: "chest" },
      ]},
      { answer: "30", question: "You found two numbers hidden in the chamber. Solve: First Number + Second Number = ?", clues: [
        { name: "Ancient Chest", clue: "First Number = 18", objectShape: "chest" },
        { name: "Jade Bowl", clue: "Second Number = 12", objectShape: "lantern" },
      ]},
    ],
  },
  {
    name: "The Shadows",
    answer: "13",
    question: "Three rune tablets each reveal an input→output pair. Crack the hidden rule, then apply it: what is the output when the input is 6?",
    hint: "Look at each pair: multiply the input by 2, then add 1. Try it on every pair to confirm, then apply it to 6.",
    storyline: "Beyond the first gate, darkness swallows you whole. Three glowing tablets flicker on the walls, each engraved with a mysterious pair of numbers linked by an arrow. The shadow priests sealed this vault with a numeric rule — only those who can see the pattern will pass!",
    objective: "Collect all 3 pattern tablets. Each shows \"input → output\". Discover the rule linking them, then calculate the missing output for input 6.",
    clueCount: 3,
    trashCount: 2,
    clues: [
      { name: "Shadow Tablet I",   clue: "Pattern Pair I:   2 ➜ 5",  objectShape: "chest" },
      { name: "Shadow Tablet II",  clue: "Pattern Pair II:  4 ➜ 9",  objectShape: "orb" },
      { name: "Shadow Tablet III", clue: "Pattern Pair III: 6 ➜ ?",  objectShape: "lantern" },
    ],
    trash: [
      { name: "Empty Coffer", msg: "The coffer is empty… nothing but a waste of time!" },
      { name: "Dead Compass", msg: "The needle spins wildly… it was cursed!" },
    ],
    altAnswers: [
      { answer: "11", question: "Three rune tablets each reveal an input→output pair. Crack the hidden rule, then apply it: what is the output when the input is 5?", clues: [
        { name: "Void Tablet I",   clue: "Pattern Pair I:   1 ➜ 3",  objectShape: "diamond" },
        { name: "Void Tablet II",  clue: "Pattern Pair II:  3 ➜ 7",  objectShape: "crystal" },
        { name: "Void Tablet III", clue: "Pattern Pair III: 5 ➜ ?",  objectShape: "tome" },
      ]},
      { answer: "19", question: "Three rune tablets each reveal an input→output pair. Crack the hidden rule, then apply it: what is the output when the input is 6?", clues: [
        { name: "Night Tablet I",   clue: "Pattern Pair I:   2 ➜ 7",  objectShape: "mirror" },
        { name: "Night Tablet II",  clue: "Pattern Pair II:  4 ➜ 13", objectShape: "chest" },
        { name: "Night Tablet III", clue: "Pattern Pair III: 6 ➜ ?",  objectShape: "pillar" },
      ]},
    ],
  },
  {
    name: "The Inferno",
    answer: "25",
    question: "Three scorched tablets each show a number and its secret value. Find the hidden rule — then calculate the secret value for 5.",
    hint: "Try multiplying each number by itself (squaring it). Does the rule hold for all three tablets?",
    storyline: "The chamber glows red-hot. Lava cracks beneath the floor. Three scorched stone tablets are mounted on the wall. Each one bears a single number and a result — but the formula connecting them has been burned away. Only the mathematician who rediscovers the rule will survive the Inferno!",
    objective: "Collect all 3 scorched tablets. Each shows \"Number → Secret Value\". Find the mathematical rule and apply it to find the secret value of 5.",
    clueCount: 3,
    trashCount: 2,
    clues: [
      { name: "Scorched Tablet I",   clue: "3 ➜ 9",  objectShape: "orb" },
      { name: "Scorched Tablet II",  clue: "4 ➜ 16", objectShape: "tome" },
      { name: "Scorched Tablet III", clue: "5 ➜ ?",  objectShape: "lantern" },
    ],
    trash: [
      { name: "Ash Pile", msg: "Just a pile of ash… nothing useful here!" },
      { name: "Burnt Scroll", msg: "The scroll is too burnt to read… total waste!" },
    ],
    altAnswers: [
      { answer: "64", question: "Three scorched tablets each show a number and its secret value. Find the hidden rule — then calculate the secret value for 4.", clues: [
        { name: "Lava Tablet I",   clue: "2 ➜ 8",  objectShape: "diamond" },
        { name: "Lava Tablet II",  clue: "3 ➜ 27", objectShape: "mirror" },
        { name: "Lava Tablet III", clue: "4 ➜ ?",  objectShape: "chest" },
      ]},
      { answer: "30", question: "Three scorched tablets each show a number and its secret value. Find the hidden rule — then calculate the secret value for 5.", clues: [
        { name: "Ember Tablet I",   clue: "3 ➜ 12", objectShape: "crystal" },
        { name: "Ember Tablet II",  clue: "4 ➜ 20", objectShape: "pillar" },
        { name: "Ember Tablet III", clue: "5 ➜ ?",  objectShape: "orb" },
      ]},
    ],
  },
  {
    name: "The Radiance",
    answer: "WEST",
    question: "Follow the compass directions listed in your clues — in order. You start NORTH. What direction are you facing at the end? (NORTH / EAST / SOUTH / WEST)",
    hint: "Face NORTH. Each turn rotates you 90°: RIGHT = clockwise, LEFT = counter-clockwise.",
    storyline: "Blinding golden light floods the chamber. A compass rose is carved into the floor. Four glowing stones describe a sequence of turns. Only the navigator who reaches the correct bearing may proceed!",
    objective: "Collect all 4 direction clues. Follow each turn from the starting direction (NORTH) and submit your final bearing.",
    clueCount: 4,
    trashCount: 3,
    clues: [
      { name: "Compass Rose", clue: "You start facing NORTH", objectShape: "chest" },
      { name: "Wind Vane I", clue: "First turn: RIGHT", objectShape: "orb" },
      { name: "Sun Dial II", clue: "Second turn: RIGHT", objectShape: "tome" },
      { name: "Sky Chart III", clue: "Third turn: RIGHT", objectShape: "lantern" },
    ],
    trash: [
      { name: "Fool's Gold", msg: "It's just fool's gold… completely worthless!" },
      { name: "Tarnished Ring", msg: "The ring turns to rust… it was cursed!" },
      { name: "Hollow Gem", msg: "The gem is hollow inside… just a trick!" },
    ],
    altAnswers: [
      { answer: "EAST", question: "Follow the compass directions listed in your clues — in order. You start NORTH. What direction are you facing at the end? (NORTH / EAST / SOUTH / WEST)", clues: [
        { name: "Bearing Stone", clue: "You start facing NORTH", objectShape: "diamond" },
        { name: "Course Rune I", clue: "First turn: RIGHT", objectShape: "mirror" },
        { name: "Course Rune II", clue: "Second turn: LEFT", objectShape: "crystal" },
        { name: "Course Rune III", clue: "Third turn: RIGHT", objectShape: "pillar" },
      ]},
      { answer: "SOUTH", question: "Follow the compass directions listed in your clues — in order. You start NORTH. What direction are you facing at the end? (NORTH / EAST / SOUTH / WEST)", clues: [
        { name: "Astrolabe", clue: "You start facing NORTH", objectShape: "chest" },
        { name: "Heading Slab I", clue: "First turn: RIGHT", objectShape: "orb" },
        { name: "Heading Slab II", clue: "Second turn: RIGHT", objectShape: "chest" },
        { name: "Heading Slab III", clue: "Third turn: LEFT", objectShape: "tome" },
      ]},
    ],
  },
  {
    name: "The Revelation",
    answer: "VAULT",
    question: "Five rune stones each hold one encoded letter. The ancient cipher shifts every letter FORWARD 3 positions (A→D, B→E … Z→C). Decode the 5-letter word by shifting each letter BACK 3.",
    hint: "Reverse the shift: subtract 3 from each letter's position. Y→V, D→A, X→U, O→L, W→T.",
    storyline: "The final chamber. Ancient runes glow green on every wall. Five encoded letters are carved into stone pillars. The cipher of the ancients shifts every letter forward by three — only by reversing the shift will the great door open!",
    objective: "Collect all 5 rune stones. Each shows one encoded letter. Shift each letter BACK by 3 to decode, then submit the 5-letter word.",
    clueCount: 5,
    trashCount: 3,
    clues: [
      { name: "Verdant Rune I", clue: "Encoded letter 1: Y", objectShape: "tome" },
      { name: "Verdant Rune II", clue: "Encoded letter 2: D", objectShape: "orb" },
      { name: "Verdant Rune III", clue: "Encoded letter 3: X", objectShape: "lantern" },
      { name: "Verdant Rune IV", clue: "Encoded letter 4: O", objectShape: "chest" },
      { name: "Verdant Rune V", clue: "Encoded letter 5: W", objectShape: "diamond" },
    ],
    trash: [
      { name: "Dead Root", msg: "The root withers in your hands… cursed garbage!" },
      { name: "Withered Leaf", msg: "The leaf crumbles to nothing… a trap!" },
      { name: "Hollow Bark", msg: "The bark is hollow and rotten… just junk!" },
    ],
    altAnswers: [
      { answer: "FLAME", question: "Five rune stones each hold one encoded letter. The ancient cipher shifts every letter FORWARD 3 positions (A→D, B→E … Z→C). Decode the 5-letter word by shifting each letter BACK 3.", clues: [
        { name: "Ember Glyph I", clue: "Encoded letter 1: I", objectShape: "orb" },
        { name: "Ember Glyph II", clue: "Encoded letter 2: O", objectShape: "chest" },
        { name: "Ember Glyph III", clue: "Encoded letter 3: D", objectShape: "pillar" },
        { name: "Ember Glyph IV", clue: "Encoded letter 4: P", objectShape: "diamond" },
        { name: "Ember Glyph V", clue: "Encoded letter 5: H", objectShape: "crystal" },
      ]},
      { answer: "STONE", question: "Five rune stones each hold one encoded letter. The ancient cipher shifts every letter FORWARD 3 positions (A→D, B→E … Z→C). Decode the 5-letter word by shifting each letter BACK 3.", clues: [
        { name: "Rock Cipher I", clue: "Encoded letter 1: V", objectShape: "mirror" },
        { name: "Rock Cipher II", clue: "Encoded letter 2: W", objectShape: "tome" },
        { name: "Rock Cipher III", clue: "Encoded letter 3: R", objectShape: "orb" },
        { name: "Rock Cipher IV", clue: "Encoded letter 4: Q", objectShape: "chest" },
        { name: "Rock Cipher V", clue: "Encoded letter 5: H", objectShape: "lantern" },
      ]},
    ],
  },
];

/* ── Helpers ──────────────────────────────────────────── */

/** Strip private fields before storing/displaying as plain JSON */
function stagesToJson(stagesList) {
  return stagesList.map((s) => {
    // eslint-disable-next-line no-unused-vars
    const { theme, mode, selectedAlt, customAnswer, customQuestion, customStoryline, customObjective, customClues, ...clean } = s;
    return clean;
  });
}

/**
 * stagesToJson with inline stage-number comments injected as "//" keys.
 * These are valid JSON (the key name is just "//") and get stripped on parse.
 */
function stagesToJsonLabeled(stagesList) {
  return stagesList.map((s, i) => {
    // eslint-disable-next-line no-unused-vars
    const { theme, mode, selectedAlt, customAnswer, customQuestion, customStoryline, customObjective, customClues, ...clean } = s;
    return { "//": `━━━ Stage ${i + 1}: ${clean.name || `Stage ${i + 1}`} ━━━`, ...clean };
  });
}

/** Strip "//" comment keys that stagesToJsonLabeled injects */
function stripJsonComments(stagesArray) {
  return stagesArray.map(({ "//": _c, ...rest }) => rest);
}

/** Load persisted config from localStorage. Returns {stages, source}. */
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.stages && Array.isArray(parsed.stages) && parsed.stages.length > 0) {
        return { stages: parsed.stages, source: "saved" };
      }
    }
  } catch { /* ignore */ }
  return { stages: DEFAULT_STAGES, source: "default" };
}

/** Persist config to localStorage (strip themes — re-added at game load) */
function persist(finalStages) {
  try {
    // eslint-disable-next-line no-unused-vars
    const clean = finalStages.map(({ theme, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ stages: clean }));
  } catch { /* ignore */ }
}

/* ══════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════ */
const StickmanSettings = ({ onSave, onCancel }) => {
  const { stages: savedStages, source: savedSource } = loadSaved();

  /* ── Global editor mode ── */
  const [editorMode, setEditorMode] = useState("structured"); // "structured" | "json"
  const [configSource] = useState(savedSource);

  /* ── Structured-editor state ── */
  const [stages, setStages] = useState(() =>
    savedStages.map((s) => ({
      ...s,
      mode: "default",
      selectedAlt: 0,
      customAnswer: "",
      customQuestion: s.question || "",
      customStoryline: s.storyline || "",
      customObjective: s.objective || "",
      customClues: (s.clues || []).map((c) => ({ ...c })),
    }))
  );

  /* ── JSON-editor state ── */
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(stagesToJsonLabeled(savedStages), null, 2)
  );
  const [jsonError, setJsonError] = useState("");

  /* ── Validation state ── */
  const [validation, setValidation] = useState({ errors: [], warnings: [], pendingStages: null });

  /* ═══════════════════════════════════════════
     Structured-editor helpers
  ═══════════════════════════════════════════ */
  const updateStage = (idx, changes) =>
    setStages((prev) => prev.map((s, i) => (i === idx ? { ...s, ...changes } : s)));

  const updateCustomClue = (stageIdx, clueIdx, field, value) => {
    setStages((prev) =>
      prev.map((s, i) => {
        if (i !== stageIdx) return s;
        const clues = [...s.customClues];
        clues[clueIdx] = { ...clues[clueIdx], [field]: value };
        return { ...s, customClues: clues };
      })
    );
  };

  const addCustomClue = (stageIdx) => {
    setStages((prev) =>
      prev.map((s, i) => {
        if (i !== stageIdx) return s;
        return {
          ...s,
          customClues: [
            ...s.customClues,
            { name: `Clue ${s.customClues.length + 1}`, clue: "", objectShape: "chest" },
          ],
        };
      })
    );
  };

  const removeCustomClue = (stageIdx, clueIdx) => {
    setStages((prev) =>
      prev.map((s, i) => {
        if (i !== stageIdx) return s;
        return { ...s, customClues: s.customClues.filter((_, ci) => ci !== clueIdx) };
      })
    );
  };

  /* ═══════════════════════════════════════════
     Build final stages from structured state
  ═══════════════════════════════════════════ */
  const buildFromStructured = () =>
    stages.map((s, idx) => {
      const theme = THEME_FOR_STAGE[idx];
      if (s.mode === "alternative" && s.altAnswers?.[s.selectedAlt]) {
        const alt = s.altAnswers[s.selectedAlt];
        return {
          name: s.name,
          answer: alt.answer,
          question: alt.question || s.question,
          hint: s.hint,
          storyline: s.storyline,
          objective: s.objective,
          clueCount: alt.clues.length,
          trashCount: s.trashCount,
          theme,
          clues: alt.clues,
          trash: s.trash,
          altAnswers: s.altAnswers,
        };
      }
      if (s.mode === "custom") {
        return {
          name: s.name,
          answer: s.customAnswer || s.answer,
          question: s.customQuestion || s.question,
          hint: s.hint,
          storyline: s.customStoryline || s.storyline,
          objective: s.customObjective || s.objective,
          clueCount: s.customClues.length,
          trashCount: s.trashCount,
          theme,
          clues: s.customClues.filter((c) => c.clue?.trim()),
          trash: s.trash,
          altAnswers: s.altAnswers,
        };
      }
      return {
        name: s.name,
        answer: s.answer,
        question: s.question,
        hint: s.hint,
        storyline: s.storyline,
        objective: s.objective,
        clueCount: s.clueCount,
        trashCount: s.trashCount,
        theme,
        clues: s.clues,
        trash: s.trash,
        altAnswers: s.altAnswers,
      };
    });

  /* ═══════════════════════════════════════════
     JSON validation
  ═══════════════════════════════════════════ */
  const validateJson = (text) => {
    try {
      const raw = JSON.parse(text);
      if (!Array.isArray(raw)) return "Root must be a JSON array of stage objects.";
      if (raw.length === 0) return "Array must contain at least one stage.";
      const parsed = stripJsonComments(raw);
      for (let i = 0; i < parsed.length; i++) {
        const s = parsed[i];
        if (!s.name) return `Stage ${i + 1}: missing "name" field.`;
        if (!s.answer) return `Stage ${i + 1}: missing "answer" field.`;
        if (!s.question) return `Stage ${i + 1}: missing "question" field.`;
        if (!Array.isArray(s.clues) || s.clues.length === 0)
          return `Stage ${i + 1}: "clues" must be a non-empty array.`;
      }
      return null;
    } catch (e) {
      return "JSON syntax error: " + e.message;
    }
  };

  /* ═══════════════════════════════════════════
     Stage validator
  ═══════════════════════════════════════════ */
  const validateFinalStages = (stagesList) => {
    const errors = [];
    const warnings = [];
    if (!Array.isArray(stagesList) || stagesList.length === 0) {
      errors.push("No stages defined.");
      return { errors, warnings };
    }
    stagesList.forEach((s, i) => {
      const label = `Stage ${i + 1} "${s.name || "unnamed"}"`;
      if (!s.name?.trim()) warnings.push(`${label}: missing stage name.`);
      if (!s.answer?.toString().trim()) errors.push(`${label}: answer is empty — players will never be able to complete it.`);
      if (!s.question?.trim()) errors.push(`${label}: puzzle question is empty.`);
      if (!Array.isArray(s.clues) || s.clues.length === 0) {
        errors.push(`${label}: must have at least 1 clue object.`);
      } else {
        s.clues.forEach((c, ci) => {
          const cLabel = `${label} — Clue ${ci + 1}`;
          if (!c.clue?.trim()) errors.push(`${cLabel}: clue text is empty.`);
          if (!c.name?.trim()) warnings.push(`${cLabel}: object display name is empty.`);
          if (!c.objectShape) warnings.push(`${cLabel}: no 3D object shape selected.`);
        });
      }
      if (s.clueCount !== undefined && s.clues && s.clueCount !== s.clues.length) {
        warnings.push(`${label}: clueCount (${s.clueCount}) does not match actual number of clues (${s.clues?.length}).`);
      }
      if (!s.storyline?.trim()) warnings.push(`${label}: storyline text is empty — players will see no intro.`);
      if (!s.objective?.trim()) warnings.push(`${label}: objective text is empty — players won't know what to do.`);
    });
    return { errors, warnings };
  };

  /* ═══════════════════════════════════════════
     Save
  ═══════════════════════════════════════════ */
  const handleSave = () => {
    let finalStages;
    if (editorMode === "json") {
      const err = validateJson(jsonText);
      if (err) { setJsonError(err); return; }
      setJsonError("");
      const parsed = stripJsonComments(JSON.parse(jsonText));
      finalStages = parsed.map((s, i) => ({
        ...s,
        theme: THEME_FOR_STAGE[i] || THEME_FOR_STAGE[4],
      }));
    } else {
      finalStages = buildFromStructured();
    }
    const { errors, warnings } = validateFinalStages(finalStages);
    if (errors.length > 0 || warnings.length > 0) {
      setValidation({ errors, warnings, pendingStages: finalStages });
      if (errors.length > 0) return; // block save on errors
    } else {
      setValidation({ errors: [], warnings: [], pendingStages: null });
    }
    persist(finalStages);
    onSave({ stages: finalStages });
  };

  /* Save anyway despite warnings (no errors) */
  const handleSaveForce = () => {
    if (!validation.pendingStages) return;
    persist(validation.pendingStages);
    onSave({ stages: validation.pendingStages });
  };

  /* ── Reset to defaults ── */
  const handleReset = () => {
    if (!window.confirm("Reset all stages to built-in defaults? This will also clear your saved config.")) return;
    localStorage.removeItem(STORAGE_KEY);
    setStages(
      DEFAULT_STAGES.map((s) => ({
        ...s,
        mode: "default",
        selectedAlt: 0,
        customAnswer: "",
        customQuestion: s.question,
        customStoryline: s.storyline,
        customObjective: s.objective,
        customClues: s.clues.map((c) => ({ ...c })),
      }))
    );
    setJsonText(JSON.stringify(stagesToJsonLabeled(DEFAULT_STAGES), null, 2));
    setJsonError("");
  };

  /* ── Sync JSON ← structured ── */
  const syncJsonFromStructured = () => {
    const built = buildFromStructured();
    setJsonText(JSON.stringify(stagesToJsonLabeled(built), null, 2));
    setJsonError("");
    setEditorMode("json");
  };

  /* ── Apply JSON → structured ── */
  const applyJsonToStructured = () => {
    const err = validateJson(jsonText);
    if (err) { setJsonError(err); return; }
    setJsonError("");
    const parsed = stripJsonComments(JSON.parse(jsonText));
    setStages(
      parsed.map((s) => ({
        ...s,
        mode: "default",
        selectedAlt: 0,
        customAnswer: "",
        customQuestion: s.question || "",
        customStoryline: s.storyline || "",
        customObjective: s.objective || "",
        customClues: (s.clues || []).map((c) => ({ ...c })),
      }))
    );
    setEditorMode("structured");
  };

  /* ═══════════════════════════════════════════
     Render
  ═══════════════════════════════════════════ */
  return (
    <div className="sms-fs-wrap">

      {/* ══════════════════════════════════════
          STICKY TOP BAR
      ══════════════════════════════════════ */}
      <div className="sms-fs-topbar">
        <div className="sms-fs-title-row">
          <div>
            <div className="sms-header-top">
              <h2>🏃 Stickman Mystery — Game Settings</h2>
              {configSource === "saved" && (
                <span className="sms-storage-badge">💾 Loaded from saved config</span>
              )}
            </div>
            <p className="sms-header-sub">
              Configure clues, questions, storylines, and answers for each stage. Changes are saved to your browser.
            </p>
          </div>
          <button className="sms-fs-close-btn" onClick={onCancel} title="Close settings">✕</button>
        </div>

        {/* Editor tabs */}
        <div className="sms-editor-tabs">
          <button
            className={`sms-tab-btn ${editorMode === "structured" ? "active" : ""}`}
            onClick={() => setEditorMode("structured")}
          >
            🗂️ Stage Editor
          </button>
          <button
            className={`sms-tab-btn ${editorMode === "json" ? "active" : ""}`}
            onClick={() => {
              const built = buildFromStructured();
              setJsonText(JSON.stringify(stagesToJsonLabeled(built), null, 2));
              setEditorMode("json");
            }}
          >
            {"{ }"} JSON Editor
          </button>
          <div className="sms-tab-spacer" />
          <button className="sms-reset-btn" onClick={handleReset} title="Reset all stages to default values">
            ↺ Reset Defaults
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════
          SCROLLABLE BODY
      ══════════════════════════════════════ */}
      <div className="sms-fs-body">

        {/* ─── JSON EDITOR ─── */}
        {editorMode === "json" && (
          <div className="sms-json-panel">
            <div className="sms-json-toolbar">
              <span className="sms-json-desc">
                Edit all 5 stages as a single JSON array. All fields are fully customisable.
              </span>
              <button className="sms-json-apply-btn" onClick={applyJsonToStructured}>
                ↩ Apply to Stage Editor
              </button>
            </div>

            <textarea
              className={`sms-json-textarea ${jsonError ? "has-error" : ""}`}
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(""); }}
              spellCheck={false}
            />

            {jsonError && <div className="sms-json-error">⚠ {jsonError}</div>}

            <div className="sms-json-schema-hint">
              <strong>Required per stage:</strong>{" "}
              <code>name</code>, <code>answer</code>, <code>question</code>,{" "}
              <code>storyline</code>, <code>objective</code>, <code>clueCount</code>,{" "}
              <code>trashCount</code>, <code>clues[]</code>, <code>trash[]</code>.
              <br />
              Each clue: <code>name</code>, <code>clue</code>, <code>objectShape</code>{" "}
              (chest | orb | tome | lantern | mirror | diamond | pillar | crystal).
              <br />
              Optional: <code>hint</code>, <code>altAnswers[]</code>{" "}
              — each alt: <code>{"{ answer, question, clues[] }"}</code>.
            </div>
          </div>
        )}

        {/* ─── STAGE EDITOR ─── */}
        {editorMode === "structured" && (
          <div className="sms-stages">
            {stages.map((stage, idx) => (
              <div
                key={idx}
                className="sms-stage-card"
                style={{ borderLeftColor: THEME_FOR_STAGE[idx].label }}
              >
                {/* Stage header */}
                <div className="sms-stage-header" style={{ background: THEME_FOR_STAGE[idx].label + "22" }}>
                  <div className="sms-stage-title-row">
                    <h3 style={{ color: THEME_FOR_STAGE[idx].label }}>
                      Stage {idx + 1}: {stage.name}
                    </h3>
                    <span className="sms-difficulty-badge">
                      {idx < 2 ? "🟢 Easy" : idx < 4 ? "🟡 Medium" : "🔴 Hard"}
                    </span>
                  </div>
                  <div className="sms-puzzle-meta">
                    <span className="sms-puzzle-type">
                      {["➕ Addition", "� Pattern Mapping (rule: ×2+1)", "🔗 Number Sequence (rule: n²)", "🧭 Direction Turns", "🔐 Caesar Cipher"][idx]}
                    </span>
                    <span className="sms-clue-count-badge">
                      {stage.clueCount} clues · {stage.trashCount} traps
                    </span>
                  </div>
                </div>

                {/* Current question preview */}
                <div className="sms-question-preview">
                  <span className="sms-label">❓ Puzzle Question:</span>
                  <span className="sms-question-text">
                    {stage.mode === "custom" && stage.customQuestion
                      ? stage.customQuestion
                      : stage.mode === "alternative" && stage.altAnswers?.[stage.selectedAlt]?.question
                      ? stage.altAnswers[stage.selectedAlt].question
                      : stage.question}
                  </span>
                </div>

                {/* Mode selector */}
                <div className="sms-mode-selector">
                  <button
                    className={`sms-mode-btn ${stage.mode === "default" ? "active" : ""}`}
                    onClick={() => updateStage(idx, { mode: "default" })}
                  >
                    📋 Default
                  </button>
                  {stage.altAnswers?.length > 0 && (
                    <button
                      className={`sms-mode-btn ${stage.mode === "alternative" ? "active" : ""}`}
                      onClick={() => updateStage(idx, { mode: "alternative" })}
                    >
                      🔄 Alternative ({stage.altAnswers.length})
                    </button>
                  )}
                  <button
                    className={`sms-mode-btn ${stage.mode === "custom" ? "active" : ""}`}
                    onClick={() => updateStage(idx, { mode: "custom" })}
                  >
                    ✏️ Custom
                  </button>
                </div>

                {/* ── DEFAULT mode ── */}
                {stage.mode === "default" && (
                  <div className="sms-mode-content">
                    <div className="sms-answer-row">
                      <span className="sms-label">Answer:</span>
                      <span className="sms-answer-value">{stage.answer}</span>
                      {stage.hint && (
                        <span className="sms-hint-inline" title={stage.hint}>💡 Hint available</span>
                      )}
                    </div>
                    <details className="sms-details">
                      <summary className="sms-details-summary">📖 Storyline & Objective</summary>
                      <div className="sms-details-body">
                        <p className="sms-story-text">{stage.storyline}</p>
                        <p className="sms-objective-text"><em>{stage.objective}</em></p>
                        {stage.hint && <p className="sms-hint-text">💡 <strong>Hint:</strong> {stage.hint}</p>}
                      </div>
                    </details>
                    <div className="sms-clues-list">
                      {(stage.clues || []).map((c, ci) => (
                        <div key={ci} className="sms-clue-row">
                          <span className="sms-clue-shape">
                            {AVAILABLE_OBJECTS.find((o) => o.id === c.objectShape)?.icon || "📦"}
                          </span>
                          <span className="sms-clue-name">{c.name}</span>
                          <span className="sms-clue-text">{c.clue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── ALTERNATIVE mode ── */}
                {stage.mode === "alternative" && (
                  <div className="sms-mode-content">
                    <p className="sms-alt-intro">Choose an alternative puzzle set for this stage:</p>
                    <div className="sms-alt-options">
                      {(stage.altAnswers || []).map((alt, ai) => (
                        <div
                          key={ai}
                          className={`sms-alt-card ${stage.selectedAlt === ai ? "selected" : ""}`}
                          onClick={() => updateStage(idx, { selectedAlt: ai })}
                        >
                          <div className="sms-alt-header">
                            <span className="sms-alt-answer">Answer: <strong>{alt.answer}</strong></span>
                            {stage.selectedAlt === ai && <span className="sms-alt-check">✓</span>}
                          </div>
                          {alt.question && (
                            <p className="sms-alt-question">{alt.question}</p>
                          )}
                          <div className="sms-clues-list">
                            {(alt.clues || []).map((c, ci) => (
                              <div key={ci} className="sms-clue-row sms-clue-row-sm">
                                <span className="sms-clue-shape">
                                  {AVAILABLE_OBJECTS.find((o) => o.id === c.objectShape)?.icon || "📦"}
                                </span>
                                <span className="sms-clue-name">{c.name}</span>
                                <span className="sms-clue-text">{c.clue}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── CUSTOM mode ── */}
                {stage.mode === "custom" && (
                  <div className="sms-mode-content">
                    <div className="sms-custom-grid">
                      <div className="sms-custom-field">
                        <label>Answer <em>(what players type)</em></label>
                        <input
                          type="text"
                          value={stage.customAnswer}
                          onChange={(e) => updateStage(idx, { customAnswer: e.target.value.toUpperCase() })}
                          placeholder={`Default: ${stage.answer}`}
                          maxLength={30}
                        />
                      </div>

                      <div className="sms-custom-field sms-custom-field-wide">
                        <label>Puzzle Question <em>(shown at Answer Cart)</em></label>
                        <input
                          type="text"
                          value={stage.customQuestion}
                          onChange={(e) => updateStage(idx, { customQuestion: e.target.value })}
                          placeholder={stage.question}
                          maxLength={200}
                        />
                      </div>

                      <div className="sms-custom-field sms-custom-field-wide">
                        <label>Storyline <em>(intro paragraph)</em></label>
                        <textarea
                          value={stage.customStoryline}
                          onChange={(e) => updateStage(idx, { customStoryline: e.target.value })}
                          placeholder={stage.storyline}
                          rows={2}
                          maxLength={400}
                        />
                      </div>

                      <div className="sms-custom-field sms-custom-field-wide">
                        <label>Objective <em>(player instructions)</em></label>
                        <textarea
                          value={stage.customObjective}
                          onChange={(e) => updateStage(idx, { customObjective: e.target.value })}
                          placeholder={stage.objective}
                          rows={2}
                          maxLength={300}
                        />
                      </div>
                    </div>

                    <div className="sms-custom-clues">
                      <div className="sms-custom-clues-header">
                        <h4>Clues ({stage.customClues.length})</h4>
                        <button className="sms-add-clue" onClick={() => addCustomClue(idx)}>
                          + Add Clue
                        </button>
                      </div>
                      {stage.customClues.map((c, ci) => (
                        <div key={ci} className="sms-custom-clue-row">
                          <span className="sms-clue-num">#{ci + 1}</span>
                          <input
                            type="text"
                            className="sms-custom-name"
                            value={c.name}
                            onChange={(e) => updateCustomClue(idx, ci, "name", e.target.value)}
                            placeholder="Object name"
                          />
                          <input
                            type="text"
                            className="sms-custom-text"
                            value={c.clue}
                            onChange={(e) => updateCustomClue(idx, ci, "clue", e.target.value)}
                            placeholder="Clue text shown to players"
                          />
                          <select
                            value={c.objectShape}
                            onChange={(e) => updateCustomClue(idx, ci, "objectShape", e.target.value)}
                            className="sms-custom-shape"
                          >
                            {AVAILABLE_OBJECTS.map((obj) => (
                              <option key={obj.id} value={obj.id}>
                                {obj.icon} {obj.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="sms-remove-clue"
                            onClick={() => removeCustomClue(idx, ci)}
                            title="Remove clue"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          STICKY FOOTER
      ══════════════════════════════════════ */}
      <div className="sms-fs-footer">

        {/* ── Validation panel ── */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className={`sms-validation-panel ${validation.errors.length > 0 ? "has-errors" : "has-warnings"}`}>
            <div className="sms-validation-header">
              {validation.errors.length > 0 ? (
                <span className="sms-val-title sms-val-error-title">
                  🚫 {validation.errors.length} Error{validation.errors.length > 1 ? "s" : ""} — Fix before saving
                </span>
              ) : (
                <span className="sms-val-title sms-val-warn-title">
                  ⚠️ {validation.warnings.length} Warning{validation.warnings.length > 1 ? "s" : ""}
                </span>
              )}
              <button className="sms-val-dismiss" onClick={() => setValidation({ errors: [], warnings: [], pendingStages: null })}>✕</button>
            </div>
            <ul className="sms-validation-list">
              {validation.errors.map((e, i) => (
                <li key={i} className="sms-val-item sms-val-error">🚫 {e}</li>
              ))}
              {validation.warnings.map((w, i) => (
                <li key={i} className="sms-val-item sms-val-warning">⚠️ {w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Actions bar ── */}
        <div className="sms-actions">
          <div className="sms-actions-left">
            {editorMode === "structured" ? (
              <button className="sms-json-switch-btn" onClick={syncJsonFromStructured}>
                {"{ }"} Edit as JSON
              </button>
            ) : (
              <button className="sms-json-switch-btn" onClick={applyJsonToStructured}>
                🗂 Switch to Stage Editor
              </button>
            )}
          </div>
          <div className="sms-actions-right">
            <button className="sms-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            {validation.errors.length === 0 && validation.warnings.length > 0 && validation.pendingStages ? (
              <button className="sms-save-btn sms-save-warn-btn" onClick={handleSaveForce}>
                ⚠️ Save Anyway
              </button>
            ) : (
              <button className="sms-save-btn" onClick={handleSave}>
                ✅ Save & Apply
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickmanSettings;

