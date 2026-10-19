"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import itLocale from "@fullcalendar/core/locales/it";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateTime } from "luxon";
import { Plus } from "lucide-react";
import { all, send, qs } from "@/lib/api";
import { Job, priorities, statuses } from "@/lib/types";
import { dayWindow, today, zone } from "@/lib/time";
import { ErrorBox, Loading, Empty } from "./ui";
import { JobForm, useInvalidate } from "./forms";
import { JobFilters, PageHeading } from "./jobs";
const colors: Record<string, string> = {
  scheduled: "#667085",
  assigned: "#2563eb",
  confirmed: "#007e87",
  travelling: "#7752bd",
  working: "#b8690c",
  completed: "#20815a",
  absent: "#b23d36",
  cancelled: "#667085",
  reschedule: "#9d5a13",
};
export default function CalendarPage() {
  const router = useRouter(),
    invalidate = useInvalidate();
  const [range, setRange] = useState(dayWindow(today())),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [technician, setTechnician] = useState(""),
    [create, setCreate] = useState(false),
    [initial, setInitial] = useState<string>(),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [moving, setMoving] = useState(false);
  const params = qs({ ...range, search, status, technician });
  const jobs = useQuery({
    queryKey: ["calendar", params],
    queryFn: () => all<Job>(`interventions/?${params}`),
    refetchInterval: 30000,
  });
  return (
    <>
      <PageHeading
        eyebrow="TEMPO BEN ORGANIZZATO"
        title="Calendario interventi"
        description="Pianifica la settimana. Sposta un appuntamento per riprogrammarlo."
        action={
          <button
            className="button"
            onClick={() => {
              setInitial(undefined);
              setCreate(true);
            }}
          >
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
      <ErrorBox error={error} />
      <section className="panel calendar-panel">
        <div className="filters">
          <JobFilters
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            technician={technician}
            setTechnician={setTechnician}
          />
        </div>
        <div className="calendar-note">
          <span className="live-dot" />
          Orari Europe/Rome · Clicca su un evento per modificarlo · Disponibile
          anche da tastiera nel dettaglio intervento.
        </div>
        <ErrorBox error={jobs.error} retry={() => jobs.refetch()} />
        {jobs.isPending && <Loading />}
        <div
          className="calendar-container"
          aria-label="Calendario appuntamenti"
        >
          <FullCalendar
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
              luxonPlugin,
            ]}
            locale={itLocale}
            timeZone={zone}
            initialView="timeGridWeek"
            initialDate={
              typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("date") ||
                  undefined
                : undefined
            }
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridDay,timeGridWeek,dayGridMonth",
            }}
            buttonText={{
              today: "Oggi",
              day: "Giorno",
              week: "Settimana",
              month: "Mese",
            }}
            allDaySlot={false}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            height="auto"
            nowIndicator
            firstDay={1}
            selectable={!moving}
            editable={!moving}
            eventDurationEditable={!moving}
            datesSet={(info) =>
              setRange({
                start: info.start.toISOString(),
                end: info.end.toISOString(),
              })
            }
            select={(info) => {
              if (info.allDay) {
                setInitial(
                  DateTime.fromISO(info.startStr, { zone })
                    .set({ hour: 9 })
                    .toUTC()
                    .toISO()!,
                );
              } else setInitial(info.start.toISOString());
              setCreate(true);
            }}
            events={(jobs.data || []).map((j) => ({
              id: j.id,
              title: `${j.title} · ${j.customer_name}`,
              start: j.starts_at,
              end: j.ends_at,
              backgroundColor: colors[j.status],
              borderColor:
                j.priority === "urgent" ? "#e04437" : colors[j.status],
              classNames: [`event-priority-${j.priority}`],
              startEditable: j.planning_editable,
              durationEditable: j.planning_editable,
              extendedProps: { job: j },
            }))}
            eventDidMount={(info) => {
              const j = info.event.extendedProps.job as Job;
              info.el.setAttribute(
                "title",
                `${j.title} · ${statuses[j.status]} · Priorità ${priorities[j.priority]}`,
              );
              info.el.setAttribute("tabindex", "0");
              info.el.onkeydown = (e) => {
                if (e.key === "Enter") router.push(`/interventi/${j.id}`);
              };
            }}
            eventClick={(info) => router.push(`/interventi/${info.event.id}`)}
            eventDrop={async (info) => {
              setMoving(true);
              setError(null);
              const j = info.event.extendedProps.job as Job;
              try {
                await send(`interventions/${j.id}/`, "PATCH", {
                  version: j.version,
                  starts_at: info.event.start!.toISOString(),
                  ends_at: info.event.end!.toISOString(),
                });
                setNotice("Appuntamento riprogrammato.");
              } catch (e) {
                info.revert();
                setError(e);
              } finally {
                await invalidate();
                setMoving(false);
              }
            }}
            eventResize={async (info) => {
              setMoving(true);
              setError(null);
              const j = info.event.extendedProps.job as Job;
              try {
                await send(`interventions/${j.id}/`, "PATCH", {
                  version: j.version,
                  starts_at: info.event.start!.toISOString(),
                  ends_at: info.event.end!.toISOString(),
                });
                setNotice("Durata aggiornata.");
              } catch (e) {
                info.revert();
                setError(e);
              } finally {
                await invalidate();
                setMoving(false);
              }
            }}
          />
        </div>
        {!jobs.isPending && !jobs.error && jobs.data?.length === 0 && (
          <div className="calendar-empty">
            <Empty
              title="Nessun appuntamento in questa vista"
              detail="Seleziona un orario oppure usa Nuovo appuntamento."
            />
          </div>
        )}
        <div className="calendar-legend">
          {["assigned", "working", "completed", "reschedule"].map((s) => (
            <span key={s}>
              <i style={{ background: colors[s] }} />
              {statuses[s]}
            </span>
          ))}
          <span>
            <i className="urgent-dot" />
            Bordo rosso: urgente
          </span>
        </div>
      </section>
      {create && (
        <JobForm
          initialDate={initial}
          onClose={() => setCreate(false)}
          onSaved={() => {
            setCreate(false);
            setNotice("Appuntamento aggiunto al calendario.");
          }}
        />
      )}
    </>
  );
}
