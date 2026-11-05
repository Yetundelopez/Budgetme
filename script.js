/* ═══════════════════════════════════════════════════════
   Spent – script.js
   Full logic · localStorage · no backend · no login
   ═══════════════════════════════════════════════════════ */
'use strict';

/* ── Categories ─────────────────────────────────────── */
const CATS = {
  food:          { label: 'Food',        emoji: '🍔', color: '#f97316' },
  transport:     { label: 'Transport',   emoji: '🚗', color: '#3b82f6' },
  shopping:      { label: 'Shopping',    emoji: '🛍️', color: '#ec4899' },
  housing:       { label: 'Housing',     emoji: '🏠', color: '#8b5cf6' },
  health:        { label: 'Health',      emoji: '💊', color: '#22c55e' },
  fun:           { label: 'Fun',         emoji: '🎬', color: '#eab308' },
  bills:         { label: 'Bills',       emoji: '💡', color: '#06b6d4' },
  education:     { label: 'Education',   emoji: '📚', color: '#a78bfa' },
  travel:        { label: 'Travel',      emoji: '✈️', color: '#14b8a6' },
  other:         { label: 'Other',       emoji: '💰', color: '#94a3b8' },
};

/* ── State ──────────────────────────────────────────── */
function localGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

const now = new Date();

const state = {
  expenses:    localGet('spent_v2_expenses', []),
  budget:      localGet('spent_v2_budget',   null),
  viewMonth:   monthStr(now),   // 'YYYY-MM'
  filterCat:   'all',
  sortBy:      'date',          // 'date' | 'amount'
  searchQuery: '',
  editingId:   null,
  deleteId:    null,
  sheetOpen:   false,
  selCat:      'other',         // selected category in form
};

function persist() {
  localStorage.setItem('spent_v2_expenses', JSON.stringify(state.expenses));
}
function persistBudget() {
  localStorage.setItem('spent_v2_budget', JSON.stringify(state.budget));
}

/* ── Utility ────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function monthStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function localDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function monthName(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function groupLabel(iso) {
  const t  = localDateStr(new Date());
  const y  = localDateStr(new Date(Date.now() - 86400000));
  if (iso === t) return 'Today';
  if (iso === y) return 'Yesterday';
  const [yr, mo, da] = iso.split('-').map(Number);
  return new Date(yr, mo - 1, da).toLocaleDateString('en-US',
    { weekday: 'short', month: 'short', day: 'numeric' });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

function hl(text, q) {
  if (!q) return text;
  return text.replace(new RegExp(`(${escRe(q)})`,'gi'), '<mark>$1</mark>');
}

/* ── DOM refs ───────────────────────────────────────── */
const searchWrap   = $('searchWrap');
const searchInput  = $('searchInput');
const searchClear  = $('searchClear');
const prevMonthBtn = $('prevMonth');
const nextMonthBtn = $('nextMonth');
const monthLabel   = $('monthLabel');
const nowBadge     = $('nowBadge');

const heroTotal    = $('heroTotal');
const heroTrend    = $('heroTrend');
const hCount       = $('hCount');
const hAvg         = $('hAvg');
const hHighest     = $('hHighest');
const hTop         = $('hTop');
const budgetWrap   = $('budgetWrap');
const budgetLbl    = $('budgetLbl');
const budgetPctLbl = $('budgetPctLbl');
const budgetFill   = $('budgetFill');
const budgetRemain = $('budgetRemaining');

const breakdownCard   = $('breakdownCard');
const donutCanvas     = $('donutChart');
const donutCenterLbl  = $('donutCenterLabel');
const catRows         = $('catRows');

const chipsRow     = $('chipsRow');
const listCountLbl = $('listCountLbl');
const sortDate     = $('sortDate');
const sortAmt      = $('sortAmt');

const emptyState   = $('emptyState');
const noResults    = $('noResults');
const groupedList  = $('groupedList');

const fab          = $('fab');
const backdrop     = $('backdrop');
const bottomSheet  = $('bottomSheet');
const sheetTitle   = $('sheetTitle');
const sheetClose   = $('sheetClose');
const expenseForm  = $('expenseForm');
const catGrid      = $('catGrid');
const dateInput    = $('dateInput');
const amtInput     = $('amtInput');
const descInput    = $('descInput');
const submitBtn    = $('submitBtn');

const budgetModal  = $('budgetModal');
const budgetInput  = $('budgetInput');
const budgetCancel = $('budgetCancel');
const budgetSave   = $('budgetSave');
const budgetRemove = $('budgetRemove');

const deleteModal   = $('deleteModal');
const deleteDesc    = $('deleteDesc');
const deleteCancel  = $('deleteCancel');
const deleteConfirm = $('deleteConfirm');
const toast         = $('toast');

/* ── Donut Chart (canvas) ───────────────────────────── */
function drawDonut(segments) {
  const canvas = donutCanvas;
  const ctx    = canvas.getContext('2d');
  const W = 200, H = 200; // canvas native resolution
  const cx = W / 2, cy = H / 2;
  const r  = W / 2 - 6;
  const ir = r * 0.56;      // inner radius (donut hole)
  const GAP = 0.05;         // gap between slices (radians)

  ctx.clearRect(0, 0, W, H);

  if (!segments || segments.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, ir, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill('evenodd');
    donutCenterLbl.innerHTML = '<span style="font-size:.7rem">No data</span>';
    return;
  }

  let startAngle = -Math.PI / 2;

  segments.forEach(seg => {
    const sweep = (seg.pct / 100) * Math.PI * 2;
    const s = startAngle + GAP / 2;
    const e = startAngle + sweep - GAP / 2;
    if (e <= s) { startAngle += sweep; return; }

    ctx.beginPath();
    ctx.arc(cx, cy, r,  s, e);
    ctx.arc(cx, cy, ir, e, s, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    startAngle += sweep;
  });

  // Center label: biggest category
  const top = segments[0];
  donutCenterLbl.innerHTML =
    `<span style="font-size:1.3rem;line-height:1">${top.emoji}</span>` +
    `<span style="font-size:.72rem;font-weight:700;color:#f1f5f9;margin-top:.12rem">${top.pct.toFixed(0)}%</span>`;
}

/* ── Breakdown Section ──────────────────────────────── */
function renderBreakdown(monthExp) {
  if (monthExp.length === 0) {
    breakdownCard.classList.remove('show');
    return;
  }
  breakdownCard.classList.add('show');

  // Aggregate by category
  const totals = {};
  monthExp.forEach(e => {
    const c = e.category || 'other';
    totals[c] = (totals[c] || 0) + e.amount;
  });
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  const segs = Object.entries(totals)
    .map(([cat, amt]) => ({
      cat, amt,
      pct:   (amt / grand) * 100,
      color: (CATS[cat] || CATS.other).color,
      emoji: (CATS[cat] || CATS.other).emoji,
      label: (CATS[cat] || CATS.other).label,
    }))
    .sort((a, b) => b.amt - a.amt);

  drawDonut(segs);

  // Category rows with mini bar
  catRows.innerHTML = '';
  segs.slice(0, 5).forEach(seg => {
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <div class="cat-row-dot" style="background:${seg.color}"></div>
      <div class="cat-row-info">
        <div class="cat-row-name">${seg.emoji} ${seg.label}</div>
        <div class="cat-row-bar-track">
          <div class="cat-row-bar-fill"
               style="width:${seg.pct}%;background:${seg.color}"></div>
        </div>
      </div>
      <span class="cat-row-pct">${seg.pct.toFixed(0)}%</span>
    `;
    catRows.appendChild(row);
  });
}

/* ── Category Filter Chips ──────────────────────────── */
function renderChips(monthExp) {
  const usedCats = [...new Set(monthExp.map(e => e.category || 'other'))];
  chipsRow.innerHTML = '';

  ['all', ...usedCats].forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (state.filterCat === cat ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat === 'all'
      ? 'All'
      : `${(CATS[cat] || CATS.other).emoji} ${(CATS[cat] || CATS.other).label}`;
    btn.addEventListener('click', () => {
      state.filterCat = cat;
      render();
    });
    chipsRow.appendChild(btn);
  });
}

/* ── Hero Stats ─────────────────────────────────────── */
function renderHero(monthExp) {
  const total   = monthExp.reduce((a, e) => a + e.amount, 0);
  const count   = monthExp.length;
  const avg     = count ? total / count : 0;
  const highest = count ? Math.max(...monthExp.map(e => e.amount)) : 0;

  heroTotal.textContent   = total.toFixed(2);
  hCount.textContent      = count;
  hAvg.textContent        = '$' + avg.toFixed(0);
  hHighest.textContent    = '$' + highest.toFixed(0);

  // Top category by spend
  if (count > 0) {
    const totals = {};
    monthExp.forEach(e => {
      const c = e.category || 'other';
      totals[c] = (totals[c] || 0) + e.amount;
    });
    const top = Object.entries(totals).sort((a,b)=>b[1]-a[1])[0][0];
    hTop.textContent = (CATS[top] || CATS.other).emoji;
  } else {
    hTop.textContent = '—';
  }

  // Trend vs previous month
  const [vy, vm] = state.viewMonth.split('-').map(Number);
  const prevDate  = new Date(vy, vm - 2, 1);
  const prevMonth = monthStr(prevDate);
  const prevTotal = state.expenses
    .filter(e => e.date.startsWith(prevMonth))
    .reduce((a, e) => a + e.amount, 0);

  if (prevTotal > 0 && total > 0) {
    const pct = ((total - prevTotal) / prevTotal) * 100;
    heroTrend.textContent = (pct >= 0 ? '↑' : '↓') + Math.abs(pct).toFixed(0) + '% vs prev';
    heroTrend.classList.add('vis');
  } else {
    heroTrend.classList.remove('vis');
  }

  // Budget
  if (state.budget) {
    budgetWrap.classList.add('show');
    const pct  = Math.min((total / state.budget) * 100, 100);
    const over = total > state.budget;
    budgetFill.style.width = pct + '%';
    budgetFill.classList.toggle('over', over);
    budgetLbl.textContent    = `Budget $${state.budget.toLocaleString()}`;
    budgetPctLbl.textContent = pct.toFixed(0) + '%';
    const rem = state.budget - total;
    budgetRemain.textContent = over
      ? `$${Math.abs(rem).toFixed(2)} over budget`
      : `$${rem.toFixed(2)} remaining`;
    budgetRemain.style.color = over ? '#fca5a5' : 'rgba(255,255,255,.75)';
  } else {
    budgetWrap.classList.remove('show');
  }
}

/* ── Main Render ────────────────────────────────────── */
function render() {
  const q          = state.searchQuery.trim().toLowerCase();
  const monthExp   = state.expenses.filter(e => e.date.startsWith(state.viewMonth));

  // Category filter
  let filtered = state.filterCat === 'all'
    ? monthExp
    : monthExp.filter(e => (e.category || 'other') === state.filterCat);

  // Search filter
  if (q) {
    filtered = filtered.filter(e =>
      e.desc.toLowerCase().includes(q) ||
      e.date.includes(q) ||
      String(e.amount).includes(q) ||
      (CATS[e.category]?.label || '').toLowerCase().includes(q)
    );
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (state.sortBy === 'amount') return b.amount - a.amount;
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.id.localeCompare(a.id);
  });

  // ── Month nav ──────────────────────────────────────
  monthLabel.textContent = monthName(state.viewMonth);
  const isNow = state.viewMonth === monthStr(now);
  nowBadge.classList.toggle('vis', isNow);
  nextMonthBtn.disabled = isNow;

  // ── Hero ───────────────────────────────────────────
  renderHero(monthExp);

  // ── Breakdown ──────────────────────────────────────
  renderBreakdown(monthExp);

  // ── Chips ──────────────────────────────────────────
  renderChips(monthExp);

  // ── Sort buttons ───────────────────────────────────
  sortDate.classList.toggle('active', state.sortBy === 'date');
  sortAmt.classList.toggle('active',  state.sortBy === 'amount');

  // ── Count label ────────────────────────────────────
  listCountLbl.textContent = filtered.length === 1
    ? '1 expense' : `${filtered.length} expenses`;

  // ── Empty states ───────────────────────────────────
  emptyState.style.display  = monthExp.length === 0 && !q ? '' : 'none';
  noResults.style.display   = filtered.length === 0 && (monthExp.length > 0 || q) ? '' : 'none';
  groupedList.style.display = filtered.length > 0 ? '' : 'none';

  if (filtered.length === 0) return;

  // ── Group by date ───────────────────────────────────
  const groups = {};
  filtered.forEach(e => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });

  const dateKeys = Object.keys(groups).sort((a, b) => {
    if (state.sortBy === 'amount') {
      return Math.max(...groups[b].map(e=>e.amount)) -
             Math.max(...groups[a].map(e=>e.amount));
    }
    return b.localeCompare(a);
  });

  groupedList.innerHTML = '';

  dateKeys.forEach(date => {
    const grp = document.createElement('div');
    grp.className = 'date-group';

    const hdr = document.createElement('div');
    hdr.className = 'date-group-hdr';
    hdr.textContent = groupLabel(date);
    grp.appendChild(hdr);

    const wrap = document.createElement('div');
    wrap.className = 'expense-items';

    groups[date].forEach(e => {
      const cat = CATS[e.category || 'other'] || CATS.other;
      const item = document.createElement('div');
      item.className  = 'expense-item';
      item.dataset.id = e.id;

      item.innerHTML = `
        <div class="exp-icon" style="background:${cat.color}1a">${cat.emoji}</div>
        <div class="exp-info">
          <div class="exp-desc">${hl(escHtml(e.desc), q)}</div>
          <div class="exp-cat-label">${cat.label}</div>
        </div>
        <div class="exp-right">
          <div class="exp-amount">$${e.amount.toFixed(2)}</div>
          <div class="exp-actions">
            <button class="exp-btn edit" data-id="${e.id}" aria-label="Edit">✏️</button>
            <button class="exp-btn del"  data-id="${e.id}" aria-label="Delete">🗑️</button>
          </div>
        </div>
      `;
      wrap.appendChild(item);
    });

    grp.appendChild(wrap);
    groupedList.appendChild(grp);
  });
}

/* ── Category Picker (bottom sheet) ─────────────────── */
function buildCatGrid() {
  catGrid.innerHTML = '';
  Object.entries(CATS).forEach(([key, cat]) => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'cat-opt' + (key === state.selCat ? ' sel' : '');
    btn.dataset.cat = key;
    btn.innerHTML = `
      <span class="cat-opt-emo">${cat.emoji}</span>
      <span class="cat-opt-lbl">${cat.label}</span>
    `;
    btn.addEventListener('click', () => {
      state.selCat = key;
      catGrid.querySelectorAll('.cat-opt').forEach(b =>
        b.classList.toggle('sel', b.dataset.cat === key)
      );
    });
    catGrid.appendChild(btn);
  });
}

/* ── Sheet open / close ─────────────────────────────── */
function openSheet(editId = null) {
  state.editingId = editId;
  state.sheetOpen = true;

  if (editId) {
    const e = state.expenses.find(x => x.id === editId);
    sheetTitle.textContent = 'Edit Expense';
    submitBtn.textContent  = 'Save Changes';
    dateInput.value        = e.date;
    amtInput.value         = e.amount;
    descInput.value        = e.desc;
    state.selCat           = e.category || 'other';
  } else {
    sheetTitle.textContent = 'New Expense';
    submitBtn.textContent  = 'Add Expense';
    expenseForm.reset();
    dateInput.value        = todayISO();
    state.selCat           = 'other';
  }

  resetErrors();
  buildCatGrid();

  bottomSheet.classList.add('open');
  bottomSheet.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('show');
  fab.classList.add('rotated');

  setTimeout(() => descInput.focus(), 350);
}

function closeSheet() {
  state.sheetOpen = false;
  state.editingId = null;
  bottomSheet.classList.remove('open');
  bottomSheet.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('show');
  fab.classList.remove('rotated');
  expenseForm.reset();
  resetErrors();
}

/* ── Validation ─────────────────────────────────────── */
function validate() {
  let ok = true;
  const setErr = (id, el, msg) => {
    $(id).textContent = msg; el.classList.add('invalid'); ok = false;
  };
  const clr = (id, el) => {
    $(id).textContent = ''; el.classList.remove('invalid');
  };

  if (!dateInput.value) setErr('dateErr', dateInput, 'Date required');
  else clr('dateErr', dateInput);

  const a = parseFloat(amtInput.value);
  if (!amtInput.value || isNaN(a) || a <= 0) setErr('amtErr', amtInput, 'Enter a valid amount');
  else clr('amtErr', amtInput);

  if (!descInput.value.trim()) setErr('descErr', descInput, 'Description required');
  else clr('descErr', descInput);

  return ok;
}

function resetErrors() {
  ['dateErr','amtErr','descErr'].forEach(id => { if ($(id)) $(id).textContent = ''; });
  [dateInput, amtInput, descInput].forEach(el => el && el.classList.remove('invalid'));
}

/* ── Form submit ────────────────────────────────────── */
expenseForm.addEventListener('submit', ev => {
  ev.preventDefault();
  if (!validate()) return;

  const entry = {
    date:     dateInput.value,
    desc:     descInput.value.trim(),
    amount:   parseFloat(parseFloat(amtInput.value).toFixed(2)),
    category: state.selCat,
  };

  if (state.editingId) {
    const idx = state.expenses.findIndex(x => x.id === state.editingId);
    if (idx !== -1) state.expenses[idx] = { id: state.editingId, ...entry };
    showToast('✓ Expense updated');
  } else {
    state.expenses.push({ id: uid(), ...entry });
    // Jump to entry's month if different
    if (entry.date.slice(0, 7) !== state.viewMonth) {
      state.viewMonth = entry.date.slice(0, 7);
    }
    showToast('✓ Expense added');
  }

  persist();
  closeSheet();
  render();
});

/* ── Event: FAB ─────────────────────────────────────── */
fab.addEventListener('click', () => {
  if (state.sheetOpen) closeSheet();
  else openSheet();
});

/* ── Event: Sheet close ─────────────────────────────── */
sheetClose.addEventListener('click', closeSheet);
backdrop.addEventListener('click',   closeSheet);

/* ── Event: Escape key ──────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (deleteModal.style.display !== 'none') closeDeleteModal();
  else if (budgetModal.style.display !== 'none') budgetModal.style.display = 'none';
  else if (state.sheetOpen) closeSheet();
});

/* ── Event: Expense list (delegated) ────────────────── */
groupedList.addEventListener('click', e => {
  const edit = e.target.closest('.exp-btn.edit');
  const del  = e.target.closest('.exp-btn.del');
  if (edit) openSheet(edit.dataset.id);
  if (del)  openDeleteModal(del.dataset.id);
});

/* ── Event: Month navigation ────────────────────────── */
prevMonthBtn.addEventListener('click', () => {
  const [y, m] = state.viewMonth.split('-').map(Number);
  state.viewMonth  = monthStr(new Date(y, m - 2, 1));
  state.filterCat  = 'all';
  render();
});

nextMonthBtn.addEventListener('click', () => {
  if (state.viewMonth >= monthStr(now)) return;
  const [y, m] = state.viewMonth.split('-').map(Number);
  state.viewMonth  = monthStr(new Date(y, m, 1));
  state.filterCat  = 'all';
  render();
});

/* ── Event: Sort buttons ────────────────────────────── */
sortDate.addEventListener('click', () => { state.sortBy = 'date';   render(); });
sortAmt.addEventListener('click',  () => { state.sortBy = 'amount'; render(); });

/* ── Event: Search ──────────────────────────────────── */
$('searchBtn').addEventListener('click', () => {
  const open = searchWrap.classList.toggle('open');
  if (open) {
    setTimeout(() => searchInput.focus(), 300);
  } else {
    searchInput.value = '';
    state.searchQuery = '';
    searchClear.classList.remove('vis');
    render();
  }
});

searchInput.addEventListener('input', () => {
  state.searchQuery = searchInput.value;
  searchClear.classList.toggle('vis', !!searchInput.value);
  render();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  state.searchQuery = '';
  searchClear.classList.remove('vis');
  searchInput.focus();
  render();
});

/* ── Budget Modal ───────────────────────────────────── */
$('budgetBtn').addEventListener('click', () => {
  budgetInput.value = state.budget || '';
  budgetModal.style.display = 'flex';
  setTimeout(() => budgetInput.focus(), 100);
});

budgetCancel.addEventListener('click', () => { budgetModal.style.display = 'none'; });

budgetSave.addEventListener('click', () => {
  const val = parseFloat(budgetInput.value);
  if (isNaN(val) || val <= 0) {
    budgetInput.classList.add('invalid');
    setTimeout(() => budgetInput.classList.remove('invalid'), 400);
    return;
  }
  state.budget = val;
  persistBudget();
  budgetModal.style.display = 'none';
  render();
  showToast(`🎯 Budget set to $${val.toLocaleString()}`);
});

budgetRemove.addEventListener('click', () => {
  state.budget = null;
  persistBudget();
  budgetModal.style.display = 'none';
  render();
  showToast('Budget removed');
});

budgetModal.addEventListener('click', e => {
  if (e.target === budgetModal) budgetModal.style.display = 'none';
});

/* ── Delete Modal ───────────────────────────────────── */
function openDeleteModal(id) {
  const item = state.expenses.find(e => e.id === id);
  if (!item) return;
  state.deleteId = id;
  deleteDesc.textContent = `"${item.desc}" will be permanently removed.`;
  deleteModal.style.display = 'flex';
  deleteConfirm.focus();
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
  state.deleteId = null;
}

deleteCancel.addEventListener('click', closeDeleteModal);

deleteConfirm.addEventListener('click', () => {
  if (!state.deleteId) return;
  state.expenses = state.expenses.filter(e => e.id !== state.deleteId);
  persist();
  if (state.editingId === state.deleteId) closeSheet();
  closeDeleteModal();
  render();
  showToast('🗑️ Expense deleted');
});

deleteModal.addEventListener('click', e => {
  if (e.target === deleteModal) closeDeleteModal();
});

/* ── Toast ──────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ── Init ───────────────────────────────────────────── */
render();
