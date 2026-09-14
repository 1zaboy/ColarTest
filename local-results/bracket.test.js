import assert from "node:assert/strict";
import { test } from "node:test";
import { bracketRounds } from "./bracket.js";

function choice(roundName, stepIndex) {
  return {
    round_name: roundName,
    step_index: stepIndex,
    left_color: "a",
    right_color: "b",
    left_hex: "#111",
    right_hex: "#222",
    choice: 1,
    chosen_color: "a",
  };
}

test("old 16-color playoff keeps 1/8, 1/4, 1/2 and final", () => {
  const choices = [
    ...Array.from({ length: 8 }, (_, i) => choice("round_of_16", i + 1)),
    ...Array.from({ length: 4 }, (_, i) => choice("quarterfinal", i + 9)),
    ...Array.from({ length: 2 }, (_, i) => choice("semifinal", i + 13)),
    choice("final", 15),
    choice("closer", 16),
  ];

  assert.deepEqual(
    bracketRounds(choices).map((round) => [round.title, round.matches.length]),
    [
      ["1/8 финала", 8],
      ["1/4 финала", 4],
      ["1/2 финала", 2],
      ["Финал", 1],
    ],
  );
});

test("16-color playoff plus extra pairs still labels 1/8 through final", () => {
  const choices = [
    ...Array.from({ length: 8 }, (_, i) => choice("round_of_16", i + 1)),
    ...Array.from({ length: 4 }, (_, i) => choice("quarterfinal", i + 9)),
    ...Array.from({ length: 2 }, (_, i) => choice("semifinal", i + 13)),
    choice("final", 15),
    choice("pair", 5),
    choice("pair", 11),
    choice("pair", 16),
    choice("closer", 19),
  ];

  assert.deepEqual(
    bracketRounds(choices).map((round) => [round.title, round.matches.length]),
    [
      ["1/8 финала", 8],
      ["1/4 финала", 4],
      ["1/2 финала", 2],
      ["Финал", 1],
    ],
  );
});
