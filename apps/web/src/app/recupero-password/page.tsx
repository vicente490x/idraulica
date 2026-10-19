"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { send } from "@/lib/api";
import { Field, ErrorBox } from "@/components/ui";
export default function Recovery() {
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Recupera la password</h1>
        <p>
          Ti invieremo le istruzioni se l’indirizzo corrisponde a un account
          attivo.
        </p>
        {done ? (
          <p role="status" className="success-box">
            Richiesta ricevuta. Controlla la tua casella di posta.
          </p>
        ) : (
          <form
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await send(
                  "auth/password/reset/",
                  "POST",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                setDone(true);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Email">
              <input type="email" name="email" autoComplete="email" required />
            </Field>
            <ErrorBox error={error} />
            <button className="button" disabled={busy}>
              {busy ? "Invio…" : "Invia istruzioni"}
            </button>
          </form>
        )}
        <Link href="/login">Torna all’accesso</Link>
      </div>
    </main>
  );
}
