export interface WalletProvider {
  isMetaMask?: boolean;
  providers?: WalletProvider[];
  request(args: {
    method: string;
    params?: unknown[] | object;
  }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

export function walletAccounts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && /^0x[0-9a-f]{40}$/i.test(item),
      )
    : [];
}

export function walletChain(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function chainLabel(chain: string | null): string {
  const labels: Record<string, string> = {
    "0x1": "Ethereum",
    "0xaa36a7": "Sepolia · testnet",
    "0xa4b1": "Arbitrum",
    "0x2105": "Base",
    "0xa": "Optimism",
    "0x89": "Polygon",
    "0x38": "BNB Chain",
  };
  return chain
    ? labels[chain] || `Sieć ${BigInt(chain).toString()}`
    : "Nieznana sieć";
}

export function nativeSymbol(chain: string | null): string {
  return chain === "0x89"
    ? "POL"
    : chain === "0x38"
      ? "BNB"
      : ["0x1", "0xaa36a7", "0xa4b1", "0x2105", "0xa"].includes(chain || "")
        ? "ETH"
        : "jedn. natywnych";
}

export function formatWalletBalance(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-f]+$/i.test(value) ||
    value.length > 66
  )
    return null;
  const wei = BigInt(value);
  const unit = BigInt("1000000000000000000");
  const fraction = ((wei % unit) / BigInt("100000000000000"))
    .toString()
    .padStart(4, "0");
  return `${wei / unit}.${fraction}`;
}

export function walletError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === 4001) return "Połączenie zostało odrzucone w portfelu.";
  if (code === -32002)
    return "Żądanie czeka w MetaMask. Otwórz rozszerzenie portfela.";
  if (code === 4900 || code === 4901)
    return "Portfel utracił połączenie z siecią.";
  return "Nie udało się odczytać portfela. Spróbuj ponownie w MetaMask.";
}
