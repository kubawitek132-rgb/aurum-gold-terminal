import type { Metadata, Viewport } from "next";
import snapshot from "../../../public/biuro-status.json";
import { OfficeHQ } from "@/components/biuro/OfficeHQ";

export const metadata: Metadata = {
  title: "BiuroHQ — jeden budynek, wszystkie projekty",
  description:
    "Przestrzenna centrala BiuroHQ. Centrala BiuroHQ, Coin Bot i AURUM na osobnych piętrach, z potwierdzonym wykazem stanowisk. Notowania BTC, ETH, SOL i coinów z giełd oraz połączenie MetaMask.",
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
