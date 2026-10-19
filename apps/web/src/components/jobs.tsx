"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  Phone,
  MapPin,
  Clock3,
  UserRound,
  History as HistoryIcon,
} from "lucide-react";
import { api, all, send, qs } from "@/lib/api";
import {
  Job,
  Page,
  Technician,
  History,
  statuses,
  priorities,
  person,
} from "@/lib/types";
import { displayDate, dayWindow } from "@/lib/time";
import {
  Badge,
  Loading,
  ErrorBox,
  Empty,
  Field,
  Modal,
  Pagination,
} from "./ui";
import { JobForm, useInvalidate } from "./forms";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function JobsTable({ jobs }: { jobs: Job[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Intervento / cliente</th>
            <th>Programmazione</th>
            <th>Tecnico</th>
            <th>Stato</th>
            <th>Priorità</th>
            <th aria-label="Dettaglio"></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                <Link className="table-primary" href={`/interventi/${j.id}`}>
                  {j.title}
                </Link>
                <small>{j.customer_name}</small>
              </td>
              <td>
                {displayDate(j.starts_at, "dd LLL · HH:mm")}
                <small>fino alle {displayDate(j.ends_at, "HH:mm")}</small>
              </td>
              <td>
                {j.technician_name ||
                  (j.technician ? `Tecnico #${j.technician}` : "Da assegnare")}
              </td>
              <td>
                <Badge status={j.status} />
              </td>
              <td>
                <span className={`priority priority-${j.priority}`}>
                  {priorities[j.priority]}
                </span>
              </td>
              <td>
                <Link
                  className="icon-button"
                  aria-label={`Apri ${j.title}`}
                  href={`/interventi/${j.id}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function JobFilters({
  search,
  setSearch,
  status,
  setStatus,
  technician,
  setTechnician,
}: {
  search: string;
  setSearch: (s: string) => void;
  status: string;
  setStatus: (s: string) => void;
  technician: string;
  setTechnician: (s: string) => void;
}) {
  const techs = useQuery({
    queryKey: ["technician-options"],
    queryFn: () => all<Technician>("technicians/"),
  });
  return (
    <>
      <div className="search-field">
        <Search size={18} />
        <input
          aria-label="Cerca interventi"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per lavoro o indirizzo"
        />
      </div>
      <select
        aria-label="Filtra per stato"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">Tutti gli stati</option>
        {Object.entries(statuses).map(([v, l]) => (
          <option value={v} key={v}>
            {l}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtra per tecnico"
        value={technician}
        onChange={(e) => setTechnician(e.target.value)}
      >
        <option value="">Tutti i tecnici</option>
        {techs.data?.map((t) => (
          <option key={t.id} value={t.id}>
            {person(t)}
          </option>
        ))}
      </select>
      <ErrorBox error={techs.error} />
    </>
  );
}
export default function JobsPage() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [technician, setTechnician] = useState(""),
    [date, setDate] = useState(""),
    [create, setCreate] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("date");
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) setDate(value);
  }, []);
  const params = qs({
    page,
    search,
    status,
    technician,
    ...(date ? dayWindow(date) : {}),
  });
  const jobs = useQuery({
    queryKey: ["jobs", params],
    queryFn: () => api<Page<Job>>(`interventions/?${params}`),
  });
  function filter(set: (v: string) => void) {
    return (v: string) => {
      set(v);
      setPage(1);
    };
  }
  return (
    <>
      <PageHeading
        eyebrow="CONTROLLO OPERATIVO"
        title="Tutti gli interventi"
        description="Dalla prima chiamata alla chiusura del lavoro."
        action={
          <button className="button" onClick={() => setCreate(true)}>
            <Plus size={18} />
            Nuovo appuntamento
          </button>
        }
      />
      {notice && (
        <p className="toast" role="status">
          {notice}
        </p>
      )}
      <section className="panel">
        <div className="filters">
          <JobFilters
            search={search}
            setSearch={filter(setSearch)}
            status={status}
            setStatus={filter(setStatus)}
            technician={technician}
            setTechnician={filter(setTechnician)}
          />
          <input
            aria-label="Filtra per data"
            type="date"
            value={date}
            onChange={(e) => filter(setDate)(e.target.value)}
          />
          {date && (
            <button className="text-button" onClick={() => filter(setDate)("")}>
              Tutte le date
            </button>
          )}
        </div>
        <ErrorBox error={jobs.error} retry={() => jobs.refetch()} />
        {jobs.isPending ? (
          <Loading />
        ) : jobs.data?.results.length ? (
          <>
            <JobsTable jobs={jobs.data.results} />
            <Pagination
              page={page}
              count={jobs.data.count}
              onChange={setPage}
            />
          </>
        ) : (
          !jobs.error && (
            <Empty
              title="Nessun intervento trovato"
              detail="Modifica i filtri oppure crea il primo appuntamento."
            />
          )
        )}
      </section>
      {create && (
        <JobForm
          onClose={() => setCreate(false)}
          onSaved={() => {
            setCreate(false);
            setNotice("Appuntamento creato e salvato.");
          }}
        />
      )}
    </>
  );
}
export function JobDetail({ id }: { id: string }) {
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: () => api<Job>(`interventions/${id}/`),
  });
  const [historyPage, setHistoryPage] = useState(1);
  const history = useQuery({
    queryKey: ["history", id, historyPage],
    queryFn: () =>
      api<Page<History>>(`interventions/${id}/history/?page=${historyPage}`),
  });
  const [edit, setEdit] = useState(false),
    [target, setTarget] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const invalidate = useInvalidate();
  if (job.isPending) return <Loading />;
  if (job.error)
    return <ErrorBox error={job.error} retry={() => job.refetch()} />;
  if (!job.data) return null;
  const j = job.data;
  return (
    <>
      <Link className="back-link" href="/interventi">
        ← Tutti gli interventi
      </Link>
      <PageHeading
        eyebrow="SCHEDA INTERVENTO"
        title={j.title}
        description={`${j.customer_name} · ${priorities[j.priority]}`}
        action={
          !["completed", "cancelled"].includes(j.status) && (
            <button className="button" onClick={() => setEdit(true)}>
              Modifica intervento
            </button>
          )
        }
      />
      {notice && (
        <p className="toast" role="status">
          {notice}
        </p>
      )}
      <div className="detail-grid">
        <section className="panel detail-card">
          <div className="section-heading">
            <h2>Il lavoro</h2>
            <Badge status={j.status} />
          </div>
          <p className="description-text">{j.description}</p>
          <div className="detail-line">
            <UserRound size={18} />
            <div>
              <small>Cliente</small>
              <Link href={`/clienti/${j.customer}`}>{j.customer_name}</Link>
            </div>
          </div>
          <div className="detail-line">
            <Phone size={18} />
            <a href={`tel:${j.customer_phone}`}>{j.customer_phone}</a>
          </div>
          <div className="detail-line">
            <MapPin size={18} />
            {j.address}
          </div>
          <div className="detail-line">
            <Clock3 size={18} />
            {displayDate(j.starts_at)} — {displayDate(j.ends_at, "HH:mm")}
          </div>
          <dl className="facts">
            <div>
              <dt>Tecnico assegnato</dt>
              <dd>
                {j.technician_name ||
                  (j.technician ? `#${j.technician}` : "Da assegnare")}
              </dd>
            </div>
            <div>
              <dt>Tipo intervento</dt>
              <dd>{j.intervention_type}</dd>
            </div>
            <div>
              <dt>Ultimo aggiornamento</dt>
              <dd>
                {displayDate(j.updated_at)} · v{j.version}
              </dd>
            </div>
          </dl>
          <h3>Note ufficio</h3>
          <p className="description-text">
            {j.office_notes || "Nessuna nota."}
          </p>
          <h3>Note del tecnico</h3>
          <p className="description-text">
            {j.technician_notes || "Nessuna nota."}
          </p>
          {j.allowed_transitions.length > 0 && (
            <div className="status-actions">
              <h3>Aggiorna stato</h3>
              <div className="button-row">
                {j.allowed_transitions.map((s) => (
                  <button
                    key={s}
                    className={`button ${s === "cancelled" ? "danger" : "secondary"}`}
                    onClick={() => {
                      setTarget(s);
                      setError(null);
                    }}
                  >
                    {statuses[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="panel detail-card">
          <div className="section-heading">
            <h2>Storico stati</h2>
            <HistoryIcon size={19} />
          </div>
          <ErrorBox error={history.error} retry={() => history.refetch()} />
          {history.isPending ? (
            <Loading />
          ) : (
            <ol className="timeline">
              {history.data?.results.map((h) => (
                <li key={h.id}>
                  <Badge status={h.new_status} />
                  <p>{displayDate(h.created_at)}</p>
                  <small>Utente #{h.actor}</small>
                </li>
              ))}
            </ol>
          )}
          {history.data && history.data.count > 25 && (
            <Pagination
              page={historyPage}
              count={history.data.count}
              onChange={setHistoryPage}
            />
          )}
        </section>
      </div>
      {edit && (
        <JobForm
          job={j}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            setNotice("Modifiche salvate.");
          }}
        />
      )}
      {target && (
        <Modal
          title={
            target === "cancelled"
              ? "Annullare questo intervento?"
              : "Conferma cambio di stato"
          }
          description={`${j.title}: ${statuses[j.status]} → ${statuses[target]}`}
          open
          onClose={() => !busy && setTarget("")}
        >
          <p>
            {target === "cancelled"
              ? "L’intervento resterà nello storico. Questa operazione non può essere annullata."
              : "Il cambiamento sarà registrato nello storico e visibile al tecnico."}
          </p>
          <ErrorBox error={error} />
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setTarget("")}
            >
              Indietro
            </button>
            <button
              className={`button ${target === "cancelled" ? "danger" : ""}`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await send(`interventions/${j.id}/status/`, "POST", {
                    status: target,
                    version: j.version,
                    operation_id: crypto.randomUUID(),
                  });
                  await invalidate();
                  setTarget("");
                  setNotice("Stato aggiornato.");
                } catch (e) {
                  setError(e);
                  await invalidate();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Aggiornamento…" : "Conferma"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
