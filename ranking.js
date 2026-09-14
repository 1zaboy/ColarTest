export function everyPair(colors) {
  const pairs = [];
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      pairs.push([colors[i], colors[j]]);
    }
  }
  return pairs;
}

export function pickSpacedSteps(shuffle, { start, end, count, minGap = 2 }) {
  const inner = [];
  for (let step = start; step <= end; step += 1) inner.push(step);
  for (let attempt = 0; attempt < 220; attempt += 1) {
    const picked = shuffle(inner)
      .slice(0, count)
      .sort((left, right) => left - right);
    const spaced = picked.every(
      (step, index) => index === 0 || step - picked[index - 1] >= minGap,
    );
    if (spaced && picked.length === count) return picked;
  }
  if (count <= 1) return [Math.round((start + end) / 2)];
  const span = end - start;
  return Array.from(
    { length: count },
    (_, index) => start + Math.round((span * index) / (count - 1)),
  );
}

function resultSides(row) {
  return {
    left: row.left_color ?? row.left?.id ?? row.left,
    right: row.right_color ?? row.right?.id ?? row.right,
    winner: row.chosen_color ?? row.winner?.id ?? row.winner,
  };
}

export function rankTargetIds(ids, results, canonicalize = (id) => id) {
  const wins = Object.fromEntries(ids.map((id) => [id, 0]));
  const played = [];
  for (const row of results ?? []) {
    const left = canonicalize(resultSides(row).left);
    const right = canonicalize(resultSides(row).right);
    const winner = canonicalize(resultSides(row).winner);
    if (!ids.includes(left) || !ids.includes(right) || wins[winner] == null) continue;
    wins[winner] += 1;
    played.push({ left, right, winner });
  }

  function h2h(a, b) {
    return played.find(
      (row) =>
        (row.left === a && row.right === b) || (row.left === b && row.right === a),
    )?.winner;
  }

  function groupWins(id, group) {
    return played.filter((row) => {
      if (row.winner !== id) return false;
      const opp = row.left === id ? row.right : row.right === id ? row.left : null;
      return group.includes(opp);
    }).length;
  }

  function sos(id) {
    let score = 0;
    for (const row of played) {
      const opp = row.left === id ? row.right : row.right === id ? row.left : null;
      if (opp) score += wins[opp] ?? 0;
    }
    return score;
  }

  const ranked = [...ids].sort((a, b) => {
    if (wins[b] !== wins[a]) return wins[b] - wins[a];
    const direct = h2h(a, b);
    if (direct === a) return -1;
    if (direct === b) return 1;
    const tied = ids.filter((id) => wins[id] === wins[a]);
    const groupDelta = groupWins(b, tied) - groupWins(a, tied);
    if (groupDelta !== 0) return groupDelta;
    return sos(b) - sos(a);
  });

  return { ranked, wins };
}
