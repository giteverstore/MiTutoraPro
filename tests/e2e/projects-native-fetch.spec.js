import { expect, test } from '@playwright/test';

const project = {
  projectId: 'bingo', title: 'Bingo', description: 'Build a terminal Bingo game.',
  difficulty: 'Intermediate', category: 'Guided coding project', estimatedMinutes: 60,
  learningOutcomes: ['Build a game'], tags: [], prerequisites: [],
  supportedLanguages: ['python'],
  starterWorkspaces: {
    python: { entrypoint: 'bingo.py', runtimeId: 'python', files: [{ path: 'bingo.py', content: '' }] },
  },
  implementationContracts: [], finalValidators: [], completionBlocks: [],
  checkpoints: [{
    checkpointId: 'bingo-start', order: 1, title: 'Start Bingo', summary: 'Create the game.',
    blocks: [], validators: [], completionBlocks: [],
    tasks: [{
      taskId: 'bingo-task-1', order: 1, title: 'Create the board', objective: 'Print the board.',
      why: 'Start with a visible board.', expectedBehavior: ['The board prints.'],
      blocks: [], implementationContractIds: [], validators: [],
    }],
  }],
};
const document = {
  contentId: 'bingo', contentType: 'PROJECT', schemaVersion: '1.0.0', version: 1,
  status: 'published', locale: 'en', metadata: {}, content: project,
};

test('native browser fetch loads canonical Project catalog and direct route @runtime', async ({ page }) => {
  let catalogRequests = 0;
  let artifactRequests = 0;
  await page.route('**/api/admin-content/public?contentType=PROJECT', async (route) => {
    catalogRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ contentId: 'bingo', activeVersion: 1 }] }) });
  });
  await page.route('**/api/admin-content/public/bingo', async (route) => {
    artifactRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ document }) });
  });

  // Do not install the E2E fetch override: this must exercise the repository default.
  await page.goto('/projects');
  await expect(page.locator('.project-card h3', { hasText: 'Bingo' })).toHaveCount(1);
  await expect(page.locator('.project-card h3')).toHaveCount(6);
  await expect(page.locator('.project-card.is-coming-soon')).toHaveCount(4);
  await expect(page.getByText('Published projects could not be loaded.')).toHaveCount(0);
  expect(catalogRequests).toBeGreaterThan(0);
  expect(artifactRequests).toBeGreaterThan(0);

  await page.goto('/projects/bingo');
  await expect(page.getByRole('heading', { name: 'Bingo', exact: true })).toBeVisible();
  await expect(page.getByText('This project could not be loaded.')).toHaveCount(0);
  expect(artifactRequests).toBeGreaterThan(1);
});
