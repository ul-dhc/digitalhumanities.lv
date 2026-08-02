const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
const menuButton = document.querySelector('.menu-toggle');
const scaleButton = document.querySelector('.text-scale');
const dropdownButtons = document.querySelectorAll('.dropdown-toggle');

themeButton?.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('dh-theme', root.dataset.theme);
});
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-is-open', open);
});
scaleButton?.addEventListener('click', () => {
  const sizes = ['100','112','125'];
  const next = sizes[(sizes.indexOf(root.dataset.scale || '100') + 1) % sizes.length];
  root.dataset.scale = next;
  localStorage.setItem('dh-scale', next);
});
dropdownButtons.forEach((dropdownButton) => dropdownButton.addEventListener('click', () => {
  const open = dropdownButton.getAttribute('aria-expanded') !== 'true';
  dropdownButtons.forEach((button) => button.setAttribute('aria-expanded', 'false'));
  dropdownButton.setAttribute('aria-expanded', String(open));
}));
document.addEventListener('click', (event) => {
  if (!event.target.closest('.nav-dropdown')) dropdownButtons.forEach((button) => button.setAttribute('aria-expanded', 'false'));
});
