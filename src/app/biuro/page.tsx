import type { Metadata, Viewport } from "next";
import snapshot from "../../../public/biuro-status.json";
import { OfficeHQ } from "@/components/biuro/OfficeHQ";

export const metadata: Metadata = {
<<<<<<< HEAD
  title: "BiuroHQ — jeden budynek, wszystkie projekty",
  description:
    "BiuroHQ, Coin Bot i AURUM na osobnych piętrach, z wykazem stanowisk i publicznymi notowaniami kryptowalut. Coin Bot: Solana DEX/Jupiter i oddzielny portfel na serwerze. HQ nie podpisuje transakcji.",
=======
  title: 'Biuro HQ — ojciec AURUM + Coin Bot',
  description: 'Biuro HQ, ojciec dwóch pionów: AURUM (xauinteligenceooffice.com) i Coin Bot (crypto paper). Widok sali, nie trzeci desk.',
>>>>>>> fc6a345 (Biuro HQ: sala w izometrii i wejście do gry paper.)
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
