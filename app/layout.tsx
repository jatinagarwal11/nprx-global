import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "NPRX Global — Solana paper trading for business hedges";
const description =
  "A Solana Devnet paper market where Nepali businesses track oil and USD/NPR, match test hedges, and publish verifiable trade receipts.";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host");
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "https://nprx-global.local";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "NPRX Global — Solana paper trading for Nepali businesses" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
