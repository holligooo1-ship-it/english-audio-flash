// ==========================================================
// ENGLISH AUDIO FLASH - v16
// Selector de mazos + soporte TTS para tarjetas sin audio
// ==========================================================

// ---------- ESTADO ----------
let decksIndex = [];           // lista de mazos del índice
let currentDeck = null;        // mazo activo (objeto del índice)
let cards = [];                // tarjetas del mazo activo
let sessionCards = [];
let currentIndex = 0;
let isPlaying = false;
let speed = 1;
let pauseSeconds = 2;
let direction = "en-es";
let order = "secuencial";
let sessionLimit = "all";
let currentTag = "all";

let cyclePlayed = [];
let history = [];
let cycleCompleted = false;
let sessionPlayed = 0;

let loopGeneration = 0;
let pendingResolve = null;

// ---------- HELPERS LUCIDE ----------
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

// ---------- PERSISTENCIA ----------
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("af_settings") || "{}");
    if (s.direction) direction = s.direction;
    if (s.order) order = s.order;
    if (typeof s.speed === "number") speed = s.speed;
    if (typeof s.pause === "number") pauseSeconds = s.pause;
    if (s.sessionLimit !== undefined) sessionLimit = s.sessionLimit;
    if (s.currentTag !== undefined) currentTag = s.currentTag;
  } catch (e) {}
}

function saveSettings() {
  localStorage.setItem("af_settings", JSON.stringify({
    direction, order, speed, pause: pauseSeconds, sessionLimit, currentTag
  }));
}

// ---------- DOM ----------
const homeView     = document.getElementById("homeView");
const playerView   = document.getElementById("playerView");
const deckGrid     = document.getElementById("deckGrid");

const player       = document.getElementById("player");
const statusEl     = document.getElementById("status");
const wordEn       = document.getElementById("wordEn");
const wordEs       = document.getElementById("wordEs");
const noteEl       = document.getElementById("note");
const counter      = document.getElementById("counter");
const progressBar  = document.getElementById("progressBar");
const cardEl       = document.getElementById("card");

const btnBack      = document.getElementById("btnBack");
const btnPlay      = document.getElementById("btnPlay");
const btnPrev      = document.getElementById("btnPrev");
const btnNext      = document.getElementById("btnNext");
const btnDirection = document.getElementById("btnDirection");
const btnOrder     = document.getElementById("btnOrder");
const btnDeck      = document.getElementById("btnDeck");

const directionLabel = document.getElementById("directionLabel");
const orderLabel     = document.getElementById("orderLabel");
const deckNameEl     = document.getElementById("deckName");

const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");
const pauseInput = document.getElementById("pause");
const pauseValue = document.getElementById("pauseValue");
const limitSelect = document.getElementById("limit");
const tagSelect   = document.getElementById("tag");

const deckModal   = document.getElementById("deckModal");
const deckList    = document.getElementById("deckList");
const btnCloseDeck = document.getElementById("btnCloseDeck");
const deckTitle   = document.getElementById("deckTitle");

// ---------- HELPERS ----------
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

function setStatus(text, icon) {
  if (icon) {
    statusEl.innerHTML = `<i data-lucide="${icon}"></i><span>${text}</span>`;
    refreshIcons();
  } else {
    statusEl.textContent = text;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- CARGAR ÍNDICE DE MAZOS ----------
async function loadDecksIndex() {
  try {
    const res = await fetch("data/decks.json", { cache: "no-store" });
    const data = await res.json();
    decksIndex = data.decks || [];
    renderDeckGrid();
  } catch (err) {
    console.error(err);
    deckGrid.innerHTML = `<p style="color:#ef4444;text-align:center;">Error al cargar los mazos</p>`;
  }
}

function renderDeckGrid() {
  deckGrid.innerHTML = "";
  decksIndex.forEach(deck => {
    const card = document.createElement("div");
    card.className = "deck-card";
    card.dataset.color = deck.color || "frases";
    card.dataset.id = deck.id;

    card.innerHTML = `
      <div class="deck-card-icon">
        <i data-lucide="${escapeHtml(deck.icon || "layers")}"></i>
      </div>
      <div class="deck-card-info">
        <div class="deck-card-name">${escapeHtml(deck.name)}</div>
        <div class="deck-card-desc">${escapeHtml(deck.description || "")}</div>
      </div>
      <div class="deck-card-arrow">
        <i data-lucide="chevron-right"></i>
      </div>
    `;

    card.addEventListener("click", () => openDeck(deck));
    deckGrid.appendChild(card);
  });
  refreshIcons();
}

// ---------- ABRIR MAZO ----------
async function openDeck(deck) {
  try {
    const res = await fetch(deck.file, { cache: "no-store" });
    const data = await res.json();
    cards = data.cards || [];
    currentDeck = deck;
    deckNameEl.textContent = deck.short || deck.name;

    if (cards.length === 0) {
      setStatus("Sin tarjetas", "alert-circle");
    }

    // Resetear estado de la sesión
    currentIndex = 0;
    cyclePlayed = [];
    history = [];
    cycleCompleted = false;
    sessionPlayed = 0;
    currentTag = "all";

    populateTagOptions();
    buildDeckList();

    // Cambiar vista
    homeView.classList.add("hidden");
    playerView.classList.remove("hidden");
    refreshIcons();

    resetCycle();
  } catch (err) {
    console.error(err);
    alert("No se pudo cargar el mazo");
  }
}

function goHome() {
  stopAll();
  playerView.classList.add("hidden");
  homeView.classList.remove("hidden");
  refreshIcons();
}

btnBack.addEventListener("click", goHome);

// ---------- POBLAR SELECTOR LÍMITE ----------
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

// ---------- POBLAR SELECTOR DE TAG ----------
function populateTagOptions() {
  const tagSet = new Set();
  cards.forEach(c => {
    if (Array.isArray(c.tags)) c.tags.forEach(t => tagSet.add(t));
  });
  const tags = Array.from(tagSet).sort();

  tagSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "Todas";
  tagSelect.appendChild(allOpt);

  tags.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    tagSelect.appendChild(opt);
  });

  if (currentTag !== "all" && !tags.includes(currentTag)) currentTag = "all";
  tagSelect.value = currentTag;
}

// ---------- ACTUALIZAR BOTONES ----------
function updateButtons() {
  directionLabel.textContent = direction === "en-es" ? "EN → ES" : "ES → EN";

  const iconName = order === "secuencial" ? "repeat" : "dices";
  const labelText = order === "secuencial" ? "Secuencial" : "Aleatorio";
  orderLabel.textContent = labelText;

  const oldIcon = btnOrder.querySelector("svg, i[data-lucide]");
  if (oldIcon) oldIcon.remove();
  const newIcon = document.createElement("i");
  newIcon.setAttribute("data-lucide", iconName);
  btnOrder.insertBefore(newIcon, orderLabel);

  refreshIcons();
}

// ---------- FILTRAR ----------
function getFilteredCards() {
  if (currentTag === "all") return cards;
  return cards.filter(c => Array.isArray(c.tags) && c.tags.includes(currentTag));
}

function effectiveLimit() {
  const filtered = getFilteredCards();
  if (filtered.length === 0) return 1;
  if (sessionLimit === "all") return filtered.length;
  const n = parseInt(sessionLimit, 10);
  if (isNaN(n)) return filtered.length;
  return Math.min(n, filtered.length);
}

function buildSession() {
  const filtered = getFilteredCards();
  sessionCards = filtered.slice(0, effectiveLimit());
}

// ---------- RESET ----------
function resetCycle() {
  buildSession();
  cyclePlayed = [];
  history = [];
  cycleCompleted = false;
  sessionPlayed = 0;

  if (sessionCards.length === 0) {
    wordEn.textContent = "Sin tarjetas";
    wordEs.textContent = "";
    noteEl.innerHTML = "";
    counter.textContent = "0 / 0";
    progressBar.style.width = "0%";
    setStatus("Sin tarjetas", "alert-circle");
    return;
  }

  if (order === "aleatorio") {
    currentIndex = Math.floor(Math.random() * sessionCards.length);
  } else {
    currentIndex = 0;
  }
  cyclePlayed = [currentIndex];
  renderCard();
}

// ---------- ALEATORIO ----------
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

function finishCycle() {
  isPlaying = false;
  cycleCompleted = true;
  player.pause();
  player.onended = null;
  player.onerror = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  cardEl.classList.remove("playing");
  setPlayState(false);
  statusEl.classList.remove("active");
  setStatus("Completado", "check-circle");
}

function renderCard() {
  const c = sessionCards[currentIndex];
  if (!c) return;
  wordEn.textContent = direction === "en-es" ? c.es : c.en;
  wordEs.textContent = "";

  const note = (c.note || "").trim();
  if (note) {
    noteEl.innerHTML = `<i data-lucide="message-circle"></i><span>${escapeHtml(note)}</span>`;
    refreshIcons();
  } else {
    noteEl.innerHTML = "";
  }

  const limit = sessionCards.length;
  const shown = currentIndex + 1;
  counter.textContent = `${shown} / ${limit}`;
  progressBar.style.width = (shown / limit) * 100 + "%";

  if (!cycleCompleted) {
    setStatus("Listo", null);
    statusEl.classList.remove("active");
  }
}

// ---------- TTS ----------
function speak(text, lang, onDone) {
  if (!("speechSynthesis" in window)) {
    onDone && onDone();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = speed;
  u.onend = () => onDone && onDone();
  u.onerror = () => onDone && onDone();
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function speakSpanish(text, onDone) { speak(text, "es-ES", onDone); }
function speakEnglish(text, onDone) { speak(text, "en-US", onDone); }

// ---------- REPRODUCIR ----------
function playCard(gen) {
  return new Promise((resolve) => {
    const c = sessionCards[currentIndex];
    if (!c) return resolve();

    pendingResolve = resolve;
    cardEl.classList.add("playing");

    const done = () => {
      if (gen !== loopGeneration) return;
      pendingResolve = null;
      setStatus("Pausa", "pause");
      statusEl.classList.remove("active");
      cardEl.classList.remove("playing");
      setTimeout(() => {
        if (gen !== loopGeneration) return;
        resolve();
      }, pauseSeconds * 1000);
    };

    if (direction === "en-es") {
      // Pregunta = Inglés → se muestra en español
      setStatus("Inglés", "volume-2");
      statusEl.classList.add("active");

      if (c.audio) {
        // Reproducir MP3
        player.onended = done;
        player.onerror = () => { console.warn("Error audio:", c.audio); done(); };
        player.src = c.audio;
        player.playbackRate = speed;
        player.currentTime = 0;
        player.play().catch(done);
      } else {
        // TTS inglés
        speakEnglish(c.en, done);
      }
    } else {
      // Pregunta = Español
      setStatus("Español", "languages");
      statusEl.classList.add("active");
      speakSpanish(c.es, done);
    }
  });
}

async function loop() {
  const myGen = ++loopGeneration;
  const limit = sessionCards.length;

  while (isPlaying && myGen === loopGeneration) {
    await playCard(myGen);
    if (myGen !== loopGeneration) return;
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

    const noteHtml = c.note && c.note.trim()
      ? `<div class="deck-item-note">${escapeHtml(c.note)}</div>`
      : "";

    const tagsHtml = Array.isArray(c.tags) && c.tags.length
      ? `<div class="deck-item-tags">${c.tags.map(t => `<span class="deck-tag">${escapeHtml(t)}</span>`).join("")}</div>`
      : "";

    item.innerHTML = `
      <div class="deck-item-header">
        <div class="deck-item-en">${escapeHtml(c.en)}</div>
        <div class="deck-item-index">#${i + 1}</div>
      </div>
      <div class="deck-item-es">${escapeHtml(c.es)}</div>
      ${noteHtml}
      ${tagsHtml}
    `;

    item.addEventListener("click", () => {
      // Si tiene audio → MP3. Si no → TTS inglés
      if (c.audio) {
        player.src = c.audio;
        player.playbackRate = speed;
        player.currentTime = 0;
        player.play().catch(() => {});
      } else {
        speakEnglish(c.en);
      }
    });

    deckList.appendChild(item);
  });
  refreshIcons();
}

function openDeckModal() {
  deckModal.classList.add("open");
  if (isPlaying) stopAll();
}

function closeDeckModal() {
  deckModal.classList.remove("open");
}

btnDeck.addEventListener("click", openDeckModal);
btnCloseDeck.addEventListener("click", closeDeckModal);
deckModal.addEventListener("click", (e) => {
  if (e.target === deckModal) closeDeckModal();
});

// ---------- STOP ----------
function stopAll() {
  isPlaying = false;
  loopGeneration++;
  player.pause();
  player.onended = null;
  player.onerror = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();

  if (pendingResolve) {
    const r = pendingResolve;
    pendingResolve = null;
    r();
  }

  cardEl.classList.remove("playing");
  setPlayState(false);
  statusEl.classList.remove("active");
  if (!cycleCompleted) setStatus("Pausado", "pause");
}

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
  stopAll();
  goNext();
  sessionPlayed = currentIndex;
  renderCard();
});

btnPrev.addEventListener("click", () => {
  if (sessionCards.length === 0) return;
  stopAll();
  goPrev();
  sessionPlayed = currentIndex;
  renderCard();
});

btnDirection.addEventListener("click", () => {
  stopAll();
  direction = direction === "en-es" ? "es-en" : "en-es";
  resetCycle();
  updateButtons();
  saveSettings();
});

btnOrder.addEventListener("click", () => {
  stopAll();
  order = order === "secuencial" ? "aleatorio" : "secuencial";
  resetCycle();
  updateButtons();
  saveSettings();
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
  sessionLimit = limitSelect.value === "all"
    ? "all"
    : parseInt(limitSelect.value, 10);
  saveSettings();
  stopAll();
  resetCycle();
});

tagSelect.addEventListener("change", () => {
  currentTag = tagSelect.value;
  saveSettings();
  stopAll();
  resetCycle();
});

// ---------- INIT ----------
loadSettings();
populateLimitOptions();
updateButtons();
speedInput.value = speed;
speedValue.textContent = speed.toFixed(1) + "x";
pauseInput.value = pauseSeconds;
pauseValue.textContent = pauseSeconds + "s";
setPlayState(false);
loadDecksIndex();
refreshIcons();
