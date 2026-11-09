// Display helpers only: never coerce persisted decimals to binary floats.
export function grouped(value) {
  const [whole, fraction] = String(value).split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const digits = sign ? whole.slice(1) : whole;
  const result = digits.length > 3 ? `${digits.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${digits.slice(-3)}` : digits;
  return `${sign}${result}${fraction === undefined ? '' : `.${fraction}`}`;
}
export const money = value => `₹${grouped(value)}`;
// Rate display only: no rounding, coercion or change to the underlying string.
export function rateLabel(value) {
  return grouped(String(value).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1'));
}
export function dateLabel(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value));
}
export function timestamp(value) {
  return `${new Intl.DateTimeFormat('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Kolkata'}).format(new Date(value))} IST`;
}
