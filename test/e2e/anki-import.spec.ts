import { expect, test } from "@playwright/test";
import path from "node:path";

const fixturesDir = path.resolve(process.cwd(), "test/e2e/fixtures");

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => {
    window.localStorage.setItem("inko_token", "test-token");
  });

  await page.route("**/api/decks", async (route) => {
    await route.fulfill({
      json: [
        {
          id: "deck_1",
          userId: "user_1",
          name: "Inbox Deck",
          language: "ja",
          archived: false,
          ttsEnabled: true,
          ttsVoice: "ja-JP-NanamiNeural",
          ttsRate: "default",
          createdAt: Date.now(),
        },
      ],
    });
  });

  await page.route("**/api/community/decks", async (route) => {
    await route.fulfill({ json: [] });
  });
});

test("reads mixed note types from an apkg", async ({ page }) => {
  await page.goto("/imports/anki");
  await page.locator('input[type="file"]').setInputFiles(path.join(fixturesDir, "mixed.apkg"));

  await expect(page.getByText("Loaded 2 note types from mixed.apkg.")).toBeVisible();
  const noteTypeSelect = page.getByRole("combobox").nth(1);
  await expect(noteTypeSelect).toHaveValue("1001");
  await noteTypeSelect.selectOption({ label: "Travel Phrase (1 notes)" });
  await expect(page.getByText("Source: mixed.apkg / Travel Phrase")).toBeVisible();
  await expect(page.getByRole("table").getByText("Phrase")).toBeVisible();
  await expect(page.getByRole("table").getByText("Translation")).toBeVisible();
  await expect(page.getByRole("cell", { name: "ありがとうございます", exact: true })).toBeVisible();
});

test("batches large apkg imports in the browser flow", async ({ page }) => {
  const batchSizes: number[] = [];
  await page.route("**/api/decks/deck_1/words/batch", async (route) => {
    const payload = route.request().postDataJSON() as { words: Array<unknown> };
    batchSizes.push(payload.words.length);
    await route.fulfill({
      json: {
        created: payload.words.length,
        words: [],
      },
    });
  });

  await page.goto("/imports/anki");
  await page.locator('input[type="file"]').setInputFiles(path.join(fixturesDir, "large.apkg"));

  await page.getByRole("combobox").first().selectOption("deck_1");
  await expect(page.getByText("600 cards will import with the current mapping")).toBeVisible();
  await page.getByRole("button", { name: "Import cards" }).click();
  await expect(page.getByText("Imported 600 cards into your deck.")).toBeVisible();
  expect(batchSizes).toEqual([500, 100]);
});
