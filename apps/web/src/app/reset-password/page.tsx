"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { send } from "@/lib/api";
import { Field, ErrorBox } from "@/components/ui";
export default function Reset() {
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Imposta una nuova password</h1>
        <p>Usa almeno 12 caratteri e una password che non usi altrove.</p>
        {done ? (
          <p role="status" className="success-box">
            Password aggiornata. Puoi accedere con la nuova password.
          </p>
        ) : (
          <form
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const form = new FormData(e.currentTarget),
                params = new URLSearchParams(window.location.search);
              try {
                if (form.get("password") !== form.get("confirm"))
                  throw new Error("Le password non coincidono.");
                await send("auth/password/reset/confirm/", "POST", {
                  uid: params.get("uid"),
                  token: params.get("token"),
                  new_password: form.get("password"),
                });
                setDone(true);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Nuova password">
              <input
                type="password"
                name="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Conferma password">
              <input
                type="password"
                name="confirm"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </Field>
            <ErrorBox error={error} />
            <button className="button" disabled={busy}>
              {busy ? "Salvataggio…" : "Aggiorna password"}
            </button>
          </form>
        )}
        <Link href="/login">Torna all’accesso</Link>
      </div>
    </main>
  );
}
