"use client";
import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { api, all, send, qs, ApiError } from "@/lib/api";
import {
  Customer,
  Job,
  Page,
  Technician,
  customerName,
  person,
  priorities,
} from "@/lib/types";
import { localInput, utcInput, zone } from "@/lib/time";
import { Modal, Field, ErrorBox } from "./ui";

export function useInvalidate() {
  const cache = useQueryClient();
  return () =>
    cache.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
}
export function CustomerFields({ customer }: { customer?: Customer }) {
  return (
    <div className="form-grid">
      <Field label="Nome *">
        <input
          name="first_name"
          required
          maxLength={120}
          defaultValue={customer?.first_name}
        />
      </Field>
      <Field label="Cognome o ragione sociale *">
        <input
          name="last_name_or_company"
          required
          maxLength={180}
          defaultValue={customer?.last_name_or_company}
        />
      </Field>
      <Field label="Telefono *">
        <input
          name="phone"
          type="tel"
          required
          maxLength={32}
          defaultValue={customer?.phone}
        />
      </Field>
      <Field label="Email">
        <input name="email" type="email" defaultValue={customer?.email} />
      </Field>
      <Field label="Indirizzo *">
        <input
          name="address"
          required
          maxLength={255}
          defaultValue={customer?.address}
        />
      </Field>
      <Field label="Città *">
        <input
          name="city"
          required
          maxLength={120}
          defaultValue={customer?.city}
        />
      </Field>
      <Field label="CAP *">
        <input
          name="postal_code"
          required
          maxLength={16}
          defaultValue={customer?.postal_code}
        />
      </Field>
      <Field label="Note ufficio">
        <textarea name="notes" rows={2} defaultValue={customer?.notes} />
      </Field>
    </div>
  );
}
export function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const invalidate = useInvalidate();
  return (
    <Modal
      title={customer ? "Modifica cliente" : "Nuovo cliente"}
      open
      onClose={onClose}
      wide
    >
      <form
        onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const data = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await send<Customer>(
              customer ? `customers/${customer.id}/` : "customers/",
              customer ? "PATCH" : "POST",
              data,
            );
            await invalidate();
            onSaved(result);
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <CustomerFields customer={customer} />
        <ErrorBox error={error} />
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Annulla
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Salvataggio…" : "Salva cliente"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function JobForm({
  job,
  initialDate,
  initialCustomer,
  onClose,
  onSaved,
}: {
  job?: Job;
  initialDate?: string;
  initialCustomer?: Customer;
  onClose: () => void;
  onSaved: (j: Job) => void;
}) {
  // Preserve the version that the user actually opened, even if background polling refreshes the detail.
  const [snapshot] = useState(job);
  job = snapshot;
  const [address, setAddress] = useState(
    job?.address || initialCustomer?.address || "",
  );
  const [search, setSearch] = useState(""),
    [customerId, setCustomerId] = useState(
      job?.customer || initialCustomer?.id || "",
    ),
    [created, setCreated] = useState<Customer>(),
    [newCustomer, setNewCustomer] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState("");
  const customers = useQuery({
    queryKey: ["customer-options", search],
    queryFn: () => api<Page<Customer>>(`customers/?${qs({ search })}`),
  });
  const technicians = useQuery({
    queryKey: ["technician-options"],
    queryFn: () => all<Technician>("technicians/"),
  });
  const invalidate = useInvalidate();
  const planning = !job || job.planning_editable;
  const start = job
    ? localInput(job.starts_at)
    : initialDate
      ? localInput(initialDate)
      : DateTime.now()
          .setZone(zone)
          .plus({ days: 1 })
          .set({ hour: 9, minute: 0 })
          .toFormat("yyyy-MM-dd'T'HH:mm");
  const end = job
    ? localInput(job.ends_at)
    : DateTime.fromISO(start, { zone })
        .plus({ hours: 1 })
        .toFormat("yyyy-MM-dd'T'HH:mm");
  const selected = created || initialCustomer;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const data: Record<string, unknown> = {
        title: values.title,
        description: values.description,
        intervention_type: values.intervention_type,
        priority: values.priority,
        office_notes: values.office_notes,
        technician_notes: values.technician_notes || "",
      };
      if (planning) {
        const starts_at = utcInput(String(values.starts_at)),
          ends_at = utcInput(String(values.ends_at));
        if (ends_at <= starts_at)
          throw new Error("La fine deve essere successiva all’inizio.");
        let id = customerId;
        if (newCustomer) {
          // Persist the customer once. A scheduling conflict leaves it selected for the retry.
          const saved = await send<Customer>("customers/", "POST", {
            first_name: values.quick_first_name,
            last_name_or_company: values.quick_last_name_or_company,
            phone: values.quick_phone,
            email: "",
            address: values.address,
            city: values.quick_city,
            postal_code: values.quick_postal_code,
          });
          id = saved.id;
          setCreated(saved);
          setCustomerId(saved.id);
          setNewCustomer(false);
          setNotice(
            "Cliente salvato. Se il calendario segnala un conflitto, scegli un altro orario e riprova.",
          );
          await invalidate();
        }
        if (!id)
          throw new Error("Seleziona un cliente o crea una nuova anagrafica.");
        Object.assign(data, {
          customer: id,
          technician: values.technician ? Number(values.technician) : null,
          starts_at,
          ends_at,
          address: values.address,
        });
      }
      if (job) {
        for (const key of Object.keys(data))
          if (data[key] === (job as unknown as Record<string, unknown>)[key])
            delete data[key];
        // ISO formatting may differ even for the same instant.
        for (const key of ["starts_at", "ends_at"] as const)
          if (
            data[key] &&
            Date.parse(String(data[key])) === Date.parse(job[key])
          )
            delete data[key];
        data.version = job.version;
      }
      const result = await send<Job>(
        job ? `interventions/${job.id}/` : "interventions/",
        job ? "PATCH" : "POST",
        data,
      );
      await invalidate();
      onSaved(result);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={job ? "Modifica intervento" : "Nuovo appuntamento"}
      description={`Pianifica in orario ${zone}. Il server controlla disponibilità e sovrapposizioni.`}
      open
      onClose={() => !busy && onClose()}
      wide
    >
      <form onSubmit={submit}>
        {planning && (
          <>
            <div className="form-section">
              <h3>01 / Cliente</h3>
              {!job && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setNewCustomer(!newCustomer)}
                >
                  {newCustomer
                    ? "Cerca cliente esistente"
                    : "+ Crea cliente durante la chiamata"}
                </button>
              )}
            </div>
            {newCustomer ? (
              <div className="form-grid" key="new-customer">
                <Field label="Nome *">
                  <input name="quick_first_name" required />
                </Field>
                <Field label="Cognome o ragione sociale *">
                  <input name="quick_last_name_or_company" required />
                </Field>
                <Field label="Telefono *">
                  <input name="quick_phone" type="tel" required />
                </Field>
                <Field label="Città *">
                  <input name="quick_city" required />
                </Field>
                <Field label="CAP *">
                  <input name="quick_postal_code" required />
                </Field>
              </div>
            ) : (
              <div className="form-grid" key="existing-customer">
                <Field label="Cerca cliente">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nome, telefono o indirizzo"
                  />
                </Field>
                <Field
                  label="Cliente *"
                  hint="La ricerca mostra fino a 25 corrispondenze."
                >
                  <select
                    required
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      const c = customers.data?.results.find(
                        (c) => c.id === e.target.value,
                      );
                      if (c) setAddress(c.address);
                    }}
                  >
                    <option value="">Seleziona cliente</option>
                    {customerId &&
                      !customers.data?.results.some(
                        (c) => c.id === customerId,
                      ) && (
                        <option value={customerId}>
                          {selected
                            ? customerName(selected)
                            : job?.customer_name || "Cliente selezionato"}
                        </option>
                      )}
                    {customers.data?.results.map((c) => (
                      <option key={c.id} value={c.id}>
                        {customerName(c)} · {c.phone}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            <ErrorBox error={customers.error} />
          </>
        )}
        <div className="form-section">
          <h3>02 / Intervento</h3>
        </div>
        <div className="form-grid">
          <Field label="Titolo *">
            <input
              name="title"
              defaultValue={job?.title}
              required
              maxLength={180}
            />
          </Field>
          <Field label="Tipo di intervento *">
            <input
              name="intervention_type"
              defaultValue={job?.intervention_type || "Riparazione"}
              required
              maxLength={80}
            />
          </Field>
          <Field label="Problema segnalato *">
            <textarea
              name="description"
              defaultValue={job?.description}
              required
              rows={3}
            />
          </Field>
          <Field label="Priorità">
            <select name="priority" defaultValue={job?.priority || "normal"}>
              {Object.entries(priorities).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {planning && (
            <>
              <Field label="Indirizzo intervento *">
                <input
                  name="address"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={255}
                />
              </Field>
              <Field label="Tecnico">
                <select name="technician" defaultValue={job?.technician || ""}>
                  <option value="">Da assegnare</option>
                  {technicians.data?.map((t) => (
                    <option key={t.id} value={t.id} disabled={!t.is_active}>
                      {person(t)}
                      {!t.is_active ? " (disattivato)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Inizio *">
                <input
                  name="starts_at"
                  type="datetime-local"
                  required
                  defaultValue={start}
                />
              </Field>
              <Field label="Fine prevista *">
                <input
                  name="ends_at"
                  type="datetime-local"
                  required
                  defaultValue={end}
                />
              </Field>
            </>
          )}
          <Field label="Note ufficio">
            <textarea
              name="office_notes"
              defaultValue={job?.office_notes}
              rows={2}
            />
          </Field>
          <Field label="Note tecnico">
            <textarea
              name="technician_notes"
              defaultValue={job?.technician_notes}
              rows={2}
            />
          </Field>
        </div>
        {!planning && (
          <p className="muted">
            La pianificazione è bloccata nello stato attuale dell’intervento.
          </p>
        )}
        <ErrorBox error={technicians.error} />
        {notice && (
          <p role="status" className="success-box">
            {notice}
          </p>
        )}
        <ErrorBox error={error} />
        {error instanceof ApiError && error.status === 409 && job && (
          <p>
            Chiudi e ricarica il dettaglio per usare la versione aggiornata.
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Annulla
          </button>
          <button
            className="button"
            disabled={busy || technicians.isPending || !!technicians.error}
          >
            {busy
              ? "Salvataggio…"
              : job
                ? "Salva modifiche"
                : "Crea appuntamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
