import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Innovip" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex flex-1 flex-col bg-surface">{children}</div>;
}
