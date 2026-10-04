// Phase 4: Outstanding balances (Admin: view; Receptionist: view, collect, request cancellation).
import { collection, doc, getDoc, writeBatch, serverTimestamp, where, limit } from 'firebase/firestore';
import { db } from '../firebase.js';
import { auditData } from '../auth.js';
import { esc, $, fmtTime, printHtml } from '../util.js';
import { list, getOpenShift, getHospital, money, parseAmount, round2, payNo } from '../data.js';
import { requestCancellation } from './cancellations.js';

const errCard = '<div class="card error">Could not load data. Check your connection and try again.</div>';

function receiptHtml(h, p, bill, remaining) {
  const row = (a, b) => `<tr><td>${esc(a)}</td><td style="text-align:right">${esc(b)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(payNo(p.seq))}</title>
    <style>@page{size:80mm auto;margin:3mm}body{font:12px monospace;width:74mm;margin:0}h1{font-size:15px;text-align:center;margin:0}
    p{margin:2px 0;text-align:center}table{width:100%;border-collapse:collapse;margin-top:6px}td{padding:1px 0}hr{border:0;border-top:1px dashed #000}</style></head><body>
    <h1>${esc(h.hospitalName)}</h1><p>${esc(h.address)}</p><p>${esc(h.phone)}</p><hr>
    <p><strong>PAYMENT RECEIPT</strong></p>
    <table>${row('Receipt no.', payNo(p.seq))}${row('Date', new Date().toLocaleString())}${row('Patient', p.patientName)}
    ${row('Original bill', bill.receiptNo)}${row('Method', p.methodName)}${row('Amount paid', money(p.amount))}${row('Balance left', money(remaining))}
    ${row('Received by', p.receptionistName)}</table><hr><p>Thank you</p></body></html>`;
}

export async function balancesPage(c, ctx) {
  const canCollect = ctx.role === 'receptionist';
  c.innerHTML = `<div class="card"><div class="row-gap" style="justify-content:space-between;margin-bottom:8px">
    <h2 style="margin:0">Patients with a balance</h2><input id="q" class="search" placeholder="Search patient or receipt no."></div>
    <div id="out" class="muted">Loading…</div></div><div id="panel"></div>`;
  let bills;
  try { bills = (await list('bills', where('outstanding', '>', 0), limit(300))).filter((b) => b.status === 'posted'); }
  catch { $('#out', c).innerHTML = '<span class="error">Could not load balances.</span>'; return; }
  bills.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const render = () => { if (!c.isConnected) return; const qEl = $('#q', c); const outEl = $('#out', c); if (!qEl || !outEl) return;
    const q = qEl.value.trim().toLowerCase();
    const rows = bills.filter((b) => !q || [b.patientName, b.receiptNo].some((v) => String(v || '').toLowerCase().includes(q)));
    outEl.className = '';
    outEl.innerHTML = rows.length
      ? `<table><thead><tr><th>Receipt</th><th>Patient</th><th class="right">Bill amount</th><th class="right">Paid</th><th class="right">Remaining</th><th></th></tr></thead><tbody>
        ${rows.map((b) => `<tr><td>${esc(b.receiptNo)}</td><td>${esc(b.patientName)}</td><td class="right">${money(b.net)}</td>
          <td class="right">${money(b.received)}</td><td class="right"><strong>${money(b.outstanding)}</strong></td>
          <td><button class="btn small" data-id="${esc(b.id)}">Open</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">No outstanding balances.</p>';
    c.querySelectorAll('button[data-id]').forEach((b) => (b.onclick = () => openBill(b.dataset.id)));
  };

  async function openBill(id) {
    const panel = $('#panel', c);
    panel.innerHTML = '<div class="card muted">Loading…</div>';
    let bill, payments, shift = null, methods = [];
    try {
      const s = await getDoc(doc(db, 'bills', id));
      bill = { id: s.id, ...s.data() };
      payments = (await list('payments', where('billId', '==', id))).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      if (canCollect) {
        shift = await getOpenShift(ctx.uid);
        methods = (await list('paymentMethods')).filter((m) => m.active);
      }
    } catch { panel.innerHTML = errCard; return; }

    panel.innerHTML = `<div class="card"><h2>${esc(bill.patientName)} — ${esc(bill.receiptNo)}</h2>
      <table><tbody>
        <tr><td>Original bill amount</td><td class="right">${money(bill.net)}</td></tr>
        <tr><td>Amount paid so far</td><td class="right">${money(bill.received)}</td></tr>
        <tr style="font-weight:700"><td>Remaining balance</td><td class="right">${money(bill.outstanding)}</td></tr></tbody></table>
      <h3 class="sec-title">Payment history</h3>
      <table><thead><tr><th>Date</th><th>Receipt</th><th>Method</th><th class="right">Amount</th></tr></thead><tbody>
        <tr><td>${esc(fmtTime(bill.createdAt))}</td><td>${esc(bill.receiptNo)}</td><td>${esc(bill.paymentMethodName)} (at billing)</td><td class="right">${money(bill.initialPaid)}</td></tr>
        ${payments.map((p) => `<tr><td>${esc(fmtTime(p.createdAt))}</td><td>${esc(payNo(p.seq))}</td><td>${esc(p.methodName)}</td><td class="right">${money(p.amount)}</td></tr>`).join('')}
      </tbody></table>
      ${canCollect ? (shift && methods.length
        ? `<h3 class="sec-title">Collect payment</h3><form id="pf" class="row-gap">
            <input name="amount" class="num-in" inputmode="decimal" placeholder="Amount" required autocomplete="off">
            <select name="method" class="inline" style="max-width:220px">${methods.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select>
            <button class="btn primary">Collect</button><span id="pm" class="error"></span></form>`
        : `<p class="muted" style="margin-top:12px">${!shift ? 'Open your shift (Current Shift) to collect payments.' : 'The Admin has not added any payment methods yet.'}</p>`)
        + `<div class="row-gap" style="margin-top:12px"><button class="btn small" id="cx">Request cancellation of this slip</button><span id="cm" class="muted"></span></div>`
        : ''}
      <div id="receipt"></div></div>`;

    if (!canCollect) return;
    const pf = $('#pf', panel);
    if (pf) {
      pf.onsubmit = async (e) => {
        e.preventDefault();
        const pm = $('#pm', panel);
        const amount = parseAmount(pf.amount.value);
        if (amount === null) { pm.textContent = 'Enter a valid amount.'; return; }
        const method = methods.find((m) => m.id === pf.method.value);
        $('button', pf).disabled = true;
        pm.textContent = '';
        try {
          const result = await collectPayment({ billId: id, amount, method, shift, ctx });
          const h = await getHospital();
          const r = $('#receipt', panel);
          r.innerHTML = `<p style="margin-top:12px"><strong>Payment saved.</strong> ${esc(payNo(result.payment.seq))} — balance now ${money(result.remaining)}.
            <button class="btn small" id="pr">Print receipt</button></p>`;
          $('#pr', r).onclick = () => printHtml(receiptHtml(h, result.payment, result.bill, result.remaining));
          bills = bills.map((x) => (x.id === id ? { ...x, outstanding: result.remaining, received: result.bill.received } : x)).filter((x) => x.outstanding > 0);
          render();
          pf.reset();
          $('button', pf).disabled = false;
        } catch (ex) {
          pm.textContent = ex.message || 'Could not save the payment.';
          $('button', pf).disabled = false;
        }
      };
    }
    $('#cx', panel).onclick = async () => {
      const why = (prompt('Reason for cancelling this slip (at least 5 characters):') || '').trim();
      if (why.length < 5) return;
      try { await requestCancellation(bill, why, ctx); $('#cm', panel).textContent = 'Request sent to the Admin.'; }
      catch { $('#cm', panel).className = 'error'; $('#cm', panel).textContent = 'Could not send. A request may already exist for this slip.'; }
    };
  }

  $('#q', c).oninput = render;
  render();
}

// Saves a balance payment: payment record, bill update, receipt counter and audit entry in one atomic batch.
// The security rules re-check every amount, so a stale screen cannot overpay or double-count.
async function collectPayment({ billId, amount, method, shift, ctx }) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const billSnap = await getDoc(doc(db, 'bills', billId));
    const bill = billSnap.data();
    if (bill.status !== 'posted') throw new Error('This slip is no longer active.');
    if (amount > round2(bill.outstanding) + 0.004) throw new Error(`Amount is more than the remaining balance (${money(bill.outstanding)}).`);
    const counterRef = doc(db, 'counters', 'paymentReceipt');
    const cs = await getDoc(counterRef);
    const seq = (cs.exists() ? cs.data().value : 0) + 1;
    const payRef = doc(collection(db, 'payments'));
    const payment = {
      billId, receiptNo: bill.receiptNo, patientName: bill.patientName, amount, methodId: method.id, methodName: method.name,
      isCash: method.isCash, shiftId: shift.id, receptionistUid: ctx.uid, receptionistName: ctx.name, seq,
    };
    const remaining = round2(bill.outstanding - amount);
    const received = round2(bill.received + amount);
    const batch = writeBatch(db);
    batch.set(counterRef, { value: seq });
    batch.set(payRef, { ...payment, createdAt: serverTimestamp() });
    batch.update(doc(db, 'bills', billId), { received, outstanding: remaining, lastPaymentId: payRef.id, updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, 'auditLogs')),
      auditData(ctx.uid, 'receptionist', 'payment.balance', 'bill', billId, { amount, receipt: payNo(seq), shiftId: shift.id }));
    try {
      await batch.commit();
      return { payment, remaining, bill: { ...bill, received } };
    } catch (e) {
      if (attempt === 1) throw new Error('Could not save. The balance may have changed; reopen the patient and try again.');
    }
  }
}
