import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase.js';

export const EMAIL_DOMAIN = 'clinicpos.local';
// Staff type a username. A real email address (used by the Admin) is also accepted.
export const toEmail = (v) => {
  const s = v.trim().toLowerCase();
  return s.includes('@') ? s : `${s}@${EMAIL_DOMAIN}`;
};

export async function getProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? s.data() : null;
}

// The data for one audit entry. Rules require uid/role to match the signed-in user.
export const auditData = (uid, role, action, entityType, entityId, details = {}) => ({
  uid, role, action, entityType, entityId, details, createdAt: serverTimestamp(),
});
export const writeAudit = (uid, role, ...rest) =>
  addDoc(collection(db, 'auditLogs'), auditData(uid, role, ...rest));

// ctx = 'staff' (Admin/Receptionist form) or 'developer' (hidden form)
export function roleAllowed(role, ctx) {
  if (ctx === 'developer') return role === 'developer';
  if (ctx === 'staff') return role === 'admin' || role === 'receptionist';
  return ['admin', 'receptionist', 'developer'].includes(role);
}

export async function login(username, password, ctx) {
  sessionStorage.setItem('ctx', ctx);
  try {
    const cred = await signInWithEmailAndPassword(auth, toEmail(username), password);
    const p = await getProfile(cred.user.uid);
    if (!p || p.disabled || !roleAllowed(p.role, ctx)) throw new Error('blocked');
    writeAudit(cred.user.uid, p.role, ctx === 'developer' ? 'login.developer.success' : 'login.success', 'user', cred.user.uid)
      .catch(() => {});
  } catch {
    sessionStorage.removeItem('ctx');
    await signOut(auth).catch(() => {});
    throw new Error('Invalid username or password.'); // same message for every failure
  }
}

// Works for accounts whose login is a real email address (the Admin).
export async function requestPasswordReset(value) {
  if (value.includes('@')) await sendPasswordResetEmail(auth, value.trim()).catch(() => {});
}

export function logout() {
  sessionStorage.removeItem('ctx');
  return signOut(auth);
}

// Signs the user out after a period without activity.
let idleHandler = null;
let idleTimer = null;
export function startIdleTimer(minutes) {
  stopIdleTimer();
  idleHandler = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(logout, minutes * 60000);
  };
  ['mousemove', 'keydown', 'click'].forEach((e) => window.addEventListener(e, idleHandler, { passive: true }));
  idleHandler();
}
export function stopIdleTimer() {
  clearTimeout(idleTimer);
  if (idleHandler) {
    ['mousemove', 'keydown', 'click'].forEach((e) => window.removeEventListener(e, idleHandler));
    idleHandler = null;
  }
}
