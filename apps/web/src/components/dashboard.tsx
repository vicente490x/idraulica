"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowRight,
  CalendarDays,
  CheckCheck,
  Timer,
  Flame,
  PauseCircle,
  HardHat,
} from "lucide-react";
import { DateTime } from "luxon";
import { api } from "@/lib/api";
import { Overview, Job, Page } from "@/lib/types";
import { today, dayWindow, displayDate, zone } from "@/lib/time";
import { Loading, ErrorBox, Empty, Badge } from "./ui";
import { JobForm } from "./forms";
import { PageHeading, JobsTable } from "./jobs";
export default function Dashboard() {
  const [day, setDay] = useState(today()),
    [create, setCreate] = useState(false),
    [notice, setNotice] = useState("");
  const overview = useQuery({
    queryKey: ["overview", day],
    queryFn: () => api<Overview>(`office/overview/?date=${day}`),
    refetchInterval: 30000,
  });
  const range = dayWindow(day);
  const jobs = useQuery({
    queryKey: ["day-jobs", day],
    queryFn: () =>
      api<Page<Job>>(
        `interventions/?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}&ordering=starts_at`,
      ),
    refetchInterval: 30000,
  });
  const counts = overview.data?.counts;
  const cards = [
    {
      label: "Appuntamenti",
      value: counts?.total,
      icon: CalendarDays,
      detail: "nella giornata",
      style: "blue",
    },
    {
      label: "In lavorazione",
      value: counts?.working,
      icon: Timer,
      detail: "sul campo adesso",
      style: "teal",
    },
    {
      label: "Completati",
      value: counts?.completed,
      icon: CheckCheck,
      detail: "lavori conclusi",
      style: "green",
    },
    {
      label: "Urgenze aperte",
      value: counts?.urgent,
      icon: Flame,
      detail: "richiedono attenzione",
      style: "orange",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="LA TUA CENTRALE OPERATIVA"
        title="Una giornata sotto controllo."
        description={DateTime.fromISO(day, { zone })
          .setLocale("it")
          .toFormat("cccc d LLLL yyyy")}
        action={
          <button className="button" onClick={() => setCreate(true)}>
            <Plus size={18} />
            Nuovo appuntamento
          </button>
        }
      />
      {notice && (
        <p role="status" className="toast">
          {notice}
        </p>
      )}
      <div className="dashboard-banner">
        <div>
          <span className="live-dot" />
          AGENDA DI LAVORO <span className="banner-separator">/</span>
          <strong>Ogni aggiornamento, una squadra più allineata.</strong>
        </div>
        <label className="date-picker">
          Giornata
          <input
            aria-label="Giornata dashboard"
            type="date"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
        </label>
      </div>
      <ErrorBox error={overview.error} retry={() => overview.refetch()} />
      <div className="stat-grid">
        {cards.map(({ label, value, icon: Icon, detail, style }) => (
          <article className={`stat-card stat-${style}`} key={label}>
            <div>
              <span>{label}</span>
              <Icon size={21} />
            </div>
            <strong>{value === undefined ? "—" : value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-body">
        <section className="panel agenda-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PROGRAMMA DEL GIORNO</span>
              <h2>
                L’agenda della squadra{" "}
                <span className="count-pill">{jobs.data?.count || 0}</span>
              </h2>
            </div>
            <Link className="text-button" href={`/calendario?date=${day}`}>
              Apri calendario <ArrowRight size={16} />
            </Link>
          </div>
          <ErrorBox error={jobs.error} retry={() => jobs.refetch()} />
          {jobs.isPending ? (
            <Loading />
          ) : jobs.data?.results.length ? (
            <>
              <JobsTable jobs={jobs.data.results} />
              {jobs.data.next && (
                <div className="panel-bottom">
                  <Link href={`/interventi?date=${day}`}>
                    Vedi tutti gli appuntamenti della giornata →
                  </Link>
                </div>
              )}
            </>
          ) : (
            !jobs.error && (
              <Empty
                title="Spazio per il prossimo lavoro"
                detail="Non ci sono appuntamenti per questa giornata."
                action={
                  <button
                    className="button secondary"
                    onClick={() => setCreate(true)}
                  >
                    Pianifica un intervento
                  </button>
                }
              />
            )
          )}
        </section>
        <section className="panel activity-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">DAL CAMPO ALL’UFFICIO</span>
              <h2>Ultimi aggiornamenti</h2>
            </div>
            <span className="live-dot" />
          </div>
          {overview.isPending ? (
            <Loading />
          ) : overview.data?.recent.length ? (
            <ol className="activity-list">
              {overview.data.recent.map((r) => (
                <li key={r.id}>
                  <span className="activity-node" />
                  <div>
                    <Link href={`/interventi/${r.intervention_id}`}>
                      {r.title}
                    </Link>
                    <Badge status={r.status} />
                    <time>{displayDate(r.created_at, "dd LLL · HH:mm")}</time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            !overview.error && (
              <Empty
                title="Tutto pronto"
                detail="I cambi di stato saranno visibili qui."
              />
            )
          )}
        </section>
      </div>
      <div className="lower-grid">
        <Link className="summary-tile" href="/tecnici">
          <span className="summary-icon">
            <HardHat />
          </span>
          <div>
            <span>Tecnici disponibili ora</span>
            <strong>
              {counts?.available_technicians ?? "—"}{" "}
              <small>pronti per il prossimo intervento</small>
            </strong>
          </div>
          <ArrowRight size={20} />
        </Link>
        <Link className="summary-tile" href="/interventi">
          <span className="summary-icon amber">
            <PauseCircle />
          </span>
          <div>
            <span>Interventi in sospeso</span>
            <strong>
              {counts?.pending ?? "—"}{" "}
              <small>programmati o da riprendere nella giornata</small>
            </strong>
          </div>
          <ArrowRight size={20} />
        </Link>
      </div>
      {create && (
        <JobForm
          initialDate={DateTime.fromISO(day, { zone })
            .set({ hour: 9 })
            .toUTC()
            .toISO()!}
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
