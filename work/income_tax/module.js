export function calcEmploymentIncomeDeduction(income) {
  if (income < 162.5) return 55;
  if (income < 180) return income * 0.4 - 10;
  if (income < 360) return income * 0.3 + 8;
  if (income < 660) return income * 0.2 + 44;
  if (income < 850) return income * 0.1 + 110;
  return 195;
}

export function calcBasicDeduction(income) {
  if (income <= 132) return 95;
  if (income <= 336) return 88;
  if (income <= 489) return 68;
  if (income <= 655) return 63;
  if (income <= 2350) return 58;
  return 0;
}

export function calcIncomeTax(income) {
  if (income < 195) return income * 0.05;
  if (income < 330) return income * 0.1 - 9.75;
  if (income < 695) return income * 0.2 - 42.75;
  if (income < 900) return income * 0.23 - 63.6;
  if (income < 1800) return income * 0.33 - 153.6;
  if (income < 4000) return income * 0.4 - 279.6;
  return income * 0.45 - 479.6;
}