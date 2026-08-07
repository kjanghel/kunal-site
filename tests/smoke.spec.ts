import { test, expect } from '@playwright/test';

test('homepage renders identity + CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kunal Janghel' })).toBeVisible();
  await expect(page.getByText('Staff Software Engineer · AI Agents + AppSec').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /email/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /linkedin/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /resume/i }).first()).toBeVisible();
});

test('featured work section shows 3 cards in order', async ({ page }) => {
  await page.goto('/');
  const featured = page.locator('section:has(h2:has-text("featured work"))');
  await expect(featured.locator('a[href^="/projects/"]')).toHaveCount(3);
  await expect(featured).toContainText('MCP Server with RAG');
  await expect(featured).toContainText('Multi-Tenant Migration');
  await expect(featured).toContainText('Kosha');
});

test('all top-level nav pages load', async ({ page }) => {
  for (const path of ['/', '/projects', '/blog', '/about', '/resume']) {
    const response = await page.goto(path);
    expect(response?.status(), `expected 200 at ${path}`).toBe(200);
  }
});

test('every project detail page renders', async ({ page }) => {
  const slugs = ['mcp-rag', 'multi-tenant-migration', 'kosha', 'event-planner', 'passive-scanner', 'nl-clickhouse'];
  for (const slug of slugs) {
    const response = await page.goto(`/projects/${slug}`);
    expect(response?.status(), `expected 200 at /projects/${slug}`).toBe(200);
    await expect(page.locator('article')).toBeVisible();
  }
});

test('resume PDF link points at the expected path', async ({ page }) => {
  await page.goto('/resume');
  const link = page.getByRole('link', { name: /Download resume/i });
  await expect(link).toHaveAttribute('href', '/Kunal_Janghel_Resume.pdf');
});

test('blog empty state renders without breaking', async ({ page }) => {
  await page.goto('/blog');
  await expect(page.getByText(/No posts published yet/i)).toBeVisible();
});

test('theme toggle switches document theme attribute', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /Switch to light mode/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
