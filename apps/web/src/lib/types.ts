export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "office" | "technician";
  phone: string;
  is_active: boolean;
}
export interface Technician {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
}
export interface Customer {
  id: string;
  first_name: string;
  last_name_or_company: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postal_code: string;
  notes?: string;
  latitude: string | null;
  longitude: string | null;
  created_at: string;
}
export interface Job {
  id: string;
  customer: string;
  customer_name: string;
  customer_phone: string;
  technician: number | null;
  technician_name: string;
  title: string;
  description: string;
  intervention_type: string;
  priority: string;
  starts_at: string;
  ends_at: string;
  address: string;
  status: string;
  office_notes?: string;
  technician_notes: string;
  version: number;
  created_at: string;
  updated_at: string;
  allowed_transitions: string[];
  planning_editable: boolean;
}
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export interface History {
  id: string;
  previous_status: string;
  new_status: string;
  actor: number;
  created_at: string;
}
export interface Absence {
  id: string;
  technician: number;
  starts_at: string;
  ends_at: string;
  available: boolean;
}
export interface Overview {
  date: string;
  timezone: string;
  counts: Record<string, number>;
  technicians: {
    id: number;
    day_count: number;
    week_count: number;
    day_hours: number;
    week_hours: number;
    available_now: boolean;
    unavailable_today: boolean;
  }[];
  recent: {
    id: string;
    intervention_id: string;
    title: string;
    status: string;
    created_at: string;
  }[];
}
export const statuses: Record<string, string> = {
  scheduled: "Programmato",
  assigned: "Assegnato",
  confirmed: "Confermato",
  travelling: "In viaggio",
  working: "In lavorazione",
  completed: "Completato",
  absent: "Cliente assente",
  cancelled: "Annullato",
  reschedule: "Da riprogrammare",
};
export const priorities: Record<string, string> = {
  normal: "Normale",
  high: "Alta",
  urgent: "Urgente",
};
export const person = (
  u: Pick<Technician, "first_name" | "last_name" | "id">,
) => `${u.first_name} ${u.last_name}`.trim() || `Tecnico #${u.id}`;
export const customerName = (
  c: Pick<Customer, "first_name" | "last_name_or_company">,
) => `${c.first_name} ${c.last_name_or_company}`.trim();
