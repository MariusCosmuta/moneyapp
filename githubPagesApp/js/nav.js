import { ecran, toast } from "./ui.js";

const ecrane = new Map();

export function inregistreaza(id, setup) {
  ecrane.set(id, setup);
}

export function go(id) {
  ecran(id);
  const setup = ecrane.get(id);
  if (setup) Promise.resolve().then(setup).catch((e) => toast("Eroare: " + e.message, false));
}

export function leagaNavigare() {
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
}
