# Flashcards

A small, dependency-free flashcard app. Everything is saved in your browser's `localStorage`.

**Live:** https://theowiik.com/flashcards/

## How it works

1. The home screen is a grid of your decks. **+** makes a new one, **✎** edits one.
2. Tap a deck and pick how to practise it:
   - **Classic** — see the question, think of the answer, reveal it, then mark *Again* or *Got it*. Missed cards come back. Keys: `Space` reveal, `1` again, `2` got it.
   - **Connect** — match questions to their shuffled answers, 5 pairs per round.

## Editing a deck

The edit pop-up has a name and a list of question/answer rows. A new empty row appears as you type; `Enter` moves to the next field. You can also import CSV (paste or upload — comma, tab or semicolon, quotes supported, header optional) and export a deck to CSV:

```csv
question,answer
Capital of France,Paris
"Largest planet, by mass",Jupiter
```

## Development

No build step — serve the folder with any static server and open it. Every push to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`.
