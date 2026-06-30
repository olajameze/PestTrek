import { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import { Skeleton } from '../ui/Skeleton';
import Button from '../ui/Button';
import AppointmentModal from './AppointmentModal';
import AppointmentDetailsPanel from './AppointmentDetailsPanel';
import DeleteAppointmentDialog from './DeleteAppointmentDialog';
import WorkloadPanel from './WorkloadPanel';
import type { AppointmentDTO, CalendarView, RecurrenceScope } from '../../lib/scheduling/types';
import Link from 'next/link';
import {
  createAppointment,
  createRecurringSeries,
  deleteAppointment,
  fetchCalendar,
  fetchTeamWorkload,
  fetchTechnicians,
  moveAppointment,
  updateAppointment,
} from '../../lib/api/schedulingClient';

import {
  getSchedulingDemoAppointments,
  getSchedulingDemoTechnicians,
  getSchedulingDemoWorkload,
} from '../../lib/scheduling/demoData';

type TechnicianOption = { id: string; name: string; email: string };

export default function SchedulingCalendar({
  canWrite,
  demoMode = false,
}: {
  canWrite: boolean;
  demoMode?: boolean;
}) {
  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [workload, setWorkload] = useState<Array<{ technicianId: string; name: string; appointmentCount: number; totalMinutes: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AppointmentDTO | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (demoMode) {
        setAppointments(getSchedulingDemoAppointments());
        setTechnicians(getSchedulingDemoTechnicians());
        setWorkload(getSchedulingDemoWorkload());
        return;
      }
      const [calendar, techs] = await Promise.all([fetchCalendar(view, anchor), fetchTechnicians()]);
      setAppointments(calendar.appointments);
      setTechnicians(techs);
      const start = range?.start ?? new Date(calendar.start);
      const end = range?.end ?? new Date(calendar.end);
      if (techs[0]) {
        const team = await fetchTeamWorkload(start, end, techs[0].id);
        setWorkload(team.teamWorkload);
      } else {
        setWorkload([]);
      }
    } finally {
      setLoading(false);
    }
  }, [view, anchor, range, demoMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const events = useMemo(
    () =>
      appointments.map((appt) => ({
        id: appt.id,
        title: appt.clientName,
        start: appt.scheduledStart,
        end: appt.scheduledEnd,
        extendedProps: { appointment: appt },
        backgroundColor: appt.status === 'completed' ? '#059669' : appt.status === 'cancelled' ? '#94a3b8' : undefined,
      })),
    [appointments],
  );

  const handleDatesSet = (arg: DatesSetArg) => {
    setRange({ start: arg.start, end: arg.end });
    setAnchor(arg.start);
  };

  const handleEventClick = (arg: EventClickArg) => {
    const appt = arg.event.extendedProps.appointment as AppointmentDTO | undefined;
    if (appt) setSelected(appt);
  };

  const handleEventDrop = async (arg: EventDropArg) => {
    if (!canWrite) {
      arg.revert();
      return;
    }
    const appt = arg.event.extendedProps.appointment as AppointmentDTO | undefined;
    if (!appt) {
      arg.revert();
      return;
    }
    try {
      const start = arg.event.start ?? new Date(appt.scheduledStart);
      const end = arg.event.end ?? new Date(appt.scheduledEnd);
      await moveAppointment(appt.id, {
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        scope: appt.recurringAppointmentId ? 'occurrence' : 'occurrence',
      });
      await load();
    } catch {
      arg.revert();
    }
  };

  const openCreate = (start?: Date, end?: Date) => {
    if (!canWrite) return;
    setModalMode('create');
    setSelected({
      id: '',
      companyId: '',
      logbookEntryId: null,
      recurringAppointmentId: null,
      clientName: '',
      address: '',
      postcode: null,
      treatment: null,
      notes: null,
      scheduledStart: (start ?? new Date()).toISOString(),
      scheduledEnd: (end ?? new Date(Date.now() + 3600000)).toISOString(),
      status: 'scheduled',
      technicians: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setModalOpen(true);
  };

  const calendarPlugins = useMemo(() => [dayGridPlugin, timeGridPlugin, interactionPlugin], []);
  const initialView = view === 'day' ? 'timeGridDay' : view === 'month' ? 'dayGridMonth' : 'timeGridWeek';

  return (
    <div className="space-y-6">
      {demoMode ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Local demo mode — sample data only.{' '}
          <Link href="/auth/signin" className="font-semibold underline">
            Sign in
          </Link>{' '}
          for live scheduling.
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Smart Scheduling</p>
          <h1 className="text-2xl font-semibold text-navy">Calendar</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['day', 'week', 'month'] as CalendarView[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${
                view === item ? 'bg-primary-500 text-white' : 'bg-zinc-100 text-zinc-700'
              }`}
            >
              {item}
            </button>
          ))}
          {canWrite ? (
            <Button type="button" onClick={() => openCreate()}>
              New appointment
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="scheduling-calendar rounded-3xl border border-zinc-200 bg-white p-4">
          {loading ? (
            <Skeleton className="h-[640px] w-full" />
          ) : appointments.length === 0 ? (
            <div className="mb-4 rounded-2xl border border-dashed border-zinc-200 bg-slate-50 p-6 text-sm text-slate-600">
              No appointments in this range yet.
              {canWrite ? ' Create one to get started.' : null}
            </div>
          ) : null}
          <FullCalendar
            plugins={calendarPlugins}
            initialView={initialView}
            key={view}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            height="auto"
            events={events}
            editable={canWrite}
            selectable={canWrite}
            selectMirror
            nowIndicator
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            select={(selection) => openCreate(selection.start, selection.end)}
          />
        </div>

        <div className="space-y-4">
          <AppointmentDetailsPanel
            appointment={selected}
            canWrite={canWrite}
            onEdit={() => {
              setModalMode('edit');
              setModalOpen(true);
            }}
            onDelete={() => setDeleteOpen(true)}
            onComplete={async () => {
              if (!selected) return;
              await updateAppointment(selected.id, { status: 'completed' });
              await load();
              setSelected(null);
            }}
            onClose={() => setSelected(null)}
          />
          <WorkloadPanel workload={workload} loading={loading} />
        </div>
      </div>

      <AppointmentModal
        open={modalOpen}
        mode={modalMode}
        initial={selected ?? undefined}
        technicians={technicians}
        canWrite={canWrite}
        onClose={() => setModalOpen(false)}
        onSave={async (payload, scope) => {
          if (modalMode === 'create') {
            await createAppointment(payload as never);
          } else if (selected) {
            await updateAppointment(selected.id, payload as never, scope);
          }
          await load();
        }}
        onSaveRecurring={async (payload) => {
          await createRecurringSeries(payload as never);
          await load();
        }}
      />

      <DeleteAppointmentDialog
        open={deleteOpen}
        hasSeries={Boolean(selected?.recurringAppointmentId)}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async (scope: RecurrenceScope) => {
          if (!selected) return;
          await deleteAppointment(selected.id, scope);
          await load();
          setSelected(null);
        }}
      />
    </div>
  );
}
