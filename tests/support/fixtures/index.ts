import { test as base } from '@playwright/test';
// Import factories here as we create them
// import { UserFactory } from './factories/user-factory';

type TestFixtures = {
  // Add fixture types here
  // userFactory: UserFactory;
};

export const test = base.extend<TestFixtures>({
  // Initialize fixtures here
  /*
  userFactory: async ({}, use) => {
    const factory = new UserFactory();
    await use(factory);
    await factory.cleanup(); 
  },
  */
});

export { expect } from '@playwright/test';
