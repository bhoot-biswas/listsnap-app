// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./use-photo-share", () => ({
  usePhotoShare: () => ({ canShare: false, prepare: vi.fn(), share: vi.fn() }),
}));

const { ExportMenu } = await import("./export-menu");

afterEach(cleanup);

describe("ExportMenu", () => {
  // the warning's label sat outside a menu group, and opening the menu took Review down
  it("opens with its warning on a listing still in Needs review", async () => {
    render(<ExportMenu listingIds={["l"]} hasWebsite unchecked />);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    expect(await screen.findByText("notChecked")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "kit" })).toBeTruthy();
  });

  it("opens without the warning on a checked listing", async () => {
    render(<ExportMenu listingIds={["l"]} hasWebsite />);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    expect(await screen.findByRole("menuitem", { name: "kit" })).toBeTruthy();
    expect(screen.queryByText("notChecked")).toBeNull();
  });
});
