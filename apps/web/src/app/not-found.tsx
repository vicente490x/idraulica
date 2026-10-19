import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-page">
      <h1>Pagina non trovata</h1>
      <p>Il collegamento potrebbe essere incompleto o non più disponibile.</p>
      <Link className="button" href="/">
        Torna alla panoramica
      </Link>
    </main>
  );
}
