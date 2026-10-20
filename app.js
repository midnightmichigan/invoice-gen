'use strict';

/* Free Invoice Generator — client-side only.
   State lives in memory + localStorage. No network calls are made. */

var DRAFT_KEY = 'invoicegen.draft.v1';
var SAVED_KEY = 'invoicegen.saved.v1';
var COUNTER_KEY = 'invoicegen.counter.v1';

var $ = function (id) { return document.getElementById(id); };

var els = {
  fromName: $('from-name'),
  fromDetails: $('from-details'),
  toName: $('to-name'),
  toDetails: $('to-details'),
  number: $('invoice-number'),
  currency: $('currency'),
  issueDate: $('issue-date'),
  terms: $('terms'),
  dueDate: $('due-date'),
  status: $('status'),
  itemsEditor: $('items-editor'),
  taxRate: $('tax-rate'),
  discountRate: $('discount-rate'),
  shipping: $('shipping'),
  amountPaid: $('amount-paid'),
  notes: $('notes'),
  savedList: $('saved-list')
};

/* ---------- helpers ---------- */

function num(v, fallback) {
  var n = parseFloat(v);
  return isNaN(n) ? (fallback || 0) : n;
}

function fmt(amount) {
  var cur = els.currency.value || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount);
  } catch (e) {
    return cur + ' ' + amount.toFixed(2);
  }
}

function todayISO() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function addDaysISO(iso, days) {
  var d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function prettyDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(s) {
  return escapeHtml(s).replace(/\n/g, '<br>');
}

function nextInvoiceNumber() {
  var n = 1;
  try { n = parseInt(localStorage.getItem(COUNTER_KEY) || '1', 10) || 1; } catch (e) { /* ignore */ }
  return 'INV-' + String(n).padStart(4, '0');
}

function bumpCounter() {
  try {
    var n = parseInt(localStorage.getItem(COUNTER_KEY) || '1', 10) || 1;
    localStorage.setItem(COUNTER_KEY, String(n + 1));
  } catch (e) { /* ignore */ }
}

/* ---------- items editor ---------- */

function addItemRow(desc, qty, rate) {
  var row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML =
    '<input type="text" class="item-desc" placeholder="Description of work or product" value="' + escapeHtml(desc || '') + '">' +
    '<input type="number" class="item-qty" min="0" step="any" placeholder="Qty" value="' + (qty == null ? 1 : qty) + '">' +
    '<input type="number" class="item-rate" min="0" step="any" placeholder="Rate" value="' + (rate == null ? '' : rate) + '">' +
    '<span class="item-amount">$0.00</span>' +
    '<button type="button" class="btn btn-ghost item-remove" title="Remove item" aria-label="Remove item">×</button>';

  row.querySelector('.item-remove').addEventListener('click', function () {
    row.parentNode.removeChild(row);
    if (els.itemsEditor.children.length === 0) addItemRow('', 1, '');
    update();
  });
  row.querySelectorAll('input').forEach(function (input) {
    input.addEventListener('input', update);
  });
  els.itemsEditor.appendChild(row);
  return row;
}

function readItems() {
  var items = [];
  Array.prototype.forEach.call(els.itemsEditor.children, function (row) {
    var desc = row.querySelector('.item-desc').value;
    var qty = num(row.querySelector('.item-qty').value, 0);
    var rate = num(row.querySelector('.item-rate').value, 0);
    items.push({ desc: desc, qty: qty, rate: rate, amount: qty * rate });
  });
  return items;
}

/* ---------- state <-> form ---------- */

function collectState() {
  return {
    fromName: els.fromName.value,
    fromDetails: els.fromDetails.value,
    toName: els.toName.value,
    toDetails: els.toDetails.value,
    number: els.number.value,
    currency: els.currency.value,
    issueDate: els.issueDate.value,
    terms: els.terms.value,
    dueDate: els.dueDate.value,
    status: els.status.value,
    taxRate: els.taxRate.value,
    discountRate: els.discountRate.value,
    shipping: els.shipping.value,
    amountPaid: els.amountPaid.value,
    notes: els.notes.value,
    items: readItems().map(function (i) { return { desc: i.desc, qty: i.qty, rate: i.rate }; })
  };
}

function applyState(s) {
  els.fromName.value = s.fromName || '';
  els.fromDetails.value = s.fromDetails || '';
  els.toName.value = s.toName || '';
  els.toDetails.value = s.toDetails || '';
  els.number.value = s.number || nextInvoiceNumber();
  els.currency.value = s.currency || 'USD';
  els.issueDate.value = s.issueDate || todayISO();
  els.terms.value = s.terms != null ? String(s.terms) : '30';
  els.dueDate.value = s.dueDate || addDaysISO(els.issueDate.value, num(els.terms.value, 30));
  els.status.value = s.status || 'UNPAID';
  els.taxRate.value = s.taxRate != null ? s.taxRate : 0;
  els.discountRate.value = s.discountRate != null ? s.discountRate : 0;
  els.shipping.value = s.shipping != null ? s.shipping : 0;
  els.amountPaid.value = s.amountPaid != null ? s.amountPaid : 0;
  els.notes.value = s.notes || '';
  els.itemsEditor.innerHTML = '';
  var items = (s.items && s.items.length) ? s.items : [{ desc: '', qty: 1, rate: '' }];
  items.forEach(function (i) { addItemRow(i.desc, i.qty, i.rate); });
  update();
}

/* ---------- render preview + totals ---------- */

function update() {
  var items = readItems();

  // Per-row amounts in the editor
  Array.prototype.forEach.call(els.itemsEditor.children, function (row, idx) {
    row.querySelector('.item-amount').textContent = fmt(items[idx] ? items[idx].amount : 0);
  });

  var subtotal = items.reduce(function (sum, i) { return sum + i.amount; }, 0);
  var discount = subtotal * (num(els.discountRate.value) / 100);
  var taxable = subtotal - discount;
  var tax = taxable * (num(els.taxRate.value) / 100);
  var shipping = num(els.shipping.value);
  var total = taxable + tax + shipping;
  var paid = num(els.amountPaid.value);
  var due = Math.max(total - paid, 0);

  $('pv-number').textContent = '#' + (els.number.value || '—');
  var statusEl = $('pv-status');
  statusEl.textContent = els.status.value;
  statusEl.className = 'inv-status status-' + els.status.value.toLowerCase();

  $('pv-from-name').textContent = els.fromName.value || 'Your Name';
  $('pv-from-details').innerHTML = nl2br(els.fromDetails.value);
  $('pv-to-name').textContent = els.toName.value || 'Client Name';
  $('pv-to-details').innerHTML = nl2br(els.toDetails.value);

  $('pv-issue').textContent = prettyDate(els.issueDate.value);
  $('pv-due').textContent = prettyDate(els.dueDate.value);
  $('pv-terms').textContent = els.terms.value === '0' ? 'Due on receipt' : 'Net ' + els.terms.value;

  var tbody = $('pv-items');
  tbody.innerHTML = '';
  items.forEach(function (i) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="col-desc">' + (escapeHtml(i.desc) || '<em>Item</em>') + '</td>' +
      '<td class="col-num">' + (i.qty || 0) + '</td>' +
      '<td class="col-num">' + fmt(i.rate) + '</td>' +
      '<td class="col-num">' + fmt(i.amount) + '</td>';
    tbody.appendChild(tr);
  });

  $('pv-subtotal').textContent = fmt(subtotal);
  $('pv-discount-row').style.display = discount > 0 ? '' : 'none';
  $('pv-discount').textContent = '−' + fmt(discount);
  $('pv-tax-row').style.display = num(els.taxRate.value) > 0 ? '' : 'none';
  $('pv-tax').textContent = fmt(tax) + ' (' + num(els.taxRate.value) + '%)';
  $('pv-shipping-row').style.display = shipping > 0 ? '' : 'none';
  $('pv-shipping').textContent = fmt(shipping);
  $('pv-total').textContent = fmt(total);
  $('pv-paid-row').style.display = paid > 0 ? '' : 'none';
  $('pv-paid').textContent = '−' + fmt(paid);
  $('pv-due-amount').textContent = fmt(due);

  var notesWrap = $('pv-notes-wrap');
  if (els.notes.value.trim()) {
    notesWrap.style.display = '';
    $('pv-notes').innerHTML = nl2br(els.notes.value);
  } else {
    notesWrap.style.display = 'none';
  }

  saveDraft();
}

/* ---------- persistence ---------- */

function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(collectState())); } catch (e) { /* ignore */ }
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (e) { return []; }
}

function storeSaved(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}

function renderSavedList() {
  var list = loadSaved();
  els.savedList.innerHTML = '';
  if (!list.length) {
    var li = document.createElement('li');
    li.className = 'saved-empty';
    li.textContent = 'No saved invoices yet.';
    els.savedList.appendChild(li);
    return;
  }
  list.forEach(function (entry, idx) {
    var li = document.createElement('li');
    var total = entry.total != null ? fmt(entry.total) : '';
    li.innerHTML =
      '<span class="saved-meta"><strong>#' + escapeHtml(entry.state.number) + '</strong> — ' +
      escapeHtml(entry.state.toName || 'Untitled client') + ' · ' + escapeHtml(entry.state.status || '') +
      (total ? ' · ' + total : '') + '</span>';
    var loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'btn btn-secondary btn-small';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', function () { applyState(entry.state); });
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-ghost btn-small';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', function () {
      var l = loadSaved();
      l.splice(idx, 1);
      storeSaved(l);
      renderSavedList();
    });
    li.appendChild(loadBtn);
    li.appendChild(delBtn);
    els.savedList.appendChild(li);
  });
}

/* ---------- wiring ---------- */

[els.fromName, els.fromDetails, els.toName, els.toDetails, els.number, els.currency,
 els.issueDate, els.dueDate, els.status, els.taxRate, els.discountRate, els.shipping,
 els.amountPaid, els.notes].forEach(function (el) {
  el.addEventListener('input', update);
  el.addEventListener('change', update);
});

els.terms.addEventListener('change', function () {
  els.dueDate.value = addDaysISO(els.issueDate.value, num(els.terms.value, 0));
  update();
});

els.issueDate.addEventListener('change', function () {
  els.dueDate.value = addDaysISO(els.issueDate.value, num(els.terms.value, 0));
  update();
});

$('add-item').addEventListener('click', function () {
  addItemRow('', 1, '');
  update();
});

$('btn-print').addEventListener('click', function () {
  window.print();
});

$('btn-save').addEventListener('click', function () {
  var state = collectState();
  var items = readItems();
  var subtotal = items.reduce(function (s, i) { return s + i.amount; }, 0);
  var discount = subtotal * (num(state.discountRate) / 100);
  var total = (subtotal - discount) + (subtotal - discount) * (num(state.taxRate) / 100) + num(state.shipping);
  var list = loadSaved();
  var existing = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i].state.number === state.number) { existing = i; break; }
  }
  var entry = { state: state, total: total, savedAt: new Date().toISOString() };
  if (existing >= 0) list[existing] = entry; else list.unshift(entry);
  storeSaved(list);
  renderSavedList();
  var btn = $('btn-save');
  var original = btn.textContent;
  btn.textContent = 'Saved ✓';
  setTimeout(function () { btn.textContent = original; }, 1500);
});

$('btn-new').addEventListener('click', function () {
  bumpCounter();
  applyState({
    number: nextInvoiceNumber(),
    issueDate: todayISO(),
    terms: '30',
    dueDate: addDaysISO(todayISO(), 30),
    status: 'UNPAID',
    currency: els.currency.value,
    fromName: els.fromName.value,       // keep sender identity for the next invoice
    fromDetails: els.fromDetails.value,
    items: [{ desc: '', qty: 1, rate: '' }]
  });
});

/* ---------- init ---------- */

(function init() {
  var draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { draft = null; }
  if (draft) {
    applyState(draft);
  } else {
    applyState({
      number: nextInvoiceNumber(),
      issueDate: todayISO(),
      terms: '30',
      dueDate: addDaysISO(todayISO(), 30),
      status: 'UNPAID',
      items: [{ desc: '', qty: 1, rate: '' }]
    });
  }
  renderSavedList();
})();
