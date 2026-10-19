import { test, expect, Page } from "@playwright/test";

async function login(page: Page, email = "office@example.invalid") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Office-browser-test-4628!");
  await page.getByRole("button", { name: "Accedi alla dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Una giornata sotto controllo." }),
  ).toBeVisible();
}
test("login, cookie HttpOnly, navigazione e logout", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
  await login(page);
  await page.screenshot({
    path: "../../.local/screenshots/office-desktop.png",
    fullPage: true,
  });
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "sessionid")?.httpOnly).toBe(true);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.getByRole("link", { name: "Clienti", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Archivio clienti" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
test("creazione cliente, appuntamento, modifica e filtri con dati persistenti", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Clienti", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuovo cliente", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  for (const [label, value] of [
    ["Nome *", "Ada"],
    ["Cognome o ragione sociale *", "Collaudo"],
    ["Telefono *", "000987654"],
    ["Indirizzo *", "Via Test 42"],
    ["Città *", "Bari"],
    ["CAP *", "70100"],
  ])
    await modal.getByLabel(label, { exact: true }).fill(value);
  await modal.getByRole("button", { name: "Salva cliente" }).click();
  await expect(modal).not.toBeVisible();
  await page.getByLabel("Cerca clienti", { exact: true }).fill("Collaudo");
  await page.getByRole("link", { name: "Ada Collaudo", exact: true }).click();
  await page.getByRole("button", { name: "Nuovo appuntamento" }).click();
  await modal
    .getByLabel("Titolo *", { exact: true })
    .fill("Riparazione browser");
  await modal
    .getByLabel("Problema segnalato *", { exact: true })
    .fill("Perdita al lavello - test");
  await modal
    .getByLabel("Tecnico", { exact: true })
    .selectOption({ label: "Marco Demo" });
  await modal.getByLabel("Inizio *", { exact: true }).fill("2026-11-16T09:00");
  await modal
    .getByLabel("Fine prevista *", { exact: true })
    .fill("2026-11-16T10:00");
  await modal.getByRole("button", { name: "Crea appuntamento" }).click();
  await expect(modal).not.toBeVisible();
  await page
    .getByRole("link", { name: "Riparazione browser", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Riparazione browser", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Modifica intervento" }).click();
  await modal
    .getByLabel("Titolo *", { exact: true })
    .fill("Riparazione aggiornata");
  await modal.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(
    page.getByRole("heading", { name: "Riparazione aggiornata", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Riparazione aggiornata", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Interventi", exact: true }).click();
  await page.getByLabel("Cerca interventi").fill("Riparazione aggiornata");
  await page.getByLabel("Filtra per stato").selectOption("completed");
  await expect(
    page.getByText("Nessun intervento trovato", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filtra per stato").selectOption("assigned");
  await expect(
    page.getByRole("link", { name: "Riparazione aggiornata", exact: true }),
  ).toBeVisible();
});
test("calendario viste, apertura dettaglio e navigazione da tastiera", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Calendario", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Calendario interventi" }),
  ).toBeVisible();
  for (const view of ["Mese", "Giorno", "Settimana"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await expect(page.locator(".fc-view")).toBeVisible();
  }
  const event = page
    .locator(".fc-event")
    .filter({ hasText: "Manutenzione di prova" })
    .first();
  await expect(event).toBeVisible();
  await event.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Manutenzione di prova", exact: true }),
  ).toBeVisible();
});
test("errore API visibile e recuperabile senza dati dimostrativi", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/v1/customers/?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { details: "Servizio temporaneamente non disponibile." },
      }),
    }),
  );
  await page.getByRole("link", { name: "Clienti", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Servizio temporaneamente non disponibile" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/customers/?**");
  await page.getByRole("button", { name: "Riprova", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Cliente Esempio", exact: true }),
  ).toBeVisible();
});
test("indisponibilità tecnico e conferma rimozione", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Tecnici", exact: true }).click();
  await page.getByRole("button", { name: "Apri agenda di Sara" }).click();
  await page.getByRole("button", { name: "Segna indisponibilità" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Inizio *", { exact: true }).fill("2026-12-01T08:00");
  await modal.getByLabel("Fine *", { exact: true }).fill("2026-12-01T18:00");
  await modal.getByRole("button", { name: "Registra indisponibilità" }).click();
  await expect(modal).not.toBeVisible();
  await page.getByRole("button", { name: "Rimuovi intervallo" }).click();
  await expect(
    page.getByRole("heading", { name: "Rimuovere l’indisponibilità?" }),
  ).toBeVisible();
  await modal.getByRole("button", { name: "Conferma rimozione" }).click();
  await expect(page.getByText("Nessun intervallo registrato.")).toBeVisible();
});
test("tecnico escluso dalla dashboard ufficio", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("tech@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Office-browser-test-4628!");
  await page.getByRole("button", { name: "Accedi alla dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Accesso riservato all’ufficio" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
test("layout mobile, menu e form da tastiera", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.screenshot({
    path: "../../.local/screenshots/office-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Apri navigazione" }).click();
  await page.getByRole("link", { name: "Clienti", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuovo cliente", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Nuovo cliente", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog").getByLabel("Nome *", { exact: true }),
  ).toBeFocused();
});

test("spostamento calendario persistente e rollback in caso di sovrapposizione", async ({
  page,
}) => {
  await login(page);
  const csrf = (await (await page.request.get("/api/v1/auth/csrf/")).json())
    .csrfToken;
  const customer = (await (await page.request.get("/api/v1/customers/")).json())
    .results[0];
  const tech = (
    await (await page.request.get("/api/v1/technicians/")).json()
  ).results.find((t: { first_name: string }) => t.first_name === "Sara");
  const create = async (title: string, start: string, end: string) => {
    const response = await page.request.post("/api/v1/interventions/", {
      headers: { "X-CSRFToken": csrf },
      data: {
        customer: customer.id,
        technician: tech.id,
        title,
        description: "Prova trascinamento",
        intervention_type: "Test",
        address: "Via Test",
        starts_at: start,
        ends_at: end,
      },
    });
    expect(response.status()).toBe(201);
    return response.json();
  };
  const job = await create(
    "Evento da spostare",
    "2026-11-18T08:00:00Z",
    "2026-11-18T09:00:00Z",
  );
  await create(
    "Evento già occupato",
    "2026-11-18T10:00:00Z",
    "2026-11-18T11:00:00Z",
  );
  await page.goto("/calendario?date=2026-11-18");
  await page.getByRole("button", { name: "Giorno", exact: true }).click();
  const event = page
    .locator(".fc-event")
    .filter({ hasText: "Evento da spostare" })
    .first();
  await expect(event).toBeVisible();
  async function moveOneHour() {
    const eventBox = (await event.boundingBox())!;
    const first = (await page
      .locator('td.fc-timegrid-slot-lane[data-time="09:00:00"]')
      .boundingBox())!;
    const next = (await page
      .locator('td.fc-timegrid-slot-lane[data-time="10:00:00"]')
      .boundingBox())!;
    const x = eventBox.x + Math.min(60, eventBox.width / 2),
      y = eventBox.y + 10;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + next.y - first.y, { steps: 15 });
    await page.mouse.up();
  }
  await moveOneHour();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`/api/v1/interventions/${job.id}/`)
          ).json()
        ).version,
    )
    .toBe(2);
  let saved = await (
    await page.request.get(`/api/v1/interventions/${job.id}/`)
  ).json();
  expect(Date.parse(saved.starts_at)).toBe(Date.parse("2026-11-18T09:00:00Z"));
  await expect(
    page.getByText("Appuntamento riprogrammato.", { exact: true }),
  ).toBeVisible();
  await moveOneHour();
  await expect(
    page.getByRole("alert").filter({ hasText: "sovrapposto" }),
  ).toBeVisible();
  saved = await (
    await page.request.get(`/api/v1/interventions/${job.id}/`)
  ).json();
  expect(saved.version).toBe(2);
  expect(Date.parse(saved.starts_at)).toBe(Date.parse("2026-11-18T09:00:00Z"));
});
test("conflitto di versione mantiene le modifiche recenti dell’ufficio", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Interventi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tutti gli interventi" }),
  ).toBeVisible();
  await page
    .getByRole("table")
    .getByRole("link", { name: "Manutenzione di prova", exact: true })
    .click();
  await page.getByRole("button", { name: "Modifica intervento" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Titolo *", { exact: true }).fill("Modifica obsoleta");
  const id = new URL(page.url()).pathname.split("/").pop();
  const csrf = (await (await page.request.get("/api/v1/auth/csrf/")).json())
    .csrfToken;
  const job = await (
    await page.request.get(`/api/v1/interventions/${id}/`)
  ).json();
  const updated = await page.request.patch(`/api/v1/interventions/${id}/`, {
    headers: { "X-CSRFToken": csrf },
    data: { version: job.version, title: "Modifica ufficio più recente" },
  });
  expect(updated.status()).toBe(200);
  await modal.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(modal.getByRole("alert")).toContainText("altro utente");
  expect(
    (await (await page.request.get(`/api/v1/interventions/${id}/`)).json())
      .title,
  ).toBe("Modifica ufficio più recente");
});
test("creazione rapida cliente durante una chiamata", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Nuovo appuntamento" }).click();
  const modal = page.getByRole("dialog");
  await modal
    .getByRole("button", { name: "+ Crea cliente durante la chiamata" })
    .click();
  for (const [label, value] of [
    ["Nome *", "Rapido"],
    ["Cognome o ragione sociale *", "Test chiamata"],
    ["Telefono *", "000123"],
    ["Città *", "Roma"],
    ["CAP *", "00100"],
    ["Titolo *", "Telefonata test"],
    ["Problema segnalato *", "Verifica perdita"],
    ["Indirizzo intervento *", "Via Chiamata 2"],
  ])
    await modal.getByLabel(label, { exact: true }).fill(value);
  await modal.getByLabel("Inizio *", { exact: true }).fill("2026-12-02T09:00");
  await modal
    .getByLabel("Fine prevista *", { exact: true })
    .fill("2026-12-02T10:00");
  await modal.getByRole("button", { name: "Crea appuntamento" }).click();
  await expect(modal).not.toBeVisible();
  await page.getByRole("link", { name: "Clienti", exact: true }).click();
  await page.getByLabel("Cerca clienti", { exact: true }).fill("Test chiamata");
  await expect(
    page.getByRole("link", { name: "Rapido Test chiamata", exact: true }),
  ).toBeVisible();
});
