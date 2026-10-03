import { login, requestPasswordReset } from '../auth.js';
import { $ } from '../util.js';

export function renderLogin(root, ctx = 'staff') {
  const dev = ctx === 'developer';
  root.innerHTML = `
    <div class="login-wrap">
      <form class="card login" id="f" autocomplete="on">
        <h1>${dev ? 'Developer access' : 'Clinic POS'}</h1>
        <p class="muted">${dev ? 'Authorized technical staff only.' : 'Sign in to continue.'}</p>
        <label>Username<input name="u" autocomplete="username" required autofocus></label>
        <label>Password<input name="p" type="password" autocomplete="current-password" required></label>
        <div class="error" id="err" role="alert"></div>
        <button class="btn primary" id="b">Sign in</button>
        ${dev ? '' : '<p class="muted small-note"><a href="#" id="forgot">Forgot password?</a></p>'}
      </form>
    </div>`;
  const err = $('#err', root);
  $('#f', root).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    err.textContent = '';
    $('#b', root).disabled = true;
    try {
      await login(f.u.value, f.p.value, ctx);
    } catch (ex) {
      err.textContent = ex.message;
      f.p.value = '';
      $('#b', root).disabled = false;
    }
  };
  const forgot = $('#forgot', root);
  if (forgot) {
    forgot.onclick = async (e) => {
      e.preventDefault();
      const v = $('#f', root).u.value;
      await requestPasswordReset(v);
      err.className = 'muted';
      err.textContent = v.includes('@')
        ? 'If that email has an account, a reset link was sent.'
        : 'Receptionists: ask the Admin to set up a new login for you. Admin: type your email address in the username box first.';
    };
  }
}
