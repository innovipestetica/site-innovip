import type { Metadata } from "next";
import { BlackLandingPage } from "@/components/site/black-landing-page";
import { getPublishedEntry } from "@/lib/cms/public-data";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedEntry("landing", "black");
  return {
    title: page?.seo.title || page?.title || "Lista VIP",
    description: page?.seo.description || page?.summary || "Entre para a lista VIP da Innovip e receba novidades, condições especiais e atendimento próximo.",
    alternates: { canonical: "/black" },
    robots: page?.seo.noindex ? { index: false, follow: false } : undefined,
  };
}

export default function VipLandingRoute() {
  return <BlackLandingPage />;
}
