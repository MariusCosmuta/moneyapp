// Ajutoare DOM. Textul se adaugă ca noduri text (fără innerHTML), deci e sigur pentru date introduse de utilizator.

export const $ = (id) => document.getElementById(id);

export function h(tag, attrs = {}, ...copii) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  el.append(...copii.flat().filter((c) => c != null && c !== false));
  return el;
}

export function ecran(id) {
  document.querySelectorAll(".ecran").forEach((s) => s.classList.toggle("hide", s.id !== id));
  window.scrollTo(0, 0);
}

let toastTimer;
export function toast(msg, ok) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast " + (ok ? "ok" : "err");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast hide"; }, 3000);
}

// Dezactivează butonul cât rulează fn; erorile apar ca toast.
export async function cuButon(btn, fn, text = "⏳ Se salvează…") {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = text;
  try {
    await fn();
  } catch (e) {
    toast("Eroare: " + e.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

export const info = (msg) => h("div", { class: "card info" }, msg);
export const eroare = (e) => h("div", { class: "card eroare" }, "Eroare: " + e.message);

export function descarca(numeFisier, continut, tip) {
  const url = URL.createObjectURL(new Blob([continut], { type: tip }));
  const a = h("a", { href: url, download: numeFisier });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Afișează „se încarcă" în box, apoi rezultatul lui fn() sau eroarea.
export async function inBox(box, msg, fn) {
  box.replaceChildren(info(msg));
  try {
    box.replaceChildren(await fn());
  } catch (e) {
    box.replaceChildren(eroare(e));
  }
}
