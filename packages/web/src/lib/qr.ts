export function buildPairingUrl(origin: string, token: string): string {
  const cleaned = origin.replace(/\/+$/, '');
  const params = new URLSearchParams({ url: cleaned, token });
  return `zenterm://connect?${params.toString()}`;
}
