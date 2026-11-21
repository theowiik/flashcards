# Flashcards

A small, dependency-free flashcard app. Cards are saved in your browser's `localStorage`.

**Live:** https://theowiik.com/flashcards/

## How it works

The home screen is a grid of your decks. Open a deck, then pick how to practise it — every mode works on the same cards:

- **Classic** —  flashcards: see the question, think, reveal, then mark *Again* or *Got it*. Missed cards come back at the end. Keys: `Space` reveal, `1` again, `2` got it. Can be flipped to answer → question.
- **Connect** — questions on the left, shuffled answers on the right. Click a question and its answer to match them. Choose 3–8 pairs per round.

## Adding cards

- One at a time from **Edit cards** (`Ctrl`+`Enter` to add).
- Bulk import by pasting or uploading CSV. Comma, tab and semicolon are detected automatically, quotes are supported, and a `question,answer` header row is optional:

  ```csv
  question,answer
  Capital of France,Paris
  "Largest planet, by mass",Jupiter
  ```

- Export any deck back to CSV.

## Development

No build step. Serve the folder with any static server, e.g. `python3 -m http.server`, and open http://localhost:8000.

Every push to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`.
