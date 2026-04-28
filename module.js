export function formatNumber(num) {
  return Number(num.toFixed(2)).toString();
}

export function tomonth(num) {
  return Math.round(num / 12 * 10000);
}

export function formatYen(num) {
  return new Intl.NumberFormat('ja-JP').format(num);
}