# MINDFORGE — ADVANCED BRAIN TRAINING & PUZZLE GAME PLATFORM

## MASTER CODEX DEVELOPMENT PROMPT

You are acting as a senior game developer, full-stack engineer, UI/UX designer, game systems designer, database architect, QA engineer, accessibility specialist, and DevOps engineer.

Your task is to design and build a complete, production-quality brain-training game platform called:

# MindForge

MindForge is a large-scale cognitive puzzle and brain-training platform containing many different games that exercise:

- Memory
- Logic
- Attention
- Concentration
- Mental mathematics
- Language
- Pattern recognition
- Spatial reasoning
- Strategic planning
- Problem solving
- Processing speed
- Visual reasoning
- Deductive reasoning

The application must NOT claim to cure, diagnose, prevent, or treat medical or neurological conditions.

Use wording such as:

- Mental exercise
- Cognitive challenges
- Brain puzzles
- Memory practice
- Logic training
- Problem-solving exercises

Do not market the application as scientifically guaranteed to increase IQ or prevent dementia.

---

# 1. CORE PRODUCT VISION

MindForge should feel like a combination of:

- A premium puzzle game
- A brain-training application
- A progression-based adventure
- A competitive challenge platform
- A personal performance tracker

The user should feel that they are progressing through an enormous world of increasingly difficult challenges rather than simply opening isolated mini-games.

The game must have enough content, procedural generation, difficulty scaling, achievements, campaigns, challenges, and game modes to remain interesting for several months of regular use.

---

# 2. PRIMARY PLATFORM

Build MindForge primarily as a responsive web application and Progressive Web App.

It must work well on:

- Desktop
- Laptop
- Tablet
- Android browser
- iPhone browser

The architecture should allow later conversion into a native mobile application.

---

# 3. RECOMMENDED TECHNOLOGY STACK

Use the following architecture unless a technically superior alternative is clearly justified.

## Frontend

- React
- TypeScript
- Vite
- React Router
- Zustand
- TanStack Query
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Lucide React
- Recharts
- React Hook Form
- Zod

Use Phaser where appropriate for mini-games requiring:

- Canvas rendering
- Animation
- Timers
- Physics
- Sprite interactions

Use standard React components where Phaser is unnecessary.

---

## Backend

Use:

- Node.js
- Express
- TypeScript

Alternative acceptable:

- NestJS

Use a clean service-oriented architecture.

---

## Database

Use:

- PostgreSQL

ORM:

- Prisma

---

## Caching

Use:

- Redis

Redis may handle:

- Leaderboards
- Active sessions
- Daily challenge caching
- Rate limiting
- Temporary game state
- Matchmaking data

---

## Authentication

Use:

- JWT access tokens
- Refresh tokens
- Secure HTTP-only cookies where appropriate
- bcrypt or Argon2 for passwords

Support:

- Email/password registration
- Guest mode
- Google login architecture placeholder
- Account upgrade from guest to registered user

---

# 4. APPLICATION STYLE

The product should look premium, modern, energetic, intelligent, and slightly futuristic.

Avoid childish educational-game styling.

Use a visual direction inspired by:

- Modern game dashboards
- Premium fitness applications
- Modern learning platforms
- Futuristic neuroscience interfaces
- Clean gaming HUD systems

---

# 5. DESIGN LANGUAGE

Use a sophisticated visual system.

Recommended characteristics:

- Dark/light theme
- Glass surfaces used sparingly
- Subtle gradients
- Soft depth
- Large readable typography
- Rounded cards
- Smooth animations
- Animated progress indicators
- Achievement effects
- Progress rings
- Interactive charts
- Micro-interactions

Do not overload the interface.

Accessibility must remain a priority.

---

# 6. MAIN NAVIGATION

Desktop sidebar:

- Home
- Brain Journey
- Games
- Daily Workout
- Daily Challenge
- Campaign
- Multiplayer
- Leaderboards
- Achievements
- Statistics
- Profile
- Settings

Mobile:

Use a bottom navigation bar for primary areas.

Suggested bottom navigation:

- Home
- Games
- Workout
- Progress
- Profile

---

# 7. HOME DASHBOARD

The home dashboard should display:

## Welcome area

Example:

"Good afternoon, Alex."

"Ready to challenge your mind?"

---

## Overall Brain Score

Display:

Brain Score: 782

Rank:

Advanced Thinker

---

## Cognitive Scores

Separate scores for:

- Memory
- Logic
- Focus
- Math
- Language
- Spatial
- Speed
- Strategy

Example:

Memory: 81

Logic: 87

Focus: 74

Math: 91

Language: 69

Spatial: 84

Speed: 78

Strategy: 82

Use animated charts.

---

## Daily Workout Card

Show:

Daily Brain Workout

Estimated time:

10 minutes

Games:

5

Difficulty:

Adaptive

Button:

Start Workout

---

## Daily Challenge

Example:

"Complete today's Expert Nonogram."

---

## Streak

Example:

17 Day Training Streak

---

## XP Progress

Level 27

3,480 / 4,000 XP

---

## Recent Performance

Display:

- Games completed
- Accuracy
- Average reaction time
- Highest score
- Improvements
- Personal records

---

# 8. BRAIN JOURNEY

Create a long campaign system called:

# The MindForge Journey

The campaign should contain multiple worlds.

Each world represents a cognitive skill.

---

# 9. CAMPAIGN WORLDS

Create at least:

## World 1 — Memory Valley

Focus:

Memory

Levels:

100+

---

## World 2 — Logic Citadel

Focus:

Deduction and reasoning

Levels:

120+

---

## World 3 — Numbers Nexus

Focus:

Mental mathematics

Levels:

100+

---

## World 4 — Language Kingdom

Focus:

Vocabulary and verbal reasoning

Levels:

100+

---

## World 5 — Spatial Realm

Focus:

Spatial awareness

Levels:

100+

---

## World 6 — Focus District

Focus:

Attention and concentration

Levels:

100+

---

## World 7 — Strategy Summit

Focus:

Planning

Levels:

100+

---

## World 8 — Speed Circuit

Focus:

Reaction and information processing

Levels:

100+

---

## World 9 — Pattern Dimension

Focus:

Patterns and visual reasoning

Levels:

100+

---

## World 10 — Grandmaster Realm

Contains mixed elite challenges.

Levels:

200+

---

The campaign should therefore support more than:

# 1,000 campaign challenges.

Do NOT manually hardcode 1,000 puzzles.

Build procedural puzzle generators wherever possible.

---

# 10. GAME CATEGORIES

Create the following primary game categories.

---

# MEMORY GAMES

## Game 1 — Memory Cards

Cards are shown face-down.

Player must find matching pairs.

Difficulty variables:

- Number of cards
- Reveal duration
- Similarity between images
- Time limit
- Number of allowed mistakes

Levels:

4 cards

8 cards

12 cards

16 cards

20 cards

24 cards

36 cards

48 cards

---

# Game 2 — Sequence Recall

Show a sequence of highlighted tiles.

Player repeats the sequence.

Example:

1 → 4 → 3 → 7

Sequence becomes longer after successful rounds.

Difficulty parameters:

- Sequence length
- Speed
- Grid size
- Distractors

---

# Game 3 — Number Memory

Display:

4386291

Hide after several seconds.

Player must type it correctly.

Scale from:

3 digits

to

20+ digits.

---

# Game 4 — Word Memory

Display a set of words briefly.

Later ask:

"Which words appeared?"

Include decoy words.

---

# Game 5 — Position Memory

Objects briefly appear on a grid.

Hide them.

Player must click their previous locations.

---

# Game 6 — N-Back Challenge

Display sequences of:

- Shapes
- Letters
- Numbers
- Positions

Player decides whether current stimulus matches one shown N steps earlier.

Support:

1-back

2-back

3-back

4-back

---

# LOGIC GAMES

# Game 7 — Sudoku

Support:

4×4

6×6

9×9

Difficulty:

Beginner

Easy

Medium

Hard

Expert

Master

Generate valid Sudoku puzzles algorithmically.

Implement uniqueness checking.

---

# Game 8 — Nonogram

Use numerical clues to reveal pixel images.

Grid sizes:

5×5

10×10

15×15

20×20

25×25

---

# Game 9 — Minesweeper

Grid configurations:

Beginner

Intermediate

Expert

Custom

Add:

- Flags
- Timer
- First-click protection
- Statistics

---

# Game 10 — Logic Grid

Example puzzle:

Four people own four different pets.

Use textual clues to deduce correct relationships.

Build reusable clue-generation architecture.

---

# Game 11 — Code Breaker

Mastermind-style puzzle.

Player guesses a secret sequence.

Feedback indicates:

- Correct item in correct position
- Correct item in wrong position

---

# Game 12 — Lights Out

Clicking one tile changes nearby tiles.

Goal:

Turn every light off.

---

# MATHEMATICS GAMES

# Game 13 — Mental Math Rush

Generate equations using:

- Addition
- Subtraction
- Multiplication
- Division
- Percentages
- Fractions

Difficulty automatically increases.

---

# Game 14 — Missing Number

Example:

2, 4, 8, 16, ?

Answer:

32

Use:

- Arithmetic sequences
- Geometric sequences
- Alternating patterns
- Composite sequences

---

# Game 15 — Equation Builder

Example:

3 ? 4 ? 2 = 14

Player inserts mathematical operators.

---

# Game 16 — Kakuro

Implement authentic Kakuro puzzle rules.

Include procedural generation.

---

# Game 17 — Number Target

Example:

Numbers:

3, 7, 10, 25

Target:

124

Player combines numbers and operations.

---

# LANGUAGE GAMES

# Game 18 — Word Connect

Player draws between letters to create valid words.

Generate puzzle sets from a dictionary.

---

# Game 19 — Anagram Challenge

Example:

RAEHT

Answer:

EARTH

Support:

Timed

Untimed

Daily challenge

---

# Game 20 — Word Search

Generate grids containing hidden words.

Words may appear:

Horizontal

Vertical

Diagonal

Backward

---

# Game 21 — Crossword

Create a reusable crossword engine.

Support:

Mini crossword

Standard crossword

Daily crossword

---

# Game 22 — Vocabulary Challenge

Ask player to:

- Match definitions
- Identify synonyms
- Identify antonyms
- Complete sentences

---

# SPATIAL GAMES

# Game 23 — Maze Runner

Procedurally generate mazes.

Algorithms may include:

- Recursive backtracking
- Prim's algorithm
- Kruskal's algorithm

Game modes:

- Relaxed
- Timed
- Limited visibility
- Shortest-path challenge

---

# Game 24 — Shape Rotation

Show rotated shapes.

Ask player to identify matching orientation.

---

# Game 25 — Mental Rotation

Show 3D-like objects.

Player determines whether objects represent the same shape rotated.

---

# Game 26 — Sliding Puzzle

Support:

3×3

4×4

5×5

Image mode.

Number mode.

---

# Game 27 — Jigsaw

Use generated or licensed images.

Difficulty:

12 pieces

24

48

100

200+

---

# STRATEGY GAMES

# Game 28 — Sokoban

Push crates onto target positions.

Include:

- Undo
- Reset
- Move counter
- Minimum-move challenge

---

# Game 29 — Tower of Hanoi

Support:

3–10 disks.

Measure:

Moves

Time

Efficiency

---

# Game 30 — Water Sort

Colored liquids must be sorted into containers.

Difficulty should scale significantly.

---

# Game 31 — Flow Connect

Connect matching endpoints.

Paths cannot cross.

Fill entire board.

---

# Game 32 — Traffic Escape

Vehicles block a target vehicle.

Player moves cars to escape.

Generate levels algorithmically or from validated level libraries.

---

# FOCUS & ATTENTION GAMES

# Game 33 — Stroop Challenge

Example:

Word:

RED

Displayed in:

Blue

Ask player to select:

Blue

Track reaction speed and accuracy.

---

# Game 34 — Spot the Difference

Show two similar scenes.

Player identifies differences.

---

# Game 35 — Target Tracking

Multiple moving objects appear.

Several are highlighted.

Highlights disappear.

Player must track the original targets.

---

# Game 36 — Visual Search

Example:

Find:

Q

Among:

OOOOOOOOOO

Or identify rotated symbols among distractors.

---

# Game 37 — Attention Switch

Game rules change rapidly.

Example:

Round 1:

Select largest number.

Round 2:

Select smallest.

Round 3:

Select odd number.

---

# PROCESSING SPEED

# Game 38 — Reaction Test

React when stimulus changes.

Track milliseconds.

Prevent premature tapping.

---

# Game 39 — Symbol Match

Match symbols quickly.

Increase complexity.

---

# Game 40 — Rapid Comparison

Display two quantities or patterns.

Player determines which is greater or whether they match.

---

# PATTERN RECOGNITION

# Game 41 — Pattern Matrix

Create Raven-like visual reasoning puzzles using original generated designs.

Do not copy copyrighted question banks.

Player determines missing pattern.

---

# Game 42 — Shape Sequence

Example:

Circle

Triangle

Circle

Triangle

?

---

# Game 43 — Color Pattern

Patterns combine:

Color

Shape

Rotation

Position

Size

---

# Game 44 — Odd One Out

Display several similar objects.

Player finds the one violating the pattern.

---

# ADVANCED PUZZLES

# Game 45 — Laser Mirrors

Player rotates mirrors.

Laser must reach target.

Include:

- Splitters
- Multiple colors
- Reflectors
- Barriers
- Multiple targets

---

# Game 46 — Circuit Builder

Connect electrical components correctly.

Components:

Battery

Wire

Switch

Lamp

Resistor

Gate

Use game logic, not dangerous real-world electrical instruction.

---

# Game 47 — Pipe Connect

Rotate pipe pieces until network is complete.

---

# Game 48 — Bridge Logic

Build simplified puzzle bridges using constraints.

Focus on logical placement rather than realistic engineering simulation.

---

# Game 49 — Escape Room

Create multiple virtual rooms.

Players must discover:

- Keys
- Codes
- Hidden symbols
- Object combinations
- Number puzzles
- Pattern clues

Build a reusable escape-room puzzle engine.

---

# Game 50 — Detective Cases

Create fictional mystery scenarios.

Player receives:

- Statements
- Timelines
- Evidence
- Locations
- Witness accounts

Player determines:

- Who is lying
- What happened
- Correct sequence of events

Cases must be fictional.

---

# 11. PROCEDURAL PUZZLE GENERATION

A major requirement is replayability.

Create puzzle generators for games where possible.

Generated puzzles must be:

- Solvable
- Valid
- Appropriately difficult
- Reproducible using seeds

Store:

puzzleSeed

difficulty

generatorVersion

Allow debugging by replaying a specific seed.

---

# 12. DIFFICULTY SYSTEM

Create difficulty levels:

1. Beginner
2. Easy
3. Normal
4. Challenging
5. Hard
6. Expert
7. Master
8. Grandmaster

Each game must define difficulty parameters.

Example:

Memory Cards:

Beginner:

6 cards

Master:

36 cards with similar visual designs.

---

# 13. ADAPTIVE DIFFICULTY ENGINE

Create a system that evaluates performance.

Inputs may include:

- Accuracy
- Completion time
- Mistakes
- Hints
- Consecutive wins
- Previous difficulty
- Long-term performance

Example:

If:

Accuracy > 90%

AND

Completion time better than target

THEN

difficulty += 1

If:

Accuracy < 50%

THEN

difficulty -= 1

Avoid changing difficulty too aggressively.

Use moving averages.

---

# 14. DAILY BRAIN WORKOUT

Create a personalized daily workout.

Default:

10 minutes.

Workout structure:

2 minutes Memory

2 minutes Logic

2 minutes Focus

2 minutes Math

2 minutes Spatial

Allow users to select:

5 minute

10 minute

15 minute

20 minute

30 minute

sessions.

---

# 15. SMART WORKOUT GENERATOR

The system should prioritize weaker categories.

Example:

Memory: 91

Logic: 87

Focus: 61

Spatial: 67

Workout should contain more:

Focus

Spatial

challenges.

---

# 16. DAILY CHALLENGE

Generate one special challenge per day.

All players receive the same daily challenge.

Store:

Date

Game

Seed

Difficulty

Leaderboard

---

# 17. WEEKLY CHALLENGE

Create larger challenges each week.

Example:

Complete:

20 puzzles

with

85%+ accuracy.

Rewards:

XP

Coins

Achievement

Profile badge

---

# 18. XP SYSTEM

Players gain XP for:

- Completing puzzles
- Difficulty
- Accuracy
- Speed
- Daily streaks
- Achievements

Suggested formula:

Base XP × difficulty multiplier × performance multiplier.

---

# 19. PLAYER LEVELS

Level range:

1–100+

Example titles:

1–5:

Beginner

6–10:

Learner

11–20:

Problem Solver

21–30:

Analyst

31–40:

Strategist

41–50:

Expert

51–65:

Master Thinker

66–80:

Grandmaster

81–99:

Mind Architect

100:

MindForge Legend

---

# 20. RANKING SYSTEM

Create competitive divisions:

Bronze

Silver

Gold

Platinum

Diamond

Master

Grandmaster

Legend

---

# 21. COINS

Virtual coins may be earned through gameplay.

Coins can purchase:

- Cosmetic themes
- Profile frames
- Avatar items
- Puzzle backgrounds
- Cosmetic animations

Do not implement gambling mechanics.

---

# 22. ACHIEVEMENTS

Create at least 100 achievement definitions.

Examples:

First Steps

Complete first puzzle.

Memory Master

Complete 100 memory puzzles.

Perfect Focus

Complete Focus challenge without mistakes.

Speed Demon

Reaction time below specified threshold.

Sudoku Master

Complete Expert Sudoku.

Seven-Day Streak

Train for seven consecutive days.

Hundred Club

Complete 100 daily workouts.

Grandmaster

Reach Grandmaster difficulty.

---

# 23. BADGES

Create visual badges for achievements.

Badge categories:

Memory

Logic

Speed

Language

Mathematics

Strategy

Streaks

Campaign

Mastery

---

# 24. PERSONAL RECORDS

Track:

Fastest Sudoku

Longest memory sequence

Best reaction time

Highest math streak

Best maze completion

Longest training streak

Highest accuracy

Most puzzles completed in one day

---

# 25. PLAYER STATISTICS

Create comprehensive statistics.

Track per game:

Times played

Games completed

Games failed

Best score

Average score

Average time

Accuracy

Current difficulty

Highest difficulty

Improvement over time

---

# 26. COGNITIVE PERFORMANCE DASHBOARD

Display charts for:

Memory

Logic

Attention

Math

Language

Spatial

Speed

Strategy

Time periods:

7 days

30 days

90 days

All time

Clearly state:

"Scores reflect performance within MindForge games and are not medical assessments."

---

# 27. BRAIN SCORE

Generate an internal MindForge score from gameplay.

Example:

Memory 82

Logic 89

Focus 73

Math 91

Language 76

Spatial 85

Speed 79

Strategy 87

MindForge Score:

83

This should represent in-game performance only.

---

# 28. STREAK SYSTEM

Track:

Daily activity.

Reward:

3 days

7 days

14 days

30 days

60 days

100 days

365 days

Include optional streak freeze rewards.

---

# 29. CAMPAIGN PROGRESSION

Campaign levels should unlock progressively.

Example:

Level 1

↓

Level 2

↓

Level 3

↓

Boss Challenge

↓

Next Zone

---

# 30. BOSS PUZZLES

At the end of campaign chapters, create boss challenges combining several skills.

Example:

Memory challenge

↓

Logic challenge

↓

Reaction challenge

↓

Pattern challenge

One mistake may reduce health/score but should not necessarily restart everything.

---

# 31. PLAYER HEALTH/LIVES

Campaign mode may use:

3 energy hearts.

Incorrect solutions may remove one heart.

Alternative:

Use score penalties rather than forced waiting.

Do not design manipulative energy systems that force payments.

---

# 32. MULTIPLAYER

Create optional multiplayer architecture.

Modes:

Quick Match

Ranked Match

Friends Challenge

Tournament

---

# 33. MULTIPLAYER GAME TYPES

Suitable games:

Mental Math Race

Word Race

Pattern Race

Memory Duel

Sudoku Sprint

Reaction Battle

Maze Race

Code Breaker

---

# 34. REAL-TIME MATCHES

Use WebSockets.

Potential technology:

Socket.IO

Match lifecycle:

Queue

↓

Match found

↓

Countdown

↓

Challenge

↓

Results

↓

Rating update

---

# 35. FRIEND SYSTEM

Players should be able to:

Add friends

Accept requests

Challenge friends

Compare statistics

View leaderboard position

---

# 36. LEADERBOARDS

Leaderboards:

Daily

Weekly

Monthly

All-time

Friends

Country

Global

Game-specific

---

# 37. ANTI-CHEAT

Server must validate important scores.

Never trust client-submitted:

Completion time

Correct answers

Rewards

XP

Leaderboard scores

Validate where possible server-side.

---

# 38. GAME SESSION MODEL

Each game session should record:

sessionId

userId

gameType

difficulty

seed

startedAt

completedAt

score

accuracy

mistakes

hintsUsed

completionTime

xpEarned

isDailyChallenge

---

# 39. USER PROFILE

Profile should contain:

Username

Avatar

Level

XP

Rank

Achievements

Joined date

Training streak

Favorite game

Best cognitive category

Total puzzles solved

---

# 40. ONBOARDING

First-time users complete a short assessment.

Assessment should contain:

Memory

Logic

Math

Focus

Spatial

Reaction

Around:

6–10 minutes.

Use results to determine starting difficulty.

Allow skipping.

---

# 41. GUEST MODE

Users may play without registration.

Guest progress stored locally.

Prompt account creation only when useful.

Allow migration of guest progress after account creation.

---

# 42. SOUND DESIGN

Create a reusable sound system.

Sounds:

Correct answer

Incorrect answer

Level complete

Achievement unlocked

Countdown

Button interaction

Combo

Victory

Allow complete muting.

---

# 43. MUSIC

Optional background tracks.

Users must control:

Music volume

Sound effects volume

Mute

Do not bundle copyrighted commercial music.

---

# 44. GAME FEEDBACK

Correct answer:

Subtle positive animation.

Incorrect:

Short visual indication.

Avoid overly harsh failure feedback.

---

# 45. COMBOS

Some games should support:

Correct streak multipliers.

Example:

5 correct

2× XP

10 correct

3× XP

---

# 46. HINT SYSTEM

Hints may be available.

Track usage.

Hints may slightly reduce score.

Never make puzzles impossible without paid hints.

---

# 47. PAUSE

All appropriate games should allow:

Pause

Resume

Restart

Quit

---

# 48. TUTORIALS

Every game must have an interactive tutorial.

Explain:

Objective

Controls

Example

Scoring

Difficulty

---

# 49. ACCESSIBILITY

Support:

Keyboard navigation

ARIA labels

Screen-reader-friendly menus where practical

High contrast mode

Reduced motion

Large text

Color blindness options

Do not rely solely on color.

---

# 50. SETTINGS

Settings sections:

Gameplay

Audio

Visual

Accessibility

Notifications

Account

Privacy

---

# 51. THEMES

Include:

Dark

Light

Midnight

Ocean

Forest

Cosmic

Minimal

Allow additional cosmetic themes.

---

# 52. NOTIFICATIONS

Optional browser notifications:

Daily workout reminder

Streak reminder

Weekly challenge

Friend challenge

Allow opt-out.

---

# 53. DATABASE DESIGN

Create Prisma schemas for at least:

User

Profile

GameDefinition

GameSession

GameScore

CognitiveScore

Achievement

UserAchievement

Badge

UserBadge

DailyChallenge

ChallengeAttempt

CampaignWorld

CampaignLevel

CampaignProgress

LeaderboardEntry

Friendship

FriendChallenge

MultiplayerMatch

Notification

UserSettings

Streak

Reward

InventoryItem

UserInventory

---

# 54. EXAMPLE USER TABLE

User:

id

email

username

passwordHash

role

createdAt

updatedAt

lastLogin

---

# 55. PROFILE TABLE

Profile:

id

userId

avatar

level

xp

coins

rank

brainScore

totalGames

totalPlayTime

---

# 56. GAME SESSION

GameSession:

id

userId

gameId

difficulty

seed

score

accuracy

mistakes

duration

completed

startedAt

completedAt

---

# 57. API DESIGN

Use REST APIs initially.

Example routes:

POST /api/auth/register

POST /api/auth/login

POST /api/auth/logout

POST /api/auth/refresh

GET /api/users/me

PATCH /api/users/me

GET /api/games

GET /api/games/:slug

POST /api/games/:slug/start

POST /api/games/:slug/complete

GET /api/stats/me

GET /api/stats/me/history

GET /api/workouts/today

POST /api/workouts/generate

GET /api/challenges/daily

POST /api/challenges/daily/submit

GET /api/campaign

GET /api/campaign/:world

POST /api/campaign/:level/start

POST /api/campaign/:level/complete

GET /api/leaderboards

GET /api/achievements

GET /api/friends

POST /api/friends/request

POST /api/friends/:id/accept

POST /api/friends/:id/challenge

---

# 58. ADMIN PANEL

Create a secure admin dashboard.

Admins can manage:

Users

Games

Game availability

Difficulty values

Daily challenges

Achievements

XP multipliers

Campaign worlds

Campaign levels

Announcements

Leaderboards

Reports

---

# 59. ANALYTICS

Admin analytics:

DAU

WAU

MAU

Retention

Average session duration

Most played games

Hardest games

Abandonment rate

Average accuracy

Daily challenge participation

---

# 60. GAME ENGINE ARCHITECTURE

Do NOT write every mini-game using unrelated patterns.

Create shared systems.

Example:

GameEngine

ScoringEngine

DifficultyEngine

TimerEngine

AchievementEngine

ProgressEngine

PuzzleGenerator

InputManager

AudioManager

AnalyticsManager

---

# 61. STANDARD GAME INTERFACE

All games should implement a common TypeScript interface.

Conceptually:

interface BrainGame {
  initialize();
  start();
  pause();
  resume();
  reset();
  validateAnswer();
  calculateScore();
  finish();
}

Extend as necessary.

---

# 62. PUZZLE GENERATORS

Create a modular structure.

Example:

src/games/generators/

sudokuGenerator.ts

mazeGenerator.ts

nonogramGenerator.ts

sequenceGenerator.ts

mathGenerator.ts

wordSearchGenerator.ts

patternGenerator.ts

waterSortGenerator.ts

flowGenerator.ts

---

# 63. GAME REGISTRY

Create a centralized registry.

Each game defines:

id

slug

name

category

icon

component

difficulty support

scoring system

tutorial

available modes

---

# 64. FRONTEND STRUCTURE

Suggested:

src/

components/

games/

layouts/

pages/

features/

hooks/

stores/

services/

utils/

types/

assets/

animations/

config/

---

# 65. GAME STRUCTURE

Example:

games/

memory-cards/

MemoryCardsGame.tsx

engine.ts

generator.ts

scoring.ts

difficulty.ts

tutorial.tsx

types.ts

tests/

---

# 66. BACKEND STRUCTURE

server/

src/

modules/

auth/

users/

games/

sessions/

statistics/

achievements/

campaign/

leaderboards/

friends/

multiplayer/

admin/

notifications/

shared/

database/

middleware/

---

# 67. SECURITY

Implement:

Input validation

Rate limiting

Secure headers

CORS configuration

SQL injection protection through ORM

Password hashing

Refresh token rotation

Role-based authorization

Server-side score validation

Audit logging for admins

Environment variables

Do not commit secrets.

---

# 68. ERROR HANDLING

Use standardized API responses.

Example:

{
  "success": false,
  "error": {
    "code": "INVALID_GAME_SESSION",
    "message": "The game session is invalid."
  }
}

---

# 69. LOADING EXPERIENCE

Use:

Skeleton loaders

Smooth transitions

Preloaded essential assets

Lazy-loaded games

Code splitting

---

# 70. PERFORMANCE

Targets:

Fast initial load

Lazy load heavy games

Cache static data

Optimize animations

Avoid unnecessary re-renders

Use memoization responsibly

Compress assets

---

# 71. PWA

Implement:

Installable application

App manifest

Service worker

Offline shell

Cached tutorials

Offline-supported games where possible

Sync results when connectivity returns.

---

# 72. OFFLINE MODE

Allow selected games to work offline.

Examples:

Sudoku

Memory Cards

2048-style optional puzzle

Maze

Mental Math

Sequence Memory

Store results locally and synchronize later.

---

# 73. SAVE SYSTEM

Save:

Game progress

Campaign progress

Settings

Statistics

Daily streak

Achievements

Support auto-save.

---

# 74. GAME RESUME

If the browser closes during a long puzzle:

Allow player to continue when reasonable.

Examples:

Sudoku

Crossword

Nonogram

Jigsaw

---

# 75. TESTING

Use:

Vitest

React Testing Library

Supertest

Playwright

Write tests for:

Authentication

Puzzle generation

Puzzle solvability

Scoring

XP

Achievements

Adaptive difficulty

API validation

Campaign progression

---

# 76. GENERATOR TESTING

Puzzle generator tests must ensure:

Puzzle is valid.

Puzzle is solvable.

Difficulty constraints are respected.

Seed produces deterministic output.

---

# 77. E2E TESTS

Test workflows:

Register

Login

Complete onboarding

Start game

Finish game

Receive XP

Unlock achievement

Complete daily workout

View statistics

---

# 78. RESPONSIVE DESIGN

Test widths:

320px

375px

768px

1024px

1440px

1920px

---

# 79. MOBILE GAME UX

Large tap targets.

Minimal accidental scrolling.

Fullscreen game mode.

Portrait and landscape support where appropriate.

---

# 80. ANIMATIONS

Use Framer Motion.

Implement:

Page transitions

XP animation

Achievement unlock

Level-up celebration

Card flips

Correct-answer feedback

Combo effects

Progress bars

Keep animations smooth and optional.

---

# 81. LEVEL-UP EXPERIENCE

When player levels up:

Display:

LEVEL UP

27 → 28

Rewards:

Coins

Badge progress

Unlocked game

New campaign zone

---

# 82. ACHIEVEMENT EXPERIENCE

Use an animated overlay.

Example:

Achievement Unlocked

MEMORY MASTER

"Complete 100 Memory challenges."

---

# 83. NEW GAME UNLOCKS

Some games unlock through progression.

However:

Core games should remain available early.

Do not create frustrating artificial restrictions.

---

# 84. SEARCH AND FILTER

Games page should allow:

Search

Category filters

Difficulty

Play time

Favorites

Recently played

Recommended

---

# 85. GAME CARDS

Each card displays:

Name

Icon

Category

Difficulty

Personal best

Estimated duration

Play button

---

# 86. FAVORITES

Allow users to favorite games.

Create:

My Games

section.

---

# 87. RECOMMENDATION ENGINE

Recommend games based on:

Weak skills

Favorites

Recent performance

Games not played recently

Current campaign

---

# 88. PERSONALIZED INSIGHTS

Examples:

"Your Logic score improved 8% this month."

"Your fastest reaction time improved by 42 ms."

"You perform best in the morning."

Avoid medical interpretations.

---

# 89. WEEKLY REPORT

Generate:

Games played

Training time

Strongest skill

Most improved skill

Streak

Achievements

Recommended focus

---

# 90. OPTIONAL SOCIAL FEATURES

Allow sharing:

Achievement

Level

Daily challenge result

Do not expose private information.

---

# 91. PRIVACY

Allow user to choose:

Private profile

Friends only

Public leaderboard profile

---

# 92. DATA EXPORT

Allow users to export their gameplay statistics.

---

# 93. ACCOUNT DELETION

Provide account deletion workflow.

---

# 94. DEVELOPMENT PHASES

Do not attempt all 50 games at once.

Use a phased architecture.

---

# PHASE 1 — FOUNDATION

Implement:

Repository

Frontend

Backend

Database

Authentication

Profiles

Navigation

Theme

Dashboard

Game engine

Scoring engine

Difficulty engine

---

# PHASE 2 — FIRST 8 GAMES

Build:

Memory Cards

Sequence Recall

Sudoku

Mental Math

Maze

Sokoban

Stroop

Pattern Matrix

Ensure systems are extensible.

---

# PHASE 3 — PROGRESSION

Implement:

XP

Levels

Campaign

Achievements

Streaks

Brain score

Statistics

---

# PHASE 4 — ADD 12 MORE GAMES

Continue using shared architecture.

---

# PHASE 5 — DAILY SYSTEM

Implement:

Daily Workout

Daily Challenge

Weekly Challenge

Recommendations

---

# PHASE 6 — FULL CONTENT

Expand toward:

40–50 games.

---

# PHASE 7 — SOCIAL

Implement:

Friends

Leaderboards

Challenges

---

# PHASE 8 — MULTIPLAYER

Implement selected real-time competitive games.

---

# PHASE 9 — PWA + OFFLINE

Improve:

Installation

Caching

Offline play

Sync.

---

# PHASE 10 — POLISH

Animations

Audio

Performance

Accessibility

Testing

Analytics

Admin

Security audit

---

# 95. DEVELOPMENT RULES

Follow these rules throughout development.

Never place the entire application inside one giant component.

Never duplicate game-engine logic unnecessarily.

Never hardcode user data.

Never trust game scores sent directly by clients.

Never commit API keys.

Never use copyrighted puzzle banks without permission.

Never silently ignore exceptions.

Never use placeholder buttons that do nothing in the final implementation.

---

# 96. CODE QUALITY

Use:

Strict TypeScript

ESLint

Prettier

Clear interfaces

Reusable components

Service layers

Repository patterns where helpful

Comments only where needed

Self-documenting names

---

# 97. DOCUMENTATION

Create:

README.md

ARCHITECTURE.md

GAME_ENGINE.md

DATABASE.md

API.md

DEVELOPMENT.md

DEPLOYMENT.md

CONTRIBUTING.md

---

# 98. ENVIRONMENT CONFIGURATION

Create:

.env.example

Include variables such as:

DATABASE_URL=

REDIS_URL=

JWT_SECRET=

JWT_REFRESH_SECRET=

CLIENT_URL=

SERVER_URL=

NODE_ENV=

---

# 99. DOCKER

Provide:

Dockerfile frontend

Dockerfile backend

docker-compose.yml

Development services:

frontend

backend

postgres

redis

---

# 100. CI/CD

Create GitHub Actions.

On pull request:

Install

Lint

Type-check

Test

Build

---

# 101. DEPLOYMENT

Prepare architecture for:

Frontend:

Vercel

Netlify

Cloudflare

Backend:

Railway

Render

Fly.io

AWS

Database:

Managed PostgreSQL

---

# 102. FIRST RUN EXPERIENCE

When developer starts project:

docker compose up

should start required infrastructure.

Provide setup instructions.

---

# 103. SEED DATA

Create database seed containing:

Games

Achievements

Campaign worlds

Starter campaign levels

Difficulty definitions

Admin account instructions

---

# 104. INITIAL GAME COUNT

The first production-quality release should contain at least:

20 complete games.

Architecture must already support expansion toward:

50+ games.

---

# 105. LONG-TERM CONTENT

Use procedural generation to enable effectively unlimited challenges for:

Sudoku

Maze

Mental Math

Memory

Word Search

Number Patterns

Flow Connect

Water Sort

Code Breaker

Nonograms where feasible

---

# 106. TARGET RETENTION LOOP

Primary loop:

Open MindForge

↓

Complete Daily Workout

↓

Earn XP

↓

Improve category scores

↓

Unlock campaign levels

↓

Earn achievements

↓

Attempt Daily Challenge

↓

Compare leaderboard

↓

Return tomorrow

---

# 107. USER EXPERIENCE PRIORITY

The application must feel like a real game.

Do NOT make it feel like:

A school worksheet.

A collection of HTML forms.

A basic dashboard with random buttons.

Games must have:

Animations

Feedback

Progression

Scoring

Sound

Achievements

Polished interfaces

---

# 108. FINAL EXPECTED RESULT

The finished platform should ultimately provide:

50 brain and puzzle games

1,000+ campaign challenges

Procedurally generated puzzles

Adaptive difficulty

Daily workouts

Daily challenges

Weekly challenges

XP and level system

Achievements

Streaks

Player profiles

Statistics

Performance graphs

Brain score

Campaign mode

Leaderboards

Friend challenges

Optional multiplayer

PWA support

Offline games

Admin dashboard

Responsive mobile/desktop interface

Accessibility options

Secure backend

Automated testing

Deployment configuration

---

# 109. STARTING INSTRUCTIONS FOR CODEX

Before coding:

1. Inspect the existing repository.

2. Do not destroy functional code.

3. Document the current architecture.

4. Create a development plan.

5. Identify missing dependencies.

6. Build a scalable project structure.

7. Configure database and authentication.

8. Build shared game-engine systems.

9. Implement the dashboard.

10. Implement the first game completely.

The FIRST completed game should be:

Memory Cards.

After Memory Cards works end-to-end, implement:

Sequence Recall

Sudoku

Mental Math Rush

Maze Runner

Sokoban

Stroop Challenge

Pattern Matrix

Do not create 50 unfinished game placeholders.

Prefer:

8 highly polished games

over

50 broken games.

Then progressively add additional games.

---

# 110. DEFINITION OF DONE FOR EACH GAME

A game is NOT complete unless it has:

Working gameplay

Tutorial

Multiple difficulty levels

Scoring

XP integration

Statistics

Personal best

Mobile responsiveness

Pause/restart where appropriate

Sound effects

Accessibility considerations

Automated tests

Error handling

Game history

Campaign integration where applicable

Daily workout compatibility

---

# 111. BUILD ORDER

Begin implementation now using this exact order:

Foundation

↓

Design system

↓

Authentication

↓

Dashboard

↓

Game engine

↓

Memory Cards

↓

Sequence Recall

↓

Sudoku

↓

Mental Math

↓

Maze

↓

Sokoban

↓

Stroop

↓

Pattern Matrix

↓

XP

↓

Achievements

↓

Statistics

↓

Daily Workout

↓

Campaign

↓

Additional games

↓

Leaderboards

↓

Friends

↓

Multiplayer

↓

PWA

↓

Optimization

↓

Production deployment

---

# FINAL REQUIREMENT

Treat MindForge as a serious commercial-quality game platform.

Do not create a tutorial demo.

Do not produce only mockups.

Do not leave major navigation buttons nonfunctional.

Do not sacrifice architecture for speed.

Create reusable systems so new puzzle games can be added with minimal duplication.

The ultimate goal is to turn MindForge into a long-lasting platform where players can continually discover new brain challenges, improve their personal in-game scores, progress through a large campaign, compete with friends, earn achievements, and receive an effectively unlimited supply of procedurally generated puzzles.