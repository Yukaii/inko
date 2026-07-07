import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const artifactsDir = "/Users/yukai/.gemini/antigravity/brain/9d92c9cb-2398-4601-b809-11c58de0879d";

test("capture screenshots of the application", async ({ page }) => {
  // 1. Landing Page
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(2000); // Wait for animations to finish
  await page.screenshot({
    path: path.join(artifactsDir, "landing_page.png"),
    fullPage: true,
  });
  console.log("Captured landing page");

  // 2. Login Page
  await page.goto("/login");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(artifactsDir, "login_page.png"),
  });
  console.log("Captured login page");

  // 3. Perform Authentication
  await page.fill("#email-input", `screenshot-tester-${Date.now()}@example.com`);
  await page.click("button:has-text('Request Magic Link')");
  
  // Wait for the token input to be autofilled
  const tokenInput = page.locator("#token-input");
  await expect(tokenInput).not.toHaveValue("", { timeout: 10000 });
  
  // Click Verify Token
  await page.click("button:has-text('Verify Token')");
  
  // Wait for Dashboard to load
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(2000); // Settle queries
  
  // 4. Dashboard (Onboarding State)
  await page.screenshot({
    path: path.join(artifactsDir, "dashboard_onboarding.png"),
  });
  console.log("Captured dashboard onboarding state");

  // Create sample deck
  const createBtn = page.locator("button:has-text('Create sample deck')");
  if (await createBtn.isVisible()) {
    await createBtn.click();
    // Wait for "Start first practice" button to appear
    const startBtn = page.locator("button:has-text('Start first practice')");
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    
    // 5. Dashboard (Deck Ready State)
    await page.screenshot({
      path: path.join(artifactsDir, "dashboard_ready.png"),
    });
    console.log("Captured dashboard deck ready state");
    
    // Start practice
    await startBtn.click();
    await page.waitForURL("**/practice/**", { timeout: 15000 });
    await page.waitForTimeout(3000); // Wait for practice card and TTS warmup/assets to settle
    
    // 6. Practice Page
    await page.screenshot({
      path: path.join(artifactsDir, "practice_page.png"),
    });
    console.log("Captured practice page");
  } else {
    console.log("Onboarding panel not visible, might already have decks");
  }

  // 7. Word Bank Page
  await page.goto("/word-bank");
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(artifactsDir, "word_bank_page.png"),
    fullPage: true,
  });
  console.log("Captured word bank page");

  // 8. Settings Page
  await page.goto("/settings");
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(artifactsDir, "settings_page.png"),
    fullPage: true,
  });
  console.log("Captured settings page");
});
