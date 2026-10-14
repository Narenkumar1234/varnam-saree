// A single 24px outline system prevents platform-dependent symbol rendering.
const iconPaths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  heart: '<path d="M20.3 5.7a5.5 5.5 0 0 0-7.8 0L12 6.2l-.5-.5a5.5 5.5 0 0 0-7.8 7.8L12 21l8.3-7.5a5.5 5.5 0 0 0 0-7.8Z"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  'arrow-up-right': '<path d="M6 18 18 6M6 6h12v12"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  leaf: '<path d="M20 4c-8-1-15 2-15 9a6 6 0 0 0 6 6c7 0 10-7 9-15Z"/><path d="M4 21 15 10"/>',
  truck: '<path d="M3 5h11v12H3V5Zm11 5h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>'
};
function icon(name, extraClass='') {
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name] || iconPaths.sparkle}</svg>`;
}
function renderIcons(root=document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML=icon(el.dataset.icon); });
}
function setMenu(open) {
  const nav=document.querySelector('#main-nav'), button=document.querySelector('.mobile-menu');
  nav.classList.toggle('open',open);
  button.setAttribute('aria-expanded',String(open));
  button.setAttribute('aria-label',open?'Close menu':'Open menu');
  button.innerHTML=icon(open?'close':'menu');
}
renderIcons();
document.querySelector('.mobile-menu').addEventListener('click',()=>setMenu(document.querySelector('.mobile-menu').getAttribute('aria-expanded')!=='true'));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.mobile-menu').getAttribute('aria-expanded')==='true'){setMenu(false);document.querySelector('.mobile-menu').focus();}});
