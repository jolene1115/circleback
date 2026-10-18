// Brief status message in the #toast element (index.html).
let timer = 0;

export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  clearTimeout(timer);
  timer = setTimeout(() => (el.style.display = 'none'), 3500);
}
