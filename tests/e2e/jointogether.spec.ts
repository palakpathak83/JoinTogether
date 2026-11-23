import { expect, test } from '@playwright/test';

test.describe('JoinTogether Full-Stack E2E Flow', () => {
  test('registers two users, creates compatible requests, matches, forms group, approves join, and exchanges persistent chat', async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();

    // User A visits Landing Page and registers
    await pageA.goto('/');
    await expect(pageA.getByRole('heading', { name: /Find verified partners/i })).toBeVisible();
    await pageA.getByRole('link', { name: 'Create Free Account' }).click();

    await pageA.getByLabel('Full name').fill('Alice Architect');
    await pageA.getByLabel('Email address').fill('alice.e2e@example.com');
    await pageA.getByLabel('Password').fill('Password123!');
    await pageA.getByLabel('Primary city').fill('Seattle');
    await pageA.getByRole('button', { name: 'Create Account' }).click();

    await expect(pageA).toHaveURL(/\/app$/);
    await expect(pageA.getByText('Welcome back, Alice Architect')).toBeVisible();

    // User A creates a Hackathon request
    await pageA.getByRole('link', { name: 'My Requests' }).click();
    await pageA.getByRole('tab', { name: 'hackathon' }).click();
    await pageA.getByLabel('Request Title').fill('Need Frontend for Climate Hack');
    await pageA.getByLabel('Description & Logistics').fill('Building clean energy dashboard');
    await pageA.getByPlaceholder('Climate Hack 2026').fill('Climate Hack 2026');
    await pageA.getByRole('button', { name: 'Publish Match Request' }).click();

    await expect(pageA.getByText('Need Frontend for Climate Hack')).toBeVisible();

    // User B registers in separate browser context
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto('/register');
    await pageB.getByLabel('Full name').fill('Bob Frontend');
    await pageB.getByLabel('Email address').fill('bob.e2e@example.com');
    await pageB.getByLabel('Password').fill('Password123!');
    await pageB.getByLabel('Primary city').fill('Seattle');
    await pageB.getByRole('button', { name: 'Create Account' }).click();

    await expect(pageB).toHaveURL(/\/app$/);

    // User B posts matching Hackathon request
    await pageB.getByRole('link', { name: 'My Requests' }).click();
    await pageB.getByRole('tab', { name: 'hackathon' }).click();
    await pageB.getByLabel('Request Title').fill('Frontend Dev for Climate Hack');
    await pageB.getByLabel('Description & Logistics').fill('React & TypeScript engineer');
    await pageB.getByPlaceholder('Climate Hack 2026').fill('Climate Hack 2026');
    await pageB.getByPlaceholder('Backend').fill('Frontend');
    await pageB.getByPlaceholder('Frontend, Designer').fill('Backend');
    await pageB.getByRole('button', { name: 'Publish Match Request' }).click();
    await expect(pageB.getByText('Frontend Dev for Climate Hack')).toBeVisible();

    // User B navigates to Matches and discovers User A
    await pageB.getByRole('link', { name: 'Find Matches' }).first().click();
    await expect(pageB.getByText('Need Frontend for Climate Hack')).toBeVisible();
    await expect(pageB.getByText(/Mutual role fit/i)).toBeVisible();

    // User B forms group from match
    await pageB.getByRole('button', { name: 'Form Group & Invite' }).click();
    await expect(pageB).toHaveURL(/\/app\/groups\/[a-f0-9]+$/);
    const groupUrl = pageB.url();

    // User A navigates directly to the group URL and sends a join request
    await pageA.goto(groupUrl);
    await pageA.getByPlaceholder(/Introduce yourself/i).fill('I am the Backend lead you matched with!');
    await pageA.getByRole('button', { name: 'Send Join Request' }).click();
    await expect(pageA.getByText(/pending review/i)).toBeVisible();

    // User B reloads / sees Alice's join request and accepts it
    await pageB.reload();
    await expect(pageB.getByText('Alice Architect · Seattle')).toBeVisible();
    await pageB.getByRole('button', { name: 'Accept' }).click();
    await expect(pageB.getByText('2/4 seats')).toBeVisible();

    // User A refreshes and sees live chat unlocked, sends a message
    await pageA.reload();
    await pageA.getByPlaceholder(/Write a message to your group/i).fill('Ready to start hacking!');
    await pageA.getByRole('button', { name: 'Send' }).click();

    await expect(pageA.getByText('Ready to start hacking!')).toBeVisible();
    await expect(pageB.getByText('Ready to start hacking!')).toBeVisible();

    await ctxA.close();
    await ctxB.close();
  });
});
