export function roundedMedian(values, digits = 2) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const median = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.5) - 1)];
  return Number(median.toFixed(digits));
}
