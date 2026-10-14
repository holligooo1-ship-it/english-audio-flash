// ==========================================================
// ENGLISH AUDIO FLASH - v5
// Modo dual + orden secuencial/aleatorio SIN repeticiones
// ==========================================================

// ---------- ESTADO ----------
let cards = [];
let currentIndex = 0;
let isPlaying = false;
let speed = 1;
let pauseSeconds = 2;
let direction = "en-es";
let order = "secuencial";

// ---------- ESTADO DEL CICLO ALEATORIO ----------
let cyclePlayed = [];   // índices que YA sonaron en este ciclo
let history = [];       // historial para el botón ⏮

// ---------- PERSISTENCIA ----------
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("af_settings") || "{}");
    if (s.direction) direction = s.direction;
    if (s.order) order = s.order;
    if (typeof s.speed === "number") speed = s.speed;
    if (typeof s.pause === "number") pauseSeconds = s.pause;
  } catch (e) {}
}

function saveSettings() {
  localStorage.setItem("af_settings", JSON.stringify({
    direction, order, speed, pause: pauseSeconds
  }));
}

// ---------- DOM ----------
const player       = document.getElementById("player");
const statusEl     = document.getElementById("status");
const wordEn       = document.getElementById("wordEn");
const wordEs       = document.getElementById("wordEs");
const counter      = document.getElementById("counter");
const progressBar  = document.getElementById("progressBar");
const cardEl       = document.getElementById("card");

const btnPlay      = document.getElementById("btnPlay");
const btnPrev      = document.getElementById("btnPrev");
const btnNext      = document.getElementById("btnNext");
const btnDirection = document.getElementById("btnDirection");
const btnOrder     = document.getElementById("btnOrder");

const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");
const pauseInput = document.getElementById("pause");
const pauseValue = document.getElementById("pauseValue");

// ---------- CARGAR DATOS ----------
async function loadCards() {
  try {
    const res = await fetch("data/decks.json", { cache: "no-store" });
    const data = await res.json();
    cards = data.cards || [];
    if (cards.length === 0) {
      statusEl.textContent = "Sin tarjetas";
      return;
    }
    cyclePlayed = [currentIndex];
    renderCard();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error al cargar datos";
  }
}

// ---------- BOTONES ----------
function updateButtons() {
  btnDirection.textContent = direction === "en-es"
    ? "EN → ES 🔄"
    : "ES → EN 🔄";

  btnOrder.textContent = order === "secuencial"
    ? "🔁 Secuencial"
    : "🎲 Aleatorio";
}

// ---------- SELECCIÓN ALEATORIA SIN REPETICIÓN ----------
function pickNextRandom() {
  // Si ya sonaron todas, empezar ciclo nuevo
  if (cyclePlayed.length >= cards.length) {
    cyclePlayed = [];
  }

  // Candidatos: no han sonado en este ciclo Y no son el actual
  const candidates = [];
  for (let i = 0; i < cards.length; i++) {
    if (i === currentIndex) continue;
    if (cyclePlayed.includes(i)) continue;
    candidates.push(i);
  }

  // Fallback (por seguridad)
  if (candidates.length === 0) {
    for (let i = 0; i < cards.length; i++) {
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

  if (order === "secuencial") {
    currentIndex = (currentIndex + 1) % cards.length;
  } else {
    currentIndex = pickNextRandom();
  }
}

function goPrev() {
  if (history.length > 0) {
    const prev = history.pop();
    if (order === "aleatorio") {
      const idx = cyclePlayed.indexOf(currentIndex);
      if (idx !== -1) cyclePlayed.splice(idx, 1);
    }
    currentIndex = prev;
  } else if (order === "secuencial") {
    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
  }
}

// ---------- RENDER ----------
function renderCard() {
  const c = cards[currentIndex];
  if (!c) return;

  wordEn.textContent = direction === "en-es" ? c.es : c.en;
  wordEs.textContent = "";

  counter.textContent = `${currentIndex + 1} / ${cards.length}`;
  progressBar.style.width = ((currentIndex + 1) / cards.length) * 100 + "%";
  statusEl.textContent = "Listo";
  statusEl.classList.remove("active");
}

// ---------- REPRODUCIR ----------
function playCard() {
  return new Promise((resolve) => {
    const c = cards[currentIndex];
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

// ---------- TTS ESPAÑOL ----------
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
  while (isPlaying) {
    await playCard();
    if (!isPlaying) break;
    goNext();
    renderCard();
  }
}

// ---------- CONTROLES ----------
btnPlay.addEventListener("click", () => {
  if (cards.length === 0) return;
  if (isPlaying) {
    stopAll();
  } else {
    isPlaying = true;
    btnPlay.textContent = "⏸";
    loop();
  }
});

btnNext.addEventListener("click", () => {
  if (cards.length === 0) return;
  const wasPlaying = isPlaying;
  stopAll();
  goNext();
  renderCard();
  if (wasPlaying) {
    isPlaying = true;
    btnPlay.textContent = "⏸";
    loop();
  }
});

btnPrev.addEventListener("click", () => {
  if (cards.length === 0) return;
  const wasPlaying = isPlaying;
  stopAll();
  goPrev();
  renderCard();
  if (wasPlaying) {
    isPlaying = true;
    btnPlay.textContent = "⏸";
    loop();
  }
});

btnDirection.addEventListener("click", () => {
  const wasPlaying = isPlaying;
  stopAll();
  direction = direction === "en-es" ? "es-en" : "en-es";
  updateButtons();
  saveSettings();
  renderCard();
  if (wasPlaying) {
    isPlaying = true;
    btnPlay.textContent = "⏸";
    loop();
  }
});

btnOrder.addEventListener("click", () => {
  const wasPlaying = isPlaying;
  stopAll();
  order = order === "secuencial" ? "aleatorio" : "secuencial";
  cyclePlayed = [currentIndex];
  history = [];
  updateButtons();
  saveSettings();
  renderCard();
  if (wasPlaying) {
    isPlaying = true;
    btnPlay.textContent = "⏸";
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

function stopAll() {
  isPlaying = false;
  player.pause();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  cardEl.classList.remove("playing");
  btnPlay.textContent = "▶";
  statusEl.classList.remove("active");
  statusEl.textContent = "Pausado";
}

// ---------- INIT ----------
loadSettings();
updateButtons();
speedInput.value = speed;
speedValue.textContent = speed.toFixed(1) + "x";
pauseInput.value = pauseSeconds;
pauseValue.textContent = pauseSeconds + "s";
loadCards();
