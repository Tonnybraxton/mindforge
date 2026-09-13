import { expect, test, type Page } from '@playwright/test';

test('onboarding, keyboard navigation, and deliberate guest deletion work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start my workout', exact: true }).click();
  await page.getByLabel('What should we call you?').fill('PuzzleExplorer');
  await page.getByLabel('Your daily rhythm').selectOption('5');
  await page.getByRole('button', { name: 'Let’s begin', exact: true }).click();
  await expect(page).toHaveURL('/workout');
  await expect(page.getByLabel('Workout duration')).toHaveValue('5');
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await opener.isVisible()) {
    await opener.click();
    await expect(page.getByRole('dialog', { name: 'MindForge navigation' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
  await page.goto('/settings');
  await expect(page.getByLabel('Explorer name', { exact: true })).toHaveValue('PuzzleExplorer');
  await page.getByRole('button', { name: 'Delete guest progress', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Keep my progress' }).click();
  await expect(page.getByLabel('Explorer name', { exact: true })).toHaveValue('PuzzleExplorer');
  await page.getByRole('button', { name: 'Delete guest progress', exact: true }).click();
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
  await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Explorer name', { exact: true })).toHaveValue('Explorer');
  await expect(page.getByLabel('Daily workout goal')).toHaveValue('10');
});

async function finishMemoryPuzzle(page: Page) {
  const board = page.locator('.memory-grid');
  const known = new Map<number, string>();
  const matched = new Set<number>();
  const count = await board.getByRole('button').count();
  for (let attempt = 0; matched.size < count && attempt < count * 3; attempt++) {
    const available = Array.from({ length: count }, (_, i) => i).filter(i => !matched.has(i));
    const knownPair = available.flatMap((first, i) => available.slice(i + 1)
      .filter(second => known.has(first) && known.get(first) === known.get(second))
      .map(second => [first, second] as const))[0];
    const first = knownPair?.[0] ?? available.find(i => !known.has(i)) ?? available[0];
    const firstCard = board.getByRole('button', { name: new RegExp(`^Card ${first + 1},`) });
    await firstCard.click();
    const symbol = (await firstCard.getAttribute('aria-label'))!.split(', ')[1];
    known.set(first, symbol);
    const second = knownPair?.[1] ?? available.find(i => i !== first && known.get(i) === symbol)
      ?? available.find(i => i !== first && !known.has(i)) ?? available.find(i => i !== first)!;
    const secondCard = board.getByRole('button', { name: new RegExp(`^Card ${second + 1},`) });
    await secondCard.click();
    if (await page.getByRole('heading', { name: 'Nicely done.' }).isVisible()) return;
    const secondLabel = (await secondCard.getAttribute('aria-label'))!;
    known.set(second, secondLabel.split(', ')[1]);
    if (secondLabel.endsWith(', matched')) {
      matched.add(first);
      matched.add(second);
    } else {
      await expect(firstCard).toHaveAttribute('aria-label', `Card ${first + 1}, face down`);
    }
  }
  await expect(page.getByRole('heading', { name: 'Nicely done.' })).toBeVisible();
}

async function navigateUsingMenu(page: Page, label: string) {
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await opener.isVisible()) await opener.click();
  await page.getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('link', { name: label, exact: true }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test('guest completes a puzzle and keeps XP, statistics, and achievements after reload', async ({ page }) => {
  await page.goto('/games/memory-cards?difficulty=1&seed=guest-completion');
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  await finishMemoryPuzzle(page);
  await expect(page.getByText('Saved on this device · local result', { exact: true })).toBeVisible();
  const earned = await page.locator('.result-stats > div').filter({ hasText: 'XP earned' }).locator('strong').textContent();
  expect(Number(earned)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await navigateUsingMenu(page, 'Statistics');
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Memory Cards', exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(earned!);
  await expect(row).toContainText('Local');
  await page.reload();
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(earned!);
  await navigateUsingMenu(page, 'Achievements');
  await page.getByRole('button', { name: 'Unlocked', exact: true }).click();
  await expect(page.locator('article').filter({ has: page.getByRole('heading', { name: 'First steps', exact: true }) })).toContainText('Unlocked');
});

test('unfinished puzzle survives reload and overview resume preserves difficulty and state', async ({ page }) => {
  await page.goto('/games/memory-cards?difficulty=3&seed=resume-specific-puzzle');
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  await page.getByRole('button', { name: 'Card 1, face down', exact: true }).click();
  const revealed = await page.locator('.memory-card').first().getAttribute('aria-label');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A moment to breathe.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume puzzle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume puzzle', exact: true }).click();
  await expect(page.locator('.memory-card').first()).toHaveAttribute('aria-label', revealed!);
  await navigateUsingMenu(page, 'Overview');
  await page.getByRole('link', { name: /Pick up where you left off/ }).click();
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('3');
  await expect(page.getByRole('button', { name: 'Resume puzzle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume puzzle', exact: true }).click();
  await expect(page.locator('.memory-card').first()).toHaveAttribute('aria-label', revealed!);
  await expect(page.locator('.seed-label')).toContainText('resume-specific-puzzle');
});

test('favorites, profile preferences, and a downloaded progress backup persist', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('button', { name: 'Favorite Memory Cards', exact: true }).click();
  await page.getByLabel('Game collection').selectOption('favorites');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Unfavorite Memory Cards', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByLabel('Game collection').selectOption('favorites');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await page.goto('/settings');
  await page.getByLabel('Explorer name', { exact: true }).fill('CuriousPlayer');
  await page.getByLabel('Daily workout goal').selectOption('5');
  await page.getByRole('button', { name: 'ocean', exact: true }).click();
  await page.getByRole('switch', { name: 'Reduced motion', exact: true }).check();
  await page.getByRole('switch', { name: 'High contrast', exact: true }).check();
  await page.getByRole('button', { name: 'Save profile & preferences', exact: true }).click();
  await expect(page.getByText('Your preferences are saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Explorer name', { exact: true })).toHaveValue('CuriousPlayer');
  await expect(page.getByLabel('Daily workout goal')).toHaveValue('5');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean');
  await expect(page.getByRole('switch', { name: 'Reduced motion', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'High contrast', exact: true })).toBeChecked();
  await expectNoHorizontalOverflow(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export browser progress', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('mindforge-progress.json');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(backup.player.name).toBe('CuriousPlayer');
  expect(backup.player.favorites).toEqual(['memory-cards']);
  expect(backup.player.settings.theme).toBe('ocean');
});

test('account registration, verified completion, refresh, sign out, and sign in retain history', async ({ page }, testInfo) => {
  const username = `e2e_${testInfo.workerIndex}_${Date.now().toString(36)}`;
  const email = `${username}@example.test`;
  const password = 'Local-test-passphrase-2026';
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create my account', exact: true }).click();
  await expect(page.getByRole('heading', { name: username, exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(username);
  await page.goto('/games/memory-cards?difficulty=1&seed=account-completion');
  await expect(page.locator('.sidebar-profile')).toContainText(username);
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  await expect(page.locator('.play-stat').filter({ hasText: 'Time' }).locator('strong')).not.toHaveText('00:00');
  await finishMemoryPuzzle(page);
  await expect(page.getByText('Account verified · server elapsed time includes pauses', { exact: true })).toBeVisible();
  await navigateUsingMenu(page, 'Statistics');
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Memory Cards', exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Verified');
  await page.reload();
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Verified');
  await page.getByRole('link', { name: 'Open profile', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(username);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Explorer', exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('form').filter({ has: page.getByLabel('Email', { exact: true }) })
    .locator('button[type=submit]').click();
  await expect(page.getByRole('heading', { name: username, exact: true })).toBeVisible();
  await navigateUsingMenu(page, 'Statistics');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Verified');
});

test('campaign gates levels and preserves campaign context when resuming from overview', async ({ page }) => {
  await page.goto('/campaign/memory-valley');
  await expect(page.getByRole('button', { name: 'Level 2, locked', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Level 1, available', exact: true }).click();
  await page.getByRole('link', { name: 'Enter challenge', exact: true }).click();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  await page.getByRole('button', { name: 'Card 1, face down', exact: true }).click();
  await navigateUsingMenu(page, 'Overview');
  await page.getByRole('link', { name: /Pick up where you left off/ }).click();
  await expect(page.getByText('Memory Valley · Level 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume puzzle', exact: true })).toBeVisible();
});

test('navigation, search, responsive layouts, and unknown routes remain usable', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Explorer');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `docs/mindforge-${testInfo.project.name === 'chromium' ? 'desktop' : 'mobile'}.png`, fullPage: true });
  const destinations = [
    ['All games', 'Your mind’s playground.'],
    ['Daily workout', 'Your daily brain workout.'],
    ['Daily challenge', 'One day. One challenge.'],
    ['Brain journey', 'A world of possibilities.'],
    ['Statistics', 'Look how you’re growing.'],
    ['Achievements', 'Every step deserves a little sparkle.'],
  ];
  for (const [label, heading] of destinations) {
    await navigateUsingMenu(page, label);
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await navigateUsingMenu(page, 'All games');
  await page.getByLabel('Search games', { exact: true }).fill('Sudoku');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Sudoku', exact: true })).toBeVisible();
  await page.getByLabel('Search games', { exact: true }).fill('a-game-that-does-not-exist');
  await expect(page.getByRole('heading', { name: 'A little room for discovery', exact: true })).toBeVisible();
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'A little off the beaten path.', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to overview', exact: true }).click();
  await expect(page).toHaveURL('/');
  expect(errors).toEqual([]);
});

test('every released game opens at its largest difficulty without clipping controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const slugs = ['memory-cards', 'sequence-recall', 'sudoku', 'mental-math', 'maze-runner', 'sokoban', 'stroop-challenge', 'pattern-matrix'];
  for (const slug of slugs) {
    await page.goto(`/games/${slug}?difficulty=8&seed=responsive-board`);
    await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
    await expect(page.locator('.game-board')).toBeVisible();
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('8');
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'How to play', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('installed PWA reloads offline and completes a locally saved puzzle', async ({ page, context }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).some(registration => registration.active !== null))).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByText('You’re offline. Keep playing — progress is saved on this device.', { exact: true })).toBeVisible();
    await navigateUsingMenu(page, 'All games');
    await page.getByRole('link', { name: 'Play Memory Cards', exact: true }).click();
    await page.getByLabel('Difficulty', { exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
    await finishMemoryPuzzle(page);
    await navigateUsingMenu(page, 'Statistics');
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Memory Cards', exact: true }) });
    await expect(row).toContainText('Local');
    await page.reload();
    await expect(row).toHaveCount(1);
  } finally {
    await context.setOffline(false);
  }
});
