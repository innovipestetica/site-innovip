import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AdminMobileMenu, AdminSidebar } from "@/components/admin/admin-nav";
import { signOutAction } from "../actions";

/**
 * Moldura do painel protegido. O layout não é barreira de segurança (não
 * re-renderiza em navegações): cada página e ação chama requireAdmin/assertAdmin.
 */
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="relative border-b border-line bg-surface-raised">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-2">
            <AdminMobileMenu />
            <Link href="/admin" className="flex min-h-11 items-center gap-2 font-display font-bold text-brand-800">
              <Logo size={40} />
              <span>Painel</span>
            </Link>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="min-h-11 rounded-[var(--radius-control)] px-4 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <AdminSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
