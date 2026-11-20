# Add two features to Gimnasio Mental (the real artifact)

Paste this to Claude Code in the `esmithco.github.io` repo.

---

Please add two features to **Gimnasio Mental**, the artifact whose source is `mente/artifact/gimnasio-mental.html` (published at https://claude.ai/artifact/RfTn6kXNR4zcxDwm6omrd9). Read the "Mind gym" section of CLAUDE.md first and keep everything that already exists: Claude as teacher, short replies, `S.cur` session restore, notes memory, the db doc `data/users/<id>/mind`, ES/EN, and progress loading before start. Don't lose any saved progress; new state goes in new keys with defaults.

In another chat, Claude built these two features in a separate, simpler copy of the trainer (an old fork). That code is in `mente/handoff/reference-fork.html`. Use it as a **reference only**: port the ideas and code into the real file, don't replace the real file with it. The relevant parts are under `/* ---------------- mental math ---------------- */` and `/* ---------------- pure math ---------------- */`.

## 1. Cálculo mental (mental math)

He wants to get faster at calculation, and he couldn't find where to do it. Make it **easy to find**:
- A button on the start screen: **"Solo cálculo mental (3 min)"**. It runs a sprint on its own and then returns to the start screen.
- The same button in the new Matemática tab.
- Optionally, a short block inside the daily session.

How it works:
- **10 techniques**, each with a short explanation and a worked example, in ES/EN: add left to right; subtract by rounding; split the multiplication; ×5/×50/×25; ×11; round and correct; quick percentages (and x% of y = y% of x); fast squares (ending in 5, near 50); difference of squares; divide in steps (÷4, ÷5, ÷25). These are `TECH` in the reference.
- **Problem generators** with 5 difficulty levels per technique. Every answer must be an exact integer. This is `GEN` in the reference, already tested over 100k problems with no bad answers.
- **One new technique unlocks per training day.** The intro screen shows today's technique (the new one, or the weakest unlocked one).
- **90-second sprint**:
  - Big problem text; a numeric input (`inputmode="decimal"`) where Enter submits; a countdown bar.
  - Instant ✓/✗ feedback. A ✗ shows the correct answer.
  - 60% of problems use today's technique; the rest mix in other unlocked techniques.
- **Leveling** per technique after each sprint: level up with ≥ 4 attempts, ≥ 90% correct and < 6 s average; level down if < 60% correct.
- **Results screen**: number correct, accuracy, seconds per answer, levels gained, and up to 6 misses with their answers. Then a line chart of the best daily score (last 30 days), drawn in SVG with theme colors.
- **Matemática tab**: a per-technique level display (5 dots each).
- **State**: `S.calc = {unlocked, lvl:{}, stats:{}, hist:[{d,score,acc}], lastDay}`. Stop the timer when he leaves the screen.

## 2. Matemática: rebuild pure math step by step

He studied math years ago and is rusty. A card on Dini's theorem was far too hard, and 10–20-minute proofs are too long. He wants **5 minutes a day to recover the basics and then stay sharp**, more like studying than solving hard problems.

- **A 37-topic syllabus from the basics** (`SYL` in the reference): fractions/exponents/roots → logarithms → equations → functions → exp/log functions → trigonometry → sets and logic → direct proof/contradiction → induction → sums → limits (intuitive) → continuity → derivative → rules → chain rule → max/min → integral and FTC → substitution → by parts → series → geometric/Taylor → vectors → matrices → determinants → vector spaces → linear maps → eigenvalues → counting → conditional probability/Bayes → expectation/variance → normal and CLT → divisibility/gcd → modular arithmetic → groups → ε-δ → supremum/completeness → uniform convergence.
- **Daily card**, written by Claude for the current topic. Use his memory and notes like the rest of the app does. The card has:
  - **Explanation:** 90–140 words, for someone rusty: the idea in plain words, the key rule, and **one worked example with numbers**. Define any symbol used.
  - **One quick question** answerable in 1–3 minutes. Never a long proof.
  - A hint, a solution, and "Que Claude revise mi respuesta" (2–4 sentence feedback that points to the first error).
- **After the solution**: "Lo entendí, siguiente tema" (advance) or "Repasar este tema otra vez" (a new card on the same topic with a different example or aspect).
- **Navigation**: a collapsible full syllabus where he can tap any topic to jump to it, plus a history of past cards.
- **Without Claude** (if `sample` is missing): fall back to the reference's static set.
- **State**: `S.pure = {step, today, hist}`.

When done: test it (sprint flow, leveling, syllabus navigation), publish it to the **same** artifact URL, and update the "Mind gym" section of CLAUDE.md. The fork artifact (https://claude.ai/artifact/MseDbFrM9XqPEEmBVomfay) is no longer needed after this.
