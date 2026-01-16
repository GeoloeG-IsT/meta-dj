# Meta-DJ Test Suite

This repository uses **Playwright** for End-to-End (E2E) testing and **Vitest** for Unit/Integration testing.

## Prerequisites

- Node.js (see `.nvmrc`)
- `npm install` to install dependencies

## Setup

1. Copy environment config:
   ```bash
   cp .env.example .env
   ```
2. Install browsers:
   ```bash
   npx playwright install
   ```

## Running Tests

### End-to-End (Playwright)

- **Run all tests (headless):**
  ```bash
  npm run test:e2e
  ```

- **Run tests with UI mode (recommended for local dev):**
  ```bash
  npx playwright test --ui
  ```

- **Run specific test file:**
  ```bash
  npx playwright test tests/e2e/example.spec.ts
  ```

- **Debug mode:**
  ```bash
  npx playwright test --debug
  ```

- **Show report:**
  ```bash
  npx playwright show-report test-results/html
  ```

### Unit/Integration (Vitest)

- **Run unit tests:**
  ```bash
  npm run test:unit
  ```
  *(Note: Script needs to be added to package.json if not present)*

## Project Structure

```
tests/
├── e2e/                      # Playwright E2E tests
├── support/                  # Shared test infrastructure
│   ├── fixtures/             # Test fixtures (data, mocks)
│   ├── helpers/              # Utility functions
│   └── factories/            # Data generation factories
└── README.md                 # This file
```

## Best Practices

1. **Selectors**: Use `data-testid` attributes (e.g., `page.getByTestId('submit-button')`) over CSS/XPath.
2. **Isolation**: Tests should create their own data and clean it up. Use Factories.
3. **Network-First**: Wait for network responses before asserting UI changes to avoid flakiness.
   ```typescript
   const responsePromise = page.waitForResponse('**/api/data');
   await page.getByTestId('submit').click();
   await responsePromise;
   ```
4. **Fixtures**: Use the custom `test` object from `tests/support/fixtures` to access pre-configured fixtures.

## CI/CD

Tests run automatically on pull requests.
- **Artifacts**: Screenshots and traces are retained on failure only.
- **Parallelism**: Tests run in parallel on workers.
