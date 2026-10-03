import { esc, $ } from './util.js';
import { logout } from './auth.js';

// Draws the sidebar + top header + content area used by every dashboard.
export function mountShell(root, { brand, roleLabel, name, nav, pages, start }) {
  root.innerHTML = `
    <div class="shell">
      <aside class="side">
        <div class="brand">${esc(brand)}</div>
        <nav>${nav.map((n) => `<button class="nav" data-id="${n.id}">${esc(n.label)}</button>`).join('')}</nav>
      </aside>
      <div class="main">
        <header class="top">
          <h1 id="crumb"></h1>
          <div class="who"><span>${esc(name)}</span><span class="badge">${esc(roleLabel)}</span>
            <button class="btn" id="out">Sign out</button></div>
        </header>
        <section class="content" id="content"></section>
      </div>
    </div>`;
  const go = (id) => {
    root.querySelectorAll('.nav').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    const item = nav.find((n) => n.id === id);
    $('#crumb', root).textContent = item.label;
    const c = $('#content', root);
    c.innerHTML = '';
    (pages[id] || placeholder(item))(c);
  };
  root.querySelectorAll('.nav').forEach((b) => (b.onclick = () => go(b.dataset.id)));
  $('#out', root).onclick = () => logout();
  go(start || nav[0].id);
}

const placeholder = (item) => (c) => {
  c.innerHTML = `<div class="card"><h2>${esc(item.label)}</h2>
    <p class="muted">${esc(item.note || 'Planned for a later build phase.')}</p></div>`;
};
