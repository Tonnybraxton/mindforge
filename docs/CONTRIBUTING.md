# Contributing

Read the architecture and game-engine documents before changing shared contracts. Keep new work small enough to review and preserve existing playable behavior. The original brief is the long-term product direction; current registry entries must represent complete games.

Use strict TypeScript, typed game state and pure deterministic reducers. Keep reusable controls and boards separate from network and persistence code. Prefer accessible native controls; every interactive control needs a useful label, visible focus and a keyboard path. Avoid importing secrets, server repositories or private account details into frontend code.

For a game, supply a tutorial, real win/loss behavior, several difficulty levels, accurate metrics, XP/results integration, resume/restart handling, mobile controls and meaningful generator/action tests. Prove solvability for generators that can otherwise create unwinnable boards. Bump the generator version when published seed behavior changes.

For API work, authenticate and authorize each account resource, validate the request shape and derive rewards on the server. Add tests for rejection paths and duplicate submissions. Preserve transaction and unique-constraint guarantees in the persistent repository. Changes to the schema need reviewed migrations and repeatable seed behavior.

Before proposing a change, run lint, type-check, tests and build. Run the relevant browser scenarios when changing a user flow. Report the checks actually run and any infrastructure that was unavailable. Do not describe a planned feature, configured workflow or untested deployment as completed.

Use plain player-facing language about mental exercise and puzzle performance. Do not claim medical effects, guaranteed IQ improvement, fake opponents or fabricated leaderboard activity. Keep the app usable for guests and explain when a connected account service is required.
