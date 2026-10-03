import './styles.css';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';
import { logout, roleAllowed, getProfile, startIdleTimer, stopIdleTimer } from './auth.js';
import { renderLogin } from './views/login.js';
import { renderAdmin } from './views/admin.js';
import { renderReceptionist } from './views/receptionist.js';
import { renderDeveloper } from './views/developer.js';

const root = document.getElementById('app');
let view = 'login'; // login | devlogin | dashboard

function showLogin() { view = 'login'; renderLogin(root, 'staff'); }
function showDevLogin() { view = 'devlogin'; renderLogin(root, 'developer'); }

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    stopIdleTimer();
    if (view === 'dashboard' || !root.firstChild) showLogin();
    return;
  }
  let p = null;
  try { p = await getProfile(user.uid); } catch { /* treated as no access */ }
  if (!p || p.disabled || !roleAllowed(p.role, sessionStorage.getItem('ctx'))) { await logout(); return; }

  const name = p.displayName || 'User';
  view = 'dashboard';
  startIdleTimer(p.role === 'developer' ? 15 : 30);
  if (p.role === 'admin') renderAdmin(root, name, user.uid);
  else if (p.role === 'receptionist') renderReceptionist(root, name);
  else renderDeveloper(root, name, p.role);
});

// Hidden shortcut: Ctrl + Shift + Alt + D. Only opens the Developer sign-in form.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && view === 'devlogin') { showLogin(); return; }
  if (e.ctrlKey && e.shiftKey && e.altKey && e.code === 'KeyD') {
    const t = e.target;
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
    e.preventDefault();
    if (auth.currentUser) return;
    showDevLogin();
  }
});

