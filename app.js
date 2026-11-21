import { parseCSV, rowsToCards, toCSV } from './csv.js';

// ---------- storage ----------
const STORE_KEY = 'flashcards.v1';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function sampleDeck() {
  return {
    id: uid(),
    name: 'Sample: Capitals',
    cards: [
      ['France', 'Paris'], ['Japan', 'Tokyo'], ['Kenya', 'Nairobi'], ['Canada', 'Ottawa'],
      ['Australia', 'Canberra'], ['Brazil', 'Brasília'], ['Norway', 'Oslo'], ['Egypt', 'Cairo'],
    ].map(([q, a]) => ({ id: uid(), q, a })),
  };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (data && Array.isArray(data.decks) && data.decks.length) return data;
  } catch { /* fall through */ }
  const deck = sampleDeck();
  return { decks: [deck], activeDeckId: deck.id, view: 'study' };
}

const state = load();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { toast('Could not save — storage is full or blocked'); }
}
const activeDeck = () => state.decks.find((d) => d.id === state.activeDeckId) ?? state.decks[0];

// ---------- dom helpers ----------
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || (k in el && typeof v !== 'string')) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const viewEl = document.getElementById('view');
const deckSelect = document.getElementById('deck-select');
let cleanupView = () => {};

// ---------- shell ----------
function renderDeckPicker() {
  deckSelect.replaceChildren(
    ...state.decks.map((d) => h('option', { value: d.id, selected: d.id === activeDeck().id }, `${d.name} (${d.cards.length})`)),
  );
}

deckSelect.addEventListener('change', () => {
  state.activeDeckId = deckSelect.value;
  save();
  render();
});

document.getElementById('new-deck').addEventListener('click', () => {
  const name = prompt('Name for the new deck:', 'New deck');
  if (!name?.trim()) return;
  const deck = { id: uid(), name: name.trim(), cards: [] };
  state.decks.push(deck);
  state.activeDeckId = deck.id;
  state.view = 'edit';
  save();
  render();
});

document.querySelectorAll('.tabs button').forEach((b) =>
  b.addEventListener('click', () => go(b.dataset.view)));

function go(view) {
  state.view = view;
  save();
  render();
}

function render() {
  cleanupView();
  cleanupView = () => {};
  renderDeckPicker();
  const view = state.view in views ? state.view : 'study';
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.view === view)));
  viewEl.replaceChildren();
  views[view](activeDeck());
}

function emptyState() {
  const node = document.getElementById('tpl-empty').content.cloneNode(true);
  node.querySelector('[data-goto]').addEventListener('click', () => go('edit'));
  viewEl.append(node);
}

// ---------- study (classic) ----------
function studyView(deck) {
  if (!deck.cards.length) return emptyState();

  let reversed = false;
  let queue, total, known, current, flipped;

  function restart() {
    queue = shuffle(deck.cards);
    total = queue.length;
    known = 0;
    next();
  }
  function next() {
    current = queue.shift();
    flipped = false;
    draw();
  }
  function grade(gotIt) {
    if (!flipped) return;
    if (gotIt) known++;
    else queue.push(current);
    next();
  }
  function flip() {
    if (!current) return;
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
    controls.hidden = !flipped;
    revealBtn.hidden = flipped;
  }

  const bar = h('div');
  const progress = h('div', { class: 'progress', 'aria-hidden': 'true' }, bar);
  const status = h('div', { class: 'muted' });
  const front = h('div', { class: 'face front' });
  const back = h('div', { class: 'face back' });
  const card = h('button', { class: 'card', onclick: flip, 'aria-live': 'polite' },
    h('div', { class: 'card-inner' }, front, back));
  const revealBtn = h('button', { class: 'btn primary', onclick: flip }, 'Reveal answer');
  const controls = h('div', { class: 'row', hidden: true },
    h('button', { class: 'btn bad', onclick: () => grade(false) }, 'Again'),
    h('button', { class: 'btn good', onclick: () => grade(true) }, 'Got it'),
  );
  const options = h('div', { class: 'row spread', style: 'width:100%' },
    status,
    h('div', { class: 'row' },
      h('label', { class: 'row muted' },
        h('input', { type: 'checkbox', onchange: (e) => { reversed = e.target.checked; draw(); } }),
        'Answer → question'),
      h('button', { class: 'btn small', onclick: restart }, 'Restart'),
    ),
  );
  const hint = h('p', { class: 'hint' },
    h('kbd', {}, 'Space'), ' reveal · ', h('kbd', {}, '1'), ' again · ', h('kbd', {}, '2'), ' got it');
  const wrap = h('div', { class: 'study' }, options, progress, card, revealBtn, controls, hint);
  viewEl.append(wrap);

  function draw() {
    bar.style.width = `${(known / total) * 100}%`;
    if (!current) {
      wrap.replaceChildren(h('div', { class: 'result' },
        h('p', { class: 'big' }, 'Deck complete 🎉'),
        h('p', { class: 'muted' }, `You went through all ${total} cards.`),
        h('button', { class: 'btn primary', onclick: () => { wrap.replaceChildren(options, progress, card, revealBtn, controls, hint); restart(); } }, 'Study again'),
      ));
      return;
    }
    status.textContent = `${known} / ${total} known · ${queue.length + 1} left`;
    // Snap back to the front without animating, so the next answer never flashes.
    card.classList.add('instant');
    card.classList.remove('flipped');
    void card.offsetWidth;
    card.classList.remove('instant');
    const [q, a] = reversed ? [current.a, current.q] : [current.q, current.a];
    front.replaceChildren(h('span', { class: 'label' }, reversed ? 'Answer' : 'Question'), q);
    back.replaceChildren(h('span', { class: 'label' }, reversed ? 'Question' : 'Answer'), a);
    controls.hidden = true;
    revealBtn.hidden = false;
  }

  function onKey(e) {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target.closest('button') && e.target !== card) return; // let focused buttons work
      e.preventDefault(); flip();
    }
    else if (e.key === '1') grade(false);
    else if (e.key === '2') grade(true);
  }
  document.addEventListener('keydown', onKey);
  cleanupView = () => document.removeEventListener('keydown', onKey);

  restart();
}

// ---------- connect (matching) ----------
const PAIR_COLORS = ['#3b5bdb', '#2b8a3e', '#e8590c', '#9c36b5', '#0c8599', '#c2255c', '#5c940d', '#d6336c'];

function connectView(deck) {
  if (deck.cards.length < 2) {
    if (!deck.cards.length) return emptyState();
    viewEl.append(h('div', { class: 'empty' }, h('p', {}, 'Connect mode needs at least 2 cards.'),
      h('button', { class: 'btn primary', onclick: () => go('edit') }, 'Add cards')));
    return;
  }

  let perRound = Math.min(state.connectSize ?? 5, deck.cards.length);
  let pool, round, mistakes, totalMistakes, matchedCount, roundNo, selected;

  function startSession() {
    pool = shuffle(deck.cards);
    totalMistakes = 0;
    roundNo = 0;
    nextRound();
  }

  function nextRound() {
    round = pool.splice(0, perRound);
    if (!round.length) return finish();
    roundNo++;
    mistakes = 0;
    matchedCount = 0;
    selected = null;
    drawRound();
  }

  const sizeSelect = h('select', {
    'aria-label': 'Pairs per round',
    onchange: (e) => { perRound = Number(e.target.value); state.connectSize = perRound; save(); startSession(); },
  }, ...[3, 4, 5, 6, 8].map((n) => h('option', { value: n, selected: n === perRound }, `${n} pairs`)));
  const status = h('div', { class: 'muted' });
  const board = h('div');
  viewEl.append(
    h('div', { class: 'row spread', style: 'margin-bottom:16px' }, status,
      h('div', { class: 'row' }, sizeSelect,
        h('button', { class: 'btn small', onclick: startSession }, 'Restart'))),
    board,
  );

  function drawRound() {
    const qTiles = round.map((c) => h('button', { class: 'tile', 'data-side': 'q' }, c.q));
    qTiles.forEach((t, i) => { t.card = round[i]; });
    const aCards = shuffle(round);
    const aTiles = aCards.map((c) => h('button', { class: 'tile', 'data-side': 'a' }, c.a));
    aTiles.forEach((t, i) => { t.card = aCards[i]; });

    for (const t of [...qTiles, ...aTiles]) t.addEventListener('click', () => pick(t));

    board.replaceChildren(h('div', { class: 'connect-grid' },
      h('div', { class: 'connect-col' }, h('h3', {}, 'Questions'), ...qTiles),
      h('div', { class: 'connect-col' }, h('h3', {}, 'Answers'), ...aTiles),
    ));
    updateStatus();
  }

  function updateStatus() {
    const rounds = roundNo + Math.ceil(pool.length / perRound);
    status.textContent = `Round ${roundNo} of ${rounds} · ${matchedCount}/${round.length} matched · ${mistakes} mistake${mistakes === 1 ? '' : 's'}`;
  }

  function pick(tile) {
    if (tile.classList.contains('matched')) return;
    if (!selected || selected.dataset.side === tile.dataset.side) {
      selected?.classList.remove('selected');
      selected = selected === tile ? null : tile;
      selected?.classList.add('selected');
      return;
    }
    const [qt, at] = tile.dataset.side === 'q' ? [tile, selected] : [selected, tile];
    selected.classList.remove('selected');
    selected = null;
    // Match on text so duplicate answers in a deck are both accepted.
    if (qt.card.id === at.card.id || qt.card.a.trim() === at.card.a.trim()) {
      const color = PAIR_COLORS[matchedCount % PAIR_COLORS.length];
      for (const t of [qt, at]) {
        t.classList.add('matched');
        t.style.setProperty('--pair', color);
        t.setAttribute('aria-disabled', 'true');
      }
      matchedCount++;
      updateStatus();
      if (matchedCount === round.length) {
        totalMistakes += mistakes;
        setTimeout(roundDone, 400);
      }
    } else {
      mistakes++;
      updateStatus();
      for (const t of [qt, at]) {
        t.classList.remove('wrong');
        void t.offsetWidth; // restart animation
        t.classList.add('wrong');
        setTimeout(() => t.classList.remove('wrong'), 600);
      }
    }
  }

  function roundDone() {
    if (!pool.length) return finish();
    board.replaceChildren(h('div', { class: 'result' },
      h('p', { class: 'big' }, mistakes === 0 ? 'Perfect round!' : 'Round complete'),
      h('p', { class: 'muted' }, `${mistakes} mistake${mistakes === 1 ? '' : 's'} this round.`),
      h('button', { class: 'btn primary', onclick: nextRound, autofocus: true }, 'Next round →'),
    ));
    board.querySelector('button').focus();
  }

  function finish() {
    status.textContent = '';
    board.replaceChildren(h('div', { class: 'result' },
      h('p', { class: 'big' }, 'All matched 🎉'),
      h('p', { class: 'muted' }, `${deck.cards.length} pairs · ${totalMistakes} mistake${totalMistakes === 1 ? '' : 's'} total.`),
      h('button', { class: 'btn primary', onclick: startSession }, 'Play again'),
    ));
  }

  startSession();
}

// ---------- edit ----------
function editView(deck) {
  // Deck settings
  const nameInput = h('input', { value: deck.name, 'aria-label': 'Deck name', style: 'flex:1;min-width:160px' });
  nameInput.addEventListener('change', () => {
    const v = nameInput.value.trim();
    if (!v) { nameInput.value = deck.name; return; }
    deck.name = v; save(); renderDeckPicker();
  });
  const deckPanel = h('section', { class: 'panel' },
    h('h2', {}, 'Deck'),
    h('div', { class: 'row' }, nameInput,
      h('button', { class: 'btn', onclick: exportCSV, disabled: !deck.cards.length }, 'Export CSV'),
      h('button', { class: 'btn danger', onclick: deleteDeck }, 'Delete deck')),
  );

  // One-by-one
  const qIn = h('textarea', { rows: 2, required: true, placeholder: 'e.g. Capital of France' });
  const aIn = h('textarea', { rows: 2, required: true, placeholder: 'e.g. Paris' });
  const form = h('form', { class: 'add-form', onsubmit: (e) => { e.preventDefault(); addOne(); } },
    h('label', {}, 'Question', qIn),
    h('label', {}, 'Answer', aIn),
    h('div', { class: 'row actions spread' },
      h('span', { class: 'hint' }, h('kbd', {}, 'Ctrl'), ' + ', h('kbd', {}, 'Enter'), ' to add'),
      h('button', { class: 'btn primary', type: 'submit' }, 'Add card')),
  );
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addOne(); }
  });
  function addOne() {
    const q = qIn.value.trim(), a = aIn.value.trim();
    if (!q || !a) { (q ? aIn : qIn).focus(); return; }
    deck.cards.push({ id: uid(), q, a });
    save();
    qIn.value = aIn.value = '';
    qIn.focus();
    renderDeckPicker();
    drawList();
  }

  // Bulk import
  const bulk = h('textarea', { rows: 6, placeholder: 'question,answer\nCapital of France,Paris\n"Largest planet, by mass",Jupiter' });
  const fileIn = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/plain', class: 'sr-only', id: 'csv-file' });
  const notice = h('p', { class: 'notice muted' }, 'One card per line: question and answer separated by a comma, tab, or semicolon. Use quotes for values containing commas. A header row is optional.');
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    if (f) bulk.value = await f.text();
    fileIn.value = '';
  });
  function importBulk() {
    const { cards, skipped } = rowsToCards(parseCSV(bulk.value));
    if (!cards.length) {
      notice.className = 'notice bad';
      notice.textContent = 'No cards found. Each line needs a question and an answer.';
      return;
    }
    deck.cards.push(...cards.map((c) => ({ id: uid(), ...c })));
    save();
    bulk.value = '';
    notice.className = 'notice muted';
    notice.textContent = `Imported ${cards.length} card${cards.length === 1 ? '' : 's'}${skipped ? ` · skipped ${skipped} incomplete line${skipped === 1 ? '' : 's'}` : ''}.`;
    renderDeckPicker();
    drawList();
  }
  const importPanel = h('section', { class: 'panel' },
    h('h2', {}, 'Import from CSV'),
    bulk, notice,
    h('div', { class: 'row spread' },
      h('label', { class: 'btn', for: 'csv-file' }, 'Choose file…', fileIn),
      h('button', { class: 'btn primary', onclick: importBulk }, 'Import')),
  );

  // List
  const list = h('ul', { class: 'card-list' });
  const listHeader = h('h2');
  const listPanel = h('section', { class: 'panel' }, listHeader, list);

  function drawList() {
    listHeader.textContent = `Cards (${deck.cards.length})`;
    deckPanel.querySelector('button').disabled = !deck.cards.length;
    if (!deck.cards.length) {
      list.replaceChildren(h('li', { class: 'muted', style: 'display:block' }, 'No cards yet.'));
      return;
    }
    list.replaceChildren(...deck.cards.map(cardRow).reverse());
  }

  function cardRow(card) {
    const li = h('li');
    let onEditKey = null;
    li.addEventListener('keydown', (e) => onEditKey?.(e));
    const show = () => { onEditKey = null; li.replaceChildren(
      h('div', { class: 'q' }, card.q),
      h('div', { class: 'a' }, card.a),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: edit }, 'Edit'),
        h('button', { class: 'btn small danger', 'aria-label': 'Delete card', onclick: remove }, '✕')),
    ); };
    function edit() {
      const q = h('textarea', { rows: 2, value: card.q });
      const a = h('textarea', { rows: 2, value: card.a });
      const commit = () => {
        if (!q.value.trim() || !a.value.trim()) return toast('Question and answer are required');
        card.q = q.value.trim(); card.a = a.value.trim(); save(); show();
      };
      li.replaceChildren(q, a, h('div', { class: 'row' },
        h('button', { class: 'btn small primary', onclick: commit }, 'Save'),
        h('button', { class: 'btn small', onclick: show }, 'Cancel')));
      onEditKey = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit();
        if (e.key === 'Escape') show();
      };
      q.focus();
    }
    function remove() {
      deck.cards = deck.cards.filter((c) => c !== card);
      save(); renderDeckPicker(); drawList();
    }
    show();
    return li;
  }

  function exportCSV() {
    const blob = new Blob([toCSV(deck.cards)], { type: 'text/csv' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${deck.name.replace(/[^\w-]+/g, '_')}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function deleteDeck() {
    if (!confirm(`Delete "${deck.name}" and its ${deck.cards.length} cards? This cannot be undone.`)) return;
    state.decks = state.decks.filter((d) => d !== deck);
    if (!state.decks.length) state.decks.push({ id: uid(), name: 'My deck', cards: [] });
    state.activeDeckId = state.decks[0].id;
    save(); render();
  }

  viewEl.append(deckPanel, h('section', { class: 'panel' }, h('h2', {}, 'Add a card'), form), importPanel, listPanel);
  drawList();
}

const views = { study: studyView, connect: connectView, edit: editView };
render();
