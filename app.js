import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import { COLORS } from "./colors.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TOTAL_STEPS = 16;

const startScreen = document.querySelector("#start-screen");
const testScreen = document.querySelector("#test-screen");
const thanksScreen = document.querySelector("#thanks-screen");
const nameInput = document.querySelector("#name-input");
const startButton = document.querySelector("#start-button");
const startError = document.querySelector("#start-error");
const hudStep = document.querySelector("#hud-step");
const hudLeft = document.querySelector("#hud-left");
const leftSwatch = document.querySelector("#swatch-left");
const rightSwatch = document.querySelector("#swatch-right");
const thanksTitle = document.querySelector("#thanks-title");
const thanksText = document.querySelector("#thanks-text");

const state = {
  busy: false,
  sessionId: null,
  name: "",
  stepIndex: 1,
  current: null,
  tournament: null,
};

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function pairUp(colors) {
  const matches = [];
  for (let i = 0; i < colors.length; i += 2) {
    matches.push({ left: colors[i], right: colors[i + 1] });
  }
  return matches;
}

const MARKED = COLORS.slice(-3);
const MARKED_IDS = new Set(MARKED.map((color) => color.id));

function roundLabel(size) {
  if (size === 8) return { name: "round_of_16" };
  if (size === 4) return { name: "quarterfinal" };
  if (size === 2) return { name: "final" };
  return { name: "decoy" };
}

function pickExtraSteps(total, count, minGap = 3) {
  const inner = [];
  for (let step = 2; step <= total - 1; step += 1) inner.push(step);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const picked = shuffle(inner)
      .slice(0, count)
      .sort((left, right) => left - right);
    const spaced = picked.every(
      (step, index) => index === 0 || step - picked[index - 1] >= minGap,
    );
    if (spaced) return picked;
  }
  return [4, 9, 14].slice(0, count);
}

function flipPair(left, right) {
  return Math.random() < 0.5 ? { left, right } : { left: right, right: left };
}

function makeDecoy(pool) {
  const colors = shuffle(pool.filter((color) => !MARKED_IDS.has(color.id)));
  return { ...flipPair(colors[0], colors[1]), kind: "decoy" };
}

function createTournament() {
  const fillers = shuffle(COLORS.filter((color) => !MARKED_IDS.has(color.id)));
  const extraSteps = new Set(pickExtraSteps(TOTAL_STEPS, 3, 3));
  const extraQueue = shuffle([
    [MARKED[0], MARKED[1]],
    [MARKED[0], MARKED[2]],
    [MARKED[1], MARKED[2]],
  ]).map(([left, right]) => ({ ...flipPair(left, right), kind: "pair" }));

  return {
    extraSteps,
    extraQueue,
    fillerQueue: pairUp(fillers.slice(0, 8)),
    fillerWinners: [],
    fillerRoundSize: 8,
    fillerChampion: null,
    decoys: fillers.slice(8),
    champion: null,
    closer: null,
    closerDone: false,
  };
}

function remainingSteps() {
  return TOTAL_STEPS - state.stepIndex + 1;
}

function nextFillerMatch(tournament) {
  if (tournament.fillerQueue.length > 0) {
    return { ...tournament.fillerQueue[0], kind: "filler" };
  }

  if (tournament.fillerWinners.length >= 2) {
    tournament.fillerRoundSize = tournament.fillerWinners.length;
    tournament.fillerQueue = pairUp(tournament.fillerWinners);
    tournament.fillerWinners = [];
    return { ...tournament.fillerQueue[0], kind: "filler" };
  }

  if (tournament.fillerWinners.length === 1 && !tournament.fillerChampion) {
    tournament.fillerChampion = tournament.fillerWinners[0];
    tournament.champion = tournament.fillerChampion;
  }

  return makeDecoy(tournament.decoys);
}

function currentMatch() {
  const { tournament } = state;
  if (state.stepIndex === TOTAL_STEPS) {
    if (!tournament.closer) {
      tournament.closer = { ...makeDecoy(tournament.decoys), kind: "closer", closer: true };
    }
    return tournament.closer;
  }
  if (tournament.extraSteps.has(state.stepIndex)) {
    return tournament.extraQueue[0];
  }
  return nextFillerMatch(tournament);
}

function applyPick(choice) {
  const match = state.current?.match ?? currentMatch();
  const winner = choice === 1 ? match.left : match.right;
  const { tournament } = state;

  if (match.kind === "pair") {
    tournament.extraQueue.shift();
    return winner;
  }

  if (match.kind === "closer" || match.kind === "decoy") {
    if (match.kind === "closer") tournament.closerDone = true;
    if (!tournament.champion && tournament.fillerChampion) {
      tournament.champion = tournament.fillerChampion;
    }
    return winner;
  }

  tournament.fillerWinners.push(winner);
  tournament.fillerQueue.shift();

  if (tournament.fillerQueue.length === 0 && tournament.fillerWinners.length === 1) {
    tournament.fillerChampion = tournament.fillerWinners[0];
    tournament.champion = tournament.fillerChampion;
  }
  return winner;
}

function showScreen(screen) {
  for (const node of document.querySelectorAll(".screen")) {
    node.classList.remove("is-active");
  }
  screen.classList.add("is-active");
}

function paintMatch() {
  const match = currentMatch();
  const round =
    match.kind === "pair"
      ? { name: "pair" }
      : match.kind === "decoy"
        ? { name: "decoy" }
        : match.kind === "closer"
          ? { name: "closer" }
          : roundLabel(state.tournament.fillerRoundSize);

  hudStep.textContent = `${state.stepIndex} / ${TOTAL_STEPS}`;
  hudLeft.textContent = `Осталось ${remainingSteps()}`;

  paintSwatch(leftSwatch, match.left);
  paintSwatch(rightSwatch, match.right);
  state.current = { match, round };
}

function paintSwatch(button, color) {
  button.style.background = color.hex;
  button.classList.toggle("is-light", luminance(color.hex) >= 150);
}

async function startTest() {
  const name = nameInput.value.trim();
  if (name.length < 2) {
    startError.hidden = false;
    startError.textContent = "Введи имя, хотя бы пару букв.";
    nameInput.focus();
    return;
  }

  startButton.disabled = true;
  startError.hidden = true;
  state.name = name;
  state.sessionId = crypto.randomUUID();
  state.stepIndex = 1;
  state.tournament = createTournament();

  const { error } = await supabase.from("test_sessions").insert({
    id: state.sessionId,
    participant_name: name,
    total_steps: TOTAL_STEPS,
    user_agent: navigator.userAgent,
  });

  if (error) {
    startButton.disabled = false;
    startError.hidden = false;
    startError.textContent = "Не получилось начать. Проверь интернет и попробуй ещё раз.";
    console.error(error);
    return;
  }

  showScreen(testScreen);
  paintMatch();
}

async function saveChoice(choice, winner) {
  const { match, round } = state.current;
  const isLast = state.stepIndex === TOTAL_STEPS;
  const { error } = await supabase.from("test_choices").insert({
    session_id: state.sessionId,
    participant_name: state.name,
    step_index: state.stepIndex,
    total_steps: TOTAL_STEPS,
    round_name: round.name,
    left_color: match.left.id,
    right_color: match.right.id,
    left_hex: match.left.hex,
    right_hex: match.right.hex,
    choice,
    chosen_color: winner.id,
    remaining_steps: remainingSteps() - 1,
    is_final: isLast,
  });
  if (error) {
    console.error(error);
  }
  return error;
}

async function finishTest() {
  const champion = state.tournament.champion;
  thanksTitle.textContent = `Спасибо, ${state.name}!`;
  thanksText.textContent = "Ты прошла весь турнир цветов. Это было ярко и очень вкусно глазами.";
  thanksScreen.style.background = `linear-gradient(160deg, ${champion?.hex ?? "#c65d3b"}, #1b1410 70%)`;
  showScreen(thanksScreen);
  requestAnimationFrame(() => burstConfetti());

  supabase
    .from("test_sessions")
    .update({
      finished_at: new Date().toISOString(),
      champion_color: champion?.id ?? null,
      champion_hex: champion?.hex ?? null,
    })
    .eq("id", state.sessionId)
    .then(({ error }) => {
      if (error) console.error(error);
    });
}

async function choose(choice) {
  if (state.busy || !state.current) return;
  state.busy = true;
  const button = choice === 1 ? leftSwatch : rightSwatch;
  button.classList.add("is-picked");

  const winner = applyPick(choice);
  await saveChoice(choice, winner);

  window.setTimeout(async () => {
    button.classList.remove("is-picked");
    if (state.stepIndex >= TOTAL_STEPS) {
      finishTest();
      return;
    }
    state.stepIndex += 1;
    paintMatch();
    state.busy = false;
  }, 180);
}

function burstConfetti() {
  const canvas = document.querySelector("#confetti");
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  const width = thanksScreen.clientWidth || window.innerWidth;
  const height = thanksScreen.clientHeight || window.innerHeight;
  const scale = width < 700 ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const palette = ["#f0d78c", "#e8b4b8", "#7a9bb5", "#c65d3b", "#dab2ba", "#ffffff"];
  const perBurst = width < 700 ? 16 : 22;
  const sparks = [];

  function spawnBurst(originX, originY) {
    for (let i = 0; i < perBurst; i += 1) {
      const angle = (Math.PI * 2 * i) / perBurst + Math.random() * 0.18;
      const speed = 2.8 + Math.random() * 3.2;
      sparks.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.8,
        life: 1,
        decay: 0.02 + Math.random() * 0.01,
        size: 2.4 + Math.random() * 2,
        color: palette[i % palette.length],
      });
    }
  }

  spawnBurst(width * 0.22, height * 0.36);
  spawnBurst(width * 0.5, height * 0.26);
  spawnBurst(width * 0.78, height * 0.36);

  const started = performance.now();
  function tick(now) {
    ctx.clearRect(0, 0, width, height);
    let alive = 0;
    for (const spark of sparks) {
      if (spark.life <= 0) continue;
      alive += 1;
      spark.vy += 0.11;
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.life -= spark.decay;
      ctx.globalAlpha = Math.max(spark.life, 0);
      ctx.fillStyle = spark.color;
      ctx.fillRect(spark.x, spark.y, spark.size, spark.size);
    }
    ctx.globalAlpha = 1;
    if (alive > 0 && now - started < 1800) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  }
  requestAnimationFrame(tick);
}

startButton.addEventListener("click", startTest);
nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") startTest();
});
leftSwatch.addEventListener("click", () => choose(1));
rightSwatch.addEventListener("click", () => choose(2));
window.addEventListener("keydown", (event) => {
  if (!testScreen.classList.contains("is-active")) return;
  if (event.key === "1") choose(1);
  if (event.key === "2") choose(2);
});
