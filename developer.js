import { doc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig, appCheckEnabled } from '../firebase.js';
import { mountShell } from '../shell.js';
import { esc } from '../util.js';

export function renderDeveloper(root, name, role) {
  mountShell(root, {
    brand: 'Developer',
    roleLabel: 'Developer',
    name,
    nav: [
      { id: 'status', label: 'System status' },
      { id: 'diag', label: 'Diagnostics', note: 'Planned for Phase 5.' },
    ],
    pages: { status: (c) => status(c, role) },
  });
}

async function status(c, role) {
  let dbOk = false;
  try { dbOk = (await getDoc(doc(db, 'users', auth.currentUser.uid))).exists(); } catch { /* shown as failed */ }
  const t = await auth.currentUser.getIdTokenResult();
  const rows = [
    ['App version', '0.1.0 (Phase 1)'],
    ['Firebase project', firebaseConfig.projectId || 'not set'],
    ['Signed in as role', role],
    ['Session token expires', new Date(t.expirationTime).toLocaleString()],
    ['Database connection', dbOk ? 'Connected' : 'Failed'],
    ['App Check', appCheckEnabled ? 'Enabled in app' : 'Not enabled yet'],
    ['Developer MFA', 'Not available on the free plan'],
  ];
  c.innerHTML = `<div class="card"><h2>System status</h2><table><tbody>${rows
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>`;
}
