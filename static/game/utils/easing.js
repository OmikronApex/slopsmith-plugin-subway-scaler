export function easeInQuad(t, d) {
  t /= d;
  return t * t;
}

export function easeOutQuad(t, d) {
  t /= d;
  return -1 * t * (t - 2);
}
