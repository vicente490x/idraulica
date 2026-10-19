import { DateTime } from "luxon";
export let zone = "Europe/Rome";
export function configureZone(value: string) {
  zone = value;
}
export const today = () => DateTime.now().setZone(zone).toISODate()!;
export const displayDate = (value: string, format = "dd LLL yyyy, HH:mm") =>
  DateTime.fromISO(value).setZone(zone).setLocale("it").toFormat(format);
export const localInput = (value: string) =>
  DateTime.fromISO(value).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm");
export function utcInput(value: string): string {
  const date = DateTime.fromISO(value, { zone });
  // Luxon normally shifts non-existent DST times; reject them explicitly.
  if (!date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm") !== value)
    throw new Error(
      `Orario non valido nella zona ${zone}, anche per il cambio di ora.`,
    );
  if (date.getPossibleOffsets().length > 1)
    throw new Error(
      "Questo orario è ambiguo per il cambio di ora. Scegli un orario fuori dalla fascia di cambio.",
    );
  return date.toUTC().toISO()!;
}
export function dayWindow(day: string) {
  const start = DateTime.fromISO(day, { zone }).startOf("day");
  return {
    start: start.toUTC().toISO()!,
    end: start.plus({ days: 1 }).toUTC().toISO()!,
  };
}
