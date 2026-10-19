"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import {
  Droplets,
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  HardHat,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { api, send, ApiError } from "@/lib/api";
import { User, person } from "@/lib/types";
import { ErrorBox, Loading } from "./ui";
import { configureZone } from "@/lib/time";
const links = [
  { href: "/", label: "Panoramica", icon: LayoutDashboard },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/interventi", label: "Interventi", icon: ClipboardList },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/tecnici", label: "Tecnici", icon: HardHat },
];
export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    router = useRouter(),
    cache = useQueryClient();
  const [menu, setMenu] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("auth/me/"),
    retry: false,
  });
  const config = useQuery({
    queryKey: ["office-config"],
    queryFn: () => api<{ timezone: string }>("office/config/"),
    enabled: !!me.data && me.data.role !== "technician",
  });
  useEffect(() => {
    if (config.data) {
      configureZone(config.data.timezone);
      setReady(true);
    }
  }, [config.data]);
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      cache.clear();
      router.replace("/login");
    }
  }, [me.error, cache, router]);
  useEffect(() => {
    const expired = () => {
      cache.clear();
      router.replace("/login?expired=1");
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [cache, router]);
  if (me.isPending) return <Loading />;
  if (me.error)
    return (
      <main className="auth-page">
        <ErrorBox error={me.error} retry={() => me.refetch()} />
        <Link href="/login">Torna all’accesso</Link>
      </main>
    );
  if (!me.data) return null;
  if (me.data.role === "technician")
    return (
      <main className="auth-page">
        <h1>Accesso riservato all’ufficio</h1>
        <p>
          Questa dashboard richiede il ruolo operatore ufficio o amministratore.
        </p>
        <button
          className="button"
          onClick={async () => {
            await send("auth/logout/", "POST");
            cache.clear();
            router.replace("/login");
          }}
        >
          Esci
        </button>
      </main>
    );
  if (config.error)
    return (
      <main className="auth-page">
        <ErrorBox error={config.error} retry={() => config.refetch()} />
      </main>
    );
  if (!ready) return <Loading />;
  const name = person(me.data);
  return (
    <div className="workspace">
      <a className="skip-link" href="#contenuto">
        Vai al contenuto
      </a>
      <button
        aria-label="Apri navigazione"
        className="mobile-menu icon-button"
        onClick={() => setMenu(!menu)}
      >
        <Menu />
      </button>
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <Link className="brand" href="/" onClick={() => setMenu(false)}>
          <span className="brand-icon">
            <Droplets size={25} />
          </span>
          <span>
            hydro<span className="brand-suffix"> / ufficio</span>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Chiudi navigazione"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <p className="nav-label">AREA OPERATIVA</p>
        <nav aria-label="Navigazione principale">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenu(false)}
              aria-current={
                (href === "/" ? path === "/" : path.startsWith(href))
                  ? "page"
                  : undefined
              }
            >
              <Icon size={19} />
              {label}
              <ArrowUpRight className="nav-arrow" size={15} />
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" />
          Un unico punto di controllo
          <p>Agenda, persone e interventi sempre allineati.</p>
        </div>
        <div className="profile">
          <span className="avatar">
            {(me.data.first_name || me.data.email).slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{me.data.first_name ? name : me.data.email}</strong>
            <small>
              {me.data.role === "admin"
                ? "Amministratore"
                : "Operatore ufficio"}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Esci"
            onClick={async () => {
              try {
                await send("auth/logout/", "POST");
                cache.clear();
                router.replace("/login");
              } catch (e) {
                setError(e);
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {menu && (
        <div className="sidebar-backdrop" onClick={() => setMenu(false)} />
      )}
      <div className="main-area">
        <div className="topbar">
          <span>
            <span className="live-dot" />
            Workspace operativo
          </span>
          <span>
            {config.data?.timezone} <span className="topbar-divider">/</span>{" "}
            {me.data.role === "admin" ? "Amministrazione" : "Ufficio"}
          </span>
        </div>
        <main id="contenuto" tabIndex={-1}>
          <ErrorBox error={error} />
          {children}
        </main>
        <footer>
          HYDRO · Gestione interventi
          <span>Dati collegati al gestionale aziendale</span>
        </footer>
      </div>
    </div>
  );
}
