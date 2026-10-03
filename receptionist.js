import { mountShell } from '../shell.js';

const later = (p) => `Planned for ${p}.`;

export function renderReceptionist(root, name) {
  mountShell(root, {
    brand: 'Clinic POS',
    roleLabel: 'Receptionist',
    name,
    nav: [
      { id: 'home', label: 'Dashboard' },
      { id: 'bill', label: 'New Bill', note: later('Phase 3') },
      { id: 'slips', label: "Today's Slips", note: later('Phase 3') },
      { id: 'held', label: 'Held Bills', note: later('Phase 3') },
      { id: 'outstanding', label: 'Outstanding Balances', note: later('Phase 4') },
      { id: 'cash', label: 'Cash In / Out', note: later('Phase 4') },
      { id: 'shift', label: 'Current Shift', note: later('Phase 4') },
    ],
    pages: {
      home: (c) => {
        c.innerHTML = `<div class="card"><h2>Welcome</h2>
          <p class="muted">Billing and shift tools arrive in the next phases. Your account and role are working.</p></div>`;
      },
    },
  });
}
