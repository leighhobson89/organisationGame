import { PUZZLES } from '../content/catalog.js';

const INVENTION_STAGE_ORDER = Object.freeze({
  Dormant: 0,
  'Memory Crystal': 1,
  'Chronology Wheel': 2,
});

function nextInventionStage(currentStage, rewardedStage) {
  const candidate = rewardedStage === 'memory-crystal' ? 'Memory Crystal' : rewardedStage;
  const currentRank = INVENTION_STAGE_ORDER[currentStage] ?? -1;
  const candidateRank = INVENTION_STAGE_ORDER[candidate] ?? -1;
  return candidateRank > currentRank ? candidate : currentStage;
}

/** Plan puzzle rewards without changing the supplied game state. */
export function planPuzzleCompletion({ game, puzzleId } = {}) {
  const solvedPuzzleIds = game?.progress?.solvedPuzzleIds ?? [];
  if (solvedPuzzleIds.includes(puzzleId)) {
    return { ok: false, reason: 'already-solved' };
  }

  const puzzle = PUZZLES.find((entry) => entry.id === puzzleId);
  if (!puzzle) return { ok: false, reason: 'unknown-puzzle' };

  const completedCollectionIds = game?.progress?.completedCollectionIds ?? [];
  const prerequisites = puzzle.requiresCompletedCollectionIds ?? [];
  if (!prerequisites.every((collectionId) => completedCollectionIds.includes(collectionId))) {
    return { ok: false, reason: 'prerequisites-unmet' };
  }

  const unlockedPuzzleIds = game?.progress?.unlockedPuzzleIds ?? [];
  if (!unlockedPuzzleIds.includes(puzzle.id)) {
    return { ok: false, reason: 'not-unlocked' };
  }

  const fromStage = game.inventionStage;
  const toStage = nextInventionStage(fromStage, puzzle.reward?.inventionStage);
  const notebook = game.notebook ?? { discoveries: [] };
  const discoveries = Array.isArray(notebook.discoveries) ? notebook.discoveries : [];
  const clueId = puzzle.reward?.clueId;
  const nextDiscoveries = [...discoveries];
  if (clueId && !nextDiscoveries.includes(clueId)) nextDiscoveries.push(clueId);

  return {
    ok: true,
    fromStage,
    toStage,
    nextGame: {
      ...game,
      progress: {
        ...game.progress,
        solvedPuzzleIds: [...solvedPuzzleIds, puzzle.id],
      },
      inventionStage: toStage,
      notebook: {
        ...notebook,
        discoveries: nextDiscoveries,
      },
    },
  };
}
