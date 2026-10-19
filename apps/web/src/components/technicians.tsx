"use client";
import { useState, FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { HardHat, Plus, CalendarDays } from "lucide-react";
import { api, all, send, qs } from "@/lib/api";
import {
  Technician,
  User,
  Overview,
  Job,
  Page,
  Absence,
  person,
} from "@/lib/types";
import { today, zone, displayDate, utcInput, dayWindow } from "@/lib/time";
import { PageHeading, JobsTable } from "./jobs";
import { ErrorBox, Loading, Empty, Field, Modal, Pagination } from "./ui";
import { useInvalidate } from "./forms";
export default function TechniciansPage() {
  const [day, setDay] = useState(today()),
    [focus, setFocus] = useState(""),
    [period, setPeriod] = useState("day"),
    [page, setPage] = useState(1),
    [absence, setAbsence] = useState(false),
    [add, setAdd] = useState(false),
    [remove, setRemove] = useState<Absence>(),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const invalidate = useInvalidate();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("auth/me/"),
  });
  const techs = useQuery({
    queryKey: ["technician-options"],
    queryFn: () => all<Technician>("technicians/"),
  });
  const overview = useQuery({
    queryKey: ["overview", day],
    queryFn: () => api<Overview>(`office/overview/?date=${day}`),
    refetchInterval: 30000,
  });
  const date = DateTime.fromISO(day, { zone });
  const range =
    period === "day"
      ? dayWindow(day)
      : {
          start: date.startOf("week").toUTC().toISO()!,
          end: date.startOf("week").plus({ weeks: 1 }).toUTC().toISO()!,
        };
  const params = qs({ technician: focus, ...range, page });
  const jobs = useQuery({
    queryKey: ["technician-jobs", params],
    queryFn: () => api<Page<Job>>(`interventions/?${params}`),
    enabled: !!focus,
  });
  const absences = useQuery({
    queryKey: ["absences", focus],
    queryFn: () => all<Absence>(`availability/?technician=${focus}`),
    enabled: !!focus,
  });
  async function submit(
    e: FormEvent<HTMLFormElement>,
    kind: "absence" | "technician",
  ) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (kind === "absence") {
        const starts_at = utcInput(String(data.starts_at)),
          ends_at = utcInput(String(data.ends_at));
        if (ends_at <= starts_at)
          throw new Error("La fine deve essere successiva all’inizio.");
        await send("availability/", "POST", {
          technician: Number(focus),
          starts_at,
          ends_at,
          available: false,
        });
        setAbsence(false);
        setNotice("Indisponibilità registrata.");
      } else {
        await send("users/", "POST", { ...data, role: "technician" });
        setAdd(false);
        setNotice("Account tecnico creato.");
      }
      await invalidate();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const selected = techs.data?.find((t) => String(t.id) === focus);
  return (
    <>
      <PageHeading
        eyebrow="LE PERSONE, AL CENTRO"
        title="La tua squadra"
        description="Disponibilità attuale, agenda individuale e carico di lavoro pianificato."
        action={
          me.data?.role === "admin" && (
            <button
              className="button"
              onClick={() => {
                setAdd(true);
                setError(null);
              }}
            >
              <Plus size={18} />
              Nuovo tecnico
            </button>
          )
        }
      />
      {notice && (
        <p className="toast" role="status">
          {notice}
        </p>
      )}
      <div className="section-heading standalone">
        <h2>Carico di lavoro</h2>
        <Field label="Giornata di riferimento">
          <input
            aria-label="Giornata tecnici"
            type="date"
            value={day}
            onChange={(e) => {
              if (e.target.value) {
                setDay(e.target.value);
                setPage(1);
              }
            }}
          />
        </Field>
      </div>
      <ErrorBox error={techs.error} retry={() => techs.refetch()} />
      <ErrorBox error={overview.error} retry={() => overview.refetch()} />
      {techs.isPending ? (
        <Loading />
      ) : techs.data?.length ? (
        <div className="technician-grid">
          {techs.data.map((t) => {
            const work = overview.data?.technicians.find((w) => w.id === t.id);
            return (
              <article
                className={`panel technician-card ${focus === String(t.id) ? "selected" : ""}`}
                key={t.id}
              >
                <div className="technician-top">
                  <span className="tech-avatar">
                    <HardHat size={25} />
                  </span>
                  <span
                    className={`badge ${!t.is_active ? "status-cancelled" : work?.available_now ? "status-completed" : "status-working"}`}
                  >
                    {!t.is_active
                      ? "Disattivato"
                      : work
                        ? work.available_now
                          ? "Disponibile ora"
                          : "Occupato / indisponibile"
                        : "Disponibilità in caricamento"}
                  </span>
                </div>
                <h2>{person(t)}</h2>
                <p>
                  {t.phone ? (
                    <a href={`tel:${t.phone}`}>{t.phone}</a>
                  ) : (
                    "Telefono non indicato"
                  )}
                </p>
                <div className="workload">
                  <div>
                    <strong>{work?.day_count ?? "—"}</strong>
                    <span>lavori del giorno</span>
                    <small>{work?.day_hours ?? "—"} ore previste</small>
                  </div>
                  <div>
                    <strong>{work?.week_count ?? "—"}</strong>
                    <span>lavori della settimana</span>
                    <small>{work?.week_hours ?? "—"} ore previste</small>
                  </div>
                </div>
                {work?.unavailable_today && (
                  <p className="availability-note">
                    Indisponibilità presente nella giornata
                  </p>
                )}
                <button
                  className="button secondary full"
                  onClick={() => {
                    setFocus(String(t.id));
                    setPage(1);
                    setNotice("");
                  }}
                >
                  <CalendarDays size={16} />
                  Apri agenda di {t.first_name || `#${t.id}`}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        !techs.error && (
          <Empty
            title="La squadra prende forma"
            detail="L’amministratore può creare gli account dei tecnici."
          />
        )
      )}
      {selected && (
        <>
          <section className="panel">
            <div className="section-heading">
              <h2>Agenda · {person(selected)}</h2>
              <div className="button-row">
                <button
                  className={`button secondary ${period === "day" ? "active" : ""}`}
                  aria-pressed={period === "day"}
                  onClick={() => {
                    setPeriod("day");
                    setPage(1);
                  }}
                >
                  Giorno
                </button>
                <button
                  className={`button secondary ${period === "week" ? "active" : ""}`}
                  aria-pressed={period === "week"}
                  onClick={() => {
                    setPeriod("week");
                    setPage(1);
                  }}
                >
                  Settimana
                </button>
                <button
                  className="button"
                  disabled={!selected.is_active}
                  onClick={() => {
                    setAbsence(true);
                    setError(null);
                  }}
                >
                  Segna indisponibilità
                </button>
              </div>
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
                  title="Agenda libera"
                  detail="Non ci sono interventi per il periodo selezionato."
                />
              )
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>Intervalli di indisponibilità</h2>
            </div>
            <ErrorBox error={absences.error} retry={() => absences.refetch()} />
            {absences.isPending ? (
              <Loading />
            ) : absences.data?.length ? (
              <ul className="absence-list">
                {absences.data.map((a) => (
                  <li key={a.id}>
                    <span>
                      {displayDate(a.starts_at)} → {displayDate(a.ends_at)}
                    </span>
                    <button
                      className="text-button danger-text"
                      onClick={() => {
                        setRemove(a);
                        setError(null);
                      }}
                    >
                      Rimuovi intervallo
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              !absences.error && (
                <p className="panel-message">Nessun intervallo registrato.</p>
              )
            )}
          </section>
        </>
      )}
      {absence && (
        <Modal
          open
          onClose={() => !busy && setAbsence(false)}
          title="Indisponibilità tecnico"
          description={`${selected ? person(selected) : ""} · Gli intervalli con lavori già assegnati saranno rifiutati.`}
        >
          <form onSubmit={(e) => submit(e, "absence")}>
            <Field label="Inizio *">
              <input
                name="starts_at"
                type="datetime-local"
                required
                defaultValue={`${day}T08:00`}
              />
            </Field>
            <Field label="Fine *">
              <input
                name="ends_at"
                type="datetime-local"
                required
                defaultValue={`${day}T18:00`}
              />
            </Field>
            <ErrorBox error={error} />
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setAbsence(false)}
              >
                Annulla
              </button>
              <button className="button" disabled={busy}>
                {busy ? "Salvataggio…" : "Registra indisponibilità"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {add && (
        <Modal
          open
          onClose={() => !busy && setAdd(false)}
          title="Crea account tecnico"
        >
          <form onSubmit={(e) => submit(e, "technician")}>
            <div className="form-grid">
              <Field label="Nome *">
                <input name="first_name" required />
              </Field>
              <Field label="Cognome *">
                <input name="last_name" required />
              </Field>
              <Field label="Email *">
                <input name="email" type="email" autoComplete="off" required />
              </Field>
              <Field label="Telefono">
                <input name="phone" type="tel" />
              </Field>
            </div>
            <Field
              label="Password iniziale *"
              hint="Almeno 12 caratteri. Comunicarla al tecnico tramite un canale aziendale sicuro."
            >
              <input
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </Field>
            <ErrorBox error={error} />
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setAdd(false)}
              >
                Annulla
              </button>
              <button className="button" disabled={busy}>
                {busy ? "Creazione…" : "Crea tecnico"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          open
          onClose={() => !busy && setRemove(undefined)}
          title="Rimuovere l’indisponibilità?"
          description={`${displayDate(remove.starts_at)} → ${displayDate(remove.ends_at)}`}
        >
          <p>Il tecnico tornerà assegnabile in questo intervallo.</p>
          <ErrorBox error={error} />
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemove(undefined)}
            >
              Annulla
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await send(`availability/${remove.id}/`, "DELETE");
                  setRemove(undefined);
                  await invalidate();
                  setNotice("Indisponibilità rimossa.");
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Rimozione…" : "Conferma rimozione"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
