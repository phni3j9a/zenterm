import type { Page } from '@playwright/test';

/**
 * Fill the OTP login form by entering each digit into its individual input box.
 * Replaces the old single-input approach after the Phase 6 G4 login redesign.
 */
export async function fillOtp(page: Page, token: string): Promise<void> {
  const digits = token.split('');
  for (let i = 0; i < digits.length; i++) {
    await page.getByLabel(`Digit ${i + 1}`).fill(digits[i]);
  }
}
