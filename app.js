import { parseCSV, rowsToCards, toCSV } from './csv.js';

// ---------- storage ----------
const STORE_KEY = 'flashcards.v1';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function sampleDeck() {
  return {
    id: uid(),
    name: 'Capitals',
    cards: [
      ['France', 'Paris'], ['Japan', 'Tokyo'], ['Kenya', 'Nairobi'], ['Canada', 'Ottawa'],
      ['Australia', 'Canberra'], ['Brazil', 'Brasília'], ['Norway', 'Oslo'], ['Egypt', 'Cairo'],
    ].map(([q, a]) => ({ id: uid(), q, a })),
  };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (data && Array.isArray(data.decks)) return { decks: data.decks };
  } catch { /* fall through */ }
  return { decks: [sampleDeck()] };
}

const state = load();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { toast('Could not save — storage is full or blocked'); }
}
const findDeck = (id) => state.decks.find((d) => d.id === id);

// ---------- dom helpers ----------
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
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

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------- modal ----------
// Opens a <dialog> with the given content. `canDismiss()` decides whether Esc /
// backdrop clicks may close it. Returns a close function.
function openModal(content, { canDismiss = () => true, onBlocked = () => {}, onClose = () => {}, wide = false } = {}) {
  const dlg = h('dialog', { class: `modal${wide ? ' wide' : ''}` }, content);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dlg.close();
    dlg.remove();
    onClose();
  };
  const dismiss = () => (canDismiss() ? close() : onBlocked());
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); dismiss(); }); // Esc
  dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) dismiss(); }); // backdrop
  document.body.append(dlg);
  dlg.showModal();
  return close;
}

function confirmModal({ title, message, confirmLabel }) {
  return new Promise((resolve) => {
    let result = false;
    const cancel = h('button', { class: 'btn', onclick: () => close() }, 'Cancel');
    const close = openModal(h('div', { class: 'modal-body' },
      h('h2', {}, title),
      h('p', { class: 'muted' }, message),
      h('div', { class: 'modal-actions' }, cancel,
        h('button', { class: 'btn danger', onclick: () => { result = true; close(); } }, confirmLabel)),
    ), { onClose: () => resolve(result) });
    cancel.focus();
  });
}

// ---------- routing: #/  or  #/<deckId>/<classic|connect> ----------
const MODES = {
  classic: { label: 'Classic', icon: '🃏', desc: 'Think of the answer, then reveal it.', min: 1 },
  connect: { label: 'Connect', icon: '🔗', desc: 'Match questions to their answers.', min: 2 },
};

const topEl = document.getElementById('top');
const viewEl = document.getElementById('view');
let cleanupView = () => {};

function render() {
  cleanupView();
  cleanupView = () => {};
  viewEl.replaceChildren();
  window.scrollTo(0, 0);

  const [, id, mode] = location.hash.replace(/^#/, '').split('/');
  const deck = findDeck(id);
  if (deck && MODES[mode] && deck.cards.length >= MODES[mode].min) {
    topEl.replaceChildren(
      h('a', { class: 'back', href: '#/', 'aria-label': 'Back to decks' }, '←'),
      h('div', { class: 'title' }, h('strong', {}, deck.name), h('span', { class: 'muted' }, MODES[mode].label)),
    );
    (mode === 'classic' ? classicView : connectView)(deck);
  } else {
    if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
    topEl.replaceChildren(h('h1', { class: 'brand' }, 'Flashcards'));
    homeView();
  }
}
window.addEventListener('hashchange', render);

// ---------- home ----------
function homeView() {
  const tiles = state.decks.map((deck) => {
    const n = deck.cards.length;
    return h('div', { class: 'deck' },
      h('button', { class: 'deck-open', onclick: () => (n ? pickMode(deck) : editDeck(deck)) },
        h('span', { class: 'deck-name' }, deck.name),
        h('span', { class: 'deck-count muted' }, n ? plural(n, 'card') : 'Empty — tap to add cards')),
      h('button', { class: 'deck-edit', 'aria-label': `Edit ${deck.name}`, title: 'Edit', onclick: () => editDeck(deck) }, '✎'),
    );
  });
  viewEl.append(h('div', { class: 'grid' }, ...tiles,
    h('button', { class: 'deck add', onclick: () => editDeck(null) }, h('span', { class: 'plus' }, '+'), 'New deck')));
}

function pickMode(deck) {
  const choose = (key) => { close(); location.hash = `#/${deck.id}/${key}`; };
  const close = openModal(h('div', { class: 'modal-body' },
    h('h2', {}, deck.name),
    h('p', { class: 'muted' }, 'How do you want to practise?'),
    h('div', { class: 'modes' }, ...Object.entries(MODES).map(([key, m]) => {
      const blocked = deck.cards.length < m.min;
      return h('button', { class: 'mode', disabled: blocked, onclick: () => choose(key) },
        h('span', { class: 'mode-icon', 'aria-hidden': 'true' }, m.icon),
        h('span', { class: 'mode-name' }, m.label),
        h('span', { class: 'muted' }, blocked ? `Needs at least ${m.min} cards` : m.desc));
    })),
  ));
}

// ---------- edit deck (modal) ----------
function editDeck(deck) {
  const isNew = !deck;
  let dirty = false;
  const markDirty = () => { dirty = true; };

  const nameIn = h('input', { class: 'name-input', value: deck?.name ?? '', placeholder: 'Deck name', 'aria-label': 'Deck name', oninput: markDirty });
  const rowsEl = h('div', { class: 'rows' });
  const error = h('p', { class: 'error', hidden: true });

  function addRow(q = '', a = '') {
    const qIn = h('input', { value: q, placeholder: 'Question', 'aria-label': 'Question' });
    const aIn = h('input', { value: a, placeholder: 'Answer', 'aria-label': 'Answer' });
    const row = h('div', { class: 'card-row' }, qIn, aIn,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove card', tabindex: '-1', onclick: () => { row.remove(); markDirty(); ensureBlankRow(); } }, '✕'));
    row.qIn = qIn; row.aIn = aIn;
    for (const input of [qIn, aIn]) {
      input.addEventListener('input', () => { markDirty(); ensureBlankRow(); });
    }
    // Enter in the answer field jumps to the next question.
    aIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); ensureBlankRow(); row.nextElementSibling?.qIn.focus(); }
    });
    qIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aIn.focus(); } });
    rowsEl.append(row);
    return row;
  }
  // Always keep exactly one empty row at the bottom to type into.
  function ensureBlankRow() {
    const last = rowsEl.lastElementChild;
    if (!last || last.qIn.value.trim() || last.aIn.value.trim()) addRow();
  }

  (deck?.cards ?? []).forEach((c) => addRow(c.q, c.a));
  ensureBlankRow();

  // CSV import, tucked away
  const csvIn = h('textarea', { rows: 5, placeholder: 'question,answer\nCapital of France,Paris\n"Largest planet, by mass",Jupiter' });
  const fileIn = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/plain', hidden: true });
  fileIn.addEventListener('change', async () => {
    if (fileIn.files[0]) csvIn.value = await fileIn.files[0].text();
    fileIn.value = '';
  });
  const importDetails = h('details', { class: 'import' },
    h('summary', {}, 'Import from CSV'),
    h('p', { class: 'muted small' }, 'One card per line: question, then answer. Comma, tab or semicolon separated.'),
    csvIn,
    h('div', { class: 'modal-actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => fileIn.click() }, 'Choose file…'), fileIn,
      h('button', { class: 'btn', type: 'button', onclick: importCSV }, 'Add these cards')),
  );
  function importCSV() {
    const { cards, skipped } = rowsToCards(parseCSV(csvIn.value));
    if (!cards.length) return toast('No cards found — each line needs a question and an answer');
    rowsEl.lastElementChild?.remove(); // drop the blank row, re-add after
    cards.forEach((c) => addRow(c.q, c.a));
    ensureBlankRow();
    markDirty();
    csvIn.value = '';
    importDetails.open = false;
    toast(`Added ${plural(cards.length, 'card')}${skipped ? ` · skipped ${skipped}` : ''}`);
  }

  function collect() {
    const cards = [];
    let incomplete = 0;
    for (const row of rowsEl.children) {
      const q = row.qIn.value.trim(), a = row.aIn.value.trim();
      if (q && a) cards.push({ q, a });
      else if (q || a) { incomplete++; row.classList.add('bad'); }
    }
    return { cards, incomplete };
  }

  function onSave() {
    rowsEl.querySelectorAll('.bad').forEach((r) => r.classList.remove('bad'));
    const name = nameIn.value.trim();
    const { cards, incomplete } = collect();
    if (!name) return showError('Give the deck a name.', nameIn);
    if (incomplete) return showError(`${plural(incomplete, 'card')} ${incomplete === 1 ? 'is' : 'are'} missing a question or answer.`);
    const target = deck ?? { id: uid() };
    const old = new Map((deck?.cards ?? []).map((c) => [`${c.q}\u0000${c.a}`, c.id]));
    target.name = name;
    target.cards = cards.map((c) => ({ id: old.get(`${c.q}\u0000${c.a}`) ?? uid(), ...c }));
    if (isNew) state.decks.push(target);
    save();
    close();
    render();
  }
  function showError(msg, focus) {
    error.textContent = msg;
    error.hidden = false;
    focus?.focus();
  }

  async function onDelete() {
    const ok = await confirmModal({
      title: `Delete “${deck.name}”?`,
      message: `This removes the deck and its ${plural(deck.cards.length, 'card')}. It can’t be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    state.decks = state.decks.filter((d) => d !== deck);
    save();
    close();
    render();
  }

  function onExport() {
    const { cards } = collect();
    const blob = new Blob([toCSV(cards)], { type: 'text/csv' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${(nameIn.value.trim() || 'deck').replace(/[^\w-]+/g, '_')}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const close = openModal(h('div', { class: 'modal-body' },
    h('div', { class: 'modal-head' },
      h('h2', {}, isNew ? 'New deck' : 'Edit deck'),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => tryClose() }, '✕')),
    nameIn,
    rowsEl,
    importDetails,
    error,
    h('div', { class: 'modal-actions spread' },
      h('div', { class: 'modal-actions' },
        !isNew && h('button', { class: 'btn ghost danger-text', onclick: onDelete }, 'Delete'),
        !isNew && h('button', { class: 'btn ghost', onclick: onExport }, 'Export CSV')),
      h('button', { class: 'btn primary', onclick: onSave }, 'Save')),
  ), { wide: true, canDismiss: () => !dirty, onBlocked: () => tryClose() });

  function tryClose() {
    if (!dirty) return close();
    confirmModal({ title: 'Discard changes?', message: 'Your edits to this deck won’t be saved.', confirmLabel: 'Discard' })
      .then((ok) => ok && close());
  }

  (isNew ? nameIn : rowsEl.lastElementChild.qIn).focus();
}

// ---------- classic: think, reveal, grade ----------
function classicView(deck) {
  let queue, total, known, current, flipped;

  const bar = h('div');
  const count = h('span', { class: 'muted' });
  const front = h('div', { class: 'face front' });
  const back = h('div', { class: 'face back' });
  const card = h('button', { class: 'card', onclick: flip }, h('div', { class: 'card-inner' }, front, back));
  const revealBtn = h('button', { class: 'btn primary big', onclick: flip }, 'Show answer');
  const gradeBtns = h('div', { class: 'grade', hidden: true },
    h('button', { class: 'btn big again', onclick: () => grade(false) }, 'Again'),
    h('button', { class: 'btn big good', onclick: () => grade(true) }, 'Got it'));
  const stage = h('div', { class: 'stage' },
    h('div', { class: 'progress-row' }, h('div', { class: 'progress' }, bar), count),
    card, revealBtn, gradeBtns);
  viewEl.append(stage);

  function restart() {
    queue = shuffle(deck.cards);
    total = queue.length;
    known = 0;
    viewEl.replaceChildren(stage);
    next();
  }
  function next() {
    current = queue.shift();
    flipped = false;
    if (!current) return finished(`You know all ${plural(total, 'card')}.`, restart);
    bar.style.width = `${(known / total) * 100}%`;
    count.textContent = `${known} / ${total}`;
    // Snap back to the front without animating so the next answer never flashes.
    card.classList.add('instant');
    card.classList.remove('flipped');
    void card.offsetWidth;
    card.classList.remove('instant');
    front.textContent = current.q;
    back.textContent = current.a;
    revealBtn.hidden = false;
    gradeBtns.hidden = true;
  }
  function flip() {
    if (!current) return;
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
    revealBtn.hidden = flipped;
    gradeBtns.hidden = !flipped;
  }
  function grade(gotIt) {
    if (!flipped) return;
    if (gotIt) known++;
    else queue.push(current);
    next();
  }

  function onKey(e) {
    if (document.querySelector('dialog[open]')) return;
    if (e.key === ' ' && !e.target.closest('button, a')) { e.preventDefault(); flip(); }
    else if (e.key === '1') grade(false);
    else if (e.key === '2') grade(true);
  }
  document.addEventListener('keydown', onKey);
  cleanupView = () => document.removeEventListener('keydown', onKey);

  restart();
}

// ---------- connect: match pairs ----------
const PER_ROUND = 5;
const PAIR_COLORS = ['#3b5bdb', '#2b8a3e', '#e8590c', '#9c36b5', '#0c8599', '#c2255c'];

function connectView(deck) {
  let pool, round, matched, mistakes, roundNo, rounds, selected;

  const status = h('p', { class: 'muted center' });
  const board = h('div', { class: 'connect' });

  function start() {
    pool = shuffle(deck.cards);
    rounds = Math.ceil(pool.length / PER_ROUND);
    roundNo = 0;
    mistakes = 0;
    viewEl.replaceChildren(status, board);
    nextRound();
  }

  function nextRound() {
    round = pool.splice(0, PER_ROUND);
    if (!round.length) return finished(`${plural(deck.cards.length, 'pair')} matched with ${plural(mistakes, 'mistake')}.`, start);
    roundNo++;
    matched = 0;
    selected = null;
    const tile = (card, side) => {
      const t = h('button', { class: 'tile', onclick: () => pick(t) }, side === 'q' ? card.q : card.a);
      t.card = card; t.side = side;
      return t;
    };
    board.replaceChildren(
      h('div', { class: 'col' }, ...round.map((c) => tile(c, 'q'))),
      h('div', { class: 'col' }, ...shuffle(round).map((c) => tile(c, 'a'))),
    );
    updateStatus();
  }

  function updateStatus() {
    status.textContent = `${rounds > 1 ? `Round ${roundNo} of ${rounds} · ` : ''}${plural(mistakes, 'mistake')}`;
  }

  function pick(t) {
    if (t.classList.contains('matched')) return;
    if (!selected || selected.side === t.side) {
      selected?.classList.remove('selected');
      selected = selected === t ? null : t;
      selected?.classList.add('selected');
      return;
    }
    const [q, a] = t.side === 'q' ? [t, selected] : [selected, t];
    selected.classList.remove('selected');
    selected = null;
    // Compare answer text so decks with duplicate answers still work.
    if (q.card.id === a.card.id || q.card.a.trim() === a.card.a.trim()) {
      const color = PAIR_COLORS[matched % PAIR_COLORS.length];
      for (const x of [q, a]) { x.classList.add('matched'); x.style.setProperty('--pair', color); }
      matched++;
      if (matched === round.length) setTimeout(nextRound, 500);
    } else {
      mistakes++;
      for (const x of [q, a]) {
        x.classList.remove('wrong');
        void x.offsetWidth;
        x.classList.add('wrong');
        setTimeout(() => x.classList.remove('wrong'), 500);
      }
    }
    updateStatus();
  }

  start();
}

function finished(message, again) {
  viewEl.replaceChildren(h('div', { class: 'done' },
    h('p', { class: 'done-emoji', 'aria-hidden': 'true' }, '🎉'),
    h('h2', {}, 'Done!'),
    h('p', { class: 'muted' }, message),
    h('div', { class: 'modal-actions center' },
      h('a', { class: 'btn', href: '#/' }, 'Back to decks'),
      h('button', { class: 'btn primary', onclick: again }, 'Go again')),
  ));
}

render();
