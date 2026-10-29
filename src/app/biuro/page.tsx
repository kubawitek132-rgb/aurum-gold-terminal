import type { Metadata, Viewport } from "next";
import snapshot from "../../../public/biuro-status.json";
import { OfficeHQ } from "@/components/biuro/OfficeHQ";

export const metadata: Metadata = {
  title: "Biuro HQ — ojciec AURUM + Coin Bot",
  description:
    "BiuroHQ, ojciec dwóch pionów. AURUM to terminal złota. Coin Bot: live MetaMask, realne kupno i sprzedaż BTC/ETH, pod risk (5000 USD, 2% DD, kill-switch). Paper jest fallbackiem, zanim MetaMask jest podłączony.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#090e15",
};

// The original public/biuro.html report remains available at /biuro/desk.
export default function BiuroPage() {
  return <OfficeHQ snapshot={snapshot} />;
}
