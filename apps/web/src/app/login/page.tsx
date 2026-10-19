"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Droplets, ArrowRight, ShieldCheck } from "lucide-react";
import { send } from "@/lib/api";
import { User } from "@/lib/types";
import { ErrorBox, Field } from "@/components/ui";
export default function Login() {
  const router = useRouter(),
    cache = useQueryClient();
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const user = await send<User>(
        "auth/web-login/",
        "POST",
        Object.fromEntries(form),
      );
      cache.clear();
      cache.setQueryData(["me"], user);
      router.replace("/");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Droplets />
          </span>
          hydro<span className="brand-suffix"> / ufficio</span>
        </div>
        <div className="story-main">
          <span className="eyebrow">IL LAVORO SCORRE MEGLIO.</span>
          <h1>
            Ogni intervento.
            <br />
            Al posto giusto.
          </h1>
          <p>
            Più chiarezza in ufficio, più continuità sul campo. Organizza la
            giornata della tua squadra da un unico spazio.
          </p>
          <div className="story-lines">
            <span>
              01 <strong>Pianifica con precisione</strong>
            </span>
            <span>
              02 <strong>Coordina le persone</strong>
            </span>
            <span>
              03 <strong>Segui ogni aggiornamento</strong>
            </span>
          </div>
        </div>
        <small>GESTIONALE AZIENDA IDRAULICA</small>
      </section>
      <main className="login-form">
        <div>
          <span className="eyebrow muted">BENTORNATO</span>
          <h2>Accedi al tuo ufficio</h2>
          <p>Usa l’account assegnato dall’amministratore.</p>
          <form onSubmit={submit}>
            <Field label="Email">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="nome@azienda.it"
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="La tua password"
              />
            </Field>
            <div className="login-forgot">
              <Link href="/recupero-password">Password dimenticata?</Link>
            </div>
            <ErrorBox error={error} />
            <button className="button full" disabled={busy}>
              {busy ? "Accesso in corso…" : "Accedi alla dashboard"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="secure-note">
            <ShieldCheck size={18} />
            Accesso riservato al personale autorizzato
          </div>
        </div>
      </main>
    </div>
  );
}
