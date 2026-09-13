# Game engine

## Contracts

The engine lives in `shared/games/engine.ts`. It exports `createGame(slug, seed, difficulty)` and `applyAction(state, action)`. `GameState` is a discriminated union keyed by `slug`; each state contains the seed, difficulty, status and metrics. `GameAction` contains a string type and optional index/value. Keep actions serializable and validate them before indexing state.

The generator version is part of the contract. Reproduction requires the same slug, seed, difficulty and generator version. Do not silently alter a released generator while accepting old sessions as though they used the same version. Preserve old implementations or explicitly reject unsupported replay versions.

## State transitions

Reducers produce the next state from a valid action. Completed or lost games stop accepting progress-changing actions. Boards render the state and issue actions; UI animation delays and reveal timers must not create a second source of truth. Gameplay metrics record correctness, attempts, moves and mistakes. Shared reward calculations map terminal metrics, difficulty and duration to score, accuracy and XP.

The API creates account sessions and reconstructs the game from its stored seed. Completion sends the action log, not a trusted client score or XP claim. The service replays the actions, requires an actual win, applies limits, computes the reward and persists it at most once. Local guest results remain unverified.

Deterministic browser games necessarily expose enough state for a modified client to solve them. Replay validation prevents malformed moves, impossible transitions and submitted score forgery; it cannot prove human play or prevent a solver from generating valid actions. Do not market this as cheat-proof competition.

## Generator invariants

- Memory Cards deals complete pairs and tracks matched cards without duplicate rewards.
- Sequence Recall uses deterministic sequences and distinct preview/input phases.
- Sudoku generates size-appropriate boards and verifies a unique solution while removing clues.
- Mental Math generates integer-answer questions and scales operations with difficulty.
- Maze Runner carves connected paths and computes a route to the exit.
- Sokoban starts from solved positions, generates reversible crate arrangements and validates solutions.
- Stroop generates word/ink trials with bounded selectable colors.
- Pattern Matrix combines dot, shape and rotation rules using original generated designs.

## Add a game

1. Add a typed state and deterministic generator. Define all eight difficulty settings and make unsupported inputs safe.
2. Add reducer actions and a terminal win/loss condition. Replaying the same actions must produce the same state.
3. Add a registry entry with category, description, expected duration and a complete tutorial.
4. Add the corresponding board with keyboard controls, mobile controls and useful accessible names.
5. Connect it to the common player flow: pause, restart, persistence, scoring, result history and personal records.
6. Add meaningful invariant, action and solution tests. Verify multiple seeds at every difficulty; prove solvability where it matters.
7. Add campaign/workout availability only after the complete game works. Keep unimplemented games out of playable navigation.

When reporting a bug, include the slug, seed, difficulty, generator version and the action that first produced the wrong behavior. Account replay logs can include puzzle answers; handle them as application data, not private account credentials.
