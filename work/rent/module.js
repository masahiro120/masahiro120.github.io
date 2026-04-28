export function calcRentToIncome(rent, ratio, subsidy, tax) {
  const realCost = rent - subsidy + tax;
  return {
    realCost,
    needIncome: realCost / ratio
  };
}

export function calcIncomeToRent(income, ratio, subsidy, tax) {
  const realCost = income * ratio;
  return {
    realCost,
    rent: realCost + subsidy - tax
  };
}

export function calcIncomeToRatio(rent, income, subsidy, tax) {
  const realCost = rent - subsidy + tax;
  return {
    realCost,
    ratio: realCost / income
  };
}