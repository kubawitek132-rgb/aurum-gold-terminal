import fs from "node:fs";
import path from "node:path";
import type { Metadata, Viewport } from "next";
import { BiuroFrame } from "../frame";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Biuro HQ — raport desku",
  description:
    "Raport sali Biura HQ. Coin Bot: live MetaMask, realne BTC/ETH pod risk. Paper jest tylko logiem fallbacku, zanim portfel jest podłączony.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#090b0e",
};

/** Same desk as public/biuro.html — one source, two URLs (/biuro and /biuro.html). */
function loadDesk(): { style: string; body: string; script: string } {
  const file = path.join(process.cwd(), "public", "biuro.html");
  const raw = fs.readFileSync(file, "utf8");
  const style = raw.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  const bodyRaw = raw.match(/<body>([\s\S]*?)<\/body>/)?.[1];
  if (!style || !bodyRaw) {
    throw new Error("public/biuro.html is missing <style> or <body>");
  }
  const scripts: string[] = [];
  const body = bodyRaw.replace(
    /<script>([\s\S]*?)<\/script>/gi,
    (_match, code: string) => {
      scripts.push(code);
      return "";
    },
  );
  return { style, body, script: scripts.join("\n") };
}

export default function BiuroPage() {
  const { style, body, script } = loadDesk();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <BiuroFrame body={body} script={script} />
    </>
  );
}
