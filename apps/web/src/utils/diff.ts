export type DiffRow = {
  line: number;
  left: string;
  right: string;
  changed: boolean;
};

export const buildLineDiff = (
  leftText: string,
  rightText: string,
  limit = 2000
): DiffRow[] => {
  const leftLines = leftText.split("\n");
  const rightLines = rightText.split("\n");
  const max = Math.min(Math.max(leftLines.length, rightLines.length), limit);
  const rows: DiffRow[] = [];
  for (let i = 0; i < max; i++) {
    const left = leftLines[i] ?? "";
    const right = rightLines[i] ?? "";
    rows.push({
      line: i + 1,
      left,
      right,
      changed: left !== right
    });
  }
  return rows;
};
