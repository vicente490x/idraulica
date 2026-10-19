import type { Page } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const labels: Record<string, string> = {
  email: "Email",
  password: "Password",
  first_name: "Nome",
  last_name_or_company: "Cognome o ragione sociale",
  phone: "Telefono",
  address: "Indirizzo",
  city: "Città",
  postal_code: "CAP",
  starts_at: "Inizio",
  ends_at: "Fine",
  technician: "Tecnico",
  customer: "Cliente",
  version: "Versione",
  non_field_errors: "Verifica",
  new_password: "Nuova password",
  old_password: "Password attuale",
};
function message(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(message).join(" ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(([key, v]) => `${labels[key] || key}: ${message(v)}`)
      .join(" · ");
  return "Operazione non riuscita.";
}
let csrf: string | undefined;
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method || "GET";
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !csrf) {
    const response = await fetch("/api/v1/auth/csrf/", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok)
      throw new ApiError(
        response.status,
        "Impossibile avviare una connessione sicura con il server.",
      );
    csrf = (await response.json()).csrfToken;
  }
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "Server non raggiungibile. Controlla la connessione e riprova.",
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 401 && !path.startsWith("auth/"))
      window.dispatchEvent(new Event("session-expired"));
    if (response.status === 403) csrf = undefined;
    throw new ApiError(
      response.status,
      data?.error?.details
        ? message(data.error.details)
        : "Operazione non riuscita. Riprova tra poco.",
    );
  }
  if (path === "auth/web-login/" || path === "auth/logout/") csrf = undefined;
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const send = <T>(path: string, method: string, data?: unknown) =>
  api<T>(path, {
    method,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
export const qs = (data: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(data)
      .filter(([, v]) => v !== "" && v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
export async function all<T>(path: string): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  while (true) {
    const data = await api<Page<T>>(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}`,
    );
    results.push(...data.results);
    if (!data.next) return results;
    page += 1;
  }
}
