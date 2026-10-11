// ==========================================================
// ENGLISH AUDIO FLASH
// ==========================================================

let cards = [];
let currentIndex = 0;
let isPlaying = false;
let isBusy = false;          // evita solapamiento de audio/TTS
let speed = 1;
let pauseSeconds = 2;

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
function renderCard() {
  const c = cards[currentIndex];
  if (!c) return;

  wordEn.textContent = c.en;
  wordEs.textContent = "";           // la traducción aparece al descubrirla
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

    isBusy = true;
    cardEl.classList.add("playing");

    // 1) Audio inglés
    statusEl.textContent = "🔊 Inglés";
    statusEl.classList.add("active");

    player.src = c.audio;
    player.playbackRate = speed;
    player.currentTime = 0;

    player.onended = () => {
      // 2) Mostrar traducción + TTS español
      wordEs.textContent = c.es;
      statusEl.textContent = "🇪🇸 Español";

      speakSpanish(c.es, () => {
        // 3) Pausa y siguiente
        statusEl.textContent = "⏸ Pausa";
        statusEl.classList.remove("active");
        cardEl.classList.remove("playing");

        setTimeout(() => {
          isBusy = false;
          resolve();
        }, pauseSeconds * 1000);
      });
    };

    player.onerror = () => {
      // Si falla el audio, saltamos al TTS igual
      console.warn("Error al reproducir:", c.audio);
      wordEs.textContent = c.es;
      speakSpanish(c.es, () => {
        setTimeout(() => {
          isBusy = false;
          resolve();
        }, pauseSeconds * 1000);
      });
    };

    player.play().catch((e) => {
      console.warn("play() rechazado:", e);
      player.onerror();
    });
  });
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
    // Pausar
    isPlaying = false;
    player.pause();
    speechSynthesis.cancel();
    isBusy = false;
    cardEl.classList.remove("playing");
    statusEl.textContent = "Pausado";
    statusEl.classList.remove("active");
    btnPlay.textContent = "▶";
  } else {
    // Reproducir
    isPlaying = true;
    btnPlay.textContent = "⏸";
    loop();
  }
});

btnNext.addEventListener("click", () => {
  if (cards.length === 0) return;
  stopAll();
  currentIndex = (currentIndex + 1) % cards.length;
  renderCard();
  if (isPlaying) loop();
});

btnPrev.addEventListener("click", () => {
  if (cards.length === 0) return;
  stopAll();
  currentIndex = (currentIndex - 1 + cards.length) % cards.length;
  renderCard();
  if (isPlaying) loop();
});

speedInput.addEventListener("input", () => {
  speed = parseFloat(speedInput.value);
  speedValue.textContent = speed.toFixed(1) + "x";
  player.playbackRate = speed;
});

pauseInput.addEventListener("input", () => {
  pauseSeconds = parseFloat(pauseInput.value);
  pauseValue.textContent = pauseSeconds + "s";
});

function stopAll() {
  isPlaying = false;
  isBusy = false;
  player.pause();
  speechSynthesis.cancel();
  cardEl.classList.remove("playing");
  btnPlay.textContent = "▶";
  statusEl.classList.remove("active");
}

// ---------- INIT ----------
loadCards();
