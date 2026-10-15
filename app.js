// ==========================================================
// ENGLISH AUDIO FLASH - v11
// Diseño profesional + fix botón play/pausa con SVG
// ==========================================================

// ---------- ESTADO ----------
let cards = [];
let sessionCards = [];
let currentIndex = 0;
let isPlaying = false;
let speed = 1;
let pauseSeconds = 2;
let direction = "en-es";
let order = "secuencial";
let sessionLimit = "all";

let cyclePlayed = [];
let history = [];
let cycleCompleted = false;
let sessionPlayed = 0;

// ---------- PERSISTENCIA ----------
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("af_settings") || "{}");
    if (s.direction) direction = s.direction;
    if (s.order) order = s.order;
    if (typeof s.speed === "number") speed = s.speed;
    if (typeof s.pause === "number") pauseSeconds = s.pause;
    if (s.sessionLimit !== undefined) sessionLimit = s.sessionLimit;
  } catch (e) {}
}

function saveSettings() {
  localStorage.setItem("af_settings", JSON.stringify({
    direction, order, speed, pause: pauseSeconds, sessionLimit
  }));
}

// ---------- DOM ----------
const player       = document.getElementById("player");
const statusEl     = document.getElementById("status");
const wordEn       = document.getElementById("wordEn");
const wordEs       = document.getElementById("wordEs");
const noteEl       = document.getElementById("note");
const counter      = document.getElementById("counter");
const progressBar  = document.getElementById("progressBar");
const cardEl       = document.getElementById("card");

const btnPlay      = document.getElementById("btnPlay");
const btnPrev      = document.getElementById("btnPrev");
const btnNext      = document.getElementById("btnNext");
const btnDirection = document.getElementById("btnDirection");
const btnOrder     = document.getElementById("btnOrder");
const btnDeck      = document.getElementById("btnDeck");

const directionLabel = document.getElementById("directionLabel");
const orderLabel     = document.getElementById("orderLabel");

const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");
const pauseInput = document.getElementById("pause");
const pauseValue = document.getElementById("pauseValue");
const limitSelect = document.getElementById("limit");

const deckModal   = document.getElementById("deckModal");
const deckList    = document.getElementById("deckList");
const btnCloseDeck = document.getElementById("btnCloseDeck");
const deckTitle   = document.getElementById("deckTitle");

// ---------- HELPERS DE PLAY/PAUSA ----------
function setPlayState(playing) {
  if (playing) {
    btnPlay.classList.add("playing");
    btnPlay.setAttribute("aria-label", "Pausar");
    btnPlay.title = "Pausar";
  } else {
    btnPlay.classList.remove("playing");
    btnPlay.setAttribute("aria-label", "Reproducir");
    btnPlay.title = "Reproducir";
  }
}

// ---------- POBLAR SELECTOR ----------
function populateLimitOptions() {
  limitSelect.innerHTML = "";
  for (let i = 1; i <= 100; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    limitSelect.appendChild(opt);
  }
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "Todas";
  limitSelect.appendChild(allOpt);
  limitSelect.value = sessionLimit === "all" ? "all" : String(sessionLimit);
}

// ---------- CARGAR DATOS ----------
async function loadCards() {
  try {
    const res = await fetch("data/decks.json", { cache: "no-store" });
    const data = await res.json();
    cards = data.cards || [];
    if (data.deck) deckTitle.textContent = data.deck;
    if (cards.length === 0) {
      statusEl.textContent = "Sin tarjetas";
      return;
    }
    buildDeckList();
    resetCycle();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error al cargar datos";
  }
}

// ---------- BOTONES ----------
function updateButtons() {
  directionLabel.textContent = direction === "en-es"
    ? "EN → ES"
    : "ES → EN";

  orderLabel.textContent = order === "secuencial"
    ? "🔁 Secuencial"
    : "🎲 Aleatorio";
}

// ---------- LÍMITE EFECTIVO ----------
function effectiveLimit() {
  if (cards.length === 0) return 1;
  if (sessionLimit === "all") return cards.length;
  const n = parseInt(sessionLimit, 10);
  if (isNaN(n)) return cards.length;
  return Math.min(n, cards.length);
}

function buildSession() {
  const limit = effectiveLimit();
  sessionCards = cards.slice(0, limit);
}

// ---------- RESET ----------
function resetCycle() {
  buildSession();
  cyclePlayed = [];
  history = [];
  cycleCompleted = false;
  sessionPlayed = 0;

  if (sessionCards.length === 0) return;

  if (order === "aleatorio") {
    currentIndex = Math.floor(Math.random() * sessionCards.length);
  } else {
    currentIndex = 0;
  }
  cyclePlayed = [currentIndex];
  renderCard();
}

// ---------- ALEATORIO SIN REPETICIÓN ----------
function pickNextRandom() {
  const total = sessionCards.length;
  if (cyclePlayed.length >= total) cyclePlayed = [];

  const candidates = [];
  for (let i = 0; i < total; i++) {
    if (i === currentIndex) continue;
    if (cyclePlayed.includes(i)) continue;
    candidates.push(i);
  }
  if (candidates.length === 0) {
    for (let i = 0; i < total; i++) {
      if (i !== currentIndex) candidates.push(i);
    }
    if (candidates.length === 0) return currentIndex;
  }
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  cyclePlayed.push(next);
  return next;
}

// ---------- SIGUIENTE / ANTERIOR ----------
function goNext() {
  history.push(currentIndex);
  cycleCompleted = false;
  if (order === "secuencial") {
    currentIndex = (currentIndex + 1) % sessionCards.length;
  } else {
    currentIndex = pickNextRandom();
  }
}

function goPrev() {
  cycleCompleted = false;
  if (history.length > 0) {
    const prev = history.pop();
    if (order === "aleatorio") {
      const idx = cyclePlayed.indexOf(currentIndex);
      if (idx !== -1) cyclePlayed.splice(idx, 1);
    }
    currentIndex = prev;
  } else if (order === "secuencial") {
    currentIndex = (currentIndex - 1 + sessionCards.length) % sessionCards.length;
  }
}

// ---------- FIN DE SESIÓN ----------
function finishCycle() {
  isPlaying = false;
  cycleCompleted = true;
  player.pause();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  cardEl.classList.remove("playing");
  setPlayState(false);
  statusEl.classList.remove("active");
  statusEl.textContent = "✅ Completado";
}

// ---------- RENDER ----------
function renderCard() {
  const c = sessionCards[currentIndex];
  if (!c) return;

  wordEn.textContent = direction === "en-es" ? c.es : c.en;
  wordEs.textContent = "";
  noteEl.textContent = (c.note || "").trim();

  const limit = sessionCards.length;
  const shown = Math.min(sessionPlayed + 1, limit);
  counter.textContent = `${shown} / ${limit}`;
  progressBar.style.width = (shown / limit) * 100 + "%";

  if (!cycleCompleted) {
    statusEl.textContent = "Listo";
    statusEl.classList.remove("active");
  }
}

// ---------- REPRODUCIR ----------
function playCard() {
  return new Promise((resolve) => {
    const c = sessionCards[currentIndex];
    if (!c) return resolve();

    cardEl.classList.add("playing");

    if (direction === "en-es") {
      statusEl.textContent = "🔊 Inglés";
      statusEl.classList.add("active");

      player.src = c.audio;
      player.playbackRate = speed;
      player.currentTime = 0;

      player.onended = () => afterCard(resolve);
      player.onerror = () => {
        console.warn("Error al reproducir:", c.audio);
        afterCard(resolve);
      };
      player.play().catch(() => afterCard(resolve));
    } else {
      statusEl.textContent = "🇪🇸 Español";
      statusEl.classList.add("active");
      speakSpanish(c.es, () => afterCard(resolve));
    }
  });
}

function afterCard(resolve) {
  statusEl.textContent = "⏸ Pausa";
  statusEl.classList.remove("active");
  cardEl.classList.remove("playing");
  setTimeout(() => resolve(), pauseSeconds * 1000);
}

// ---------- TTS ----------
function speakSpanish(text, onDone) {
  if (!("speechSynthesis" in window)) {
    onDone && onDone();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = speed;
  u.onend = () => onDone && onDone();
  u.onerror = () => onDone && onDone();
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ---------- LOOP ----------
async function loop() {
  const limit = sessionCards.length;
  while (isPlaying) {
    await playCard();
    if (!isPlaying) break;
    sessionPlayed++;

    if (sessionPlayed >= limit) {
      finishCycle();
      break;
    }
    goNext();
    renderCard();
  }
}

// ---------- PANEL DEL MAZO ----------
function buildDeckList() {
  deckList.innerHTML = "";
  cards.forEach((c, i) => {
    const item = document.createElement("div");
    item.className = "deck-item";
    item.dataset.index = i;

    const noteHtml = c.note && c.note.trim()
      ? `<div class="deck-item-note">${escapeHtml(c.note)}</div>`
      : "";

    item.innerHTML = `
      <div class="deck-item-header">
        <div class="deck-item-en">${escapeHtml(c.en)}</div>
        <div class="deck-item-index">#${i + 1}</div>
      </div>
      <div class="deck-item-es">${escapeHtml(c.es)}</div>
      ${noteHtml}
    `;

    item.addEventListener("click", () => {
      if (!c.audio) return;
      player.src = c.audio;
      player.playbackRate = speed;
      player.currentTime = 0;
      player.play().catch(() => {});
    });

    deckList.appendChild(item);
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function openDeck() {
  deckModal.classList.add("open");
  if (isPlaying) stopAll();
}

function closeDeck() {
  deckModal.classList.remove("open");
}

btnDeck.addEventListener("click", openDeck);
btnCloseDeck.addEventListener("click", closeDeck);
deckModal.addEventListener("click", (e) => {
  if (e.target === deckModal) closeDeck();
});

// ---------- CONTROLES ----------
btnPlay.addEventListener("click", () => {
  if (sessionCards.length === 0) return;
  if (isPlaying) {
    stopAll();
  } else {
    if (cycleCompleted) resetCycle();
    isPlaying = true;
    setPlayState(true);
    loop();
  }
});

btnNext.addEventListener("click", () => {
  if (sessionCards.length === 0) return;
  const wasPlaying = isPlaying;
  stopAll();
  goNext();
  renderCard();
  if (wasPlaying) {
    isPlaying = true;
    setPlayState(true);
    loop();
  }
});

btnPrev.addEventListener("click", () => {
  if (sessionCards.length === 0) return;
  const wasPlaying = isPlaying;
  stopAll();
  goPrev();
  renderCard();
  if (wasPlaying) {
    isPlaying = true;
    setPlayState(true);
    loop();
  }
});

btnDirection.addEventListener("click", () => {
  const wasPlaying = isPlaying;
  stopAll();
  direction = direction === "en-es" ? "es-en" : "en-es";
  resetCycle();
  updateButtons();
  saveSettings();
  if (wasPlaying) {
    isPlaying = true;
    setPlayState(true);
    loop();
  }
});

btnOrder.addEventListener("click", () => {
  const wasPlaying = isPlaying;
  stopAll();
  order = order === "secuencial" ? "aleatorio" : "secuencial";
  resetCycle();
  updateButtons();
  saveSettings();
  if (wasPlaying) {
    isPlaying = true;
    setPlayState(true);
    loop();
  }
});

speedInput.addEventListener("input", () => {
  speed = parseFloat(speedInput.value);
  speedValue.textContent = speed.toFixed(1) + "x";
  player.playbackRate = speed;
  saveSettings();
});

pauseInput.addEventListener("input", () => {
  pauseSeconds = parseFloat(pauseInput.value);
  pauseValue.textContent = pauseSeconds + "s";
  saveSettings();
});

limitSelect.addEventListener("change", () => {
  const wasPlaying = isPlaying;
  sessionLimit = limitSelect.value === "all"
    ? "all"
    : parseInt(limitSelect.value, 10);
  saveSettings();
  if (wasPlaying) stopAll();
  resetCycle();
});

function stopAll() {
  isPlaying = false;
  player.pause();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  cardEl.classList.remove("playing");
  setPlayState(false);
  statusEl.classList.remove("active");
  if (!cycleCompleted) statusEl.textContent = "Pausado";
}

// ---------- INIT ----------
loadSettings();
populateLimitOptions();
updateButtons();
speedInput.value = speed;
speedValue.textContent = speed.toFixed(1) + "x";
pauseInput.value = pauseSeconds;
pauseValue.textContent = pauseSeconds + "s";
setPlayState(false);
loadCards();
