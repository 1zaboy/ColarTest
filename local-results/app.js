import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config.js";
import { COLORS, TARGET_IDS } from "../colors.js";
import { rankTargetIds } from "../ranking.js";
import { bracketRounds, matchesOf } from "./bracket.js";
import { connectorPath } from "./lines.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const REAL_LABELS = {
  rose: "Ceramic Pink / Rose Gold",
  fig: "Jasper Plum",
  apricot: "Ceramic Apricot / Topaz",
  amber: "Amber Silk",
  cranberry: "Red Velvet / Gold",
  petal: "Ceramic Pink / Rose Gold",
  mulberry: "Jasper Plum",
  garnet: "Red Velvet / Gold",
};

const TARGET_SWATCHES = {
  rose: "#dab2ba",
  fig: "#522c40",
  apricot: "#e8c09a",
  amber: "#c48454",
  cranberry: "#8e2436",
};

const TRACKED_IDS = new Set([...TARGET_IDS, "petal", "mulberry", "garnet"]);
const SUB_ROUNDS = new Set([
  "pair",
  "cross",
  "sub_open",
  "sub_drop",
  "sub_semi",
  "sub_final",
]);

const COLOR_NAMES = {
  mocha: "мокко",
  butter: "масло",
  sage: "шалфей",
  terracotta: "терракота",
  chocolate: "шоколад",
  lavender: "лаванда",
  oat: "овёс",
  eucalyptus: "эвкалипт",
  blush: "румянец",
  caramel: "карамель",
  dustyblue: "пыльный синий",
  olive: "олива",
  indigo: "индиго",
  rose: "роза",
  fig: "инжир",
  cranberry: "клюква",
  apricot: "абрикос",
  amber: "янтарь",
  petal: "роза",
  mulberry: "инжир",
  garnet: "клюква",
};

const peopleEl = document.querySelector("#people");
const boardsEl = document.querySelector("#boards");
const emptyEl = document.querySelector("#empty");
const statusEl = document.querySelector("#status");
const searchInput = document.querySelector("#search-input");
const refreshButton = document.querySelector("#refresh-button");

let sessions = [];
let activeId = null;

function luminance(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function colorLabel(id) {
  return REAL_LABELS[id] ?? COLOR_NAMES[id] ?? id;
}

function formatWhen(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function realLabel(id) {
  return REAL_LABELS[id] ?? colorLabel(id);
}

function hexForChoice(match, colorId) {
  if (match.left_color === colorId) return match.left_hex;
  if (match.right_color === colorId) return match.right_hex;
  return "#333333";
}

function championOf(session) {
  if (session.champion_color && session.champion_hex) {
    return { id: session.champion_color, hex: session.champion_hex };
  }
  const final = session.test_choices.find((row) => row.round_name === "final");
  if (!final) return null;
  return { id: final.chosen_color, hex: hexForChoice(final, final.chosen_color) };
}

function isComplete(session) {
  return Boolean(
    session.finished_at ||
      session.champion_color ||
      session.test_choices.some((row) => row.round_name === "final"),
  );
}

function slotClass(hex, won) {
  return ["slot", won ? "is-won" : "is-lost", luminance(hex) >= 150 ? "is-light" : ""]
    .filter(Boolean)
    .join(" ");
}

function trackedMatches(session) {
  const named = (session.test_choices ?? []).filter((row) =>
    SUB_ROUNDS.has(row.round_name),
  );
  const rows =
    named.length > 0
      ? named
      : (session.test_choices ?? []).filter(
          (row) => TRACKED_IDS.has(row.left_color) && TRACKED_IDS.has(row.right_color),
        );
  return rows.sort((a, b) => a.step_index - b.step_index);
}

function canonicalId(id) {
  if (id === "petal") return "rose";
  if (id === "mulberry") return "fig";
  if (id === "garnet") return "cranberry";
  return id;
}

function targetHex(id, rows) {
  return (
    rows.find((row) => canonicalId(row.left_color) === id)?.left_hex ||
    rows.find((row) => canonicalId(row.right_color) === id)?.right_hex ||
    COLORS.find((color) => color.id === id)?.hex ||
    TARGET_SWATCHES[id] ||
    "#333"
  );
}

function winWord(count) {
  const n10 = count % 10;
  const n100 = count % 100;
  if (n10 === 1 && n100 !== 11) return "победа";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "победы";
  return "побед";
}

function orderWithGrandFinal(ranked, grandFinal) {
  if (!grandFinal) return ranked;
  const champ = canonicalId(grandFinal.chosen_color);
  const loser = canonicalId(
    grandFinal.left_color === grandFinal.chosen_color
      ? grandFinal.right_color
      : grandFinal.left_color,
  );
  return [
    champ,
    loser,
    ...ranked.filter((id) => id !== champ && id !== loser),
  ];
}

function renderTrackedRank(session) {
  if ((session.test_choices ?? []).length === 0) return "";

  const matches = trackedMatches(session);
  const grandFinal = matches.find((row) => row.round_name === "sub_final");
  const circle = matches.filter((row) => row.round_name !== "sub_final");
  const { ranked: circleRanked, wins } = rankTargetIds(TARGET_IDS, circle, canonicalId);
  const ranked = orderWithGrandFinal(circleRanked, grandFinal);

  const knockoutCollisions = (session.test_choices ?? []).filter(
    (row) =>
      !SUB_ROUNDS.has(row.round_name) &&
      TRACKED_IDS.has(row.left_color) &&
      TRACKED_IDS.has(row.right_color),
  );
  const allShown = [...matches, ...knockoutCollisions].sort(
    (a, b) => a.step_index - b.step_index,
  );

  const leader = ranked[0];
  const runnerUp = ranked[1];
  const tied = !grandFinal && wins[leader] === wins[runnerUp];

  return `
    <section class="shade-rank">
      <p class="shade-title">Рейтинг оттенков</p>
      <ol>
        ${ranked
          .map((id, index) => {
            const hex = targetHex(id, allShown);
            return `
              <li>
                <span class="shade-swatch" style="background:${hex}"></span>
                <strong>${index + 1}. ${realLabel(id)}</strong>
                <span>${wins[id] ?? 0} ${winWord(wins[id] ?? 0)}</span>
              </li>
            `;
          })
          .join("")}
      </ol>
      <div class="shade-matches">
        ${allShown
          .map(
            (match) => `
              <p>
                шаг ${match.step_index}: ${realLabel(match.left_color)} vs
                ${realLabel(match.right_color)} →
                <b>${realLabel(match.chosen_color)}</b>
              </p>
            `,
          )
          .join("")}
      </div>
      <p class="shade-verdict">
        ${
          tied
            ? `Лидер пока не один: ${realLabel(leader)} и ${realLabel(runnerUp)}.`
            : `Лучше всего зашёл ${realLabel(leader)}.`
        }
      </p>
    </section>
  `;
}

function renderMatch(match) {
  const leftWon = match.choice === 1;
  return `
    <div class="match">
      <div class="${slotClass(match.left_hex, leftWon)}" style="background:${match.left_hex}">
        <span>${colorLabel(match.left_color)}</span>
        <span class="slot-mark">${leftWon ? "win" : ""}</span>
      </div>
      <div class="${slotClass(match.right_hex, !leftWon)}" style="background:${match.right_hex}">
        <span>${colorLabel(match.right_color)}</span>
        <span class="slot-mark">${leftWon ? "" : "win"}</span>
      </div>
    </div>
  `;
}

function clusterMatches(matches) {
  const clusters = [];
  for (let index = 0; index < matches.length; index += 2) {
    clusters.push(matches.slice(index, index + 2));
  }
  return clusters;
}

function renderRound(round) {
  return `
    <section class="round">
      <p class="round-title">${round.title}</p>
      <div class="matches">
        ${clusterMatches(round.matches)
          .map((cluster) => {
            const single = cluster.length === 1 ? " is-single" : "";
            return `
              <div class="cluster${single}">
                ${cluster
                  .map((match) => `<div class="match-slot">${renderMatch(match)}</div>`)
                  .join("")}
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderChampion(champion) {
  const inner = champion
    ? `
        <div class="trophy">
          <div class="trophy-color" style="background:${champion.hex}"></div>
          <strong>${colorLabel(champion.id)}</strong>
          <span>цвет победитель</span>
        </div>
      `
    : `<p class="incomplete">Ещё нет победителя</p>`;

  return `
    <section class="round champion-round">
      <p class="round-title">Чемпион</p>
      <div class="matches">
        <div class="cluster is-single is-end">
          <div class="match-slot">${inner}</div>
        </div>
      </div>
    </section>
  `;
}

function renderSubBracket(choices) {
  const labels = {
    sub_open: "старт",
    sub_drop: "нижняя сетка",
    pair: "круг",
    cross: "встреча",
    sub_final: "гранд-финал",
  };
  const matches = (choices ?? [])
    .filter((row) => labels[row.round_name])
    .sort((a, b) => a.step_index - b.step_index);
  if (matches.length === 0) return "";
  return `
    <div class="closer">
      <p class="closer-label">Подсетка</p>
      <div class="extra-matches">
        ${matches
          .map(
            (match) => `
              <div>
                <p class="closer-label">${labels[match.round_name]} · шаг ${match.step_index}</p>
                ${renderMatch(match)}
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderMatchList(choices, roundKey, label) {
  const matches = matchesOf(choices, roundKey);
  if (matches.length === 0) return "";
  return `
    <div class="closer">
      <p class="closer-label">${label}</p>
      <div class="extra-matches">
        ${matches.map(renderMatch).join("")}
      </div>
    </div>
  `;
}

function renderPlayoff(session, champion) {
  if (session.test_choices.length === 0) {
    return `<p class="incomplete">Ходов пока нет — сетку собрать нельзя.</p>`;
  }

  const rounds = bracketRounds(session.test_choices);
  const rows = Math.max(rounds[0]?.matches.length ?? 2, 2);
  return `
    <div class="bracket-scroll">
      <div class="bracket" style="--rows:${rows}">
        ${rounds.map(renderRound).join("")}
        ${renderChampion(champion)}
      </div>
    </div>
    ${renderSubBracket(session.test_choices)}
    ${renderMatchList(session.test_choices, "decoy", "Дополнительные матчи")}
    ${renderMatchList(session.test_choices, "closer", "Контрольный матч")}
  `;
}

function renderBoard(session) {
  const champion = championOf(session);
  const complete = isComplete(session);
  const when = formatWhen(session.finished_at || session.started_at);
  const subtitle = complete
    ? `${when} · чемпион: ${champion ? colorLabel(champion.id) : "—"}`
    : `${when} · не закончил (${session.test_choices.length} из ${session.total_steps ?? 16})`;

  return `
    <article class="board" id="board-${session.id}" data-name="${session.participant_name.toLowerCase()}">
      <header class="board-head">
        <div class="champion-orb" style="background:${champion?.hex ?? "#3a2c26"}"></div>
        <div>
          <h2>${session.participant_name}</h2>
          <p>${subtitle}</p>
        </div>
      </header>
      ${renderTrackedRank(session)}
      ${renderPlayoff(session, champion)}
    </article>
  `;
}

function renderPeople(list) {
  peopleEl.innerHTML = list
    .map((session) => {
      const champion = championOf(session);
      const complete = isComplete(session);
      const active = session.id === activeId ? "is-active" : "";
      const incomplete = complete ? "" : "is-incomplete";
      return `
        <button class="person ${active} ${incomplete}" type="button" data-id="${session.id}">
          <span class="person-swatch" style="background:${champion?.hex ?? "transparent"}"></span>
          <span>${session.participant_name}</span>
          ${complete ? "" : `<span class="badge">игра</span>`}
        </button>
      `;
    })
    .join("");
}

function visibleSessions() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return sessions;
  return sessions.filter((session) => session.participant_name.toLowerCase().includes(query));
}

function slotAnchor(slot, side, origin) {
  const card = slot.querySelector(".match, .trophy") || slot;
  const box = card.getBoundingClientRect();
  return {
    x: (side === "right" ? box.right : box.left) - origin.x,
    y: box.top + box.height / 2 - origin.y,
  };
}

function drawBracketLines(bracket) {
  bracket.querySelector(":scope > svg.bracket-lines")?.remove();

  const rounds = [...bracket.querySelectorAll(":scope > .round")];
  if (rounds.length < 2) return;

  const origin = bracket.getBoundingClientRect();
  const width = Math.max(bracket.scrollWidth, origin.width);
  const height = Math.max(bracket.scrollHeight, origin.height);
  const paths = [];

  for (let index = 0; index < rounds.length - 1; index += 1) {
    const from = [...rounds[index].querySelectorAll(".match-slot")].map((slot) =>
      slotAnchor(slot, "right", origin),
    );
    const to = [...rounds[index + 1].querySelectorAll(".match-slot")].map((slot) =>
      slotAnchor(slot, "left", origin),
    );
    const d = connectorPath(from, to);
    if (d) paths.push(d);
  }

  if (paths.length === 0) return;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "bracket-lines");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", paths.join(""));
  svg.append(path);
  bracket.prepend(svg);
}

function refreshBracketLines() {
  document.querySelectorAll(".bracket").forEach(drawBracketLines);
}

function paint() {
  const list = visibleSessions();
  renderPeople(list);
  boardsEl.innerHTML = list.map(renderBoard).join("");
  emptyEl.hidden = list.length > 0;
  if (activeId) {
    document.querySelector(`#board-${activeId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
  requestAnimationFrame(refreshBracketLines);
}

async function load() {
  refreshButton.disabled = true;
  statusEl.textContent = "Загружаю…";

  const { data, error } = await supabase
    .from("test_sessions")
    .select(
      "id, participant_name, started_at, finished_at, champion_color, champion_hex, total_steps, test_choices(step_index, round_name, left_color, right_color, left_hex, right_hex, choice, chosen_color, is_final)",
    )
    .order("started_at", { ascending: false })
    .order("step_index", { referencedTable: "test_choices", ascending: true });

  refreshButton.disabled = false;

  if (error) {
    statusEl.textContent = "Не получилось загрузить результаты.";
    console.error(error);
    return;
  }

  sessions = (data ?? [])
    .map((session) => ({
      ...session,
      test_choices: session.test_choices ?? [],
    }))
    .sort((a, b) => {
      const completeDelta = Number(isComplete(b)) - Number(isComplete(a));
      if (completeDelta !== 0) return completeDelta;
      return new Date(b.started_at) - new Date(a.started_at);
    });

  const completed = sessions.filter(isComplete).length;
  statusEl.textContent = `${sessions.length} участник(ов), ${completed} с полной сеткой`;
  paint();
}

peopleEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  activeId = button.dataset.id;
  paint();
});

searchInput.addEventListener("input", () => {
  activeId = null;
  paint();
});

refreshButton.addEventListener("click", load);
window.addEventListener("resize", refreshBracketLines);
document.fonts?.ready.then(refreshBracketLines);
new ResizeObserver(refreshBracketLines).observe(boardsEl);
load();
