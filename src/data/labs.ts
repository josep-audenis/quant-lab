export type LabStatTone = "pos" | "neg" | "";

export type Lab = {
  name: string;
  meta: string;
  badge: string;
  tone: "live" | "draft";
  stats: Array<[label: string, value: string, tone: LabStatTone]>;
  path: string;
};

export const labs: Lab[] = [
  {
    name: "Does the 200-day MA actually protect SPY investors?",
    meta: "SPY - 32y - daily signal",
    badge: "ready",
    tone: "live",
    stats: [
      ["CAGR", "12.4%", "pos"],
      ["Max DD", "-18.7%", "neg"],
      ["Sharpe", "1.05", ""],
    ],
    path: "M0,42 C34,34 54,38 82,29 S139,13 178,17 232,13 292,3 340,0",
  },
  {
    name: "Can momentum rotation beat buy-and-hold?",
    meta: "3 sector ETFs - monthly - 20y",
    badge: "ready",
    tone: "live",
    stats: [
      ["CAGR", "15.1%", "pos"],
      ["Max DD", "-13.2%", "neg"],
      ["Turnover", "42%", ""],
    ],
    path: "M0,50 C31,43 58,44 84,37 S124,45 151,31 197,6 236,18 279,22 340,9",
  },
];
