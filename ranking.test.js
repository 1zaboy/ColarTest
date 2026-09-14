import assert from "node:assert/strict";
import { test } from "node:test";
import { TARGET_IDS } from "./colors.js";
import { everyPair, pickSpacedSteps, playoffPair, rankTargetIds } from "./ranking.js";

test("five shades produce every pairwise meeting", () => {
  const colors = TARGET_IDS.map((id) => ({ id }));
  const keys = everyPair(colors).map(([left, right]) =>
    [left.id, right.id].sort().join("-"),
  );
  assert.equal(keys.length, 10);
  assert.equal(new Set(keys).size, 10);
});

test("spaced steps never sit on first, last, or back-to-back slots", () => {
  const shuffle = (list) => [...list].reverse();
  const steps = pickSpacedSteps(shuffle, {
    start: 3,
    end: 23,
    count: 10,
    minGap: 2,
  });
  assert.equal(steps.length, 10);
  assert.ok(steps[0] >= 3);
  assert.ok(steps.at(-1) <= 23);
  assert.ok(steps.every((step, index) => index === 0 || step - steps[index - 1] >= 2));
});

test("ranking uses head-to-head when two shades have the same wins", () => {
  const results = [
    { left_color: "rose", right_color: "fig", chosen_color: "rose" },
    { left_color: "rose", right_color: "apricot", chosen_color: "rose" },
    { left_color: "rose", right_color: "amber", chosen_color: "rose" },
    { left_color: "rose", right_color: "cranberry", chosen_color: "cranberry" },
    { left_color: "fig", right_color: "apricot", chosen_color: "fig" },
    { left_color: "fig", right_color: "amber", chosen_color: "fig" },
    { left_color: "fig", right_color: "cranberry", chosen_color: "fig" },
    { left_color: "apricot", right_color: "amber", chosen_color: "amber" },
    { left_color: "apricot", right_color: "cranberry", chosen_color: "cranberry" },
    { left_color: "amber", right_color: "cranberry", chosen_color: "amber" },
  ];
  const { ranked, wins } = rankTargetIds(TARGET_IDS, results);
  assert.equal(wins.rose, 3);
  assert.equal(wins.fig, 3);
  assert.equal(ranked[0], "rose");
  assert.equal(ranked[1], "fig");
});

test("4-2-2 in the top three schedules a playoff between the two with 2 wins", () => {
  const results = [
    { left_color: "fig", right_color: "rose", chosen_color: "fig" },
    { left_color: "fig", right_color: "apricot", chosen_color: "fig" },
    { left_color: "fig", right_color: "amber", chosen_color: "fig" },
    { left_color: "fig", right_color: "cranberry", chosen_color: "fig" },
    { left_color: "rose", right_color: "apricot", chosen_color: "rose" },
    { left_color: "rose", right_color: "amber", chosen_color: "rose" },
    { left_color: "rose", right_color: "cranberry", chosen_color: "cranberry" },
    { left_color: "apricot", right_color: "amber", chosen_color: "amber" },
    { left_color: "apricot", right_color: "cranberry", chosen_color: "cranberry" },
    { left_color: "amber", right_color: "cranberry", chosen_color: "amber" },
  ];
  const { wins, ranked } = rankTargetIds(TARGET_IDS, results);
  assert.equal(wins.fig, 4);
  assert.equal(wins[ranked[1]], 2);
  assert.equal(wins[ranked[2]], 2);
  const pair = playoffPair(TARGET_IDS, results);
  assert.deepEqual(new Set(pair), new Set([ranked[1], ranked[2]]));
  assert.ok(!pair.includes("fig"));
});

test("unique 4-3-2 top three does not need a playoff", () => {
  const results = [
    { left_color: "fig", right_color: "rose", chosen_color: "fig" },
    { left_color: "fig", right_color: "apricot", chosen_color: "fig" },
    { left_color: "fig", right_color: "amber", chosen_color: "fig" },
    { left_color: "fig", right_color: "cranberry", chosen_color: "fig" },
    { left_color: "rose", right_color: "apricot", chosen_color: "rose" },
    { left_color: "rose", right_color: "amber", chosen_color: "rose" },
    { left_color: "rose", right_color: "cranberry", chosen_color: "rose" },
    { left_color: "apricot", right_color: "amber", chosen_color: "amber" },
    { left_color: "apricot", right_color: "cranberry", chosen_color: "cranberry" },
    { left_color: "amber", right_color: "cranberry", chosen_color: "amber" },
  ];
  assert.equal(playoffPair(TARGET_IDS, results), null);
});
