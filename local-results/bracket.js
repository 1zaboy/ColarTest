const ROUND_ORDER = ["round_of_16", "quarterfinal", "semifinal", "final"];

export function matchesOf(choices, roundKey) {
  return (choices ?? [])
    .filter((row) => row.round_name === roundKey)
    .sort((a, b) => a.step_index - b.step_index);
}

function titleForCount(count) {
  if (count >= 8) return "1/8 финала";
  if (count === 4) return "1/4 финала";
  if (count === 2) return "1/2 финала";
  if (count === 1) return "Финал";
  return `сетка ${count * 2}`;
}

export function bracketRounds(choices) {
  return ROUND_ORDER.map((key) => {
    const matches = matchesOf(choices, key);
    return {
      key,
      title: titleForCount(matches.length),
      size: matches.length,
      matches,
    };
  }).filter((round) => round.matches.length > 0);
}
