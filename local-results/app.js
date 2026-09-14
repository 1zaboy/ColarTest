import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config.js";
import { HIDDEN_IDS } from "../colors.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SECRET_LABELS = {
  petal: "Ceramic Pink",
  mulberry: "Jasper Plum",
  garnet: "Red Velvet",
};

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
  petal: "лепесток",
  mulberry: "шелковица",
  garnet: "гранат",
};

const ROUNDS = [
  { key: "round_of_16", title: "1/8 финала", size: 8 },
  { key: "quarterfinal", title: "1/4 финала", size: 4 },
  { key: "semifinal", title: "1/2 финала", size: 2 },
  { key: "final", title: "Финал", size: 1 },
];

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
  return COLOR_NAMES[id] ?? id;
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

function secretLabel(id) {
  return SECRET_LABELS[id] ?? colorLabel(id);
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

function matchesOf(session, roundKey) {
  return session.test_choices
    .filter((row) => row.round_name === roundKey)
    .sort((a, b) => a.step_index - b.step_index);
}

function slotClass(hex, won) {
  return ["slot", won ? "is-won" : "is-lost", luminance(hex) >= 150 ? "is-light" : ""]
    .filter(Boolean)
    .join(" ");
}

function crossMatches(session) {
  return session.test_choices
    .filter(
      (row) =>
        row.round_name === "cross" ||
        (HIDDEN_IDS.has(row.left_color) && HIDDEN_IDS.has(row.right_color)),
    )
    .sort((a, b) => a.step_index - b.step_index);
}

function renderSecretRank(session) {
  const matches = crossMatches(session);
  if (matches.length === 0) return "";

  const ids = ["petal", "mulberry", "garnet"];
  const wins = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const match of matches) {
    if (wins[match.chosen_color] != null) wins[match.chosen_color] += 1;
  }
  const ranked = [...ids].sort((a, b) => wins[b] - wins[a]);
  const topWins = wins[ranked[0]];
  const tied = ranked.filter((id) => wins[id] === topWins);

  return `
    <section class="secret-rank">
      <p class="secret-title">Скрытый рейтинг</p>
      <ol>
        ${ranked
          .map((id, index) => {
            const hex =
              matches.find((row) => row.left_color === id)?.left_hex ||
              matches.find((row) => row.right_color === id)?.right_hex ||
              "#333";
            return `
              <li>
                <span class="secret-swatch" style="background:${hex}"></span>
                <strong>${index + 1}. ${secretLabel(id)}</strong>
                <span>${wins[id]} ${wins[id] === 1 ? "победа" : "победы"}</span>
              </li>
            `;
          })
          .join("")}
      </ol>
      <div class="secret-matches">
        ${matches
          .map(
            (match) => `
              <p>
                шаг ${match.step_index}: ${secretLabel(match.left_color)} vs
                ${secretLabel(match.right_color)} →
                <b>${secretLabel(match.chosen_color)}</b>
              </p>
            `,
          )
          .join("")}
      </div>
      <p class="secret-verdict">
        ${
          tied.length > 1
            ? `Лидер пока не один: ${tied.map(secretLabel).join(" и ")}.`
            : `Лучше всего зашёл ${secretLabel(ranked[0])}.`
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

function renderRound(session, round) {
  const matches = matchesOf(session, round.key);
  const slots = Array.from({ length: round.size }, (_, index) => matches[index] ?? null);
  return `
    <section class="round">
      <p class="round-title">${round.title}</p>
      <div class="matches">
        ${slots
          .map((match) => `<div class="match-slot">${match ? renderMatch(match) : ""}</div>`)
          .join("")}
      </div>
    </section>
  `;
}

function renderChampion(champion) {
  if (!champion) {
    return `
      <section class="round champion-round">
        <p class="round-title">Чемпион</p>
        <div class="matches">
          <p class="incomplete">Ещё нет победителя</p>
        </div>
      </section>
    `;
  }
  return `
    <section class="round champion-round">
      <p class="round-title">Чемпион</p>
      <div class="matches">
        <div class="trophy">
          <div class="trophy-color" style="background:${champion.hex}"></div>
          <strong>${colorLabel(champion.id)}</strong>
          <span>цвет победитель</span>
        </div>
      </div>
    </section>
  `;
}

function renderCloser(session) {
  const closer = matchesOf(session, "closer")[0];
  if (!closer) return "";
  return `
    <div class="closer">
      <p class="closer-label">Контрольный матч</p>
      ${renderMatch(closer)}
    </div>
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
      ${renderSecretRank(session)}
      ${
        session.test_choices.length === 0
          ? `<p class="incomplete">Ходов пока нет — сетку собрать нельзя.</p>`
          : `<div class="bracket-scroll">
              <div class="bracket">
                ${ROUNDS.map((round) => renderRound(session, round)).join("")}
                ${renderChampion(champion)}
              </div>
            </div>
            ${renderCloser(session)}`
      }
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
load();
