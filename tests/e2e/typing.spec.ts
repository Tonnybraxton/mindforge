import { expect, test } from '@playwright/test';

test('academy first lesson updates XP, weak keys, records, and the next lesson', async ({ page }) => {
  await page.goto('/typing');
  await expect(page.getByRole('heading', { name: 'Find your rhythm.Make every key count.' })).toBeVisible();
  await page.getByRole('link', { name: 'Start with F & J' }).click();
  await page.getByRole('button', { name: 'Begin typing', exact: true }).click();
  const text = await page.locator('.typing-passage .sr-only').textContent();
  const field = page.getByLabel('Typing exercise input', { exact: true }); await expect(field).toBeFocused();
  await field.pressSequentially('x', { delay: 100 }); await field.press('Backspace');
  await field.pressSequentially(text!, { delay: 250 });
  await expect(page.getByRole('heading', { name: 'A little more fluent.' })).toBeVisible();
  await expect(page.locator('.typing-result-main')).toContainText(/\+[1-9]/);
  await page.getByRole('link', { name: 'View progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Keyboard mastery', exact: true })).toBeVisible();
  await expect(page.locator('.typing-table').first().locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: /^F, Left index/ }).click();
  await expect(page.locator('.key-detail')).toContainText('attempts');
  await page.goto('/typing/lessons');
  await expect(page.locator('.typing-lesson').nth(1)).toHaveAttribute('aria-disabled', 'false');
  await page.goto('/workout');
  await expect(page.getByText('Typing Academy', { exact: true }).last()).toBeVisible();
});

test('code indentation stays scoped, practice pauses, settings persist, and bulk input earns no XP', async ({ page }) => {
  await page.goto('/typing/train?mode=code&language=Python&indentation=tab&duration=0&seed=browser-code');
  await page.getByRole('button', { name: 'Begin typing', exact: true }).click();
  const field = page.getByLabel('Typing exercise input', { exact: true });
  const text = await page.locator('.typing-passage .sr-only').textContent();
  const tab = text!.indexOf('\t'); expect(tab).toBeGreaterThan(0);
  for (const key of text!.slice(0, tab)) await field.pressSequentially(key, { delay: 20 });
  await field.press('Tab'); await expect(field).toBeFocused(); await expect(field).toHaveValue(text!.slice(0, tab + 1));
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(field).toBeDisabled();
  await page.getByRole('button', { name: 'Continue typing', exact: true }).click();
  await expect(field).toBeFocused();
  await field.press('Escape'); await expect(field).toBeDisabled();
  await page.getByRole('button', { name: 'Exercise settings', exact: true }).click();
  await page.getByLabel('Caret', { exact: true }).selectOption('block');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Continue typing', exact: true }).click();
  await expect(page.locator('.typing-passage')).toHaveClass(/caret-block/);
  await page.goto('/typing/train?mode=words&wordCount=10&duration=0&seed=bulk-test');
  await page.getByRole('button', { name: 'Begin typing', exact: true }).click();
  await field.fill((await page.locator('.typing-passage .sr-only').textContent())!);
  await expect(page.locator('.typing-result-main')).toContainText('+0');
  await expect(page.getByRole('status').filter({ hasText: 'Bulk input' })).toBeVisible();
});

test('timed tests complete, arcade impacts end play, and memory hides guidance', async ({ page }) => {
  await page.clock.install();
  await page.goto('/typing/train?duration=15&seed=timed-browser');
  await page.getByRole('button', { name: 'Begin typing', exact: true }).click();
  const field = page.getByLabel('Typing exercise input', { exact: true });
  const text = (await page.locator('.typing-passage .sr-only').textContent())!.slice(0, 20);
  for (const char of text) { await page.clock.runFor(300); await field.pressSequentially(char); }
  await page.clock.runFor(15000);
  await expect(page.getByRole('heading', { name: 'A little more fluent.' })).toBeVisible();
  await page.goto('/typing/train?mode=falling&duration=60&seed=falling-browser');
  await page.getByRole('button', { name: 'Begin typing', exact: true }).click();
  await expect(page.locator('.arcade-hud')).toContainText('3 LIVES');
  await page.clock.runFor(60000);
  await expect(page.getByRole('heading', { name: 'Accuracy comes with practice.' })).toBeVisible();
  await page.goto('/typing/train?mode=memory&duration=0&seed=memory-browser');
  await page.getByRole('button', { name: 'Begin typing', exact: true }).click();
  await expect(field).toBeDisabled();
  await page.clock.runFor(5500);
  await expect(field).toBeEnabled();
  await expect(page.locator('.typing-passage')).toHaveAttribute('aria-label', 'Passage hidden for recall');
  await expect(page.getByRole('group', { name: 'QWERTY finger guide' })).toHaveCount(0);
});

test('academy routes stay usable without page overflow and campaign locks are real', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/typing', '/typing/lessons', '/typing/practice', '/typing/code', '/typing/campaign', '/typing/workout', '/typing/arcade', '/typing/races', '/typing/leaderboards', '/typing/statistics']) {
    await page.goto(path); await expect(page.locator('.typing-tabs')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), path).toBe(true);
  }
  await page.goto('/typing/campaign');
  await expect(page.getByRole('link', { name: 'Home Row Plains level 2, locked', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await page.goto('/typing/train?region=home-row-plains&level=2');
  await expect(page.getByRole('button', { name: 'Begin typing', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
  await page.goto('/typing');
  await page.screenshot({ path: `test-results/typing-academy-${test.info().project.name}.png`, fullPage: true });
});
