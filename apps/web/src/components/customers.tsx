"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, ArrowUpRight, Phone, Mail, MapPin } from "lucide-react";
import { api, send, qs } from "@/lib/api";
import { Customer, Job, Page, customerName } from "@/lib/types";
import { displayDate } from "@/lib/time";
import { Loading, ErrorBox, Empty, Pagination, Modal } from "./ui";
import { CustomerForm, JobForm, useInvalidate } from "./forms";
import { PageHeading, JobsTable } from "./jobs";
export default function CustomersPage() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [city, setCity] = useState(""),
    [create, setCreate] = useState(false),
    [notice, setNotice] = useState("");
  const params = qs({ page, search, city });
  const customers = useQuery({
    queryKey: ["customers", params],
    queryFn: () => api<Page<Customer>>(`customers/?${params}`),
  });
  return (
    <>
      <PageHeading
        eyebrow="RELAZIONI CHE CONTANO"
        title="Archivio clienti"
        description="Contatti e storico dei lavori, sempre a portata di mano."
        action={
          <button className="button" onClick={() => setCreate(true)}>
            <Plus size={18} />
            Nuovo cliente
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
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Cerca clienti"
              type="search"
              placeholder="Nome, telefono, email o indirizzo"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <input
            aria-label="Filtra clienti per città"
            placeholder="Filtra per città"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <ErrorBox error={customers.error} retry={() => customers.refetch()} />
        {customers.isPending ? (
          <Loading />
        ) : customers.data?.results.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contatti</th>
                    <th>Indirizzo</th>
                    <th>In archivio dal</th>
                    <th aria-label="Dettaglio"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.data.results.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          className="table-primary"
                          href={`/clienti/${c.id}`}
                        >
                          {customerName(c)}
                        </Link>
                        <small>{c.city}</small>
                      </td>
                      <td>
                        <a href={`tel:${c.phone}`}>{c.phone}</a>
                        <small>{c.email || "Email non indicata"}</small>
                      </td>
                      <td>
                        {c.address}
                        <small>
                          {c.postal_code} {c.city}
                        </small>
                      </td>
                      <td>{displayDate(c.created_at, "dd LLL yyyy")}</td>
                      <td>
                        <Link
                          className="icon-button"
                          aria-label={`Apri ${customerName(c)}`}
                          href={`/clienti/${c.id}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              count={customers.data.count}
              page={page}
              onChange={setPage}
            />
          </>
        ) : (
          !customers.error && (
            <Empty
              title="Nessun cliente trovato"
              detail="Prova un’altra ricerca oppure inserisci una nuova anagrafica."
            />
          )
        )}
      </section>
      {create && (
        <CustomerForm
          onClose={() => setCreate(false)}
          onSaved={() => {
            setCreate(false);
            setNotice("Cliente salvato nell’archivio.");
          }}
        />
      )}
    </>
  );
}
export function CustomerDetail({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    [edit, setEdit] = useState(false),
    [create, setCreate] = useState(false),
    [remove, setRemove] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [deleted, setDeleted] = useState(false);
  const invalidate = useInvalidate();
  const c = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api<Customer>(`customers/${id}/`),
    enabled: !deleted,
  });
  const jobs = useQuery({
    queryKey: ["customer-jobs", id, page],
    queryFn: () =>
      api<Page<Job>>(
        `interventions/?customer=${id}&ordering=-starts_at&page=${page}`,
      ),
    enabled: !deleted,
  });
  if (deleted)
    return (
      <Empty
        title="Cliente eliminato"
        detail="L’anagrafica è stata rimossa dal gestionale."
        action={
          <Link className="button" href="/clienti">
            Torna ai clienti
          </Link>
        }
      />
    );
  if (c.isPending) return <Loading />;
  if (c.error) return <ErrorBox error={c.error} retry={() => c.refetch()} />;
  if (!c.data) return null;
  const customer = c.data;
  return (
    <>
      <Link className="back-link" href="/clienti">
        ← Archivio clienti
      </Link>
      <PageHeading
        eyebrow="SCHEDA CLIENTE"
        title={customerName(customer)}
        description={`${customer.city} · Cliente dal ${displayDate(customer.created_at, "dd LLL yyyy")}`}
        action={
          <div className="button-row">
            <button className="button secondary" onClick={() => setEdit(true)}>
              Modifica dati
            </button>
            <button className="button" onClick={() => setCreate(true)}>
              <Plus size={18} />
              Nuovo appuntamento
            </button>
          </div>
        }
      />
      {notice && (
        <p role="status" className="toast">
          {notice}
        </p>
      )}
      <section className="panel customer-overview">
        <div>
          <span className="eyebrow">CONTATTI</span>
          <p>
            <Phone size={17} />
            <a href={`tel:${customer.phone}`}>{customer.phone}</a>
          </p>
          {customer.email && (
            <p>
              <Mail size={17} />
              <a href={`mailto:${customer.email}`}>{customer.email}</a>
            </p>
          )}
        </div>
        <div>
          <span className="eyebrow">INDIRIZZO</span>
          <p>
            <MapPin size={17} />
            {customer.address}
          </p>
          <p>
            {customer.postal_code} {customer.city}
          </p>
        </div>
        <div>
          <span className="eyebrow">NOTE UFFICIO</span>
          <p className="description-text">
            {customer.notes || "Nessuna nota."}
          </p>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Storico interventi</h2>
          <span className="muted">{jobs.data?.count || 0} lavori</span>
        </div>
        <ErrorBox error={jobs.error} retry={() => jobs.refetch()} />
        {jobs.isPending ? (
          <Loading />
        ) : jobs.data?.results.length ? (
          <>
            <JobsTable jobs={jobs.data.results} />
            <Pagination
              count={jobs.data.count}
              page={page}
              onChange={setPage}
            />
          </>
        ) : (
          !jobs.error && (
            <Empty
              title="La storia inizia da qui"
              detail="Gli appuntamenti collegati a questo cliente compariranno in questa sezione."
            />
          )
        )}
      </section>
      <div className="danger-zone">
        <p>
          Le anagrafiche collegate a interventi non possono essere eliminate.
        </p>
        <button
          className="text-button danger-text"
          onClick={() => {
            setRemove(true);
            setError(null);
          }}
        >
          Elimina cliente
        </button>
      </div>
      {edit && (
        <CustomerForm
          customer={customer}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            setNotice("Dati cliente aggiornati.");
          }}
        />
      )}
      {create && (
        <JobForm
          initialCustomer={customer}
          onClose={() => setCreate(false)}
          onSaved={() => {
            setCreate(false);
            setNotice("Appuntamento creato.");
          }}
        />
      )}
      {remove && (
        <Modal
          title="Eliminare il cliente?"
          description={`${customerName(customer)} verrà rimosso dall’archivio. L’operazione è definitiva.`}
          open
          onClose={() => !busy && setRemove(false)}
        >
          <ErrorBox error={error} />
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemove(false)}
            >
              Annulla
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await send(`customers/${id}/`, "DELETE");
                  setDeleted(true);
                  setRemove(false);
                  await invalidate();
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Eliminazione…" : "Elimina definitivamente"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
