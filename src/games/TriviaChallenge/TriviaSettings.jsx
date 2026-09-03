import { useState, useMemo, useCallback, useEffect } from "react";
import DEFAULT_TRIVIA_QUESTIONS from "./triviaQuestions";
import "./TriviaSettings.css";

/**
 * TriviaSettings – Admin modal for configuring a Trivia Challenge session.
 *
 * Props:
 *   onSave(config)  – called with the final config object
 *   onCancel()      – close without saving
 */

const DIFF_LABELS = { 1: "Easy", 2: "Medium", 3: "Hard", 4: "Expert", 5: "Master" };

const DEFAULT_CATS = Object.keys(DEFAULT_TRIVIA_QUESTIONS);

/** Suggested icons for new categories */
const ICON_PRESETS = [
  "🌍", "🎭", "🏆", "🎵", "🍕", "🚀", "⚽", "🐾", "🎨", "📚",
  "🧪", "💡", "🌿", "🏛️", "🎲", "🧩", "🌊", "🔭", "🎯", "👾",
  "🦁", "🌸", "🎸", "🏋️", "💎", "🧠", "🎬", "🎮", "🔬", "📜",
];

/** Build initial editor state for a single category */
function buildEditorEntry(questions, modified = false, icon = "❓", isCustomCat = false) {
  return {
    icon,
    questions: questions.map((q) => ({ ...q, choices: [...q.choices] })),
    modified,
    isCustomCat,
    isDirty: false,
  };
}

const DEFAULT_TEXT_IMPORT_TEMPLATE = `1. Which game features the character Mario?
A. Minecraft
B. Super Mario Bros.
C. Fortnite
D. Roblox
Answer: B

2. Who directed Titanic?
A. James Cameron
B. Steven Spielberg
C. Christopher Nolan
D. Ridley Scott
Answer: A`;

function parseClientTextQuestions(rawText, defaultDifficulty = 1) {
  if (!rawText || typeof rawText !== "string") return [];
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return [];

  const lines = text.split("\n").map((l) => l.trim());
  const blocks = [];
  let currentBlock = [];

  const questionStartRe = /^(?:\d+[\.\)]|Q\d+[:\.]?)\s*/i;

  for (const line of lines) {
    if (!line) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }

    const hasAnswer = currentBlock.some((l) => /^(?:Answer|Ans|Correct)[:\s]/i.test(l));
    if (questionStartRe.test(line) && currentBlock.length > 0 && (hasAnswer || currentBlock.length >= 3)) {
      blocks.push(currentBlock);
      currentBlock = [];
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const parsed = [];

  for (const block of blocks) {
    let qText = "";
    const choices = [];
    let answerStr = "";

    const choiceRe = /^(?:[A-Da-d0-9][\.\)]|[A-Da-d0-9]\s*[-–—])\s*(.+)/;
    const answerRe = /^(?:Answer|Ans|Correct)[:\s]*\s*(.+)/i;

    for (const line of block) {
      const ansMatch = line.match(answerRe);
      if (ansMatch) {
        answerStr = ansMatch[1].trim();
        continue;
      }

      const choiceMatch = line.match(choiceRe);
      if (choiceMatch) {
        choices.push(choiceMatch[1].trim());
        continue;
      }

      if (choices.length === 0 && !answerStr) {
        const cleanLine = line.replace(questionStartRe, "").trim();
        if (cleanLine) {
          qText = qText ? qText + " " + cleanLine : cleanLine;
        }
      }
    }

    if (!qText || choices.length < 2) continue;

    let answerIdx = 0;
    if (answerStr) {
      const upperAns = answerStr.toUpperCase();
      if (upperAns.length === 1 && upperAns >= "A" && upperAns <= "Z") {
        answerIdx = upperAns.charCodeAt(0) - 65;
      } else if (!isNaN(parseInt(upperAns))) {
        const num = parseInt(upperAns);
        answerIdx = num >= 1 ? num - 1 : 0;
      } else {
        const foundIdx = choices.findIndex((c) => c.toLowerCase() === answerStr.toLowerCase());
        if (foundIdx !== -1) answerIdx = foundIdx;
      }
    }

    answerIdx = Math.max(0, Math.min(choices.length - 1, answerIdx));

    parsed.push({
      question: qText,
      difficulty: Math.max(1, Math.min(5, parseInt(defaultDifficulty) || 1)),
      choices,
      answer: answerIdx,
    });
  }

  return parsed;
}

const API_URL = import.meta.env.VITE_API_URL || "";

const TriviaSettings = ({ initialConfig, onSave, onCancel }) => {
  const [rounds, setRounds] = useState(() => initialConfig?.rounds || 3);
  const [questionsPerRound, setQuestionsPerRound] = useState(() => initialConfig?.questionsPerRound || 5);
  const [timerEnabled, setTimerEnabled] = useState(() => initialConfig?.timerEnabled !== undefined ? initialConfig.timerEnabled : true);
  const [timerSeconds, setTimerSeconds] = useState(() => initialConfig?.timerSeconds || 15);
  const [selectedCategory, setSelectedCategory] = useState(() => initialConfig?.selectedCategory || "All");
  const [allowPlayerCategoryChoice, setAllowPlayerCategoryChoice] = useState(() => initialConfig?.allowPlayerCategoryChoice || false);

  // Per-round categories array
  const [roundCategories, setRoundCategories] = useState(() => {
    if (Array.isArray(initialConfig?.roundCategories) && initialConfig.roundCategories.length > 0) {
      return initialConfig.roundCategories;
    }
    const initRounds = initialConfig?.rounds || 3;
    const defaultCat = initialConfig?.selectedCategory || "All";
    return Array(initRounds).fill(defaultCat);
  });

  const [loadingApi, setLoadingApi] = useState(false);

  // Loading overlay state
  const [loadingOverlay, setLoadingOverlay] = useState({ active: false, title: "", message: "" });

  // Track deleted question dbIds for MongoDB sync
  const [deletedQIds, setDeletedQIds] = useState(new Set());

  // Text Import state
  const [importCat, setImportCat] = useState("Movies");
  const [importDifficulty, setImportDifficulty] = useState(1);
  const [importText, setImportText] = useState(DEFAULT_TEXT_IMPORT_TEMPLATE);
  const [importError, setImportError] = useState("");
  const [importSuccessMsg, setImportSuccessMsg] = useState("");

  // "settings" | "questions" | "text" | "json"
  const [tab, setTab] = useState("settings");

  // Ordered list of all category names (default + custom)
  const [catOrder, setCatOrder] = useState(DEFAULT_CATS);

  // Category toggles
  const [enabledCats, setEnabledCats] = useState(new Set(DEFAULT_CATS));

  // Per-category editor state: { [catName]: editorEntry }
  const [catEditors, setCatEditors] = useState(() => {
    const init = {};
    DEFAULT_CATS.forEach((cat) => {
      init[cat] = buildEditorEntry(
        DEFAULT_TRIVIA_QUESTIONS[cat].questions,
        false,
        DEFAULT_TRIVIA_QUESTIONS[cat].icon,
        false
      );
    });
    return init;
  });

  // Fetch categories and questions from backend API on mount
  useEffect(() => {
    let isMounted = true;
    const fetchBackendData = async () => {
      try {
        setLoadingApi(true);
        const [catRes, qRes] = await Promise.all([
          fetch(`${API_URL}/api/trivia/categories`),
          fetch(`${API_URL}/api/trivia/questions`),
        ]);
        const catData = await catRes.json();
        const qData = await qRes.json();

        if (isMounted && catData.success && Array.isArray(catData.categories) && catData.categories.length > 0) {
          const apiCatNames = catData.categories.map((c) => c.name);
          const editors = {};
          const catIdMap = {};

          catData.categories.forEach((catObj) => {
            catIdMap[catObj.id] = catObj.name;
            editors[catObj.name] = {
              dbId: catObj.id,
              icon: catObj.icon || "❓",
              questions: [],
              modified: false,
              isCustomCat: false,
              isDirty: false,
            };
          });

          if (qData.success && Array.isArray(qData.questions)) {
            qData.questions.forEach((qObj) => {
              const catName = catIdMap[qObj.categoryId];
              if (catName && editors[catName]) {
                editors[catName].questions.push({
                  dbId: qObj.id,
                  question: qObj.question,
                  difficulty: qObj.difficulty,
                  choices: qObj.choices,
                  answer: qObj.answer,
                });
              }
            });
          }

          setCatOrder(apiCatNames);
          setEnabledCats(new Set(apiCatNames));
          setCatEditors(editors);

          // Preserve selectedCategory if provided in initialConfig
          if (initialConfig?.selectedCategory) {
            setSelectedCategory(initialConfig.selectedCategory);
          }
        }
      } catch (err) {
        console.error("Failed to load trivia data from backend:", err);
      } finally {
        if (isMounted) setLoadingApi(false);
      }
    };

    fetchBackendData();
    return () => {
      isMounted = false;
    };
  }, [API_URL, initialConfig]);

  // Modal: which category is being edited (null = none)
  const [editingCat, setEditingCat] = useState(null);

  // "Add category" form visibility toggle
  const [showAddCatForm, setShowAddCatForm] = useState(false);

  // "Add category" form state
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("❓");
  const [newCatIconInput, setNewCatIconInput] = useState("");
  const [newCatError, setNewCatError] = useState("");

  // Unsaved-changes guard dialog
  // { open: bool, targetTab: str | null, targetAction: 'tab'|'cancel'|'close' }
  const [guardDialog, setGuardDialog] = useState({ open: false, targetTab: null, targetAction: null });

  // Reset to defaults confirmation dialog
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);

  // JSON editor state
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonValid, setJsonValid] = useState(false);
  const [jsonCustom, setJsonCustom] = useState(false);
  // Track whether admin has manually typed into JSON editor
  const [jsonDirty, setJsonDirty] = useState(false);

  /* ── Derived dirty state ── */
  const hasUnappliedEdits = useMemo(
    () => Object.values(catEditors).some((e) => e.isDirty),
    [catEditors]
  );
  const hasStructuredCustom = useMemo(
    () => Object.values(catEditors).some((e) => e.modified),
    [catEditors]
  );

  /* ══════════════════════════════════════
     Category toggle (Settings tab)
  ══════════════════════════════════════ */
  const toggleCat = (cat) => {
    setEnabledCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size <= 1) return next;
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  /* ══════════════════════════════════════
     Tab navigation with dirty guard
  ══════════════════════════════════════ */
  const requestTabChange = (targetTab) => {
    // Guard: leaving questions tab with unapplied question edits
    if (hasUnappliedEdits && tab === "questions") {
      setGuardDialog({ open: true, targetTab, targetAction: "tab" });
      return;
    }
    // Guard: leaving json tab with manually typed (dirty) json changes
    if (jsonDirty && tab === "json") {
      setGuardDialog({ open: true, targetTab, targetAction: "tab-json" });
      return;
    }
    performTabChange(targetTab);
  };

  const performTabChange = (targetTab) => {
    if (targetTab === "json" && !jsonText.trim()) {
      const built = {};
      catOrder.forEach((cat) => {
        built[cat] = {
          icon: catEditors[cat]?.icon || "❓",
          questions: catEditors[cat]?.questions || [],
        };
      });
      setJsonText(JSON.stringify(built, null, 2));
      setJsonError("");
      setJsonValid(false);
      setJsonCustom(false);
      setJsonDirty(false);
    }
    setTab(targetTab);
    setGuardDialog({ open: false, targetTab: null, targetAction: null });
  };

  const requestClose = () => {
    if (hasUnappliedEdits || jsonDirty) {
      setGuardDialog({ open: true, targetTab: null, targetAction: "cancel" });
    } else {
      onCancel();
    }
  };

  const guardDiscard = () => {
    // Clear dirty flags
    setCatEditors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        next[k] = { ...next[k], isDirty: false };
      });
      return next;
    });
    setJsonDirty(false);

    if (guardDialog.targetAction === "cancel") {
      onCancel();
    } else {
      performTabChange(guardDialog.targetTab);
    }
    setGuardDialog({ open: false, targetTab: null, targetAction: null });
  };

  const guardApplyAndContinue = () => {
    if (guardDialog.targetAction === "tab-json") {
      // For JSON tab guard — treat as "keep changes" (they're in jsonText already)
      setJsonDirty(false);
      performTabChange(guardDialog.targetTab);
      return;
    }

    let allValid = true;
    setCatEditors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cat) => {
        if (!next[cat].isDirty) return;
        const qs = next[cat].questions;
        for (let i = 0; i < qs.length; i++) {
          const q = qs[i];
          if (!q.question.trim() || q.choices.filter((c) => c.trim()).length < 2) {
            allValid = false;
            return;
          }
        }
        next[cat] = { ...next[cat], modified: true, isDirty: false };
      });
      return next;
    });
    if (!allValid) {
      setGuardDialog({ open: false, targetTab: null, targetAction: null });
      return;
    }
    if (guardDialog.targetAction === "cancel") {
      onCancel();
    } else {
      performTabChange(guardDialog.targetTab);
    }
    setGuardDialog({ open: false, targetTab: null, targetAction: null });
  };

  /* ══════════════════════════════════════
     Category editor helpers
  ══════════════════════════════════════ */
  const markDirty = useCallback((cat, updater) => {
    setCatEditors((prev) => {
      const updated = updater(prev[cat]);
      return { ...prev, [cat]: { ...updated, isDirty: true } };
    });
  }, []);

  const updateQuestion = (cat, qIdx, field, value) => {
    markDirty(cat, (editor) => ({
      ...editor,
      questions: editor.questions.map((q, i) =>
        i === qIdx ? { ...q, [field]: value } : q
      ),
    }));
  };

  const updateCatIcon = (cat, icon) => {
    setCatEditors((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], icon, isDirty: true },
    }));
  };

  const updateChoice = (cat, qIdx, cIdx, value) => {
    markDirty(cat, (editor) => ({
      ...editor,
      questions: editor.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const choices = [...q.choices];
        choices[cIdx] = value;
        return { ...q, choices };
      }),
    }));
  };

  const addChoice = (cat, qIdx) => {
    markDirty(cat, (editor) => ({
      ...editor,
      questions: editor.questions.map((q, i) =>
        i === qIdx ? { ...q, choices: [...q.choices, ""] } : q
      ),
    }));
  };

  const removeChoice = (cat, qIdx, cIdx) => {
    markDirty(cat, (editor) => ({
      ...editor,
      questions: editor.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const choices = q.choices.filter((_, ci) => ci !== cIdx);
        let answer = q.answer;
        if (cIdx === answer) answer = 0;
        else if (cIdx < answer) answer = answer - 1;
        return { ...q, choices, answer };
      }),
    }));
  };

  const addQuestion = (cat) => {
    markDirty(cat, (editor) => ({
      ...editor,
      questions: [
        ...editor.questions,
        { difficulty: 1, question: "", choices: ["", "", "", ""], answer: 0 },
      ],
    }));
  };

  const removeQuestion = (cat, qIdx) => {
    const targetQ = catEditors[cat]?.questions[qIdx];
    if (targetQ && targetQ.dbId) {
      setDeletedQIds((prev) => new Set([...prev, targetQ.dbId]));
    }
    markDirty(cat, (editor) => ({
      ...editor,
      questions: editor.questions.filter((_, i) => i !== qIdx),
    }));
  };

  /* ── Plain Text Import Handler ── */
  const handleImportTextSubmit = async () => {
    setImportError("");
    setImportSuccessMsg("");

    const catName = importCat || catOrder[0] || "Movies";
    const parsed = parseClientTextQuestions(importText, importDifficulty);

    if (parsed.length === 0) {
      setImportError("Could not parse any valid questions. Please ensure text matches the format:\n1. Question text\nA. Choice 1\nB. Choice 2\nAnswer: B");
      return;
    }

    setLoadingOverlay({
      active: true,
      title: "Importing Questions",
      message: `Translating ${parsed.length} question(s) and sending to backend database...`,
    });

    try {
      const targetEditor = catEditors[catName];
      const catId = targetEditor?.dbId;

      const res = await fetch(`${API_URL}/api/trivia/import-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: catId,
          categoryName: catName,
          text: importText,
          difficulty: importDifficulty,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.questions)) {
        setCatEditors((prev) => {
          const existingQs = prev[catName]?.questions || [];
          const newQs = data.questions.map((q) => ({
            dbId: q.id,
            question: q.question,
            difficulty: q.difficulty,
            choices: q.choices,
            answer: q.answer,
          }));
          return {
            ...prev,
            [catName]: {
              ...prev[catName],
              dbId: data.categoryId || prev[catName]?.dbId,
              questions: [...existingQs, ...newQs],
              modified: true,
              isDirty: false,
            },
          };
        });
        setImportSuccessMsg(`Successfully imported ${data.count} question(s) into category "${catName}"!`);
      } else {
        setCatEditors((prev) => {
          const existingQs = prev[catName]?.questions || [];
          return {
            ...prev,
            [catName]: {
              ...prev[catName],
              questions: [...existingQs, ...parsed],
              modified: true,
              isDirty: true,
            },
          };
        });
        setImportSuccessMsg(`Imported ${parsed.length} question(s) into category "${catName}" locally.`);
      }
    } catch (err) {
      console.error("Text import error:", err);
      setCatEditors((prev) => {
        const existingQs = prev[catName]?.questions || [];
        return {
          ...prev,
          [catName]: {
            ...prev[catName],
            questions: [...existingQs, ...parsed],
            modified: true,
            isDirty: true,
          },
        };
      });
      setImportSuccessMsg(`Imported ${parsed.length} question(s) into category "${catName}" locally.`);
    } finally {
      setLoadingOverlay({ active: false, title: "", message: "" });
    }
  };

  /** Validate + mark a category as applied */
  const applyCategory = (cat) => {
    const qs = catEditors[cat].questions;
    if (qs.length === 0) {
      setNewCatError(`"${cat}" has no questions. Add at least one.`);
      return false;
    }
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (!q.question.trim()) {
        alert(`Question #${i + 1} in "${cat}" has no question text.`);
        return false;
      }
      if (q.choices.filter((c) => c.trim()).length < 2) {
        alert(`Question #${i + 1} in "${cat}" needs at least 2 non-empty choices.`);
        return false;
      }
      if (q.answer < 0 || q.answer >= q.choices.length) {
        alert(`Question #${i + 1} in "${cat}" has an invalid answer index.`);
        return false;
      }
    }
    setCatEditors((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], modified: true, isDirty: false },
    }));
    return true;
  };

  /** Apply and close the modal */
  const applyCategoryAndClose = (cat) => {
    const ok = applyCategory(cat);
    if (ok) setEditingCat(null);
  };

  /** Discard edits and close modal */
  const discardAndCloseModal = (cat) => {
    setCatEditors((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], isDirty: false },
    }));
    setEditingCat(null);
  };

  /** Reset a default category to built-in questions */
  const resetCategory = (cat) => {
    if (!DEFAULT_TRIVIA_QUESTIONS[cat]) return;
    const oldEditor = catEditors[cat];
    if (oldEditor && Array.isArray(oldEditor.questions)) {
      const idsToDelete = oldEditor.questions.filter((q) => q.dbId).map((q) => q.dbId);
      if (idsToDelete.length > 0) {
        setDeletedQIds((prev) => new Set([...prev, ...idsToDelete]));
      }
    }
    setCatEditors((prev) => ({
      ...prev,
      [cat]: {
        ...buildEditorEntry(
          DEFAULT_TRIVIA_QUESTIONS[cat].questions,
          true,
          DEFAULT_TRIVIA_QUESTIONS[cat].icon,
          false
        ),
        dbId: prev[cat]?.dbId,
      },
    }));
  };

  /** Remove an admin-added custom category */
  const removeCustomCat = (cat) => {
    const targetCatObj = catEditors[cat];
    if (targetCatObj?.dbId) {
      fetch(`${API_URL}/api/trivia/categories/${targetCatObj.dbId}`, { method: "DELETE" }).catch(() => {});
    }
    if (editingCat === cat) setEditingCat(null);
    setCatOrder((prev) => prev.filter((c) => c !== cat));
    setEnabledCats((prev) => {
      const next = new Set(prev);
      next.delete(cat);
      return next;
    });
    setCatEditors((prev) => {
      const next = { ...prev };
      delete next[cat];
      return next;
    });
  };

  /* ── Add category handler ── */
  const handleAddCategory = () => {
    const name = newCatName.trim();
    if (!name) { setNewCatError("Category name is required."); return; }
    if (catOrder.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setNewCatError(`A category named "${name}" already exists.`);
      return;
    }
    const icon = newCatIconInput.trim() || newCatIcon;
    const entry = buildEditorEntry([], false, icon, true);
    setCatOrder((prev) => [...prev, name]);
    setEnabledCats((prev) => new Set([...prev, name]));
    setCatEditors((prev) => ({ ...prev, [name]: entry }));
    setNewCatName("");
    setNewCatIconInput("");
    setNewCatIcon("❓");
    setNewCatError("");
    setShowAddCatForm(false);
    setEditingCat(name);
  };

  /* ══════════════════════════════════════
     JSON tab helpers
  ══════════════════════════════════════ */
  const handleJsonChange = (text) => {
    setJsonText(text);
    setJsonError("");
    setJsonValid(false);
    setJsonCustom(false);
    setJsonDirty(true);
    if (!text.trim()) return;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        setJsonError("Must be an object with category names as keys."); return;
      }
      for (const [catName, catData] of Object.entries(parsed)) {
        const questions = catData.questions || catData;
        if (!Array.isArray(questions)) {
          setJsonError(`"${catName}" must have a "questions" array.`); return;
        }
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (!q.question || !Array.isArray(q.choices) || q.answer === undefined) {
            setJsonError(`"${catName}" question #${i + 1} missing required fields (question, choices, answer).`); return;
          }
          if (q.choices.length < 2) {
            setJsonError(`"${catName}" question #${i + 1} needs at least 2 choices.`); return;
          }
        }
      }
      setJsonCustom(true);
      setJsonValid(true);
    } catch (e) {
      setJsonError("Invalid JSON: " + e.message);
    }
  };

  const handleResetJson = () => {
    setJsonText(JSON.stringify(DEFAULT_TRIVIA_QUESTIONS, null, 2));
    setJsonError(""); setJsonValid(false); setJsonCustom(false); setJsonDirty(false);
  };

  /** Reset all categories and questions to built-in defaults in local state and backend MongoDB */
  const handleResetAllToDefaults = async () => {
    setLoadingOverlay({
      active: true,
      title: "Resetting to Defaults",
      message: "Restoring default categories and questions in the database...",
    });

    try {
      const res = await fetch(`${API_URL}/api/trivia/reset`, { method: "POST" });
      const data = await res.json();
      if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
        const apiCatNames = data.categories.map((c) => c.name);
        const editors = {};
        const catIdMap = {};

        data.categories.forEach((catObj) => {
          catIdMap[catObj.id] = catObj.name;
          editors[catObj.name] = {
            dbId: catObj.id,
            icon: catObj.icon || "❓",
            questions: [],
            modified: false,
            isCustomCat: false,
            isDirty: false,
          };
        });

        if (Array.isArray(data.questions)) {
          data.questions.forEach((qObj) => {
            const catName = catIdMap[qObj.categoryId];
            if (catName && editors[catName]) {
              editors[catName].questions.push({
                dbId: qObj.id,
                question: qObj.question,
                difficulty: qObj.difficulty,
                choices: qObj.choices,
                answer: qObj.answer,
              });
            }
          });
        }

        setCatOrder(apiCatNames);
        setEnabledCats(new Set(apiCatNames));
        setCatEditors(editors);
      } else {
        const init = {};
        DEFAULT_CATS.forEach((cat) => {
          init[cat] = buildEditorEntry(
            DEFAULT_TRIVIA_QUESTIONS[cat].questions,
            false,
            DEFAULT_TRIVIA_QUESTIONS[cat].icon,
            false
          );
        });
        setCatEditors(init);
        setCatOrder(DEFAULT_CATS);
        setEnabledCats(new Set(DEFAULT_CATS));
      }
    } catch (err) {
      console.error("Failed to reset trivia to defaults via API:", err);
      const init = {};
      DEFAULT_CATS.forEach((cat) => {
        init[cat] = buildEditorEntry(
          DEFAULT_TRIVIA_QUESTIONS[cat].questions,
          false,
          DEFAULT_TRIVIA_QUESTIONS[cat].icon,
          false
        );
      });
      setCatEditors(init);
      setCatOrder(DEFAULT_CATS);
      setEnabledCats(new Set(DEFAULT_CATS));
    } finally {
      setDeletedQIds(new Set());
      setJsonText(JSON.stringify(DEFAULT_TRIVIA_QUESTIONS, null, 2));
      setJsonCustom(false);
      setJsonValid(false);
      setJsonDirty(false);
      setEditingCat(null);
      setConfirmResetAllOpen(false);
      setLoadingOverlay({ active: false, title: "", message: "" });
    }
  };

  /* ══════════════════════════════════════
     Save — FIX: include deleted questions sync & loading screen
  ══════════════════════════════════════ */
  const handleSave = async () => {
    setLoadingOverlay({
      active: true,
      title: "Saving Settings & Database",
      message: "Syncing categories, question updates, and deletions with MongoDB...",
    });

    let questions;
    if (jsonCustom && jsonValid) {
      questions = JSON.parse(jsonText);
    } else {
      questions = {};
      catOrder.forEach((cat) => {
        if (!enabledCats.has(cat)) return;
        const editor = catEditors[cat];
        if (!editor) return;
        if (Array.isArray(editor.questions) && editor.questions.length > 0) {
          questions[cat] = { icon: editor.icon || "❓", questions: editor.questions };
        } else if (DEFAULT_TRIVIA_QUESTIONS[cat]) {
          questions[cat] = DEFAULT_TRIVIA_QUESTIONS[cat];
        }
      });
    }

    try {
      // 1. Delete queued removed questions from backend DB
      for (const qId of deletedQIds) {
        try {
          await fetch(`${API_URL}/api/trivia/questions/${qId}`, { method: "DELETE" });
        } catch (err) {
          console.error(`Failed to delete question ${qId} from DB:`, err);
        }
      }
      setDeletedQIds(new Set());

      // 2. Persist any custom/modified category and question edits to backend DB
      for (const [catName, editor] of Object.entries(catEditors)) {
        if (!editor.modified && !editor.isCustomCat) continue;
        let catId = editor.dbId;
        if (!catId) {
          const catRes = await fetch(`${API_URL}/api/trivia/categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: catName, icon: editor.icon }),
          });
          const catData = await catRes.json();
          if (catData.success && catData.category) {
            catId = catData.category.id;
          }
        }
        if (catId && Array.isArray(editor.questions)) {
          for (const q of editor.questions) {
            if (!q.question?.trim()) continue;
            if (q.dbId) {
              await fetch(`${API_URL}/api/trivia/questions/${q.dbId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  question: q.question,
                  difficulty: q.difficulty,
                  choices: q.choices,
                  answer: q.answer,
                }),
              });
            } else {
              await fetch(`${API_URL}/api/trivia/questions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  categoryId: catId,
                  question: q.question,
                  difficulty: q.difficulty,
                  choices: q.choices,
                  answer: q.answer,
                }),
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to sync trivia edits to backend DB:", e);
    } finally {
      setLoadingOverlay({ active: false, title: "", message: "" });
    }

    onSave({
      rounds: Math.max(1, Math.min(10, rounds)),
      questionsPerRound: Math.max(1, Math.min(20, questionsPerRound)),
      timerEnabled,
      timerSeconds: Math.max(5, Math.min(60, timerSeconds)),
      selectedCategory,
      roundCategories: roundCategories.slice(0, Math.max(1, Math.min(10, rounds))),
      allowPlayerCategoryChoice,
      questions,
    });
  };

  const parsedPreview = useMemo(() => {
    return parseClientTextQuestions(importText, importDifficulty);
  }, [importText, importDifficulty]);

  /* ══════════════════════════════════════
     Category Edit Modal
  ══════════════════════════════════════ */
  const editingEditor = editingCat ? catEditors[editingCat] : null;
  const editingIsDefault = editingCat ? !!DEFAULT_TRIVIA_QUESTIONS[editingCat] : false;
  const editingCatIcon = editingEditor?.icon || DEFAULT_TRIVIA_QUESTIONS[editingCat]?.icon || "❓";

  // Close modal on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && editingCat) {
        discardAndCloseModal(editingCat);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editingCat]);

  /* ══════════════════════════════════════
     Render
  ══════════════════════════════════════ */
  return (
    <div className="ts-fs-wrap">

      {/* ── Loading screen overlay ── */}
      {loadingOverlay.active && (
        <div className="ts-loading-overlay">
          <div className="ts-loading-modal">
            <div className="ts-spinner-ring" />
            <h3 className="ts-loading-title">{loadingOverlay.title}</h3>
            <p className="ts-loading-message">{loadingOverlay.message}</p>
          </div>
        </div>
      )}

      {/* ── Unsaved changes guard dialog ── */}
      {guardDialog.open && (
        <div className="ts-guard-overlay">
          <div className="ts-guard-dialog">
            <div className="ts-guard-icon">⚠️</div>
            <h3 className="ts-guard-title">
              {guardDialog.targetAction === "tab-json"
                ? "Unsaved JSON Changes"
                : "Unapplied Changes"}
            </h3>
            <p className="ts-guard-body">
              {guardDialog.targetAction === "tab-json"
                ? "You have unsaved changes in the JSON editor. Keep them or discard?"
                : "You have edits that haven't been applied yet. Apply them now, or discard and continue?"}
            </p>
            <div className="ts-guard-actions">
              <button
                className="ts-guard-apply-btn"
                onClick={guardApplyAndContinue}
              >
                {guardDialog.targetAction === "tab-json"
                  ? "Keep Changes & Continue"
                  : "Apply & Continue"}
              </button>
              <button
                className="ts-guard-discard-btn"
                onClick={guardDiscard}
              >
                Discard Changes
              </button>
              <button
                className="ts-guard-stay-btn"
                onClick={() => setGuardDialog({ open: false, targetTab: null, targetAction: null })}
              >
                Stay Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset to defaults confirmation dialog ── */}
      {confirmResetAllOpen && (
        <div className="ts-guard-overlay" onClick={() => setConfirmResetAllOpen(false)}>
          <div className="ts-guard-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ts-guard-icon">⚠️</div>
            <h3 className="ts-guard-title">Reset All to Defaults?</h3>
            <p className="ts-guard-body">
              This will restore all default trivia categories and questions, reverting all edits and removing any newly added custom categories.
            </p>
            <div className="ts-guard-actions">
              <button
                className="ts-guard-discard-btn"
                style={{
                  background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                  color: "#ffffff",
                  borderColor: "#ef4444",
                  fontWeight: 700
                }}
                onClick={handleResetAllToDefaults}
              >
                ↺ Yes, Reset All to Defaults
              </button>
              <button
                className="ts-guard-stay-btn"
                onClick={() => setConfirmResetAllOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Edit Modal ── */}
      {editingCat && editingEditor && (
        <div className="ts-cat-modal-overlay" onClick={() => discardAndCloseModal(editingCat)}>
          <div className="ts-cat-modal" onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <div className="ts-cat-modal-header">
              <div className="ts-cat-modal-title">
                <span className="ts-cat-modal-icon">{editingCatIcon}</span>
                <span className="ts-cat-modal-name">{editingCat}</span>
                <span className="ts-cat-modal-count">{editingEditor.questions.length} questions</span>
                {editingEditor.modified && <span className="ts-modified-badge">✦ Custom</span>}
                {editingEditor.isDirty && <span className="ts-dirty-badge">● Unsaved</span>}
              </div>
              <div className="ts-cat-modal-header-actions">
                {editingIsDefault && editingEditor.modified && (
                  <button
                    className="ts-cat-reset-btn"
                    onClick={() => resetCategory(editingCat)}
                    title="Reset to default questions"
                  >
                    ↺ Reset
                  </button>
                )}
                {editingEditor.isCustomCat && (
                  <button
                    className="ts-cat-delete-btn"
                    onClick={() => removeCustomCat(editingCat)}
                    title="Delete this category"
                  >
                    🗑 Delete
                  </button>
                )}
                <button
                  className="ts-cat-modal-close-btn"
                  onClick={() => discardAndCloseModal(editingCat)}
                  title="Close without saving"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="ts-cat-modal-body">

              {/* Icon editor */}
              <div className="ts-cat-icon-editor">
                <span className="ts-cat-icon-label">Category Icon</span>
                <div className="ts-cat-icon-presets">
                  {ICON_PRESETS.map((ic) => (
                    <button
                      key={ic}
                      className={`ts-icon-preset-btn ${editingCatIcon === ic ? "selected" : ""}`}
                      onClick={() => updateCatIcon(editingCat, ic)}
                      title={ic}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
                <div className="ts-cat-icon-custom-row">
                  <span className="ts-cat-icon-preview">{editingCatIcon}</span>
                  <input
                    type="text"
                    className="ts-cat-icon-input"
                    value={editingCatIcon === "❓" && editingEditor.isCustomCat ? "" : editingCatIcon}
                    onChange={(e) => {
                      const val = [...e.target.value].find(c => /\p{Emoji}/u.test(c)) || e.target.value.trim() || "❓";
                      updateCatIcon(editingCat, val);
                    }}
                    placeholder="Paste or type an emoji"
                    maxLength={8}
                  />
                  <span className="ts-cat-icon-hint">or type / paste any emoji</span>
                </div>
              </div>

              {/* Questions */}
              {editingEditor.questions.length === 0 && (
                <div className="ts-cat-modal-empty">
                  No questions yet — click <strong>+ Add Question</strong> below to get started.
                </div>
              )}

              {editingEditor.questions.map((q, qIdx) => (
                <div key={qIdx} className="ts-q-card">
                  <div className="ts-q-header">
                    <span className="ts-q-num">Q{qIdx + 1}</span>
                    <select
                      className="ts-q-diff-select"
                      value={q.difficulty || 1}
                      onChange={(e) => updateQuestion(editingCat, qIdx, "difficulty", parseInt(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>{DIFF_LABELS[d]}</option>
                      ))}
                    </select>
                    <button
                      className="ts-q-remove-btn"
                      onClick={() => removeQuestion(editingCat, qIdx)}
                      title="Remove question"
                    >✕</button>
                  </div>

                  <textarea
                    className="ts-q-text"
                    value={q.question}
                    onChange={(e) => updateQuestion(editingCat, qIdx, "question", e.target.value)}
                    placeholder="Enter question text…"
                    rows={2}
                  />

                  <div className="ts-q-choices">
                    {q.choices.map((choice, cIdx) => (
                      <div key={cIdx} className={`ts-q-choice-row ${q.answer === cIdx ? "correct" : ""}`}>
                        <input
                          type="radio"
                          className="ts-q-radio"
                          name={`${editingCat}-q${qIdx}-answer`}
                          checked={q.answer === cIdx}
                          onChange={() => updateQuestion(editingCat, qIdx, "answer", cIdx)}
                          title="Mark as correct answer"
                        />
                        <span className="ts-q-choice-letter">{String.fromCharCode(65 + cIdx)}</span>
                        <input
                          type="text"
                          className="ts-q-choice-input"
                          value={choice}
                          onChange={(e) => updateChoice(editingCat, qIdx, cIdx, e.target.value)}
                          placeholder={`Choice ${String.fromCharCode(65 + cIdx)}`}
                        />
                        {q.choices.length > 2 && (
                          <button
                            className="ts-q-choice-remove"
                            onClick={() => removeChoice(editingCat, qIdx, cIdx)}
                            title="Remove choice"
                          >✕</button>
                        )}
                      </div>
                    ))}
                    {q.choices.length < 6 && (
                      <button className="ts-q-add-choice" onClick={() => addChoice(editingCat, qIdx)}>
                        + Add Choice
                      </button>
                    )}
                  </div>

                  <div className="ts-q-answer-hint">
                    ✓ Correct answer: Choice <strong>{String.fromCharCode(65 + q.answer)}</strong>
                    {q.choices[q.answer] ? ` — "${q.choices[q.answer]}"` : ""}
                  </div>
                </div>
              ))}

              <button className="ts-add-question-btn" onClick={() => addQuestion(editingCat)}>
                + Add Question
              </button>
            </div>

            {/* Modal footer */}
            <div className="ts-cat-modal-footer">
              <button
                className="ts-cat-modal-discard-btn"
                onClick={() => discardAndCloseModal(editingCat)}
              >
                ✕ Discard & Close
              </button>
              <button
                className="ts-cat-modal-apply-btn"
                onClick={() => applyCategoryAndClose(editingCat)}
              >
                ✓ Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          STICKY TOP BAR
      ══════════════════════════════════════ */}
      <div className="ts-fs-topbar">
        <div className="ts-fs-title-row">
          <div>
            <h2>🧠 Trivia Challenge — Game Settings</h2>
            <p className="ts-header-sub">Configure rounds, timer, categories, and custom questions.</p>
          </div>
          <button className="ts-fs-close-btn" onClick={requestClose} title="Close settings">✕</button>
        </div>

        <div className="ts-editor-tabs">
          <button
            className={`ts-tab-btn ${tab === "settings" ? "active" : ""}`}
            onClick={() => requestTabChange("settings")}
          >
            ⚙️ Game Settings
          </button>
          <button
            className={`ts-tab-btn ${tab === "questions" ? "active" : ""}`}
            onClick={() => requestTabChange("questions")}
          >
            📝 Questions
            {hasStructuredCustom && <span className="ts-tab-badge">✦ Custom</span>}
            {hasUnappliedEdits && <span className="ts-tab-badge ts-tab-badge-warn">● Unsaved</span>}
          </button>
          <button
            className={`ts-tab-btn ${tab === "text" ? "active" : ""}`}
            onClick={() => requestTabChange("text")}
          >
            📋 Text Import
          </button>
          <button
            className={`ts-tab-btn ${tab === "json" ? "active" : ""}`}
            onClick={() => requestTabChange("json")}
          >
            {"{ }"} JSON Editor
            {jsonCustom && <span className="ts-tab-badge">✦ Custom</span>}
            {jsonDirty && !jsonCustom && <span className="ts-tab-badge ts-tab-badge-warn">● Unsaved</span>}
          </button>
          <div className="ts-tab-spacer" />
          {(tab === "questions" || tab === "json") && (
            <button className="ts-reset-btn" onClick={() => setConfirmResetAllOpen(true)}>
              ↺ Reset to Defaults
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          SCROLLABLE BODY
      ══════════════════════════════════════ */}
      <div className="ts-fs-body">

        {/* ─── SETTINGS TAB ─── */}
        {tab === "settings" && (
          <div className="ts-settings-panel">
            <div className="ts-section">
              <div className="ts-section-title">⚙️ Game Settings</div>
              <div className="ts-row">
                <span className="ts-label">Rounds</span>
                <input type="number" className="ts-input" min={1} max={10} value={rounds}
                  onChange={(e) => setRounds(parseInt(e.target.value) || 1)} />
                <span className="ts-hint">1 – 10</span>
              </div>
              <div className="ts-row">
                <span className="ts-label">Questions / Round</span>
                <input type="number" className="ts-input" min={1} max={20} value={questionsPerRound}
                  onChange={(e) => setQuestionsPerRound(parseInt(e.target.value) || 1)} />
                <span className="ts-hint">1 – 20</span>
              </div>
              <div className="ts-row">
                <span className="ts-label">Timer</span>
                <label className="ts-toggle">
                  <input type="checkbox" checked={timerEnabled}
                    onChange={(e) => setTimerEnabled(e.target.checked)} />
                  <span className="ts-toggle-slider" />
                </label>
                {timerEnabled && (
                  <div className="ts-timer-seconds">
                    <input type="number" className="ts-input" min={5} max={60} value={timerSeconds}
                      onChange={(e) => setTimerSeconds(parseInt(e.target.value) || 15)} />
                    <span className="ts-hint">seconds per question</span>
                  </div>
                )}
              </div>
              <div className="ts-row">
                <span className="ts-label">Player Category Choice</span>
                <label className="ts-toggle">
                  <input
                    type="checkbox"
                    checked={allowPlayerCategoryChoice}
                    onChange={(e) => setAllowPlayerCategoryChoice(e.target.checked)}
                  />
                  <span className="ts-toggle-slider" />
                </label>
                <span className="ts-hint">
                  {allowPlayerCategoryChoice
                    ? "✅ Players will pick their own category before playing"
                    : "Players use the admin-assigned category per round"}
                </span>
              </div>
            </div>

            <div className="ts-section">
              <div className="ts-section-title">🎯 Per-Round Category Assignment (Admin Only)</div>
              <p className="ts-hint" style={{ marginBottom: "10px" }}>
                Select a specific category for each round (or "All Enabled Categories" for mixed questions):
              </p>
              {Array.from({ length: Math.max(1, Math.min(10, rounds)) }).map((_, rIdx) => (
                <div key={rIdx} className="ts-row" style={{ marginBottom: "8px" }}>
                  <span className="ts-label">Round {rIdx + 1} Category</span>
                  <select
                    className="ts-input"
                    value={roundCategories[rIdx] || selectedCategory || "All"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRoundCategories((prev) => {
                        const next = [...prev];
                        next[rIdx] = val;
                        return next;
                      });
                      if (rIdx === 0) setSelectedCategory(val);
                    }}
                    style={{ minWidth: "300px", padding: "6px 10px", borderRadius: "6px" }}
                  >
                    <option value="All">🌟 All Enabled Categories (Mixed)</option>
                    {catOrder.filter((cat) => enabledCats.has(cat)).map((cat) => (
                      <option key={cat} value={cat}>
                        {catEditors[cat]?.icon || DEFAULT_TRIVIA_QUESTIONS[cat]?.icon || "❓"} {cat}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="ts-section">
              <div className="ts-section-title">📂 Active Categories</div>
              <div className="ts-categories-grid">
                {catOrder.map((cat) => (
                  <label key={cat} className={`ts-category-chip ${enabledCats.has(cat) ? "active" : ""}`}>
                    <input type="checkbox" className="ts-cat-checkbox"
                      checked={enabledCats.has(cat)} onChange={() => toggleCat(cat)} />
                    <span className="ts-cat-check-icon" />
                    <span>
                      {catEditors[cat]?.icon || DEFAULT_TRIVIA_QUESTIONS[cat]?.icon || "❓"} {cat}
                    </span>
                    {catEditors[cat]?.modified && (
                      <span className="ts-cat-modified-dot" title="Custom questions applied" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {(hasStructuredCustom || jsonCustom) && (
              <div className="ts-custom-notice">
                ✦ Custom questions will be used on save.{" "}
                {hasStructuredCustom && (
                  <button className="ts-notice-link" onClick={() => requestTabChange("questions")}>
                    View edited categories
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── QUESTIONS TAB ─── */}
        {tab === "questions" && (
          <div className="ts-questions-panel">

            {/* Category list — clicking opens modal */}
            {catOrder.map((cat) => {
              const editor = catEditors[cat];
              if (!editor) return null;
              const isDefault = !!DEFAULT_TRIVIA_QUESTIONS[cat];
              const catIcon = editor.icon || DEFAULT_TRIVIA_QUESTIONS[cat]?.icon || "❓";

              return (
                <div
                  key={cat}
                  className={`ts-cat-card ${editor.modified ? "modified" : ""} ${editor.isDirty ? "dirty" : ""}`}
                >
                  {/* Card row — click to open modal */}
                  <div
                    className="ts-cat-card-header clickable"
                    onClick={() => setEditingCat(cat)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setEditingCat(cat)}
                  >
                    <div className="ts-cat-card-title">
                      <span className="ts-cat-card-icon">{catIcon}</span>
                      <span className="ts-cat-card-name">{cat}</span>
                      <span className="ts-cat-card-count">{editor.questions.length} questions</span>
                      {editor.modified && <span className="ts-modified-badge">✦ Custom</span>}
                      {editor.isDirty && <span className="ts-dirty-badge">● Unsaved</span>}
                      {editor.isCustomCat && <span className="ts-new-cat-badge">+ New</span>}
                    </div>
                    <div className="ts-cat-card-actions" onClick={(e) => e.stopPropagation()}>
                      {isDefault && editor.modified && (
                        <button className="ts-cat-reset-btn" onClick={() => resetCategory(cat)} title="Reset to default">
                          ↺ Reset
                        </button>
                      )}
                      {editor.isCustomCat && (
                        <button className="ts-cat-delete-btn" onClick={() => removeCustomCat(cat)} title="Delete category">
                          🗑
                        </button>
                      )}
                      <button
                        className="ts-cat-edit-btn"
                        onClick={() => setEditingCat(cat)}
                        title="Edit questions"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ── Add New Category — toggle form ── */}
            <div className="ts-add-cat-section">
              {!showAddCatForm ? (
                /* Collapsed state: add category and reset buttons */
                <div className="ts-add-cat-actions-row">
                  <button
                    className="ts-add-cat-toggle-btn"
                    onClick={() => setShowAddCatForm(true)}
                  >
                    ➕ Add New Category
                  </button>
                  <button
                    className="ts-reset-all-cats-btn"
                    onClick={() => setConfirmResetAllOpen(true)}
                    title="Restore all default trivia questions and categories"
                  >
                    ↺ Reset to Defaults
                  </button>
                </div>
              ) : (
                /* Expanded form */
                <>
                  <div className="ts-add-cat-form-header">
                    <span className="ts-add-cat-title">➕ Add New Category</span>
                    <button
                      className="ts-add-cat-cancel-btn"
                      onClick={() => {
                        setShowAddCatForm(false);
                        setNewCatName("");
                        setNewCatIconInput("");
                        setNewCatIcon("❓");
                        setNewCatError("");
                      }}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                  <div className="ts-add-cat-form">
                    <div className="ts-add-cat-icon-picker">
                      <div className="ts-add-cat-icon-preview">
                        {newCatIconInput.trim() || newCatIcon}
                      </div>
                      <div className="ts-add-cat-presets">
                        {ICON_PRESETS.map((ic) => (
                          <button
                            key={ic}
                            className={`ts-icon-preset-btn ${newCatIcon === ic && !newCatIconInput.trim() ? "selected" : ""}`}
                            onClick={() => { setNewCatIcon(ic); setNewCatIconInput(""); }}
                            title={ic}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        className="ts-cat-icon-input"
                        value={newCatIconInput}
                        onChange={(e) => setNewCatIconInput(e.target.value)}
                        placeholder="Or type / paste an emoji"
                        maxLength={8}
                      />
                    </div>

                    <div className="ts-add-cat-name-row">
                      <input
                        type="text"
                        className="ts-add-cat-name-input"
                        value={newCatName}
                        onChange={(e) => { setNewCatName(e.target.value); setNewCatError(""); }}
                        placeholder="Category name (e.g. Space, Food, Sports)"
                        maxLength={40}
                        onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                        autoFocus
                      />
                      <button className="ts-add-cat-btn" onClick={handleAddCategory}>
                        + Add Category
                      </button>
                    </div>
                    {newCatError && <div className="ts-add-cat-error">⚠ {newCatError}</div>}
                    <p className="ts-add-cat-hint">
                      After adding, a modal will open so you can add questions right away.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ─── TEXT IMPORT TAB ─── */}
        {tab === "text" && (
          <div className="ts-text-import-panel">
            <div className="ts-section">
              <div className="ts-section-title">📋 Import Questions from Plain Text</div>
              <p className="ts-hint" style={{ marginBottom: "12px" }}>
                Paste questions in standard plain-text format. Questions will be translated to the backend database and fetched for play.
              </p>

              <div className="ts-text-import-controls">
                <div className="ts-text-import-field">
                  <label>Target Category</label>
                  <select
                    className="ts-input"
                    value={importCat}
                    onChange={(e) => setImportCat(e.target.value)}
                    style = {{width: "150px", textAlign: "left"}}
                  >
                    {catOrder.map((cat) => (
                      <option key={cat} value={cat}>
                        {catEditors[cat]?.icon || "❓"} {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ts-text-import-field">
                  <label>Default Difficulty</label>
                  <select
                    className="ts-input"
                    value={importDifficulty}
                    onChange={(e) => setImportDifficulty(parseInt(e.target.value) || 1)}
                    style = {{width: "150px", textAlign: "left"}}
                  >
                    <option value={1}>Easy (1★)</option>
                    <option value={2}>Medium (2★)</option>
                    <option value={3}>Hard (3★)</option>
                    <option value={4}>Expert (4★)</option>
                    <option value={5}>Master (5★)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="ts-text-area-wrap">
              <textarea
                className="ts-text-import-area"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError("");
                  setImportSuccessMsg("");
                }}
                placeholder={`1. Which game features the character Mario?\nA. Minecraft\nB. Super Mario Bros.\nC. Fortnite\nD. Roblox\nAnswer: B`}
                rows={10}
              />
            </div>

            {importError && <div className="ts-add-cat-error">⚠ {importError}</div>}
            {importSuccessMsg && <div className="ts-json-ok">✅ {importSuccessMsg}</div>}

            {/* Live Preview Box */}
            <div className="ts-import-preview-box">
              <div className="ts-import-preview-header">
                <span className="ts-import-preview-title">🔍 Live Parser Preview</span>
                <span className="ts-import-badge-count">
                  {parsedPreview.length} Question{parsedPreview.length !== 1 ? "s" : ""} Detected
                </span>
              </div>

              {parsedPreview.length === 0 ? (
                <div className="ts-hint" style={{ padding: "0.5rem 0" }}>
                  No valid questions detected yet. Ensure each question has question text, choices (A., B.), and an Answer line.
                </div>
              ) : (
                <div className="ts-import-parsed-list">
                  {parsedPreview.map((pq, idx) => (
                    <div key={idx} className="ts-parsed-q-card">
                      <div className="ts-parsed-q-title">
                        {idx + 1}. {pq.question}
                      </div>
                      <div className="ts-parsed-choices">
                        {pq.choices.map((ch, cIdx) => (
                          <div
                            key={cIdx}
                            className={`ts-parsed-choice-item ${pq.answer === cIdx ? "correct" : ""}`}
                          >
                            {String.fromCharCode(65 + cIdx)}. {ch} {pq.answer === cIdx ? "✓" : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="ts-cat-modal-apply-btn"
                  onClick={handleImportTextSubmit}
                  disabled={parsedPreview.length === 0}
                  style={{ opacity: parsedPreview.length === 0 ? 0.5 : 1, cursor: parsedPreview.length === 0 ? "not-allowed" : "pointer" }}
                >
                  📥 Import &amp; Save to Database
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── JSON TAB ─── */}
        {tab === "json" && (
          <div className="ts-json-panel">
            <div className="ts-json-toolbar">
              <span className="ts-json-desc">
                Edit all categories as a single JSON object. Valid JSON overrides built-in questions on save.
              </span>
              {jsonCustom && (
                <button
                  className="ts-json-apply-btn"
                  onClick={() => { setJsonCustom(false); setJsonValid(false); setJsonText(""); setJsonDirty(false); }}
                  title="Clear custom JSON"
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <div className="ts-json-schema-hint">
              <strong>Structure:</strong>{"\n"}
              {"{"}{"\n"}
              {"  "}<code>"CategoryName"</code>: {"{"}{"\n"}
              {"    "}<code>"icon"</code>: "🔬",{"\n"}
              {"    "}<code>"questions"</code>: [{"\n"}
              {"      "}{"{"} <code>"question"</code>: "...", <code>"choices"</code>: ["A","B","C","D"], <code>"answer"</code>: 0, <code>"difficulty"</code>: 1 {"}"}{"\n"}
              {"    "}]{"\n"}
              {"  "}{"}"}{"\n"}
              {"}"}
            </div>
            <textarea
              className={`ts-json-textarea ${jsonError ? "has-error" : jsonValid ? "has-ok" : ""}`}
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              spellCheck={false}
              placeholder='{"Technology": {"icon": "💻", "questions": [{"question": "...", "choices": [...], "answer": 0}]}}'
            />
            {jsonError && <div className="ts-json-error">⚠ {jsonError}</div>}
            {jsonValid && (
              <div className="ts-json-ok">
                ✅ Valid — {Object.keys(JSON.parse(jsonText)).length} categories
              </div>
            )}
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════
          STICKY FOOTER
      ══════════════════════════════════════ */}
      <div className="ts-fs-footer">
        <div className="ts-actions">
          <div className="ts-actions-left">
            {tab === "settings" && (
              <button className="ts-json-switch-btn" onClick={() => requestTabChange("questions")}>📝 Edit Questions</button>
            )}
            {tab === "questions" && (
              <button className="ts-json-switch-btn" onClick={() => requestTabChange("settings")}>⚙️ Back to Settings</button>
            )}
            {tab === "json" && (
              <button className="ts-json-switch-btn" onClick={() => requestTabChange("settings")}>⚙️ Back to Settings</button>
            )}
          </div>
          <div className="ts-actions-right">
            <button className="ts-cancel-btn" onClick={requestClose}>Cancel</button>
            <button className="ts-save-btn" onClick={handleSave}>✅ Save &amp; Apply</button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TriviaSettings;
