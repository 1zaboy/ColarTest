import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import { COLORS } from "./colors.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TOTAL_STEPS = 19;

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
  const remaining = shuffle(colors);
  const matches = [];
  while (remaining.length >= 2) {
    const left = remaining.shift();
    const right = pickContrastPartner(left, remaining);
    remaining.splice(
      remaining.findIndex((color) => color.id === right.id),
      1,
    );
    matches.push({ ...flipPair(left, right) });
  }
  return matches;
}

const MIN_DELTA_E = 32;

function srgbToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function hexToLab(hex) {
  const r = srgbToLinear(parseInt(hex.slice(1, 3), 16));
  const g = srgbToLinear(parseInt(hex.slice(3, 5), 16));
  const b = srgbToLinear(parseInt(hex.slice(5, 7), 16));
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(leftHex, rightHex) {
  const left = hexToLab(leftHex);
  const right = hexToLab(rightHex);
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function pickContrastPartner(left, pool) {
  const scored = pool
    .map((color) => ({ color, dist: deltaE(left.hex, color.hex) }))
    .sort((a, b) => b.dist - a.dist);
  const farEnough = scored.filter((item) => item.dist >= MIN_DELTA_E);
  const options = farEnough.length > 0 ? farEnough : scored.slice(0, 1);
  return options[Math.floor(Math.random() * options.length)].color;
}

const MARKED = COLORS.slice(-3);
const MARKED_IDS = new Set(MARKED.map((color) => color.id));

function roundLabel(size) {
  if (size === 16) return { name: "round_of_16" };
  if (size === 8) return { name: "quarterfinal" };
  if (size === 4) return { name: "semifinal" };
  if (size === 2) return { name: "final" };
  return { name: "decoy" };
}

function pickMidSubSteps(total, count, minGap = 4) {
  const start = Math.max(2, Math.round(total * 0.32));
  const end = Math.min(total - 1, Math.round(total * 0.84));
  const inner = [];
  for (let step = start; step <= end; step += 1) inner.push(step);
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const picked = shuffle(inner)
      .slice(0, count)
      .sort((left, right) => left - right);
    const spaced = picked.every(
      (step, index) => index === 0 || step - picked[index - 1] >= minGap,
    );
    if (spaced) return picked;
  }
  if (count <= 1) return [Math.round((start + end) / 2)];
  const span = end - start;
  return Array.from({ length: count }, (_, index) =>
    start + Math.round((span * index) / (count - 1)),
  );
}

function flipPair(left, right) {
  return Math.random() < 0.5 ? { left, right } : { left: right, right: left };
}

function makeDecoy(pool) {
  const colors = shuffle(pool.filter((color) => !MARKED_IDS.has(color.id)));
  const left = colors[0];
  const right = pickContrastPartner(left, colors.slice(1));
  return { ...flipPair(left, right), kind: "decoy" };
}

function preferPlainOpener(matches) {
  const plainScore = (match) =>
    Number(!MARKED_IDS.has(match.left.id)) + Number(!MARKED_IDS.has(match.right.id));
  for (let index = 1; index < matches.length; index += 1) {
    if (plainScore(matches[0]) === 2) break;
    if (plainScore(matches[index]) > plainScore(matches[0])) {
      [matches[0], matches[index]] = [matches[index], matches[0]];
    }
  }
  return matches;
}

function splitMarkedOpeners(matches) {
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (!MARKED_IDS.has(match.left.id) || !MARKED_IDS.has(match.right.id)) continue;
    const donorIndex = matches.findIndex(
      (other, otherIndex) =>
        otherIndex !== index &&
        !MARKED_IDS.has(other.left.id) &&
        !MARKED_IDS.has(other.right.id),
    );
    if (donorIndex < 0) continue;
    const donor = matches[donorIndex];
    matches[index] = flipPair(match.left, donor.right);
    matches[donorIndex] = flipPair(donor.left, match.right);
  }
  return preferPlainOpener(matches);
}

function createTournament() {
  return {
    extraSteps: new Set(pickMidSubSteps(TOTAL_STEPS, 3, 4)),
    sub: {
      stage: 0,
      bye: null,
      openerWinner: null,
      openerLoser: null,
      pending: null,
    },
    fillerQueue: splitMarkedOpeners(pairUp([...COLORS])),
    fillerWinners: [],
    fillerRoundSize: 16,
    fillerChampion: null,
    decoys: COLORS.filter((color) => !MARKED_IDS.has(color.id)),
    champion: null,
    closer: null,
    closerDone: false,
  };
}

function buildSubMatch(sub) {
  if (sub.stage === 0) {
    const [left, right, bye] = shuffle([...MARKED]);
    sub.bye = bye;
    return { ...flipPair(left, right), kind: "pair", subRound: "sub_open" };
  }
  if (sub.stage === 1) {
    return { ...flipPair(sub.openerLoser, sub.bye), kind: "pair", subRound: "sub_drop" };
  }
  return { ...flipPair(sub.openerWinner, sub.bye), kind: "pair", subRound: "sub_final" };
}

function currentSubMatch(tournament) {
  if (!tournament.sub.pending) {
    tournament.sub.pending = buildSubMatch(tournament.sub);
  }
  return tournament.sub.pending;
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
    return currentSubMatch(tournament);
  }
  return nextFillerMatch(tournament);
}

function applyPick(choice) {
  const match = state.current?.match ?? currentMatch();
  const winner = choice === 1 ? match.left : match.right;
  const { tournament } = state;

  if (match.kind === "pair") {
    const loser = choice === 1 ? match.right : match.left;
    if (match.subRound === "sub_open") {
      tournament.sub.openerWinner = winner;
      tournament.sub.openerLoser = loser;
    }
    tournament.sub.stage += 1;
    tournament.sub.pending = null;
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
      ? { name: match.subRound ?? "pair" }
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
