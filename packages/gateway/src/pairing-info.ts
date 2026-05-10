export interface PairingInfoInput {
  lan: string | null;
  tailscale: string | null;
  port: number;
  token: string;
}

export function formatPairingInfo(input: PairingInfoInput): string[] {
  const { lan, tailscale, port, token } = input;
  const lines: string[] = [];
  if (lan) {
    lines.push(`  LAN:       http://${lan}:${port}`);
    lines.push(`  Web (LAN): http://${lan}:${port}/web`);
  }
  if (tailscale) {
    lines.push(`  Tailscale: http://${tailscale}:${port}`);
    lines.push(`  Web (Ts):  http://${tailscale}:${port}/web`);
  }
  lines.push(`  Token:     ${token}`);
  return lines;
}
