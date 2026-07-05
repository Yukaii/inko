export function getWordsPageShownCount(input: {
  pageIndex: number;
  pageSize: number;
  currentPageCount: number;
  totalCount: number | null;
}) {
  const shown = Math.max(0, input.pageIndex) * input.pageSize + input.currentPageCount;
  return input.totalCount === null ? shown : Math.min(shown, input.totalCount);
}
