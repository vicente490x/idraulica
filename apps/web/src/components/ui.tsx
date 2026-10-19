"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertCircle, LoaderCircle } from "lucide-react";
import {
  ReactNode,
  ReactElement,
  useId,
  cloneElement,
  isValidElement,
  useRef,
} from "react";
import { statuses } from "@/lib/types";

export function Modal({
  title,
  description,
  children,
  open,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  wide?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          ref={content}
          className={`modal ${wide ? "modal-wide" : ""}`}
          onOpenAutoFocus={(e) => {
            const input = content.current?.querySelector<HTMLElement>(
              "input,select,textarea",
            );
            if (input) {
              e.preventDefault();
              input.focus();
            }
          }}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <header>
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description ||
                  "Compila i campi richiesti. Le modifiche vengono salvate sul server."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Chiudi finestra">
              <X size={20} />
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            id,
            ...(hint ? { "aria-describedby": `${id}-hint` } : {}),
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div role="alert" className="error-box">
      <AlertCircle size={18} />
      <div>
        {error instanceof Error ? error.message : String(error)}
        {retry && (
          <button className="text-button" onClick={retry}>
            Riprova
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div role="status" className="loading">
      <LoaderCircle className="spin" size={22} />
      Caricamento in corso…
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">↗</span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status}`}>
      <i />
      {statuses[status] || status}
    </span>
  );
}
export function Pagination({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {count} risultati · pagina {page} di{" "}
        {Math.max(1, Math.ceil(count / 25))}
      </span>
      <div>
        <button
          className="button secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Precedente
        </button>
        <button
          className="button secondary"
          disabled={page * 25 >= count}
          onClick={() => onChange(page + 1)}
        >
          Successiva
        </button>
      </div>
    </div>
  );
}
