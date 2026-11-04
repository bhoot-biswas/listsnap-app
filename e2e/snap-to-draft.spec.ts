import path from "node:path";
import { expect, test } from "@playwright/test";

// The seller's main path, end to end in the browser: try the demo, snap a product, check
// the listing on Review and save it as a store draft. Every outside service is mocked.
test("a demo seller snaps a product and saves it as a store draft", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Try the demo shop" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/snap");
  // the "Upload photos" button opens this picker; the chat box has a multiple picker too, later on the page
  await page
    .locator('input[type="file"][multiple]')
    .first()
    .setInputFiles(path.join(process.cwd(), "public/samples/saree.jpg"));
  await expect(page.getByText("1 photo ready")).toBeVisible();
  await page.getByRole("button", { name: "Make the listing" }).click();

  // the job page drives the pipeline, then offers Review
  await expect(page).toHaveURL(/\/job\/[0-9a-f-]{36}/);
  await page
    .getByRole("link", { name: /Review/ })
    .first()
    .click({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/job\/[0-9a-f-]{36}\/review/);
  await expect(page.getByRole("heading", { name: "Review listing" })).toBeVisible();

  await page.getByRole("button", { name: "Save draft to store" }).click();
  await expect(page.getByRole("heading", { name: "Draft saved" })).toBeVisible({ timeout: 30_000 });
});

// Two ways a seller could lose a listing's Review page: the Export menu crashing it, and a
// blank title being saved, after which the page could no longer read the listing.
test("a demo seller exports a Needs review listing and can't save a blank title", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Try the demo shop" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/listings?status=needs_review");
  await page.locator('a[href*="/review"]').first().click();
  await expect(page.getByRole("heading", { name: "Review listing" })).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("menuitem", { name: /Listing kit/ })).toBeVisible();
  await page.keyboard.press("Escape");

  const title = page.locator("#en-title");
  const before = await title.inputValue();
  await title.fill("");
  await expect(page.getByText("Add English title")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Review listing" })).toBeVisible();
  await expect(page.locator("#en-title")).toHaveValue(before);
});
