// ==========================================================
// ENGLISH AUDIO FLASH - v2
// Modo dual (EN→ES / ES→EN) + persistencia de ajustes
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
const player    = document.getElementById("player");
const statusEl  = document.getElementById("status");
const wordEn    = document.getElementById("wordEn");
const wordEs    = document.getElementById("wordEs");
const counter   = document.getElementById("counter");
const progressBar = document.getElementById("progressBar");
const cardEl    = document.getElementById("card");

const btnPlay = document.getElementById("btnPlay");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
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

// ---------- RENDER ----------
function updateDirectionButton() {
  btnDirection.textContent = direction === "en-es"
    ? "EN → ES 🔄"
    : "ES → EN 🔄";
}

function renderCard() {
  const c = cards[currentIndex];
  if (!c) return;

  // Siempre ponemos los dos textos
  wordEn.textContent = c.en;
  wordEs.textContent = c.es;

  // Según la dirección, ocultamos la "respuesta"
  if (direction === "en-es") {
    // pregunta = inglés (visible), respuesta = español (oculta)
    wordEn.classList.remove("hidden");
    wordEs.classList.add("hidden");
  } else {
    // pregunta = español (visible), respuesta = inglés (oculta)
    wordEs.classList.remove("hidden");
    wordEn.classList.add("hidden");
  }

  counter.textContent = `${currentIndex + 1} / ${cards.length}`;
  progressBar.style.width = ((currentIndex + 1) / cards.length) * 100 + "%";
  statusEl.textContent = "Listo";
  statusEl.classList.remove("active");
}

function revealAnswer() {
  if (direction === "en-es") {
    wordEs.classList.remove("hidden");
  } else {
    wordEn.classList.remove("hidden");
  }
}

// ---------- REPRODUCIR UNA TARJETA ----------
function playCard() {
  return new Promise((resolve) => {
    const c = cards[currentIndex];
    if (!c) return resolve();

    cardEl.classList.add("playing");

    if (direction === "en-es") {
      playEnToEs(c, resolve);
    } else {
      playEsToEn(c, resolve);
    }
  });
}

// --- EN → ES: audio inglés, luego TTS español + revelar traducción
function playEnToEs(c, resolve) {
  statusEl.textContent = "🔊 Inglés";
  statusEl.classList.add("active");

  player.src = c.audio;
  player.playbackRate = speed;
  player.currentTime = 0;

  player.onended = () => {
    revealAnswer();
    statusEl.textContent = "🇪🇸 Español";
    speakSpanish(c.es, () => afterCard(resolve));
  };

  player.onerror = () => {
    console.warn("Error al reproducir:", c.audio);
    revealAnswer();
    speakSpanish(c.es, () => afterCard(resolve));
  };

  player.play().catch(() => player.onerror());
}

// --- ES → EN: TTS español, luego audio inglés + revelar inglés
function playEsToEn(c, resolve) {
  statusEl.textContent = "🇪🇸 Español";
  statusEl.classList.add("active");

  speakSpanish(c.es, () => {
    statusEl.textContent = "🔊 Inglés";

    player.src = c.audio;
    player.playbackRate = speed;
    player.currentTime = 0;

    player.onended = () => {
      revealAnswer();
      afterCard(resolve);
    };

    player.onerror = () => {
      console.warn("Error al reproducir:", c.audio);
      revealAnswer();
      afterCard(resolve);
    };

    player.play().catch(() => player.onerror());
  });
}

// --- Pausa final antes de la siguiente tarjeta
function afterCard(resolve) {
  statusEl.textContent = "⏸ Pausa";
  statusEl.classList.remove("active");
  cardEl.classList.remove("playing");

  setTimeout(() => {
    resolve();
  }, pauseSeconds * 1000);
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
