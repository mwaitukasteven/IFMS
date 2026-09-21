export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return 'TSHS 0';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `TSHS ${formatted}`;
}

export function formatInputNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const [whole, decimal] = cleaned.split('.');
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal}`;
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}
