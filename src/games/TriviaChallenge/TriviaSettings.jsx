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

const API_URL = import.meta.env.VITE_API_URL || "";

const TriviaSettings = ({ onSave, onCancel }) => {
  const [rounds, setRounds] = useState(3);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(15);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loadingApi, setLoadingApi] = useState(false);

  // "settings" | "questions" | "json"
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
          if (apiCatNames.length > 0) {
            setSelectedCategory(apiCatNames[0]);
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
  }, [API_URL]);

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
    markDirty(cat, (editor) => ({
      ...editor,
      questions: editor.questions.filter((_, i) => i !== qIdx),
    }));
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
    // Revert to last applied state
    setCatEditors((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], isDirty: false },
    }));
    setEditingCat(null);
  };

  /** Reset a default category to built-in questions */
  const resetCategory = (cat) => {
    if (!DEFAULT_TRIVIA_QUESTIONS[cat]) return;
    setCatEditors((prev) => ({
      ...prev,
      [cat]: buildEditorEntry(
        DEFAULT_TRIVIA_QUESTIONS[cat].questions,
        false,
        DEFAULT_TRIVIA_QUESTIONS[cat].icon,
        false
      ),
    }));
  };

  /** Remove an admin-added custom category */
  const removeCustomCat = (cat) => {
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
    // Immediately open the modal for the new category so user can add questions
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

  /* ══════════════════════════════════════
     Save — FIX: always include ALL enabled categories
  ══════════════════════════════════════ */
  const handleSave = () => {
    let questions;
    if (jsonCustom && jsonValid) {
      // JSON editor override takes precedence
      questions = JSON.parse(jsonText);
    } else {
      questions = {};
      catOrder.forEach((cat) => {
        if (!enabledCats.has(cat)) return; // skip disabled categories
        const editor = catEditors[cat];
        if (!editor) return;
        if (editor.modified) {
          // Use admin-edited questions
          questions[cat] = { icon: editor.icon, questions: editor.questions };
        } else if (DEFAULT_TRIVIA_QUESTIONS[cat]) {
          // Use default built-in questions
          questions[cat] = DEFAULT_TRIVIA_QUESTIONS[cat];
        } else if (editor.isCustomCat && editor.questions.length > 0) {
          // Custom category with questions (not yet formally applied)
          questions[cat] = { icon: editor.icon, questions: editor.questions };
        }
      });
    }
    onSave({
      rounds: Math.max(1, Math.min(10, rounds)),
      questionsPerRound: Math.max(1, Math.min(20, questionsPerRound)),
      timerEnabled,
      timerSeconds: Math.max(5, Math.min(60, timerSeconds)),
      selectedCategory,
      questions,
    });
  };

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
            className={`ts-tab-btn ${tab === "json" ? "active" : ""}`}
            onClick={() => requestTabChange("json")}
          >
            {"{ }"} JSON Editor
            {jsonCustom && <span className="ts-tab-badge">✦ Custom</span>}
            {jsonDirty && !jsonCustom && <span className="ts-tab-badge ts-tab-badge-warn">● Unsaved</span>}
          </button>
          <div className="ts-tab-spacer" />
          {tab === "json" && (
            <button className="ts-reset-btn" onClick={handleResetJson}>
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
            </div>

            <div className="ts-section">
              <div className="ts-section-title">🎯 Assigned Game Category (Admin Only)</div>
              <p className="ts-hint" style={{ marginBottom: "10px" }}>
                Players cannot choose categories during gameplay. Select the assigned category for this trivia game:
              </p>
              <div className="ts-row">
                <span className="ts-label">Category for Game</span>
                <select
                  className="ts-input"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ minWidth: "200px", padding: "6px 10px", borderRadius: "6px" }}
                >
                  <option value="All">🌟 All Enabled Categories (Mixed)</option>
                  {catOrder.filter((cat) => enabledCats.has(cat)).map((cat) => (
                    <option key={cat} value={cat}>
                      {catEditors[cat]?.icon || DEFAULT_TRIVIA_QUESTIONS[cat]?.icon || "❓"} {cat}
                    </option>
                  ))}
                </select>
              </div>
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
                /* Collapsed state: just the button */
                <button
                  className="ts-add-cat-toggle-btn"
                  onClick={() => setShowAddCatForm(true)}
                >
                  ➕ Add New Category
                </button>
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
