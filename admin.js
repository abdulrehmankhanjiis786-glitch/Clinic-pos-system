import { collection, getDocs, query, orderBy, limit, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, firebaseConfig } from '../firebase.js';
import { toEmail, auditData } from '../auth.js';
import { mountShell } from '../shell.js';
import { esc, $, fmtTime } from '../util.js';

const later = (p) => `Planned for ${p}.`;
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
let myUid = null;

// Creates the sign-in with a temporary second app connection, so the Admin
// stays signed in, then saves the profile + audit entry together.
async function createStaff(f) {
  const username = f.username.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new Error('Username must be 3-30 characters: letters, numbers, dot, dash or underscore.');
  if (f.password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (!['receptionist', 'developer'].includes(f.role)) throw new Error('Choose a role.');
  const tmp = initializeApp(firebaseConfig, 'tmp-' + Date.now());
  let uid;
  try {
    const a = getAuth(tmp);
    const cred = await createUserWithEmailAndPassword(a, toEmail(username), f.password);
    uid = cred.user.uid;
    await signOut(a);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') throw new Error('That username is already taken.');
    throw new Error('Could not create the sign-in. Check the details and try again.');
  } finally {
    await deleteApp(tmp);
  }
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), {
    username, displayName: f.displayName.trim(), role: f.role, recoveryEmail: f.recoveryEmail.trim().toLowerCase(),
    disabled: false, createdAt: serverTimestamp(), createdBy: myUid,
  });
  batch.set(doc(collection(db, 'auditLogs')), auditData(myUid, 'admin', 'user.create', 'user', uid, { newRole: f.role, username }));
  try { await batch.commit(); }
  catch { throw new Error('The sign-in was created but the profile was not saved. Use a different username and try again.'); }
}

async function setDisabled(uid, disabled) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { disabled });
  batch.set(doc(collection(db, 'auditLogs')), auditData(myUid, 'admin', disabled ? 'user.disable' : 'user.enable', 'user', uid));
  await batch.commit();
}

export function renderAdmin(root, name, uid) {
  myUid = uid;
  mountShell(root, {
    brand: 'Clinic POS',
    roleLabel: 'Admin',
    name,
    nav: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'slips', label: "Today's Slips", note: later('Phase 3') },
      { id: 'staff', label: 'Receptionists & Staff' },
      { id: 'doctors', label: 'Doctors', note: later('Phase 2') },
      { id: 'services', label: 'Services', note: later('Phase 2') },
      { id: 'fees', label: 'Fees', note: later('Phase 2') },
      { id: 'outstanding', label: 'Outstanding Balances', note: later('Phase 4') },
      { id: 'cash', label: 'Cash Transactions', note: later('Phase 4') },
      { id: 'shifts', label: 'Shift Reports', note: later('Phase 4') },
      { id: 'cancelled', label: 'Cancelled Slips', note: later('Phase 4') },
      { id: 'audit', label: 'Audit Logs' },
      { id: 'settings', label: 'Settings', note: later('Phase 2') },
      { id: 'security', label: 'Security & Backup', note: later('Phase 5') },
    ],
    pages: { dashboard, staff, audit },
  });
}

async function loadUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

async function dashboard(c) {
  c.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const users = await loadUsers();
    const active = (r) => users.filter((u) => u.role === r && !u.disabled).length;
    c.innerHTML = `
      <div class="cards">
        <div class="card stat"><span class="num">${active('receptionist')}</span><span>Active receptionists</span></div>
        <div class="card stat"><span class="num">${active('developer')}</span><span>Active developers</span></div>
      </div>
      <div class="card"><h2>Build progress</h2>
        <p class="muted">Billing, payments, shifts and reports arrive in the next phases.
        Today's totals will appear here once billing is built.</p></div>`;
  } catch {
    c.innerHTML = '<div class="card error">Could not load data. Check your connection and rules.</div>';
  }
}

async function staff(c) {
  c.innerHTML = `
    <div class="card"><h2>Add staff account</h2>
      <form id="f" class="grid2">
        <label>Username<input name="username" required autocomplete="off"></label>
        <label>Full name<input name="displayName" required autocomplete="off"></label>
        <label>Recovery email<input name="recoveryEmail" type="email" required autocomplete="off"></label>
        <label>Role<select name="role"><option value="receptionist">Receptionist</option>
          <option value="developer">Developer</option></select></label>
        <label>Temporary password (10+ characters)<input name="password" type="password" minlength="10" required autocomplete="new-password"></label>
        <div class="row-end"><span id="msg" class="muted"></span><button class="btn primary">Create account</button></div>
      </form></div>
    <div class="card"><h2>Accounts</h2><div id="list" class="muted">Loading…</div></div>`;

  const list = $('#list', c);
  async function refresh() {
    try {
      const users = (await loadUsers()).sort((a, b) => a.username.localeCompare(b.username));
      list.className = '';
      list.innerHTML = `<table><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>${users.map((u) => `<tr>
          <td>${esc(u.username)}</td><td>${esc(u.displayName)}</td><td>${esc(u.role)}</td>
          <td><span class="pill ${u.disabled ? 'off' : 'on'}">${u.disabled ? 'Disabled' : 'Active'}</span></td>
          <td>${u.role === 'admin' ? '' : `<button class="btn small" data-uid="${esc(u.uid)}" data-dis="${!u.disabled}">${u.disabled ? 'Enable' : 'Disable'}</button>`}</td>
        </tr>`).join('')}</tbody></table>`;
      list.querySelectorAll('button[data-uid]').forEach((b) => {
        b.onclick = async () => {
          b.disabled = true;
          try { await setDisabled(b.dataset.uid, b.dataset.dis === 'true'); }
          catch (e) { alert(e.message); }
          refresh();
        };
      });
    } catch {
      list.innerHTML = '<span class="error">Could not load accounts.</span>';
    }
  }

  $('#f', c).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const msg = $('#msg', c);
    msg.className = 'muted';
    msg.textContent = 'Creating…';
    try {
      await createStaff({
        username: f.username.value, displayName: f.displayName.value,
        recoveryEmail: f.recoveryEmail.value, role: f.role.value, password: f.password.value,
      });
      f.reset();
      msg.textContent = 'Account created.';
      refresh();
    } catch (ex) {
      msg.className = 'error';
      msg.textContent = ex.message || 'Could not create the account.';
    }
  };
  refresh();
}

async function audit(c) {
  c.innerHTML = '<div class="card"><h2>Latest 50 events</h2><div id="a" class="muted">Loading…</div></div>';
  try {
    const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(50)));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    $('#a', c).className = '';
    $('#a', c).innerHTML = rows.length
      ? `<table><thead><tr><th>Time</th><th>Action</th><th>Role</th><th>Item</th></tr></thead><tbody>${rows.map((r) =>
          `<tr><td>${esc(fmtTime(r.createdAt))}</td><td>${esc(r.action)}</td><td>${esc(r.role)}</td>
           <td>${esc(r.entityType)} ${esc(r.entityId)}</td></tr>`).join('')}</tbody></table>`
      : 'No events yet.';
  } catch {
    $('#a', c).innerHTML = '<span class="error">Could not load the audit log.</span>';
  }
}
