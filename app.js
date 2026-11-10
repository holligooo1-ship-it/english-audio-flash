// ==========================================================
// ENGLISH AUDIO FLASH - v30 (Verdadero/Falso + Opción Múltiple)
// ==========================================================

// ---------- ESTADO ----------
let decksIndex = [];
let currentDeck = null;
let cards = [];
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

let examplePlaying = false;
let availableVoices = [];

// Estado del Juego
let gameDirection = "en-es";
let gameCards = [];

// TF = True/False
let tfTimerInterval = null;
let tfTimeLeft = 60;
let tfScore = 0;
let tfCurrentCard = null;
let tfIsFake = false;

// MC = Multiple Choice
let mcTimerInterval = null;
let mcTimeLeft = 60;
let mcScore = 0;
let mcCurrentCard = null;
let mcCorrectAnswer = "";
let mcIsAnswering = false;

// ---------- HELPERS ----------
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function setPlayState(playing) {
  if (playing) { btnPlay.classList.add("playing"); } else { btnPlay.classList.remove("playing"); }
}

function setStatus(text, icon) {
  if (icon) { statusEl.innerHTML = `<i data-lucide="${icon}"></i><span>${text}</span>`; refreshIcons(); } 
  else { statusEl.textContent = text; }
}

// ---------- PERSISTENCIA ----------
function loadGlobalSettings() {
  try {
    const g = JSON.parse(localStorage.getItem("af_global") || "{}");
    if (typeof g.speed === "number") speed = g.speed;
    if (typeof g.pause === "number") pauseSeconds = g.pause;
  } catch (e) {}
}
function saveGlobalSettings() {
  localStorage.setItem("af_global", JSON.stringify({ speed, pause: pauseSeconds }));
}

function loadDeckSettings(deckId) {
  try {
    const all = JSON.parse(localStorage.getItem("af_decks") || "{}");
    const d = all[deckId] || {};
    direction    = d.direction    || "en-es";
    order        = d.order        || "secuencial";
    sessionLimit = d.sessionLimit !== undefined ? d.sessionLimit : "all";
    currentTag   = d.currentTag   || "all";
  } catch (e) {
    direction = "en-es"; order = "secuencial"; sessionLimit = "all"; currentTag = "all";
  }
}
function saveDeckSettings() {
  if (!currentDeck) return;
  let all = {};
  try { all = JSON.parse(localStorage.getItem("af_decks") || "{}"); } catch (e) {}
  all[currentDeck.id] = { direction, order, sessionLimit, currentTag };
  localStorage.setItem("af_decks", JSON.stringify(all));
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
const exampleEl    = document.getElementById("example");
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
const btnGame      = document.getElementById("btnGame");

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

// DOM del Juego (Menú)
const gameMenuModal = document.getElementById("gameMenuModal");
const btnCloseGameMenu = document.getElementById("btnCloseGameMenu");
const btnPlayTF = document.getElementById("btnPlayTF");
const btnPlayMC = document.getElementById("btnPlayMC");
const gameDirSelect = document.getElementById("gameDirSelect");
const gameTagSelect = document.getElementById("gameTagSelect");

// DOM Verdadero/Falso
const gameView = document.getElementById("gameView");
const btnCloseGame = document.getElementById("btnCloseGame");
const tfScoreEl = document.getElementById("tfScore");
const tfTimerEl = document.getElementById("tfTimer");
const tfCardEl = document.getElementById("tfCard");
const tfWordEl = document.getElementById("tfWord");
const tfTranslationEl = document.getElementById("tfTranslation");
const btnTrue = document.getElementById("btnTrue");
const btnFalse = document.getElementById("btnFalse");
const btnGameDir = document.getElementById("btnGameDir");
const btnGameAudio = document.getElementById("btnGameAudio");
const tfGameOver = document.getElementById("tfGameOver");
const tfFinalScore = document.getElementById("tfFinalScore");
const btnRestartTF = document.getElementById("btnRestartTF");

// DOM Opción Múltiple
const mcGameView = document.getElementById("mcGameView");
const btnCloseMCGame = document.getElementById("btnCloseMCGame");
const mcScoreEl = document.getElementById("mcScore");
const mcTimerEl = document.getElementById("mcTimer");
const mcCardEl = document.getElementById("mcCard");
const mcWordEl = document.getElementById("mcWord");
const mcOptionsContainer = document.getElementById("mcOptionsContainer");
const btnMCGameDir = document.getElementById("btnMCGameDir");
const btnMCGameAudio = document.getElementById("btnMCGameAudio");
const mcGameOver = document.getElementById("mcGameOver");
const mcFinalScore = document.getElementById("mcFinalScore");
const btnRestartMC = document.getElementById("btnRestartMC");

// ---------- CARGA INICIAL ----------
async function loadDecksIndex() {
  try {
    const res = await fetch("data/decks.json", { cache: "no-store" });
    const data = await res.json();
    decksIndex = data.decks || [];
    renderDeckGrid();
  } catch (err) {
    console.error(err);
    deckGrid.innerHTML = `<p style="color:#ef4444;text-align:center;">Error al cargar</p>`;
  } finally {
    const splash = document.getElementById("splash-screen");
    if (splash) { splash.classList.add("hidden"); setTimeout(() => splash.remove(), 600); }
  }
}

function renderDeckGrid() {
  deckGrid.innerHTML = "";
  decksIndex.forEach(deck => {
    const card = document.createElement("div");
    card.className = "deck-card";
    card.dataset.color = deck.color || "frases";
    card.innerHTML = `
      <div class="deck-card-icon"><i data-lucide="${escapeHtml(deck.icon || "layers")}"></i></div>
      <div class="deck-card-info">
        <div class="deck-card-name">${escapeHtml(deck.name)}</div>
        <div class="deck-card-desc">${escapeHtml(deck.description || "")}</div>
      </div>
      <div class="deck-card-arrow"><i data-lucide="chevron-right"></i></div>
    `;
    card.addEventListener("click", () => openDeck(deck));
    deckGrid.appendChild(card);
  });
  refreshIcons();
}

async function openDeck(deck) {
  try {
    const res = await fetch(deck.file, { cache: "no-store" });
    const data = await res.json();
    cards = data.cards || [];
    currentDeck = deck;
    deckNameEl.textContent = deck.short || deck.name;
    if (cards.length === 0) setStatus("Sin tarjetas", "alert-circle");

    currentIndex = 0; cyclePlayed = []; history = []; cycleCompleted = false; sessionPlayed = 0;
    loadDeckSettings(deck.id);
    populateLimitOptions(); populateTagOptions(); buildDeckList(); updateButtons();

    speedInput.value = speed; speedValue.textContent = speed.toFixed(1) + "x";
    pauseInput.value = pauseSeconds; pauseValue.textContent = pauseSeconds + "s";
    limitSelect.value = String(sessionLimit);

    homeView.classList.add("hidden"); playerView.classList.remove("hidden"); refreshIcons();
    resetCycle();
  } catch (err) { alert("No se pudo cargar"); }
}

function goHome() { stopAll(); playerView.classList.add("hidden"); homeView.classList.remove("hidden"); refreshIcons(); }
btnBack.addEventListener("click", goHome);

function populateLimitOptions() {
  limitSelect.innerHTML = "";
  let max = (currentDeck && currentDeck.limitMax) ? currentDeck.limitMax : 100;
  for (let i = 1; i <= max; i++) {
    const opt = document.createElement("option"); opt.value = String(i); opt.textContent = String(i); limitSelect.appendChild(opt);
  }
  const allOpt = document.createElement("option"); allOpt.value = "all"; allOpt.textContent = "Todas"; limitSelect.appendChild(allOpt);
  const saved = String(sessionLimit);
  if (saved !== "all" && (parseInt(saved, 10) < 1 || parseInt(saved, 10) > max)) sessionLimit = "all";
  limitSelect.value = String(sessionLimit);
}

function populateTagOptions() {
  const tagSet = new Set();
  cards.forEach(c => { if (Array.isArray(c.tags)) c.tags.forEach(t => tagSet.add(t)); });
  const tags = Array.from(tagSet).sort();
  tagSelect.innerHTML = "";
  const allOpt = document.createElement("option"); allOpt.value = "all"; allOpt.textContent = "Todas"; tagSelect.appendChild(allOpt);
  tags.forEach(t => { const opt = document.createElement("option"); opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1); tagSelect.appendChild(opt); });
  if (currentTag !== "all" && !tags.includes(currentTag)) currentTag = "all";
  tagSelect.value = currentTag;
}

function updateButtons() {
  directionLabel.textContent = direction === "en-es" ? "EN → ES" : "ES → EN";
  const iconName = order === "secuencial" ? "repeat" : "dices";
  orderLabel.textContent = order === "secuencial" ? "Secuencial" : "Aleatorio";
  const oldIcon = btnOrder.querySelector("svg, i[data-lucide]"); if (oldIcon) oldIcon.remove();
  const newIcon = document.createElement("i"); newIcon.setAttribute("data-lucide", iconName); btnOrder.insertBefore(newIcon, orderLabel);
  refreshIcons();
}

// ---------- REPRODUCTOR NORMAL ----------
function getFilteredCards() { return currentTag === "all" ? cards : cards.filter(c => Array.isArray(c.tags) && c.tags.includes(currentTag)); }
function effectiveLimit() { const f = getFilteredCards(); if (f.length === 0) return 1; if (sessionLimit === "all") return f.length; const n = parseInt(sessionLimit, 10); return isNaN(n) ? f.length : Math.min(n, f.length); }
function buildSession() { sessionCards = getFilteredCards().slice(0, effectiveLimit()); }

function resetCycle() {
  buildSession(); cyclePlayed = []; history = []; cycleCompleted = false; sessionPlayed = 0;
  if (sessionCards.length === 0) {
    wordEn.textContent = "Sin tarjetas"; wordEs.textContent = ""; noteEl.innerHTML = ""; exampleEl.innerHTML = ""; counter.textContent = "0 / 0"; progressBar.style.width = "0%"; setStatus("Sin tarjetas", "alert-circle"); return;
  }
  currentIndex = order === "aleatorio" ? Math.floor(Math.random() * sessionCards.length) : 0;
  cyclePlayed = [currentIndex]; renderCard();
}

function pickNextRandom() {
  const total = sessionCards.length; if (cyclePlayed.length >= total) cyclePlayed = [];
  const candidates = []; for (let i = 0; i < total; i++) { if (i !== currentIndex && !cyclePlayed.includes(i)) candidates.push(i); }
  if (candidates.length === 0) { for (let i = 0; i < total; i++) { if (i !== currentIndex) candidates.push(i); } if (candidates.length === 0) return currentIndex; }
  const next = candidates[Math.floor(Math.random() * candidates.length)]; cyclePlayed.push(next); return next;
}

function goNext() { history.push(currentIndex); cycleCompleted = false; currentIndex = order === "secuencial" ? (currentIndex + 1) % sessionCards.length : pickNextRandom(); }
function goPrev() {
  cycleCompleted = false;
  if (history.length > 0) { const prev = history.pop(); if (order === "aleatorio") { const idx = cyclePlayed.indexOf(currentIndex); if (idx !== -1) cyclePlayed.splice(idx, 1); } currentIndex = prev; }
  else if (order === "secuencial") { currentIndex = (currentIndex - 1 + sessionCards.length) % sessionCards.length; }
}

function finishCycle() {
  isPlaying = false; cycleCompleted = true; player.pause(); player.onended = null; player.onerror = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel(); cardEl.classList.remove("playing"); setPlayState(false); statusEl.classList.remove("active"); setStatus("Completado", "check-circle");
}

function renderCard() {
  const c = sessionCards[currentIndex]; if (!c) return;
  if (direction === "en-es") { wordEn.textContent = c.es; wordEs.textContent = c.en; } 
  else { wordEn.textContent = c.en; wordEs.textContent = c.es; }

  const exEn = (c.example_en || "").trim(); const exEs = (c.example_es || "").trim();
  if (exEn || exEs) {
    let html = `<i data-lucide="book-open"></i><div class="ex-body">`;
    if (exEn) html += `<span class="ex-en">${escapeHtml(exEn)}</span>`; if (exEs) html += `<span class="ex-es">${escapeHtml(exEs)}</span>`; html += `</div>`;
    if (exEn) html += `<button class="example-play-btn" title="Escuchar"><i data-lucide="volume-2"></i></button>`;
    exampleEl.innerHTML = html; refreshIcons();
    const exBtn = exampleEl.querySelector(".example-play-btn");
    if (exBtn && exEn) { exBtn.addEventListener("click", (e) => { e.stopPropagation(); playExample(exEn, exBtn); }); }
  } else { exampleEl.innerHTML = ""; }

  const note = (c.note || "").trim();
  if (note) { noteEl.innerHTML = `<i data-lucide="message-circle"></i><span>${escapeHtml(note)}</span>`; refreshIcons(); } else { noteEl.innerHTML = ""; }

  counter.textContent = `${currentIndex + 1} / ${sessionCards.length}`; progressBar.style.width = ((currentIndex + 1) / sessionCards.length) * 100 + "%";
  if (!cycleCompleted) { setStatus("Listo", null); statusEl.classList.remove("active"); }
}

function playExample(text, btn) {
  if (!("speechSynthesis" in window)) return;
  if (examplePlaying) { speechSynthesis.cancel(); examplePlaying = false; document.querySelectorAll(".example-play-btn.playing").forEach(b => b.classList.remove("playing")); return; }
  player.pause(); player.onended = null; player.onerror = null; speechSynthesis.cancel();
  examplePlaying = true; if (btn) btn.classList.add("playing");
  const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = speed;
  const bestVoice = getBestVoice("en-US"); if (bestVoice) u.voice = bestVoice;
  const cleanup = () => { examplePlaying = false; if (btn) btn.classList.remove("playing"); };
  u.onend = cleanup; u.onerror = cleanup; speechSynthesis.speak(u);
}

function loadVoices() { availableVoices = window.speechSynthesis.getVoices(); }
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) { speechSynthesis.onvoiceschanged = loadVoices; }
loadVoices();

function getBestVoice(lang) {
  if (availableVoices.length === 0) loadVoices();
  const langCode = lang.split('-')[0]; const filtered = availableVoices.filter(v => v.lang.startsWith(langCode));
  if (filtered.length === 0) return null;
  const keywords = ['natural', 'neural', 'google', 'premium', 'enhanced'];
  for (const kw of keywords) { const v = filtered.find(v => v.name.toLowerCase().includes(kw)); if (v) return v; }
  return filtered[0];
}

function speak(text, lang, onDone) {
  if (!("speechSynthesis" in window)) { onDone && onDone(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = speed;
  const bestVoice = getBestVoice(lang); if (bestVoice) u.voice = bestVoice;
  u.onend = () => onDone && onDone(); u.onerror = () => onDone && onDone(); speechSynthesis.speak(u);
}
function speakSpanish(text, onDone) { speak(text, "es-ES", onDone); }
function speakEnglish(text, onDone) { speak(text, "en-US", onDone); }

function playCard(gen) {
  return new Promise((resolve) => {
    const c = sessionCards[currentIndex]; if (!c) return resolve();
    pendingResolve = resolve; cardEl.classList.add("playing");
    const done = () => {
      if (gen !== loopGeneration) return;
      pendingResolve = null; setStatus("Pausa", "pause"); statusEl.classList.remove("active"); cardEl.classList.remove("playing");
      setTimeout(() => { if (gen !== loopGeneration) return; resolve(); }, pauseSeconds * 1000);
    };
    if (direction === "en-es") {
      setStatus("Inglés", "volume-2"); statusEl.classList.add("active");
      if (c.audio) {
        player.onended = done; player.onerror = () => { done(); }; player.src = c.audio; player.playbackRate = speed; player.currentTime = 0; player.play().catch(done);
      } else { speakEnglish(c.en, done); }
    } else {
      setStatus("Español", "languages"); statusEl.classList.add("active"); speakSpanish(c.es, done);
    }
  });
}

async function loop() {
  const myGen = ++loopGeneration; const limit = sessionCards.length;
  while (isPlaying && myGen === loopGeneration) {
    await playCard(myGen);
    if (myGen !== loopGeneration) return;
    if (!isPlaying) break;
    sessionPlayed++;
    if (sessionPlayed >= limit) { finishCycle(); break; }
    goNext(); renderCard();
  }
}

function buildDeckList() {
  deckList.innerHTML = "";
  cards.forEach((c, i) => {
    const item = document.createElement("div"); item.className = "deck-item";
    const exampleHtml = (c.example_en || c.example_es) ? `<div class="deck-item-note example-note"><i data-lucide="book-open"></i><span>${escapeHtml(c.example_en || "")}${c.example_es ? " — " + escapeHtml(c.example_es) : ""}</span></div>` : "";
    const noteHtml = c.note && c.note.trim() ? `<div class="deck-item-note"><i data-lucide="message-circle"></i><span>${escapeHtml(c.note)}</span></div>` : "";
    const tagsHtml = Array.isArray(c.tags) && c.tags.length ? `<div class="deck-item-tags">${c.tags.map(t => `<span class="deck-tag">${escapeHtml(t)}</span>`).join("")}</div>` : "";
    
    item.innerHTML = `
      <div class="deck-item-header"><div class="deck-item-en">${escapeHtml(c.en)}</div><div class="deck-item-index">#${i + 1}</div></div>
      <div class="deck-item-es">${escapeHtml(c.es)}</div>${exampleHtml}${noteHtml}${tagsHtml}
    `;
    item.addEventListener("click", () => {
      if (c.audio) { player.src = c.audio; player.playbackRate = speed; player.currentTime = 0; player.play().catch(() => {}); } 
      else { speakEnglish(c.en); }
    });
    deckList.appendChild(item);
  });
  refreshIcons();
}

function openDeckModal() { deckModal.classList.add("open"); if (isPlaying) stopAll(); }
function closeDeckModal() { deckModal.classList.remove("open"); }
btnDeck.addEventListener("click", openDeckModal);
btnCloseDeck.addEventListener("click", closeDeckModal);
deckModal.addEventListener("click", (e) => { if (e.target === deckModal) closeDeckModal(); });

function stopAll() {
  isPlaying = false; loopGeneration++; player.pause(); player.onended = null; player.onerror = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  examplePlaying = false; document.querySelectorAll(".example-play-btn.playing").forEach(b => b.classList.remove("playing"));
  if (pendingResolve) { const r = pendingResolve; pendingResolve = null; r(); }
  cardEl.classList.remove("playing"); setPlayState(false); statusEl.classList.remove("active");
  if (!cycleCompleted) setStatus("Pausado", "pause");
}

btnPlay.addEventListener("click", () => {
  if (sessionCards.length === 0) return;
  if (isPlaying) { stopAll(); } 
  else { if (cycleCompleted) resetCycle(); isPlaying = true; setPlayState(true); loop(); }
});

btnNext.addEventListener("click", () => { if (sessionCards.length === 0) return; stopAll(); goNext(); sessionPlayed = currentIndex; renderCard(); });
btnPrev.addEventListener("click", () => { if (sessionCards.length === 0) return; stopAll(); goPrev(); sessionPlayed = currentIndex; renderCard(); });

btnDirection.addEventListener("click", () => { stopAll(); direction = direction === "en-es" ? "es-en" : "en-es"; resetCycle(); updateButtons(); saveDeckSettings(); });
btnOrder.addEventListener("click", () => { stopAll(); order = order === "secuencial" ? "aleatorio" : "secuencial"; resetCycle(); updateButtons(); saveDeckSettings(); });

speedInput.addEventListener("input", () => { speed = parseFloat(speedInput.value); speedValue.textContent = speed.toFixed(1) + "x"; player.playbackRate = speed; saveGlobalSettings(); });
pauseInput.addEventListener("input", () => { pauseSeconds = parseFloat(pauseInput.value); pauseValue.textContent = pauseSeconds.toFixed(1).replace(/\.0$/, "") + "s"; saveGlobalSettings(); });

limitSelect.addEventListener("change", () => { sessionLimit = limitSelect.value === "all" ? "all" : parseInt(limitSelect.value, 10); saveDeckSettings(); stopAll(); resetCycle(); });
tagSelect.addEventListener("change", () => { currentTag = tagSelect.value; saveDeckSettings(); stopAll(); resetCycle(); });

// ==========================================================
// LÓGICA DE MENÚ DE JUEGOS
// ==========================================================
btnGame.addEventListener("click", () => {
  if (isPlaying) stopAll();
  const tagSet = new Set();
  cards.forEach(c => { if (Array.isArray(c.tags)) c.tags.forEach(t => tagSet.add(t)); });
  const tags = Array.from(tagSet).sort();
  
  gameTagSelect.innerHTML = `<option value="all">Todas las categorías</option>`;
  tags.forEach(t => { gameTagSelect.innerHTML += `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`; });
  
  gameDirSelect.value = direction;
  gameMenuModal.classList.add("open");
});

btnCloseGameMenu.addEventListener("click", () => gameMenuModal.classList.remove("open"));
gameMenuModal.addEventListener("click", (e) => { if (e.target === gameMenuModal) gameMenuModal.classList.remove("open"); });

function prepareGameCards() {
  gameDirection = gameDirSelect.value;
  const selectedTag = gameTagSelect.value;
  gameCards = selectedTag === "all" ? [...cards] : cards.filter(c => Array.isArray(c.tags) && c.tags.includes(selectedTag));
  if (gameCards.length < 4) { alert("Necesitas al menos 4 tarjetas de esta categoría para jugar."); return false; }
  gameMenuModal.classList.remove("open");
  return true;
}

// ==========================================================
// JUEGO 1: VERDADERO O FALSO
// ==========================================================
btnPlayTF.addEventListener("click", () => {
  if (!prepareGameCards()) return;
  startTrueFalseGame();
});

function startTrueFalseGame() {
  tfScore = 0; tfTimeLeft = 60; tfScoreEl.textContent = tfScore; tfTimerEl.textContent = tfTimeLeft + "s";
  tfGameOver.style.display = "none"; tfCardEl.classList.remove("correct", "wrong"); gameView.classList.add("active");
  
  nextTFQuestion();
  
  clearInterval(tfTimerInterval);
  tfTimerInterval = setInterval(() => {
    tfTimeLeft--; tfTimerEl.textContent = tfTimeLeft + "s";
    if (tfTimeLeft <= 0) endTrueFalseGame();
  }, 1000);
}

function nextTFQuestion() {
  speechSynthesis.cancel();
  tfCurrentCard = gameCards[Math.floor(Math.random() * gameCards.length)];
  tfIsFake = Math.random() < 0.5;
  
  const isEnToEs = gameDirection === "en-es";
  const mainText = isEnToEs ? tfCurrentCard.en : tfCurrentCard.es;
  tfWordEl.textContent = mainText;
  
  if (isEnToEs) { speakEnglish(mainText); } else { speakSpanish(mainText); }

  tfCardEl.classList.remove("correct", "wrong");
  
  if (tfIsFake) {
    let fakeCard;
    do { fakeCard = gameCards[Math.floor(Math.random() * gameCards.length)]; } while ((isEnToEs ? fakeCard.es : fakeCard.en) === (isEnToEs ? tfCurrentCard.es : tfCurrentCard.en));
    tfTranslationEl.textContent = isEnToEs ? fakeCard.es : fakeCard.en;
  } else { 
    tfTranslationEl.textContent = isEnToEs ? tfCurrentCard.es : tfCurrentCard.en; 
  }
}

function checkTFAnswer(userSaidTrue) {
  const isCorrect = (userSaidTrue && !tfIsFake) || (!userSaidTrue && tfIsFake);
  if (isCorrect) { tfScore++; tfScoreEl.textContent = tfScore; tfCardEl.classList.add("correct"); } 
  else { tfScore = Math.max(0, tfScore - 1); tfScoreEl.textContent = tfScore; tfCardEl.classList.add("wrong"); }
  
  setTimeout(() => { if (tfTimeLeft > 0) nextTFQuestion(); }, 600);
}

btnTrue.addEventListener("click", () => checkTFAnswer(true));
btnFalse.addEventListener("click", () => checkTFAnswer(false));

btnGameDir.addEventListener("click", () => { gameDirection = gameDirection === "en-es" ? "es-en" : "en-es"; nextTFQuestion(); });
btnGameAudio.addEventListener("click", () => {
  const mainText = gameDirection === "en-es" ? tfCurrentCard.en : tfCurrentCard.es;
  if (gameDirection === "en-es") speakEnglish(mainText); else speakSpanish(mainText);
});

function endTrueFalseGame() { clearInterval(tfTimerInterval); speechSynthesis.cancel(); tfFinalScore.textContent = tfScore; tfGameOver.style.display = "flex"; }
btnRestartTF.addEventListener("click", startTrueFalseGame);
btnCloseGame.addEventListener("click", () => { clearInterval(tfTimerInterval); speechSynthesis.cancel(); gameView.classList.remove("active"); });

// ==========================================================
// JUEGO 2: OPCIÓN MÚLTIPLE
// ==========================================================
btnPlayMC.addEventListener("click", () => {
  if (!prepareGameCards()) return;
  startMultipleChoiceGame();
});

function startMultipleChoiceGame() {
  mcScore = 0; mcTimeLeft = 60; mcScoreEl.textContent = mcScore; mcTimerEl.textContent = mcTimeLeft + "s";
  mcGameOver.style.display = "none"; mcGameView.classList.add("active");
  
  nextMCQuestion();
  
  clearInterval(mcTimerInterval);
  mcTimerInterval = setInterval(() => {
    mcTimeLeft--; mcTimerEl.textContent = mcTimeLeft + "s";
    if (mcTimeLeft <= 0) endMultipleChoiceGame();
  }, 1000);
}

function nextMCQuestion() {
  speechSynthesis.cancel();
  mcIsAnswering = false;
  
  mcCurrentCard = gameCards[Math.floor(Math.random() * gameCards.length)];
  const isEnToEs = gameDirection === "en-es";
  
  const mainText = isEnToEs ? mcCurrentCard.en : mcCurrentCard.es;
  mcCorrectAnswer = isEnToEs ? mcCurrentCard.es : mcCurrentCard.en;
  mcWordEl.textContent = mainText;
  
  if (isEnToEs) { speakEnglish(mainText); } else { speakSpanish(mainText); }

  // Generar 3 respuestas falsas
  const fakes = new Set();
  while (fakes.size < 3) {
    const f = gameCards[Math.floor(Math.random() * gameCards.length)];
    const text = isEnToEs ? f.es : f.en;
    if (text !== mcCorrectAnswer) fakes.add(text);
  }

  const options = [mcCorrectAnswer, ...fakes];
  // Mezclar aleatoriamente
  options.sort(() => Math.random() - 0.5);

  // Renderizar botones
  mcOptionsContainer.innerHTML = "";
  options.forEach(optText => {
    const btn = document.createElement("button");
    btn.className = "mc-btn";
    btn.textContent = optText;
    btn.addEventListener("click", () => checkMCAnswer(optText, btn));
    mcOptionsContainer.appendChild(btn);
  });
}

function checkMCAnswer(selectedText, btnElement) {
  if (mcIsAnswering) return; // Evitar doble clic rápido
  mcIsAnswering = true;

  if (selectedText === mcCorrectAnswer) {
    mcScore++;
    mcScoreEl.textContent = mcScore;
    btnElement.classList.add("correct");
  } else {
    mcScore = Math.max(0, mcScore - 1);
    mcScoreEl.textContent = mcScore;
    btnElement.classList.add("wrong");
    
    // Iluminar la correcta también para aprender
    const allBtns = mcOptionsContainer.querySelectorAll(".mc-btn");
    allBtns.forEach(b => {
      if (b.textContent === mcCorrectAnswer) b.classList.add("correct");
    });
  }

  setTimeout(() => { 
    if (mcTimeLeft > 0) nextMCQuestion(); 
  }, 1200); // Pausa más larga para que asimile la respuesta
}

btnMCGameDir.addEventListener("click", () => { gameDirection = gameDirection === "en-es" ? "es-en" : "en-es"; nextMCQuestion(); });
btnMCGameAudio.addEventListener("click", () => {
  const mainText = gameDirection === "en-es" ? mcCurrentCard.en : mcCurrentCard.es;
  if (gameDirection === "en-es") speakEnglish(mainText); else speakSpanish(mainText);
});

function endMultipleChoiceGame() { 
  clearInterval(mcTimerInterval); 
  speechSynthesis.cancel(); 
  mcFinalScore.textContent = mcScore; 
  mcGameOver.style.display = "flex"; 
}

btnRestartMC.addEventListener("click", startMultipleChoiceGame);
btnCloseMCGame.addEventListener("click", () => { 
  clearInterval(mcTimerInterval); 
  speechSynthesis.cancel(); 
  mcGameView.classList.remove("active"); 
});

// ---------- INIT ----------
loadGlobalSettings();
speedInput.value = speed; speedValue.textContent = speed.toFixed(1) + "x";
pauseInput.value = pauseSeconds; pauseValue.textContent = pauseSeconds + "s";
setPlayState(false); loadDecksIndex(); refreshIcons();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('service-worker.js').catch(err => console.warn(err)); });
}
let deferredPrompt; const installBtn = document.getElementById("installBtn");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferredPrompt = e;
  if (installBtn) { installBtn.style.display = "inline-flex"; refreshIcons(); }
});
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.style.display = "none"; }
  });
}
