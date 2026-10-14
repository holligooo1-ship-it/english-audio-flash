// ==========================================================
// ENGLISH AUDIO FLASH - v3
// Un audio por tarjeta según el modo
// ==========================================================

// ---------- ESTADO ----------
let cards = [];
let currentIndex = 0;
let isPlaying = false;
let speed = 1;
let pauseSeconds = 2;
let direction = "en-es";     // "en-es" | "es-en"

// ---------- PERSISTENCIA ----------
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("af_settings") || "{}");
    if (s.direction) direction = s.direction;
    if (typeof s.speed === "number") speed = s.speed;
    if (typeof s.pause === "number") pauseSeconds = s.pause;
  } catch (e) {}
}

function saveSettings() {
  localStorage.setItem("af_settings", JSON.stringify({
    direction, speed, pause: pauseSeconds
  }));
}

// ---------- DOM ----------
const player       = document.getElementById("player");
const statusEl     = document.getElementById("status");
const wordEn       = document.getElementById("wordEn");   // texto principal en pantalla
const wordEs       = document.getElementById("wordEs");   // (queda vacío ahora)
const counter      = document.getElementById("counter");
const progressBar  = document.getElementById("progressBar");
const cardEl       = document.getElementById("card");

const btnPlay      = document.getElementById("btnPlay");
const btnPrev      = document.getElementById("btnPrev");
const btnNext      = document.getElementById("btnNext");
const btnDirection = document.getElementById("btnDirection");

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
    renderCard();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error al cargar datos";
  }
}

// ---------- BOTÓN DE DIRECCIÓN ----------
function updateDirectionButton() {
  btnDirection.textContent = direction === "en-es"
    ? "EN → ES 🔄"
    : "ES → EN 🔄";
}

// ---------- RENDER ----------
// EN→ES: suena inglés, se ve español
// ES→EN: suena español, se ve inglés
function renderCard() {
  const c = cards[currentIndex];
  if (!c) return;

  if (direction === "en-es") {
    wordEn.textContent = c.es;   // texto visible: español
  } else {
    wordEn.textContent = c.en;   // texto visible: inglés
  }
  wordEs.textContent = "";       // no mostramos subtítulo

  counter.textContent = `${currentIndex + 1} / ${cards.length}`;
  progressBar.style.width = ((currentIndex + 1) / cards.length) * 100 + "%";
  statusEl.textContent = "Listo";
  statusEl.classList.remove("active");
}

// ---------- REPRODUCIR UNA TARJETA ----------
function playCard() {
  return new Promise((resolve) => {
    const c = cards[currentIndex];
    if (!c) return resolve();

    cardEl.classList.add("playing");

    if (direction === "en-es") {
      // Solo suena el audio en inglés (MP3)
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
      // Solo suena el TTS en español
      statusEl.textContent = "🇪🇸 Español";
      statusEl.classList.add("active");

      speakSpanish(c.es, () => afterCard(resolve));
    }
  });
}

// ---------- PAUSA FINAL ----------
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

// ---------- LOOP PRINCIPAL ----------
async function loop() {
  while (isPlaying) {
    await playCard();
    if (!isPlaying) break;
    currentIndex = (currentIndex + 1) % cards.length;
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
  currentIndex = (currentIndex + 1) % cards.length;
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
  currentIndex = (currentIndex - 1 + cards.length) % cards.length;
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
  updateDirectionButton();
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
updateDirectionButton();
speedInput.value = speed;
speedValue.textContent = speed.toFixed(1) + "x";
pauseInput.value = pauseSeconds;
pauseValue.textContent = pauseSeconds + "s";
loadCards();
