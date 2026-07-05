import { describe, expect, it } from "vite-plus/test";
import { getWordsPageShownCount } from "./wordBankPagination";

describe("getWordsPageShownCount", () => {
  it("shows the cumulative count through the current full page", () => {
    expect(
      getWordsPageShownCount({
        pageIndex: 6,
        pageSize: 100,
        currentPageCount: 100,
        totalCount: 1019,
      }),
    ).toBe(700);
  });

  it("caps the shown count at the total on the final page", () => {
    expect(
      getWordsPageShownCount({
        pageIndex: 10,
        pageSize: 100,
        currentPageCount: 100,
        totalCount: 1019,
      }),
    ).toBe(1019);
  });

  it("supports unknown totals", () => {
    expect(
      getWordsPageShownCount({
        pageIndex: 2,
        pageSize: 100,
        currentPageCount: 35,
        totalCount: null,
      }),
    ).toBe(235);
  });
});
