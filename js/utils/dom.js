export const byId = (id) => document.getElementById(id);

export function show(el) {
  el.classList.remove('hidden');
}

export function hide(el) {
  el.classList.add('hidden');
}

export function toggle(el, state) {
  el.classList.toggle('hidden', state);
}