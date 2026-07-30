# Bracket Engine

Implement the bracket shuffling and advancement logic.

## Core Algorithm
1. Shuffle players randomly across brackets
2. Ensure no same-game duplication (same opponent in different brackets)
3. Option: 50K fairness shuffles for optimal distribution

## Files
- `packages/shared/src/utils/brackets.ts`
- `packages/shared/src/utils/brackets.test.ts`

## Bracket Types
- 8-person forward (game 1: 1v8, 2v7, 3v6, 4v5)
- 8-person reverse (game 1: 1v2, 3v4, 5v6, 7v8)
- Single elimination (bracket tree)
- Double elimination (two trees)
- Eliminator (top X advance each round)

## Payout
- Smart payouts with geometric decay
- Custom per-place overrides
