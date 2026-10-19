"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <h1>Qualcosa non ha funzionato</h1>
      <p>Riprova a caricare questa pagina.</p>
      <button className="button" onClick={reset}>
        Riprova
      </button>
    </main>
  );
}
