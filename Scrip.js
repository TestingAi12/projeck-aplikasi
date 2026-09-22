const currency=new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0});
const dateFormatter=new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'});
const monthNamesID=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const dayNamesID=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

const expenseCategories=['Makan & Minum','Kos & Utilitas','Transportasi','Nongkrong','Lainnya'];
const incomeCategories=['Kerja sampingan','Uang bulanan'];
const budgetCategories=['Makan & Minum','Kos & Utilitas','Transportasi','Nongkrong'];
const categoryIcons={'Makan & Minum':'🍜','Kos & Utilitas':'🏠',Transportasi:'🛵',Nongkrong:'☕','Kerja sampingan':'💼','Uang bulanan':'🎓',Lainnya:'🧾'};
const categoryColors={'Makan & Minum':'#FFB300','Kos & Utilitas':'#6200EA',Transportasi:'#26A69A',Nongkrong:'#9C27B0'};

let transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
let budgetTargets = JSON.parse(localStorage.getItem('budgetTargets') || '{}');
let wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
let trendChartInstance = null;

function saveTransactions(){ localStorage.setItem('transactions', JSON.stringify(transactions)); }
function saveBudgetTargets(){ localStorage.setItem('budgetTargets', JSON.stringify(budgetTargets)); }
function saveWallets(){ localStorage.setItem('wallets', JSON.stringify(wallets)); }
function catKey(c){ return c.replace(/[^a-zA-Z0-9]/g,''); }
function escapeHtml(str){ const d=document.createElement('div'); d.textContent=str||''; return d.innerHTML; }

const modal=document.getElementById('modalBackdrop'),typeInput=document.getElementById('transactionType'),list=document.getElementById('transactionList'),dateInput=document.getElementById('transactionDate');
const editingIdInput=document.getElementById('editingId');
const categorySelect=document.getElementById('category');
const monthFilter=document.getElementById('monthFilter');
const balanceAmountEl=document.getElementById('balanceAmount'),incomeAmountEl=document.getElementById('incomeAmount'),expenseAmountEl=document.getElementById('expenseAmount');
const balanceChangeEl=document.getElementById('balanceChange'),incomeChangeEl=document.getElementById('incomeChange'),expenseChangeEl=document.getElementById('expenseChange');
const budgetList=document.getElementById('budgetList'),budgetNote=document.getElementById('budgetNote');
const trendCanvas=document.getElementById('trendChart'),chartEmptyState=document.getElementById('chartEmptyState');
const txSearch=document.getElementById('txSearch'),txTypeFilter=document.getElementById('txTypeFilter'),txCategoryFilter=document.getElementById('txCategoryFilter');
const exportCsvBtn=document.getElementById('exportCsvBtn'),printReportBtn=document.getElementById('printReportBtn');
const paydayBanner=document.getElementById('paydayBanner');
const notifBtn=document.getElementById('notifBtn'),notifDropdown=document.getElementById('notifDropdown'),notifBadge=document.getElementById('notifBadge'),notifList=document.getElementById('notifList');
const themeToggle=document.getElementById('themeToggle');
const openBudgetModalBtn=document.getElementById('openBudgetModal'),budgetModalBackdrop=document.getElementById('budgetModalBackdrop');
const walletGrid=document.getElementById('walletGrid'),walletEmptyState=document.getElementById('walletEmptyState');
const walletTotalAmount=document.getElementById('walletTotalAmount'),walletTotalCount=document.getElementById('walletTotalCount');
const walletWidgetList=document.getElementById('walletWidgetList'),walletWidgetEmpty=document.getElementById('walletWidgetEmpty'),walletWidgetTotal=document.getElementById('walletWidgetTotal');
const transactionWalletSelect=document.getElementById('transactionWallet');
const walletForm=document.getElementById('walletForm'),walletModalBackdrop=document.getElementById('walletModalBackdrop');
const walletPresetSelect=document.getElementById('walletPreset'),walletManualNameField=document.getElementById('walletManualNameField'),walletManualNameInput=document.getElementById('walletManualName'),walletTypeSelect=document.getElementById('walletType'),walletBalanceInput=document.getElementById('walletBalanceInput'),editingWalletIdInput=document.getElementById('editingWalletId');

function localToday(){const now=new Date();const offset=now.getTimezoneOffset();return new Date(now.getTime()-offset*60000).toISOString().slice(0,10)}
function formatDate(value){const [year,month,day]=value.split('-').map(Number);return dateFormatter.format(new Date(year,month-1,day))}
function ymOf(dateStr){ return dateStr.slice(0,7); }
function shiftYM(ym, delta){ let [y,m]=ym.split('-').map(Number); m+=delta; while(m<1){m+=12;y--;} while(m>12){m-=12;y++;} return y+'-'+String(m).padStart(2,'0'); }
function labelYM(ym){ const [y,m]=ym.split('-').map(Number); return monthNamesID[m-1]+' '+y; }
function sumByType(list,type){ return list.filter(t=>t.type===type).reduce((s,t)=>s+t.amount,0); }

// animasi angka naik/turun pelan-pelan ke nilai target
function animateNumber(element, target, duration = 700) {
  const start = Number(element.dataset.rawValue || 0);
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out
    const current = start + (target - start) * eased;
    element.textContent = currency.format(Math.round(current));
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.dataset.rawValue = target;
    }
  }

  requestAnimationFrame(step);
}

function setChangeText(el, current, prev, isExpense=false){
  if(!el) return;
  if(current===0 && prev===0){ el.textContent='Belum ada transaksi bulan ini'; el.className='change'; return; }
  if(prev===0){ el.textContent = current>0 ? 'Baru mulai tercatat bulan ini' : 'Belum ada transaksi bulan ini'; el.className='change'; return; }
  const pct = Math.round(((current-prev)/prev)*100);
  const arrow = pct>=0 ? '▲' : '▼';
  const good = isExpense ? pct<=0 : pct>=0;
  el.textContent = `${arrow} ${Math.abs(pct)}% dibanding bulan lalu`;
  el.className = 'change ' + (good?'change-up':'change-down');
}

// ===== Update pilihan bulan di dropdown filter =====
function renderMonthOptions(){
  const set = new Set(transactions.map(t=>ymOf(t.date)));
  const todayYM = ymOf(localToday());
  set.add(todayYM);
  const options = Array.from(set).sort().reverse();
  const prevValue = monthFilter.value;
  monthFilter.innerHTML = options.map(ym=>`<option value="${ym}">${labelYM(ym)}</option>`).join('');
  monthFilter.value = options.includes(prevValue) ? prevValue : todayYM;
}

// ===== Kategori dropdown pada modal transaksi, mengikuti jenis (pemasukan/pengeluaran) =====
function updateCategoryOptions(type){
  const cats = type==='income' ? incomeCategories : expenseCategories;
  categorySelect.innerHTML = cats.map(c=>`<option>${c}</option>`).join('');
}

// ===== Render anggaran per kategori =====
function renderBudget(monthTx){
  const spentByCategory={};
  budgetCategories.forEach(c=>spentByCategory[c]=0);
  monthTx.filter(t=>t.type==='expense').forEach(t=>{ if(spentByCategory[t.category]!==undefined) spentByCategory[t.category]+=t.amount; });

  const overBudget=[];
  budgetList.innerHTML = budgetCategories.map(cat=>{
    const spent=spentByCategory[cat];
    const target=budgetTargets[cat]||0;
    const pct = target>0 ? Math.min(100, Math.round((spent/target)*100)) : 0;
    if(target>0 && spent/target>=0.8){ overBudget.push({cat, spent, target, pct:Math.round((spent/target)*100)}); }
    return `<div>
      <div class="budget-item-top"><span>${categoryIcons[cat]} ${cat}</span><span>${currency.format(spent)} / ${target>0?currency.format(target):'Belum diatur'}</span></div>
      <div class="budget-bar"><i style="width:${pct}%;background:${categoryColors[cat]}"></i></div>
    </div>`;
  }).join('');

  if(overBudget.length){
    budgetNote.textContent = `⚠️ ${overBudget.length} kategori sudah mendekati/melebihi batas anggaran bulan ini.`;
    budgetNote.classList.add('budget-warn');
  } else {
    budgetNote.textContent = 'Anggaran masih aman. Atur limit tiap kategori lewat tombol "Atur" di atas.';
    budgetNote.classList.remove('budget-warn');
  }

  renderNotifications(overBudget);
}

function renderNotifications(overBudget){
  lastOverBudget = overBudget || [];
  const items=[];

  // --- Peringatan tagihan / tanggungan jatuh tempo ---
  const billAlerts = (typeof getBillAlerts === 'function') ? getBillAlerts() : [];
  billAlerts.forEach(b=>{
    const st=billStatus(b);
    const icon = st.key==='late' ? '🚨' : (st.key==='today' ? '⏰' : '📌');
    items.push(`<div class="notif-item notif-${st.key}">${icon} <strong>${escapeHtml(b.name)}</strong> ke ${escapeHtml(b.party||'-')} — ${currency.format(b.amount)}<div class="notif-sub">${st.label} · ${dayNameOf(b.dueDate)}, ${formatDate(b.dueDate)}</div></div>`);
  });

  // --- Peringatan tugas kampus mendekati deadline ---
  const taskAlerts = (typeof getTaskAlerts === 'function') ? getTaskAlerts() : [];
  taskAlerts.forEach(t=>{
    const st=taskStatus(t);
    const icon = st.key==='late' ? '🚨' : (st.key==='today' ? '⏰' : '🎓');
    items.push(`<div class="notif-item notif-${st.key}">${icon} <strong>${escapeHtml(t.title)}</strong> — ${escapeHtml(t.subject||'-')}<div class="notif-sub">${st.label} · ${dayNameOf(t.deadlineDate)}, ${formatDate(t.deadlineDate)}</div></div>`);
  });

  // --- Peringatan anggaran ---
  lastOverBudget.forEach(o=>{
    items.push(`<div class="notif-item">⚠️ <strong>${o.cat}</strong> sudah ${o.pct}% dari anggaran<div class="notif-sub">${currency.format(o.spent)} / ${currency.format(o.target)}</div></div>`);
  });

  if(items.length){
    notifBadge.style.display='grid';
    notifBadge.textContent=items.length;
    notifList.innerHTML = items.join('');
  } else {
    notifBadge.style.display='none';
    notifList.innerHTML = '<div class="notif-empty">Tidak ada peringatan. Anggaran &amp; tagihan aman! ✅</div>';
  }
}

// ===== Grafik arus keuangan mingguan =====
function renderChart(monthTx, ym){
  if(monthTx.length===0 || typeof Chart==='undefined'){
    chartEmptyState.style.display='grid';
    trendCanvas.style.display='none';
    if(trendChartInstance){ trendChartInstance.destroy(); trendChartInstance=null; }
    return;
  }
  chartEmptyState.style.display='none';
  trendCanvas.style.display='block';

  const [y,m]=ym.split('-').map(Number);
  const daysInMonth=new Date(y,m,0).getDate();
  const buckets=[[1,7],[8,14],[15,21],[22,daysInMonth]];
  const labels=buckets.map((b,i)=>`Minggu ${i+1}`);
  const incomeData=buckets.map(([start,end])=> sumByType(monthTx.filter(t=>{const d=Number(t.date.slice(8,10)); return d>=start&&d<=end;}),'income'));
  const expenseData=buckets.map(([start,end])=> sumByType(monthTx.filter(t=>{const d=Number(t.date.slice(8,10)); return d>=start&&d<=end;}),'expense'));

  if(trendChartInstance){ trendChartInstance.destroy(); }
  trendChartInstance = new Chart(trendCanvas.getContext('2d'), {
    type:'bar',
    data:{ labels, datasets:[
      {label:'Pemasukan', data:incomeData, backgroundColor:'#2DD4A0', borderRadius:6, maxBarThickness:30},
      {label:'Pengeluaran', data:expenseData, backgroundColor:'#FF6B81', borderRadius:6, maxBarThickness:30}
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      font:{ family:'Roboto, "Helvetica Neue", Arial, sans-serif', size:11 },
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(ctx)=>` ${ctx.dataset.label}: ${currency.format(ctx.raw)}` } } },
      scales:{
        x:{ grid:{ display:false }, ticks:{ color:'#8A8A8A' } },
        y:{ border:{ display:false }, grid:{ color:'rgba(128,128,128,.18)' }, ticks:{ color:'#8A8A8A', callback:v=>currency.format(v) } }
      }
    }
  });
}

// ===== Filter & render daftar transaksi =====
function getFilteredTransactions(){
  const q=(txSearch.value||'').toLowerCase().trim();
  const typeF=txTypeFilter.value;
  const catF=txCategoryFilter.value;
  return transactions.filter(t=>{
    if(q && !t.name.toLowerCase().includes(q)) return false;
    if(typeF!=='all' && t.type!==typeF) return false;
    if(catF!=='all' && t.category!==catF) return false;
    return true;
  }).sort((a,b)=> (b.date+String(b.id).padStart(20,'0')).localeCompare(a.date+String(a.id).padStart(20,'0')));
}

function renderTransactionList(){
  const filtered = getFilteredTransactions();
  if(filtered.length===0){
    list.innerHTML = `<div class="empty-transactions" id="emptyState"><svg class="icon empty-icon" viewBox="0 0 40 40" style="width:30px;height:30px;margin:0 auto 8px;color:var(--muted)"><rect x="6" y="10" width="28" height="22" rx="3"/><path d="M6 18h28M14 10v8M26 10v8"/></svg><strong>Belum ada transaksi</strong><span>Coba ubah pencarian/filter, atau tekan tombol "Tambah Transaksi".</span></div>`;
    return;
  }
  list.innerHTML = filtered.map(t=>{
    const wallet = t.walletId ? wallets.find(w=>w.id===t.walletId) : null;
    const walletTag = wallet ? ` · ${escapeHtml(wallet.name)}` : '';
    return `
    <div class="transaction" data-id="${t.id}">
      <div class="trans-icon">${categoryIcons[t.category]||'🧾'}</div>
      <div><div class="trans-name">${escapeHtml(t.name)}</div><div class="trans-category">${t.type==='income'?'Pemasukan':'Pengeluaran'} · ${escapeHtml(t.category)}${walletTag}</div></div>
      <div class="trans-date">${formatDate(t.date)}</div>
      <div class="trans-amount ${t.type==='income'?'positive':'negative'}">${t.type==='income'?'+':'−'} ${currency.format(t.amount)}</div>
      <div class="trans-actions">
        <button type="button" class="trans-edit" data-id="${t.id}" title="Edit">✏️</button>
        <button type="button" class="trans-delete" data-id="${t.id}" title="Hapus">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function populateCategoryFilter(){
  const all=[...expenseCategories, ...incomeCategories];
  txCategoryFilter.innerHTML = '<option value="all">Semua Kategori</option>' + all.map(c=>`<option value="${c}">${c}</option>`).join('');
}

// ===== Banner tanggal gajian =====
function renderPaydayBanner(){
  const profile=getSavedProfile();
  const payday=Number(profile.payday);
  if(!payday || payday<1 || payday>31){ paydayBanner.style.display='none'; return; }
  const now=new Date();
  const todayOnly=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let target=new Date(now.getFullYear(), now.getMonth(), payday);
  if(target < todayOnly){ target=new Date(now.getFullYear(), now.getMonth()+1, payday); }
  const diffDays=Math.round((target-todayOnly)/86400000);
  paydayBanner.style.display='flex';
  paydayBanner.textContent = diffDays===0
    ? '🎉 Hari ini tanggal gajian / uang bulanan kamu!'
    : `📅 ${diffDays} hari lagi menuju tanggal ${payday} (gajian/uang bulanan).`;
}

// ===== Dompet & Rekening (BRImo, SeaBank, GoPay, dll — dilacak manual, tanpa koneksi bank asli) =====
const walletTypeLabels={bank:'Bank',ewallet:'E-Wallet',cash:'Tunai',other:'Lainnya'};
const walletTypeColors={bank:'#6200EA',ewallet:'#F57C00',cash:'#26A69A',other:'#757575'};

function walletTypeLabel(type){ return walletTypeLabels[type] || 'Lainnya'; }
function walletBadgeColor(type){ return walletTypeColors[type] || walletTypeColors.other; }
function walletInitials(name){
  const clean=(name||'').replace(/\(.*?\)/g,'').trim();
  const parts=clean.split(/\s+/).filter(Boolean).slice(0,2);
  return (parts.map(p=>p[0]).join('') || '?').toUpperCase();
}
function walletNetFromTransactions(id){
  return transactions.filter(t=>t.walletId===id).reduce((s,t)=> s + (t.type==='income'? t.amount : -t.amount), 0);
}
function walletBalance(w){
  return (w.balanceBase||0) + walletNetFromTransactions(w.id) + (w.adjustment||0);
}
function totalWalletBalance(){ return wallets.reduce((s,w)=>s+walletBalance(w),0); }

function populateWalletSelect(){
  if(!transactionWalletSelect) return;
  const prev=transactionWalletSelect.value;
  transactionWalletSelect.innerHTML = '<option value="">Tanpa rekening (umum)</option>' +
    wallets.map(w=>`<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
  if(wallets.some(w=>String(w.id)===prev)) transactionWalletSelect.value=prev;
}

function renderWalletWidget(){
  if(!walletWidgetList) return;
  if(wallets.length===0){
    walletWidgetList.innerHTML='';
    if(walletWidgetEmpty) walletWidgetEmpty.style.display='block';
  } else {
    if(walletWidgetEmpty) walletWidgetEmpty.style.display='none';
    walletWidgetList.innerHTML = wallets.slice(0,4).map(w=>`
      <div class="wallet-mini-item">
        <div><div class="wallet-mini-name">${escapeHtml(w.name)}</div><div class="wallet-mini-type">${walletTypeLabel(w.type)}</div></div>
        <div class="wallet-mini-balance">${currency.format(walletBalance(w))}</div>
      </div>`).join('');
  }
  if(walletWidgetTotal) walletWidgetTotal.textContent = currency.format(totalWalletBalance());
}

function renderWallets(){
  if(!walletGrid) return;
  if(wallets.length===0){
    walletGrid.innerHTML='';
    walletEmptyState.style.display='block';
  } else {
    walletEmptyState.style.display='none';
    walletGrid.innerHTML = wallets.map(w=>{
      const color=walletBadgeColor(w.type);
      return `<div class="wallet-card" data-id="${w.id}">
        <div class="wallet-card-top">
          <span class="wallet-badge" style="background:${color};color:#fff">${escapeHtml(walletInitials(w.name))}</span>
          <div class="wallet-card-menu">
            <button type="button" class="wallet-sync-btn" data-id="${w.id}" title="Sinkronkan saldo manual">⟲</button>
            <button type="button" class="wallet-edit-btn" data-id="${w.id}" title="Ubah">✎</button>
            <button type="button" class="wallet-delete-btn" data-id="${w.id}" title="Hapus">🗑</button>
          </div>
        </div>
        <div><div class="wallet-name">${escapeHtml(w.name)}</div><div class="wallet-type">${walletTypeLabel(w.type)}</div></div>
        <div class="wallet-balance">${currency.format(walletBalance(w))}</div>
      </div>`;
    }).join('');
  }
  walletTotalAmount.textContent = currency.format(totalWalletBalance());
  walletTotalCount.textContent = wallets.length + (wallets.length===1 ? ' rekening dipantau' : ' rekening dipantau');
  populateWalletSelect();
}

function handleWalletPresetChange(){
  const [name,type]=walletPresetSelect.value.split('|');
  if(name==='custom'){
    walletManualNameField.style.display='grid';
    walletManualNameInput.required=true;
  } else {
    walletManualNameField.style.display='none';
    walletManualNameInput.required=false;
    walletManualNameInput.value=name;
  }
  walletTypeSelect.value=type;
}
if(walletPresetSelect) walletPresetSelect.addEventListener('change', handleWalletPresetChange);

function openWalletModal(){
  editingWalletIdInput.value='';
  walletForm.reset();
  walletPresetSelect.value='custom|other';
  handleWalletPresetChange();
  document.getElementById('walletModalTitle').textContent='Tambah Rekening';
  walletForm.querySelector('button[type="submit"]').textContent='Simpan Rekening';
  walletModalBackdrop.classList.add('show');
}
function closeWalletModal(){ walletModalBackdrop.classList.remove('show'); }

function openEditWalletModal(id){
  const w=wallets.find(x=>x.id===id);
  if(!w) return;
  editingWalletIdInput.value=w.id;
  const matched=Array.from(walletPresetSelect.options).find(o=>o.value.split('|')[0]===w.name);
  walletPresetSelect.value = matched ? matched.value : 'custom|'+w.type;
  handleWalletPresetChange();
  if(!matched){
    walletManualNameInput.value=w.name;
    walletManualNameField.style.display='grid';
    walletManualNameInput.required=true;
  }
  walletTypeSelect.value=w.type;
  walletBalanceInput.value=w.balanceBase||0;
  document.getElementById('walletModalTitle').textContent='Ubah Rekening';
  walletForm.querySelector('button[type="submit"]').textContent='Simpan Perubahan';
  walletModalBackdrop.classList.add('show');
}

function handleDeleteWallet(id){
  if(!confirm('Hapus rekening ini? Transaksi yang sudah tercatat tidak akan terhapus, hanya tautannya ke rekening ini yang dilepas.')) return;
  wallets = wallets.filter(w=>w.id!==id);
  transactions.forEach(t=>{ if(t.walletId===id) t.walletId=null; });
  saveWallets(); saveTransactions();
  renderWallets(); renderWalletWidget(); renderTransactionList();
}

function handleSyncWallet(id){
  const w=wallets.find(x=>x.id===id);
  if(!w) return;
  const current=walletBalance(w);
  const input=prompt(`Cocokkan dengan saldo asli ${w.name} di aplikasinya saat ini:`, current);
  if(input===null) return;
  const target=Number(input);
  if(Number.isNaN(target)){ alert('Masukkan angka yang valid.'); return; }
  w.adjustment = target - (w.balanceBase||0) - walletNetFromTransactions(w.id);
  saveWallets();
  renderWallets(); renderWalletWidget();
}

if(walletGrid) walletGrid.addEventListener('click', e=>{
  const editBtn=e.target.closest('.wallet-edit-btn');
  const delBtn=e.target.closest('.wallet-delete-btn');
  const syncBtn=e.target.closest('.wallet-sync-btn');
  if(editBtn) openEditWalletModal(Number(editBtn.dataset.id));
  if(delBtn) handleDeleteWallet(Number(delBtn.dataset.id));
  if(syncBtn) handleSyncWallet(Number(syncBtn.dataset.id));
});

if(walletForm) walletForm.addEventListener('submit', e=>{
  e.preventDefault();
  const presetName=walletPresetSelect.value.split('|')[0];
  const name = presetName==='custom' ? walletManualNameInput.value.trim() : presetName;
  const type = walletTypeSelect.value;
  const balanceBase = Number(walletBalanceInput.value) || 0;
  const editingId = editingWalletIdInput.value;
  if(!name) return;
  if(editingId){
    const idx=wallets.findIndex(w=>w.id===Number(editingId));
    if(idx>-1){ wallets[idx]={...wallets[idx], name, type, balanceBase}; }
  } else {
    wallets.push({ id: Date.now(), name, type, balanceBase, adjustment:0 });
  }
  saveWallets();
  renderWallets(); renderWalletWidget();
  closeWalletModal();
});

['closeWalletModal','cancelWalletModal'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener('click', closeWalletModal);
});
if(walletModalBackdrop) walletModalBackdrop.addEventListener('click', e=>{ if(e.target===walletModalBackdrop) closeWalletModal(); });

['addWalletBtn','widgetAddWalletBtn'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener('click', openWalletModal);
});
const goToWalletsBtn=document.getElementById('goToWalletsBtn');
if(goToWalletsBtn) goToWalletsBtn.addEventListener('click', ()=>{
  const m=document.querySelector('.menu-item[data-page="dompet"]');
  if(m) m.click();
});

// ===== Kalkulator (Standar / Split Bill / Target Tabungan) =====

// --- Mesin kalkulator generik, dipakai oleh kalkulator utama & kalkulator cepat ---
function makeCalcEngine(exprEl, historyEl){
  const state = { current:'0', previous:null, operator:null, resetNext:false, memory:0, history:[] };

  function round(n){ return Math.round((n + Number.EPSILON) * 1e6) / 1e6; }
  function fmt(numStr){
    if(numStr==='Error') return numStr;
    const neg = numStr.startsWith('-');
    const raw = neg ? numStr.slice(1) : numStr;
    const [intPart, decPart] = raw.split('.');
    const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg?'-':'') + intFmt + (decPart!==undefined ? ','+decPart : '');
  }
  function opSymbol(op){ return {add:'+',subtract:'−',multiply:'×',divide:'÷'}[op] || ''; }
  function render(){
    if(exprEl) exprEl.textContent = fmt(state.current);
    if(historyEl) historyEl.innerHTML = state.history.slice(-3).map(h=>`<div>${h}</div>`).join('');
  }
  function compute(a,b,op){
    switch(op){
      case 'add': return a+b;
      case 'subtract': return a-b;
      case 'multiply': return a*b;
      case 'divide': return b===0 ? NaN : a/b;
      default: return b;
    }
  }
  function inputDigit(d){
    if(state.resetNext || state.current==='0'){ state.current = d; state.resetNext=false; }
    else { state.current += d; }
    render();
  }
  function inputDot(){
    if(state.resetNext){ state.current='0.'; state.resetNext=false; render(); return; }
    if(!state.current.includes('.')) state.current += '.';
    render();
  }
  function clearAll(){ state.current='0'; state.previous=null; state.operator=null; state.resetNext=false; render(); }
  function backspace(){
    if(state.resetNext) return;
    state.current = state.current.length>1 ? state.current.slice(0,-1) : '0';
    render();
  }
  function percent(){ state.current = String(round(parseFloat(state.current||'0')/100)); render(); }
  function chooseOperator(op){
    const val = parseFloat(state.current) || 0;
    if(state.operator && !state.resetNext){
      const result = compute(state.previous, val, state.operator);
      state.current = Number.isFinite(result) ? String(round(result)) : 'Error';
      state.previous = Number.isFinite(result) ? result : null;
    } else {
      state.previous = val;
    }
    state.operator = op;
    state.resetNext = true;
    render();
  }
  function equals(){
    if(state.operator===null) return;
    const val = parseFloat(state.current) || 0;
    const result = compute(state.previous, val, state.operator);
    if(Number.isFinite(result)){
      state.history.push(`${fmt(String(state.previous))} ${opSymbol(state.operator)} ${fmt(String(val))} = ${fmt(String(round(result)))}`);
      state.current = String(round(result));
    } else {
      state.current = 'Error';
    }
    state.previous = null;
    state.operator = null;
    state.resetNext = true;
    render();
  }
  function memoryAdd(){ state.memory += (parseFloat(state.current)||0); }
  function memorySub(){ state.memory -= (parseFloat(state.current)||0); }
  function memoryRecall(){ state.current = String(state.memory); state.resetNext=false; render(); }
  function memoryClear(){ state.memory = 0; }
  function clearHistory(){ state.history=[]; render(); }
  function getValue(){ const v=parseFloat(state.current); return Number.isFinite(v) ? v : 0; }

  render();
  return { inputDigit, inputDot, clearAll, backspace, percent, chooseOperator, equals, memoryAdd, memorySub, memoryRecall, memoryClear, clearHistory, getValue };
}

function bindCalcKeys(containerEl, engine){
  if(!containerEl || !engine) return;
  containerEl.addEventListener('click', e=>{
    const btn = e.target.closest('[data-calc-key]');
    if(!btn) return;
    const key = btn.dataset.calcKey;
    if(/^[0-9]$/.test(key)) engine.inputDigit(key);
    else if(key==='00'){ engine.inputDigit('0'); engine.inputDigit('0'); }
    else if(key==='dot') engine.inputDot();
    else if(key==='clear') engine.clearAll();
    else if(key==='back') engine.backspace();
    else if(key==='percent') engine.percent();
    else if(['add','subtract','multiply','divide'].includes(key)) engine.chooseOperator(key);
    else if(key==='equals') engine.equals();
    else if(key==='mc') engine.memoryClear();
    else if(key==='mr') engine.memoryRecall();
    else if(key==='m+') engine.memoryAdd();
    else if(key==='m-') engine.memorySub();
  });
}

// --- Kalkulator standar (halaman Kalkulator) ---
const calcExpressionEl=document.getElementById('calcExpression'), calcHistoryEl=document.getElementById('calcHistory');
const mainCalc = calcExpressionEl ? makeCalcEngine(calcExpressionEl, calcHistoryEl) : null;
bindCalcKeys(document.getElementById('calcKeys'), mainCalc);

document.getElementById('calcClearHistoryBtn')?.addEventListener('click', ()=> mainCalc && mainCalc.clearHistory());
document.getElementById('calcUseResultBtn')?.addEventListener('click', ()=>{
  if(!mainCalc) return;
  const val = mainCalc.getValue();
  openModal();
  document.getElementById('amount').value = val>0 ? val : '';
});

// dukungan keyboard untuk kalkulator standar saat tab tersebut aktif
document.addEventListener('keydown', (e)=>{
  const kalkPage=document.getElementById('page-kalkulator');
  const standarPanel=document.getElementById('calcPanel-standar');
  if(!mainCalc || !kalkPage || !kalkPage.classList.contains('active') || !standarPanel || !standarPanel.classList.contains('active')) return;
  const k=e.key;
  if(/^[0-9]$/.test(k)) mainCalc.inputDigit(k);
  else if(k==='.'||k===',') mainCalc.inputDot();
  else if(k==='+') mainCalc.chooseOperator('add');
  else if(k==='-') mainCalc.chooseOperator('subtract');
  else if(k==='*') mainCalc.chooseOperator('multiply');
  else if(k==='/'){ e.preventDefault(); mainCalc.chooseOperator('divide'); }
  else if(k==='Enter'||k==='='){ e.preventDefault(); mainCalc.equals(); }
  else if(k==='Backspace') mainCalc.backspace();
  else if(k==='Escape') mainCalc.clearAll();
  else if(k==='%') mainCalc.percent();
});

// --- Kalkulator cepat (popup di form transaksi) ---
const miniCalcBackdrop=document.getElementById('miniCalcBackdrop'), miniCalcExpressionEl=document.getElementById('miniCalcExpression');
const miniCalc = miniCalcExpressionEl ? makeCalcEngine(miniCalcExpressionEl, null) : null;
bindCalcKeys(document.getElementById('miniCalcKeys'), miniCalc);

document.getElementById('openMiniCalc')?.addEventListener('click', ()=>{
  if(miniCalc) miniCalc.clearAll();
  miniCalcBackdrop.classList.add('show');
});
document.getElementById('closeMiniCalc')?.addEventListener('click', ()=> miniCalcBackdrop.classList.remove('show'));
if(miniCalcBackdrop) miniCalcBackdrop.addEventListener('click', e=>{ if(e.target===miniCalcBackdrop) miniCalcBackdrop.classList.remove('show'); });
document.getElementById('miniCalcUseBtn')?.addEventListener('click', ()=>{
  if(!miniCalc) return;
  const val = miniCalc.getValue();
  document.getElementById('amount').value = val>0 ? val : '';
  miniCalcBackdrop.classList.remove('show');
});

// --- Tab switching untuk halaman Kalkulator ---
document.querySelectorAll('.calc-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.calc-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.calc-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('calcPanel-'+tab.dataset.calc)?.classList.add('active');
  });
});

// --- Kalkulator Split Bill (Patungan) ---
const splitTotalEl=document.getElementById('splitTotal'), splitPeopleEl=document.getElementById('splitPeople'), splitTaxEl=document.getElementById('splitTax');
const splitGrandTotalEl=document.getElementById('splitGrandTotal'), splitPerPersonEl=document.getElementById('splitPerPerson');
function renderSplitBill(){
  if(!splitGrandTotalEl) return;
  const total=Number(splitTotalEl.value)||0;
  const people=Math.max(1, Number(splitPeopleEl.value)||1);
  const tax=Number(splitTaxEl.value)||0;
  const grandTotal=total*(1+tax/100);
  splitGrandTotalEl.textContent=currency.format(grandTotal);
  splitPerPersonEl.textContent=currency.format(grandTotal/people);
}
[splitTotalEl,splitPeopleEl,splitTaxEl].forEach(el=> el && el.addEventListener('input', renderSplitBill));
renderSplitBill();

// --- Kalkulator & Target Tabungan (tersimpan & terhubung ke widget dashboard/sidebar) ---
let savingsGoal = JSON.parse(localStorage.getItem('savingsGoal') || 'null');
function saveSavingsGoal(){ localStorage.setItem('savingsGoal', JSON.stringify(savingsGoal)); }

function monthsBetween(fromStr, toStr){
  const from=new Date(fromStr), to=new Date(toStr);
  if(isNaN(from)||isNaN(to)) return 1;
  let months=(to.getFullYear()-from.getFullYear())*12 + (to.getMonth()-from.getMonth());
  if(to.getDate() > from.getDate()) months += 1;
  return Math.max(1, months);
}

const goalNameEl=document.getElementById('goalName'), goalTargetEl=document.getElementById('goalTarget'), goalCurrentEl=document.getElementById('goalCurrent'), goalDeadlineEl=document.getElementById('goalDeadline');
const goalResultBox=document.getElementById('goalResultBox'), goalMonthsLeftEl=document.getElementById('goalMonthsLeft'), goalPerMonthEl=document.getElementById('goalPerMonth');
const goalProgressBar=document.getElementById('goalProgressBar'), goalProgressText=document.getElementById('goalProgressText');

function renderGoalCalc(){
  if(!goalResultBox) return;
  const target=Number(goalTargetEl.value)||0;
  const current=Number(goalCurrentEl.value)||0;
  const deadline=goalDeadlineEl.value;
  if(target<=0 || !deadline){ goalResultBox.style.display='none'; return; }
  goalResultBox.style.display='block';
  const months=monthsBetween(localToday(), deadline);
  const remaining=Math.max(0, target-current);
  const perMonth=remaining/months;
  goalMonthsLeftEl.textContent = months+' bulan lagi';
  goalPerMonthEl.textContent = currency.format(Math.ceil(perMonth));
  const pct=target>0 ? Math.min(100, Math.round((current/target)*100)) : 0;
  goalProgressBar.style.width=pct+'%';
  goalProgressText.textContent = `${pct}% tercapai (${currency.format(current)} dari ${currency.format(target)})`;
}
[goalTargetEl,goalCurrentEl,goalDeadlineEl].forEach(el=> el && el.addEventListener('input', renderGoalCalc));

function populateGoalForm(){
  if(!savingsGoal || !goalNameEl) return;
  goalNameEl.value=savingsGoal.name||'';
  goalTargetEl.value=savingsGoal.target||'';
  goalCurrentEl.value=savingsGoal.current||'';
  goalDeadlineEl.value=savingsGoal.deadline||'';
  renderGoalCalc();
}

document.getElementById('goalSaveBtn')?.addEventListener('click', ()=>{
  const target=Number(goalTargetEl.value)||0;
  if(target<=0){ alert('Masukkan target dana yang valid terlebih dahulu.'); return; }
  savingsGoal = {
    name: goalNameEl.value.trim() || 'Target Tabungan',
    target,
    current: Number(goalCurrentEl.value)||0,
    deadline: goalDeadlineEl.value || ''
  };
  saveSavingsGoal();
  renderSavingsGoalWidgets();
  alert('Target tabungan berhasil disimpan sebagai target aktif! 🎉');
});

document.getElementById('goalClearBtn')?.addEventListener('click', ()=>{
  if(!confirm('Hapus target tabungan aktif ini?')) return;
  savingsGoal=null;
  saveSavingsGoal();
  [goalNameEl,goalTargetEl,goalCurrentEl,goalDeadlineEl].forEach(el=> el && (el.value=''));
  if(goalResultBox) goalResultBox.style.display='none';
  renderSavingsGoalWidgets();
});

const goToKalkulatorBtn=document.getElementById('goToKalkulatorBtn');
if(goToKalkulatorBtn) goToKalkulatorBtn.addEventListener('click', ()=>{
  document.querySelector('.menu-item[data-page="kalkulator"]')?.click();
  document.querySelector('.calc-tab[data-calc="target"]')?.click();
});

// render widget target tabungan di sidebar (mini-card) & dashboard (savings-goal-card)
function renderSavingsGoalWidgets(){
  const miniLabel=document.getElementById('miniGoalLabel'), miniAmount=document.getElementById('miniGoalAmount'), miniProgress=document.getElementById('miniGoalProgress');
  const goalCard=document.getElementById('savingsGoalCard'), goalCardSubtitle=document.getElementById('goalCardSubtitle');
  const goalCardProgressBar=document.getElementById('goalCardProgressBar'), goalCardProgressText=document.getElementById('goalCardProgressText');

  if(!savingsGoal){
    if(miniLabel) miniLabel.textContent='Target tabungan';
    if(miniAmount) miniAmount.textContent='Belum diatur';
    if(miniProgress) miniProgress.style.width='0%';
    if(goalCard) goalCard.style.display='none';
    return;
  }
  const pct = savingsGoal.target>0 ? Math.min(100, Math.round((savingsGoal.current/savingsGoal.target)*100)) : 0;
  if(miniLabel) miniLabel.textContent=savingsGoal.name;
  if(miniAmount) miniAmount.textContent=`${currency.format(savingsGoal.current)} / ${currency.format(savingsGoal.target)}`;
  if(miniProgress) miniProgress.style.width=pct+'%';

  if(goalCard){
    goalCard.style.display='block';
    let subtitle=pct+'% tercapai';
    if(savingsGoal.deadline){ subtitle += ` · sisa ${monthsBetween(localToday(), savingsGoal.deadline)} bulan`; }
    if(goalCardSubtitle) goalCardSubtitle.textContent=subtitle;
    if(goalCardProgressBar) goalCardProgressBar.style.width=pct+'%';
    if(goalCardProgressText) goalCardProgressText.textContent=`${currency.format(savingsGoal.current)} dari target ${currency.format(savingsGoal.target)}`;
  }
}

// --- Insight kategori pengeluaran terbesar bulan ini ---
function renderTopCategoryInsight(monthTx){
  const insightEl=document.getElementById('budgetInsight');
  if(!insightEl) return;
  const expenses=monthTx.filter(t=>t.type==='expense');
  if(expenses.length===0){ insightEl.textContent='Belum ada pengeluaran bulan ini untuk dianalisis.'; return; }
  const totals={};
  expenses.forEach(t=>{ totals[t.category]=(totals[t.category]||0)+t.amount; });
  const [topCat, topAmount]=Object.entries(totals).sort((a,b)=>b[1]-a[1])[0];
  insightEl.textContent = `🏆 Kategori terbesar bulan ini: ${categoryIcons[topCat]||'🧾'} ${topCat} (${currency.format(topAmount)})`;
}

// ===== Galeri: Gambar Penting, Video YouTube, Link Penting =====
let mediaImages = JSON.parse(localStorage.getItem('mediaImages') || '[]');
let mediaVideos = JSON.parse(localStorage.getItem('mediaVideos') || '[]');
let mediaLinks = JSON.parse(localStorage.getItem('mediaLinks') || '[]');
function saveMediaImages(){ localStorage.setItem('mediaImages', JSON.stringify(mediaImages)); }
function saveMediaVideos(){ localStorage.setItem('mediaVideos', JSON.stringify(mediaVideos)); }
function saveMediaLinks(){ localStorage.setItem('mediaLinks', JSON.stringify(mediaLinks)); }

// --- Tab switching untuk halaman Galeri ---
document.querySelectorAll('.media-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.media-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.media-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('mediaPanel-'+tab.dataset.media)?.classList.add('active');
  });
});

// --- Gambar Penting ---
const imageUploadInput=document.getElementById('imageUploadInput'), imageGrid=document.getElementById('imageGrid'), imageEmptyState=document.getElementById('imageEmptyState');

function renderImages(){
  if(!imageGrid) return;
  if(mediaImages.length===0){
    imageGrid.innerHTML='';
    imageEmptyState?.classList.add('show');
    return;
  }
  imageEmptyState?.classList.remove('show');
  imageGrid.innerHTML = mediaImages.map(img=>`
    <div class="image-item" data-id="${img.id}">
      <img src="${img.data}" alt="${escapeHtml(img.name)}" loading="lazy">
      <button type="button" class="media-del-btn" data-id="${img.id}" title="Hapus gambar">🗑</button>
      <div class="image-caption">${escapeHtml(img.name)}</div>
    </div>`).join('');
}

if(imageUploadInput) imageUploadInput.addEventListener('change', (e)=>{
  const files = Array.from(e.target.files || []);
  files.forEach(file=>{
    if(!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      mediaImages.push({ id: Date.now()+Math.random(), name: file.name.replace(/\.[^/.]+$/, ''), data: reader.result, date: localToday() });
      saveMediaImages();
      renderImages();
    };
    reader.readAsDataURL(file);
  });
  imageUploadInput.value='';
});

const imageViewBackdrop=document.getElementById('imageViewBackdrop'), imageViewImg=document.getElementById('imageViewImg'), imageViewTitle=document.getElementById('imageViewTitle'), deleteImageBtn=document.getElementById('deleteImageBtn');
let currentViewImageId=null;

if(imageGrid) imageGrid.addEventListener('click', (e)=>{
  const delBtn=e.target.closest('.media-del-btn');
  const item=e.target.closest('.image-item');
  if(delBtn){
    e.stopPropagation();
    if(!confirm('Hapus gambar ini?')) return;
    mediaImages = mediaImages.filter(i=>String(i.id)!==delBtn.dataset.id);
    saveMediaImages(); renderImages();
    return;
  }
  if(item){
    const img = mediaImages.find(i=>String(i.id)===item.dataset.id);
    if(!img) return;
    currentViewImageId = img.id;
    imageViewImg.src = img.data;
    imageViewTitle.textContent = img.name;
    imageViewBackdrop.classList.add('show');
  }
});
document.getElementById('closeImageView')?.addEventListener('click', ()=> imageViewBackdrop.classList.remove('show'));
if(imageViewBackdrop) imageViewBackdrop.addEventListener('click', e=>{ if(e.target===imageViewBackdrop) imageViewBackdrop.classList.remove('show'); });
if(deleteImageBtn) deleteImageBtn.addEventListener('click', ()=>{
  if(currentViewImageId==null) return;
  if(!confirm('Hapus gambar ini?')) return;
  mediaImages = mediaImages.filter(i=>i.id!==currentViewImageId);
  saveMediaImages(); renderImages();
  imageViewBackdrop.classList.remove('show');
});
renderImages();

// --- Video YouTube ---
function extractYoutubeId(url){
  try{
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./,'').replace(/^m\./,'');
    if(host==='youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if(host==='youtube.com' || host==='music.youtube.com'){
      if(u.pathname==='/watch') return u.searchParams.get('v');
      if(u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
      if(u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
      if(u.pathname.startsWith('/live/')) return u.pathname.split('/')[2] || null;
    }
  }catch(err){ /* url tidak valid */ }
  return null;
}

const videoForm=document.getElementById('videoForm'), videoGrid=document.getElementById('videoGrid'), videoEmptyState=document.getElementById('videoEmptyState');

function renderVideos(){
  if(!videoGrid) return;
  if(mediaVideos.length===0){
    videoGrid.innerHTML='';
    videoEmptyState?.classList.add('show');
    return;
  }
  videoEmptyState?.classList.remove('show');
  videoGrid.innerHTML = mediaVideos.map(v=>`
    <div class="video-item" data-id="${v.id}">
      <div class="video-thumb-wrap">
        <img src="https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg" alt="${escapeHtml(v.title)}" loading="lazy">
        <div class="video-play-icon"></div>
        <button type="button" class="media-del-btn" data-id="${v.id}" title="Hapus video">🗑</button>
      </div>
      <div class="video-title">${escapeHtml(v.title)}</div>
    </div>`).join('');
}

if(videoForm) videoForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const url=document.getElementById('videoUrl').value.trim();
  const videoId=extractYoutubeId(url);
  if(!videoId){ alert('Link YouTube tidak dikenali. Pastikan formatnya seperti https://youtube.com/watch?v=... atau https://youtu.be/...'); return; }
  const title=document.getElementById('videoTitle').value.trim() || 'Video YouTube';
  mediaVideos.push({ id: Date.now()+Math.random(), title, url, videoId, date: localToday() });
  saveMediaVideos();
  renderVideos();
  videoForm.reset();
});

const videoPlayBackdrop=document.getElementById('videoPlayBackdrop'), videoPlayFrame=document.getElementById('videoPlayFrame'), videoPlayTitle=document.getElementById('videoPlayTitle'), deleteVideoBtn=document.getElementById('deleteVideoBtn');
let currentPlayVideoId=null;

function closeVideoPlay(){
  videoPlayBackdrop.classList.remove('show');
  videoPlayFrame.src=''; // hentikan pemutaran saat modal ditutup
}

if(videoGrid) videoGrid.addEventListener('click', (e)=>{
  const delBtn=e.target.closest('.media-del-btn');
  const item=e.target.closest('.video-item');
  if(delBtn){
    e.stopPropagation();
    if(!confirm('Hapus video ini?')) return;
    mediaVideos = mediaVideos.filter(v=>String(v.id)!==delBtn.dataset.id);
    saveMediaVideos(); renderVideos();
    return;
  }
  if(item){
    const v = mediaVideos.find(x=>String(x.id)===item.dataset.id);
    if(!v) return;
    currentPlayVideoId = v.id;
    videoPlayFrame.src = `https://www.youtube.com/embed/${v.videoId}?autoplay=1&rel=0`;
    videoPlayTitle.textContent = v.title;
    videoPlayBackdrop.classList.add('show');
  }
});
document.getElementById('closeVideoPlay')?.addEventListener('click', closeVideoPlay);
if(videoPlayBackdrop) videoPlayBackdrop.addEventListener('click', e=>{ if(e.target===videoPlayBackdrop) closeVideoPlay(); });
if(deleteVideoBtn) deleteVideoBtn.addEventListener('click', ()=>{
  if(currentPlayVideoId==null) return;
  if(!confirm('Hapus video ini?')) return;
  mediaVideos = mediaVideos.filter(v=>v.id!==currentPlayVideoId);
  saveMediaVideos(); renderVideos();
  closeVideoPlay();
});
renderVideos();

// --- Link Penting ---
const linkForm=document.getElementById('linkForm'), linkList=document.getElementById('linkList'), linkEmptyState=document.getElementById('linkEmptyState');

function renderLinks(){
  if(!linkList) return;
  if(mediaLinks.length===0){
    linkList.innerHTML='';
    linkEmptyState?.classList.add('show');
    return;
  }
  linkEmptyState?.classList.remove('show');
  linkList.innerHTML = mediaLinks.map(l=>`
    <div class="link-item" data-id="${l.id}">
      <div class="link-icon">🔗</div>
      <div class="link-info"><div class="link-name">${escapeHtml(l.name)}</div><div class="link-url">${escapeHtml(l.url)}</div></div>
      <div class="trans-actions"><button type="button" class="media-link-del" data-id="${l.id}" title="Hapus link">🗑️</button></div>
    </div>`).join('');
}

if(linkForm) linkForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  let url=document.getElementById('linkUrl').value.trim();
  const name=document.getElementById('linkName').value.trim();
  if(!url) return;
  if(!/^https?:\/\//i.test(url)) url='https://'+url;
  mediaLinks.push({ id: Date.now()+Math.random(), name: name || url, url, date: localToday() });
  saveMediaLinks();
  renderLinks();
  linkForm.reset();
});

if(linkList) linkList.addEventListener('click', (e)=>{
  const delBtn=e.target.closest('.media-link-del');
  if(delBtn){
    e.stopPropagation();
    if(!confirm('Hapus link ini?')) return;
    mediaLinks = mediaLinks.filter(l=>String(l.id)!==delBtn.dataset.id);
    saveMediaLinks(); renderLinks();
    return;
  }
  const item=e.target.closest('.link-item');
  if(item){
    const l = mediaLinks.find(x=>String(x.id)===item.dataset.id);
    if(l) window.open(l.url, '_blank', 'noopener,noreferrer');
  }
});
renderLinks();

// ===== Master render =====
// =========================================================
// ===== FITUR TAGIHAN & TANGGUNGAN (jatuh tempo) ==========
// =========================================================
let bills = JSON.parse(localStorage.getItem('bills') || '[]');
let billReminderDays = Number(localStorage.getItem('billReminderDays') || 3);
let billFilter = 'active';
let lastOverBudget = [];

function saveBills(){ localStorage.setItem('bills', JSON.stringify(bills)); }

const billModalBackdrop=document.getElementById('billModalBackdrop');
const billForm=document.getElementById('billForm');
const billListEl=document.getElementById('billList');
const billEmptyState=document.getElementById('billEmptyState');
const billBanner=document.getElementById('billBanner');
const billWidgetList=document.getElementById('billWidgetList');
const billWidgetEmpty=document.getElementById('billWidgetEmpty');
const billWidgetTotal=document.getElementById('billWidgetTotal');
const billWidgetSubtitle=document.getElementById('billWidgetSubtitle');
const billCategorySelect=document.getElementById('billCategory');
const billWalletSelect=document.getElementById('billWallet');
const editingBillIdInput=document.getElementById('editingBillId');
const billReminderSelect=document.getElementById('billReminderDays');
const menuBillDot=document.getElementById('menuBillDot');

// ----- Perhitungan tanggal & status -----
function daysUntil(dateStr){
  const [y,m,d]=dateStr.split('-').map(Number);
  const target=new Date(y,m-1,d);
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  return Math.round((target-today)/86400000);
}

function dayNameOf(dateStr){
  const [y,m,d]=dateStr.split('-').map(Number);
  return dayNamesID[new Date(y,m-1,d).getDay()];
}

function addOneMonth(dateStr){
  const [y,m,d]=dateStr.split('-').map(Number);
  let ny=y, nm=m+1;
  if(nm>12){ nm=1; ny++; }
  const lastDay=new Date(ny,nm,0).getDate();
  const nd=Math.min(d,lastDay);
  return `${ny}-${String(nm).padStart(2,'0')}-${String(nd).padStart(2,'0')}`;
}

// status: paid | late | today | soon | safe
function billStatus(b){
  if(b.paid) return {key:'paid', label:'Lunas', short:'Lunas', days:null};
  const d=daysUntil(b.dueDate);
  if(d<0) return {key:'late', label:`Terlambat ${Math.abs(d)} hari`, short:`Telat ${Math.abs(d)}h`, days:d};
  if(d===0) return {key:'today', label:'Jatuh tempo HARI INI', short:'Hari ini', days:0};
  if(d<=billReminderDays) return {key:'soon', label:`Jatuh tempo ${d} hari lagi`, short:`H-${d}`, days:d};
  return {key:'safe', label:`${d} hari lagi`, short:`${d} hari`, days:d};
}

function unpaidBills(){ return bills.filter(b=>!b.paid); }
function sortedBills(list){ return [...list].sort((a,b)=> a.dueDate.localeCompare(b.dueDate) || a.id-b.id); }

// Tagihan yang perlu diperingatkan (telat / hari ini / mendekati)
function getBillAlerts(){
  return sortedBills(unpaidBills().filter(b=>{
    const st=billStatus(b);
    return st.key==='late' || st.key==='today' || st.key==='soon';
  }));
}

// ----- Isi pilihan kategori & rekening di modal tagihan -----
function populateBillSelects(){
  if(billCategorySelect){
    const prev=billCategorySelect.value;
    billCategorySelect.innerHTML = expenseCategories.map(c=>`<option value="${c}">${categoryIcons[c]||'🧾'} ${c}</option>`).join('');
    if(expenseCategories.includes(prev)) billCategorySelect.value=prev;
  }
  if(billWalletSelect){
    const prev=billWalletSelect.value;
    billWalletSelect.innerHTML = '<option value="">Tanpa rekening (umum)</option>' +
      wallets.map(w=>`<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
    if(wallets.some(w=>String(w.id)===prev)) billWalletSelect.value=prev;
  }
}

// ----- Modal tambah / edit tagihan -----
function openBillModal(){
  if(!billModalBackdrop) return;
  populateBillSelects();
  billForm.reset();
  editingBillIdInput.value='';
  document.getElementById('billDueDate').value=localToday();
  document.getElementById('billModalTitle').textContent='Tambah Tagihan';
  billForm.querySelector('button[type="submit"]').textContent='Simpan Tagihan';
  billModalBackdrop.classList.add('show');
  document.getElementById('billName').focus();
}

function closeBillModal(){ if(billModalBackdrop) billModalBackdrop.classList.remove('show'); }

function openEditBillModal(id){
  const b=bills.find(x=>x.id===id);
  if(!b) return;
  populateBillSelects();
  editingBillIdInput.value=b.id;
  document.getElementById('billName').value=b.name;
  document.getElementById('billParty').value=b.party||'';
  document.getElementById('billAmount').value=b.amount;
  document.getElementById('billDueDate').value=b.dueDate;
  document.getElementById('billRepeat').value=b.repeat||'once';
  if(billCategorySelect) billCategorySelect.value=b.category||'Kos & Utilitas';
  if(billWalletSelect) billWalletSelect.value=b.walletId?String(b.walletId):'';
  document.getElementById('billNote').value=b.note||'';
  document.getElementById('billModalTitle').textContent='Edit Tagihan';
  billForm.querySelector('button[type="submit"]').textContent='Simpan Perubahan';
  billModalBackdrop.classList.add('show');
}

if(billForm){
  billForm.addEventListener('submit', e=>{
    e.preventDefault();
    const data={
      name: document.getElementById('billName').value.trim(),
      party: document.getElementById('billParty').value.trim(),
      amount: Number(document.getElementById('billAmount').value),
      dueDate: document.getElementById('billDueDate').value,
      repeat: document.getElementById('billRepeat').value,
      category: billCategorySelect ? billCategorySelect.value : 'Kos & Utilitas',
      walletId: billWalletSelect && billWalletSelect.value ? Number(billWalletSelect.value) : null,
      note: document.getElementById('billNote').value.trim()
    };
    const editingId=editingBillIdInput.value;
    if(editingId){
      const idx=bills.findIndex(b=>b.id===Number(editingId));
      if(idx>-1) bills[idx]={...bills[idx], ...data};
    } else {
      bills.push({ id: Date.now(), ...data, paid:false, paidDate:null });
    }
    saveBills();
    closeBillModal();
    renderBillsAll();
  });
}

['closeBillModal','cancelBillModal'].forEach(id=>{
  const btn=document.getElementById(id);
  if(btn) btn.addEventListener('click', closeBillModal);
});
if(billModalBackdrop) billModalBackdrop.addEventListener('click', e=>{ if(e.target===billModalBackdrop) closeBillModal(); });

// ----- Aksi: tandai lunas, batal lunas, hapus -----
function markBillPaid(id){
  const b=bills.find(x=>x.id===id);
  if(!b) return;
  if(!confirm(`Tandai "${b.name}" (${currency.format(b.amount)}) sebagai LUNAS?`)) return;

  const today=localToday();
  b.paid=true;
  b.paidDate=today;

  if(confirm('Catat sekalian sebagai PENGELUARAN hari ini?\n\nOK = catat otomatis di daftar transaksi.\nBatal = tandai lunas saja.')){
    transactions.push({
      id: Date.now(),
      name: b.name + (b.party ? ' — ' + b.party : ''),
      amount: b.amount,
      date: today,
      category: b.category || 'Lainnya',
      type: 'expense',
      walletId: b.walletId || null
    });
    saveTransactions();
  }

  // tagihan bulanan: otomatis buat untuk bulan berikutnya
  if(b.repeat==='monthly'){
    bills.push({
      id: Date.now()+1,
      name: b.name,
      party: b.party,
      amount: b.amount,
      dueDate: addOneMonth(b.dueDate),
      repeat: 'monthly',
      category: b.category,
      walletId: b.walletId,
      note: b.note,
      paid: false,
      paidDate: null
    });
  }

  saveBills();
  renderAll();
}

function unmarkBillPaid(id){
  const b=bills.find(x=>x.id===id);
  if(!b) return;
  b.paid=false; b.paidDate=null;
  saveBills();
  renderBillsAll();
}

function deleteBill(id){
  const b=bills.find(x=>x.id===id);
  if(!b) return;
  if(!confirm(`Hapus tagihan "${b.name}"?`)) return;
  bills=bills.filter(x=>x.id!==id);
  saveBills();
  renderBillsAll();
}

// ----- Render daftar tagihan di halaman Tagihan -----
function renderBillList(){
  if(!billListEl) return;
  let list;
  if(billFilter==='active') list=unpaidBills();
  else if(billFilter==='paid') list=bills.filter(b=>b.paid);
  else if(billFilter==='due') list=getBillAlerts();
  else list=bills;

  list=sortedBills(list);
  if(billFilter==='paid') list.reverse();

  if(list.length===0){
    billListEl.innerHTML='';
    if(billEmptyState) billEmptyState.classList.add('show');
    return;
  }
  if(billEmptyState) billEmptyState.classList.remove('show');

  billListEl.innerHTML = list.map(b=>{
    const st=billStatus(b);
    const wallet = b.walletId ? wallets.find(w=>w.id===b.walletId) : null;
    const repeatTag = b.repeat==='monthly' ? '<span class="bill-tag">🔁 Tiap bulan</span>' : '';
    const walletTag = wallet ? `<span class="bill-tag">💳 ${escapeHtml(wallet.name)}</span>` : '';
    const noteTag = b.note ? `<span class="bill-tag">📝 ${escapeHtml(b.note)}</span>` : '';
    return `
    <div class="bill-item bill-${st.key}" data-id="${b.id}">
      <div class="bill-status-bar"></div>
      <div class="bill-main">
        <div class="bill-top">
          <span class="bill-name">${escapeHtml(b.name)}</span>
          <span class="bill-badge bill-badge-${st.key}">${st.label}</span>
        </div>
        <div class="bill-meta">
          <span>👤 ${escapeHtml(b.party||'-')}</span>
          <span>📅 ${dayNameOf(b.dueDate)}, ${formatDate(b.dueDate)}</span>
          <span>${categoryIcons[b.category]||'🧾'} ${escapeHtml(b.category||'-')}</span>
        </div>
        <div class="bill-tags">${repeatTag}${walletTag}${noteTag}</div>
      </div>
      <div class="bill-amount">${currency.format(b.amount)}</div>
      <div class="bill-actions">
        ${b.paid
          ? `<button type="button" class="btn btn-secondary bill-unpay" data-id="${b.id}">↺ Batal Lunas</button>`
          : `<button type="button" class="btn btn-primary bill-pay" data-id="${b.id}">✓ Lunas</button>`}
        <button type="button" class="trans-edit bill-edit" data-id="${b.id}" title="Edit">✏️</button>
        <button type="button" class="trans-delete bill-delete" data-id="${b.id}" title="Hapus">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// ----- Ringkasan di halaman Tagihan -----
function renderBillSummary(){
  const unpaid=unpaidBills();
  const unpaidTotal=unpaid.reduce((s,b)=>s+b.amount,0);
  const alerts=getBillAlerts();
  const alertTotal=alerts.reduce((s,b)=>s+b.amount,0);
  const thisMonth=localToday().slice(0,7);
  const paidThisMonth=bills.filter(b=>b.paid && b.paidDate && b.paidDate.slice(0,7)===thisMonth);
  const paidTotal=paidThisMonth.reduce((s,b)=>s+b.amount,0);

  const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
  set('billUnpaidTotal', currency.format(unpaidTotal));
  set('billUnpaidCount', unpaid.length ? `${unpaid.length} tanggungan aktif` : 'Belum ada tanggungan');
  set('billDueTotal', currency.format(alertTotal));
  set('billDueCount', alerts.length ? `${alerts.length} tagihan perlu segera dibayar` : 'Aman, tidak ada yang jatuh tempo');
  set('billPaidTotal', currency.format(paidTotal));
  set('billPaidCount', paidThisMonth.length ? `${paidThisMonth.length} tagihan lunas bulan ini` : 'Belum ada yang dilunasi');
}

// ----- Widget tagihan di dashboard -----
function renderBillWidget(){
  if(!billWidgetList) return;
  const unpaid=sortedBills(unpaidBills());
  const total=unpaid.reduce((s,b)=>s+b.amount,0);
  if(billWidgetTotal) billWidgetTotal.textContent=currency.format(total);

  if(unpaid.length===0){
    billWidgetList.innerHTML='';
    if(billWidgetEmpty) billWidgetEmpty.style.display='block';
    if(billWidgetSubtitle) billWidgetSubtitle.textContent='Tidak ada tanggungan';
    return;
  }
  if(billWidgetEmpty) billWidgetEmpty.style.display='none';
  const alerts=getBillAlerts();
  if(billWidgetSubtitle) billWidgetSubtitle.textContent = alerts.length ? `⚠️ ${alerts.length} tagihan perlu perhatian` : 'Jatuh tempo terdekat';

  billWidgetList.innerHTML = unpaid.slice(0,4).map(b=>{
    const st=billStatus(b);
    return `<div class="wallet-mini-item">
      <div>
        <div class="wallet-mini-name">${escapeHtml(b.name)}</div>
        <div class="wallet-mini-type">${escapeHtml(b.party||'-')} · ${dayNameOf(b.dueDate)}, ${formatDate(b.dueDate)}</div>
      </div>
      <div style="text-align:right">
        <div class="wallet-mini-balance">${currency.format(b.amount)}</div>
        <div class="bill-badge bill-badge-${st.key}" style="margin-top:3px">${st.short}</div>
      </div>
    </div>`;
  }).join('');
}

// ----- Banner peringatan di dashboard + titik merah di sidebar -----
function renderBillBanner(){
  const alerts=getBillAlerts();
  if(menuBillDot) menuBillDot.style.display = alerts.length ? 'block' : 'none';
  if(!billBanner) return;
  if(alerts.length===0){ billBanner.style.display='none'; return; }

  const late=alerts.filter(b=>billStatus(b).key==='late');
  const today=alerts.filter(b=>billStatus(b).key==='today');
  const total=alerts.reduce((s,b)=>s+b.amount,0);
  const first=alerts[0];

  let msg;
  if(late.length){
    msg = `🚨 <strong>${late.length} tagihan TERLAMBAT dibayar!</strong> Contoh: ${escapeHtml(first.name)} ke ${escapeHtml(first.party||'-')} — ${currency.format(first.amount)}, jatuh tempo ${dayNameOf(first.dueDate)}, ${formatDate(first.dueDate)}.`;
  } else if(today.length){
    msg = `⏰ <strong>${today.length} tagihan jatuh tempo HARI INI</strong> — total ${currency.format(today.reduce((s,b)=>s+b.amount,0))}. Jangan sampai kelewat ya!`;
  } else {
    msg = `📌 <strong>${alerts.length} tagihan mendekati jatuh tempo</strong> (total ${currency.format(total)}). Terdekat: ${escapeHtml(first.name)} — ${dayNameOf(first.dueDate)}, ${formatDate(first.dueDate)}.`;
  }
  billBanner.className = 'bill-banner ' + (late.length ? 'bill-banner-late' : today.length ? 'bill-banner-today' : 'bill-banner-soon');
  billBanner.style.display='flex';
  billBanner.innerHTML = `<span>${msg}</span><button type="button" class="link-btn" id="bannerGoToBills">Lihat →</button>`;
  const go=document.getElementById('bannerGoToBills');
  if(go) go.addEventListener('click', goToBillsPage);
}

// ----- Toast pengingat (muncul 1x per hari saat ada yang telat / jatuh tempo) -----
function maybeShowBillToast(){
  const toast=document.getElementById('billToast');
  if(!toast) return;
  const urgent=getBillAlerts().filter(b=>['late','today'].includes(billStatus(b).key));
  if(urgent.length===0) return;
  if(localStorage.getItem('billToastShown')===localToday()) return;

  const body=document.getElementById('billToastBody');
  const title=document.getElementById('billToastTitle');
  if(title) title.textContent = urgent.some(b=>billStatus(b).key==='late')
    ? '🚨 Ada tagihan yang terlambat!'
    : '⏰ Tagihan jatuh tempo hari ini';
  if(body) body.innerHTML = urgent.slice(0,3).map(b=>{
    const st=billStatus(b);
    return `<div class="bill-toast-row"><span>${escapeHtml(b.name)} → ${escapeHtml(b.party||'-')}</span><strong>${currency.format(b.amount)}</strong><em>${st.label}</em></div>`;
  }).join('') + (urgent.length>3 ? `<div class="bill-toast-more">+${urgent.length-3} tagihan lainnya</div>` : '');

  toast.classList.add('show');
  localStorage.setItem('billToastShown', localToday());
}

function hideBillToast(){
  const toast=document.getElementById('billToast');
  if(toast) toast.classList.remove('show');
}

// ----- Navigasi ke halaman Tagihan -----
function goToBillsPage(){
  document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));
  const menu=document.querySelector('.menu-item[data-page="tagihan"]');
  if(menu) menu.classList.add('active');
  document.querySelectorAll('.page-section').forEach(sec=>sec.classList.remove('active'));
  const page=document.getElementById('page-tagihan');
  if(page){ void page.offsetWidth; page.classList.add('active'); }
  window.scrollTo({top:0, behavior:'smooth'});
  hideBillToast();
}

// ----- Event listener halaman Tagihan -----
const addBillBtn=document.getElementById('addBillBtn');
if(addBillBtn) addBillBtn.addEventListener('click', openBillModal);
const widgetAddBillBtn=document.getElementById('widgetAddBillBtn');
if(widgetAddBillBtn) widgetAddBillBtn.addEventListener('click', openBillModal);
const goToBillsBtn=document.getElementById('goToBillsBtn');
if(goToBillsBtn) goToBillsBtn.addEventListener('click', goToBillsPage);
const closeBillToastBtn=document.getElementById('closeBillToast');
if(closeBillToastBtn) closeBillToastBtn.addEventListener('click', hideBillToast);
const billToastAction=document.getElementById('billToastAction');
if(billToastAction) billToastAction.addEventListener('click', goToBillsPage);

if(billListEl){
  billListEl.addEventListener('click', e=>{
    const pay=e.target.closest('.bill-pay');
    const unpay=e.target.closest('.bill-unpay');
    const edit=e.target.closest('.bill-edit');
    const del=e.target.closest('.bill-delete');
    if(pay) markBillPaid(Number(pay.dataset.id));
    else if(unpay) unmarkBillPaid(Number(unpay.dataset.id));
    else if(edit) openEditBillModal(Number(edit.dataset.id));
    else if(del) deleteBill(Number(del.dataset.id));
  });
}

document.querySelectorAll('.bill-tabs .media-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.bill-tabs .media-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    billFilter=tab.dataset.billFilter;
    renderBillList();
  });
});

if(billReminderSelect){
  billReminderSelect.value=String(billReminderDays);
  billReminderSelect.addEventListener('change', ()=>{
    billReminderDays=Number(billReminderSelect.value)||3;
    localStorage.setItem('billReminderDays', String(billReminderDays));
    renderBillsAll();
  });
}

// ----- Render semua bagian tagihan -----
function renderBillsAll(){
  renderBillSummary();
  renderBillList();
  renderBillWidget();
  renderBillBanner();
  renderNotifications(lastOverBudget);
}


// =========================================================
// ===== ASISTEN AI (bisa pilih Groq atau Google Gemini) =====
// =========================================================
const AI_PROVIDERS = {
  groq: {
    label: 'Groq',
    model: 'openai/gpt-oss-120b',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    // Diisi path proxy (misal '/api/groq') = mode PUBLIK lewat server (key aman, tanpa perlu diisi pengguna).
    // Kosongkan ('') kalau mau mode BYOK (tiap pengguna isi API key sendiri di halaman Profil).
    proxyUrl: '/api/groq',
    keyName: 'groqApiKey',
    keyLink: 'https://console.groq.com/keys',
    keyPlaceholder: 'Tempel API key kamu di sini (diawali gsk_...)',
    desc: 'Pakai GroqCloud — gratis, cepat, tanpa kartu kredit. Ambil API key di <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>, lalu tempel di sini.'
  },
  gemini: {
    label: 'Google Gemini',
    model: 'gemini-3.1-flash-lite',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
    proxyUrl: '/api/gemini',
    keyName: 'geminiApiKey',
    keyLink: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'Tempel API key kamu di sini (diawali AIza...)',
    desc: 'Pakai Google AI Studio (Gemini) — gratis, tanpa kartu kredit. Ambil API key di <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>, lalu tempel di sini.'
  }
};

function getAiProvider(){
  const p = localStorage.getItem('aiProvider');
  return AI_PROVIDERS[p] ? p : 'groq';
}
function setAiProvider(p){ if(AI_PROVIDERS[p]) localStorage.setItem('aiProvider', p); }
function currentProvider(){ return AI_PROVIDERS[getAiProvider()]; }
function isAiProxyMode(){ return !!currentProvider().proxyUrl; }

let aiChatHistory = JSON.parse(sessionStorage.getItem('aiChatHistory') || '[]');

function getAiKey(){ return localStorage.getItem(currentProvider().keyName) || ''; }
function saveAiKey(key){ localStorage.setItem(currentProvider().keyName, key); }
function clearAiKey(){ localStorage.removeItem(currentProvider().keyName); }

const aiKeyForm=document.getElementById('aiKeyForm');
const aiApiKeyInput=document.getElementById('aiApiKey');
const aiApiKeyLabel=document.getElementById('aiApiKeyLabel');
const aiKeyMsg=document.getElementById('aiKeyMsg');
const aiKeyNote=document.getElementById('aiKeyNote');
const aiProviderDesc=document.getElementById('aiProviderDesc');
const aiProviderSelect=document.getElementById('aiProviderSelect');
const toggleAiKeyBtn=document.getElementById('toggleAiKey');
const clearAiKeyBtn=document.getElementById('clearAiKeyBtn');
const aiKeyWarning=document.getElementById('aiKeyWarning');
const aiChatWindow=document.getElementById('aiChatWindow');
const aiChatEmpty=document.getElementById('aiChatEmpty');
const aiChatForm=document.getElementById('aiChatForm');
const aiChatInput=document.getElementById('aiChatInput');
const aiSendBtn=document.getElementById('aiSendBtn');
const aiInsightBtn=document.getElementById('aiInsightBtn');
const aiClearChatBtn=document.getElementById('aiClearChatBtn');
const goToProfileFromAi=document.getElementById('goToProfileFromAi');

// ----- Isi ulang field key & keterangan provider saat halaman Profil dibuka / provider diganti -----
function refreshAiKeyField(){
  const cfg = currentProvider();
  if(aiProviderSelect) aiProviderSelect.value = getAiProvider();
  if(aiApiKeyInput) aiApiKeyInput.value = getAiKey();
  if(aiApiKeyLabel) aiApiKeyLabel.textContent = cfg.label + ' API Key';
  if(aiApiKeyInput) aiApiKeyInput.placeholder = cfg.keyPlaceholder;
  if(aiProviderDesc && !isAiProxyMode()) aiProviderDesc.innerHTML = cfg.desc;
  if(aiKeyNote) aiKeyNote.textContent = 'API key disimpan langsung di browser kamu (localStorage), tidak dikirim ke server manapun selain langsung ke ' + cfg.label + '. Jangan bagikan key ini ke orang lain.';
  applyAiProxyModeUI();
  updateAiKeyWarning();
}
refreshAiKeyField();

if(aiProviderSelect){
  aiProviderSelect.addEventListener('change', ()=>{
    setAiProvider(aiProviderSelect.value);
    if(aiKeyMsg) aiKeyMsg.textContent='';
    refreshAiKeyField();
  });
}

if(aiKeyForm){
  aiKeyForm.addEventListener('submit', e=>{
    e.preventDefault();
    const val=aiApiKeyInput.value.trim();
    if(!val){ aiKeyMsg.textContent='Isi API key dulu sebelum menyimpan.'; aiKeyMsg.style.color='var(--c-red)'; return; }
    saveAiKey(val);
    aiKeyMsg.textContent='✅ API key tersimpan di browser ini.';
    aiKeyMsg.style.color='var(--income)';
    updateAiKeyWarning();
  });
}
if(toggleAiKeyBtn){
  toggleAiKeyBtn.addEventListener('click', ()=>{
    aiApiKeyInput.type = aiApiKeyInput.type==='password' ? 'text' : 'password';
  });
}
if(clearAiKeyBtn){
  clearAiKeyBtn.addEventListener('click', ()=>{
    if(!confirm('Hapus API key ' + currentProvider().label + ' dari browser ini?')) return;
    clearAiKey();
    aiApiKeyInput.value='';
    aiKeyMsg.textContent='API key dihapus.';
    aiKeyMsg.style.color='var(--muted)';
    updateAiKeyWarning();
  });
}

function updateAiKeyWarning(){
  if(!aiKeyWarning) return;
  if(isAiProxyMode()){ aiKeyWarning.style.display='none'; return; }
  if(getAiKey()){ aiKeyWarning.style.display='none'; return; }
  const span = aiKeyWarning.querySelector('span');
  if(span) span.textContent = '⚠️ Kamu belum menyetel ' + currentProvider().label + ' API Key. Atur dulu di halaman Profil supaya Asisten AI bisa dipakai.';
  aiKeyWarning.style.display='flex';
}

// Sembunyikan sepenuhnya bagian "isi API key" di halaman Profil kalau provider yang aktif pakai mode proxy publik.
function applyAiProxyModeUI(){
  const proxyMode = isAiProxyMode();
  if(aiKeyForm) aiKeyForm.style.display = proxyMode ? 'none' : '';
  if(aiKeyMsg) aiKeyMsg.style.display = proxyMode ? 'none' : '';
  if(aiKeyNote) aiKeyNote.style.display = proxyMode ? 'none' : '';
  if(aiProviderDesc){
    aiProviderDesc.innerHTML = proxyMode
      ? 'Asisten AI (' + currentProvider().label + ') sudah aktif untuk semua pengguna aplikasi ini — tidak perlu isi API key apapun.'
      : currentProvider().desc;
  }
}
applyAiProxyModeUI();

if(goToProfileFromAi){
  goToProfileFromAi.addEventListener('click', ()=>{
    document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));
    const menu=document.querySelector('.menu-item[data-page="profil"]');
    if(menu) menu.classList.add('active');
    document.querySelectorAll('.page-section').forEach(sec=>sec.classList.remove('active'));
    const page=document.getElementById('page-profil');
    if(page){ void page.offsetWidth; page.classList.add('active'); }
    window.scrollTo({top:0, behavior:'smooth'});
    setTimeout(()=>aiApiKeyInput && aiApiKeyInput.focus(), 300);
  });
}

// ----- Ringkasan data keuangan bulan berjalan, dipakai sebagai konteks AI -----
function buildFinanceContext(){
  const ym=monthFilter.value || ymOf(localToday());
  const monthTx=transactions.filter(t=>ymOf(t.date)===ym);
  const income=sumByType(monthTx,'income');
  const expense=sumByType(monthTx,'expense');
  const balance=income-expense;

  const spentByCategory={};
  monthTx.filter(t=>t.type==='expense').forEach(t=>{ spentByCategory[t.category]=(spentByCategory[t.category]||0)+t.amount; });
  const budgetLines=budgetCategories.map(c=>{
    const spent=spentByCategory[c]||0;
    const target=budgetTargets[c]||0;
    return `- ${c}: terpakai ${currency.format(spent)}${target?` dari anggaran ${currency.format(target)}`:' (anggaran belum diatur)'}`;
  }).join('\n');

  const topTx=[...monthTx].sort((a,b)=>b.amount-a.amount).slice(0,8)
    .map(t=>`- ${t.date} | ${t.type==='income'?'Masuk':'Keluar'} | ${t.name} | ${t.category} | ${currency.format(t.amount)}`).join('\n');

  const walletLines = wallets.map(w=>`- ${w.name} (${walletTypeLabel(w.type)}): ${currency.format(walletBalance(w))}`).join('\n');

  const unpaid = sortedBills(unpaidBills());
  const billLines = unpaid.map(b=>{
    const st=billStatus(b);
    return `- ${b.name} ke ${b.party||'-'} sebesar ${currency.format(b.amount)}, jatuh tempo ${formatDate(b.dueDate)} (${st.label})`;
  }).join('\n');

  const activeTaskList = sortedTasks(activeTasks());
  const taskLines = activeTaskList.map(t=>{
    const st=taskStatus(t);
    const jam = t.deadlineTime ? ' jam '+t.deadlineTime : '';
    return `- ${t.title} (${t.subject||'-'}), deadline ${formatDate(t.deadlineDate)}${jam}, prioritas ${priorityLabels[t.priority]||'Sedang'} (${st.label})${t.weight?`, bobot nilai ${t.weight}%`:''}`;
  }).join('\n');

  return `Data keuangan pengguna untuk bulan ${labelYM(ym)} (mata uang Rupiah Indonesia):

RINGKASAN
- Total pemasukan: ${currency.format(income)}
- Total pengeluaran: ${currency.format(expense)}
- Sisa saldo bulan ini: ${currency.format(balance)}

ANGGARAN PER KATEGORI
${budgetLines || '- Belum ada anggaran diatur'}

TRANSAKSI TERBESAR BULAN INI
${topTx || '- Belum ada transaksi'}

DOMPET & REKENING
${walletLines || '- Belum ada rekening ditambahkan'}

TAGIHAN BELUM DIBAYAR
${billLines || '- Tidak ada tagihan aktif'}

TUGAS KAMPUS BELUM SELESAI
${taskLines || '- Tidak ada tugas aktif'}`;
}

const AI_SYSTEM_PROMPT = `Kamu adalah asisten keuangan pribadi di aplikasi StastistikDompet, untuk pengguna anak kos/mahasiswa di Indonesia. Jawab dalam Bahasa Indonesia yang santai tapi jelas, ringkas (maksimal sekitar 150 kata kecuali diminta lebih detail), dan gunakan format Rupiah. Fokus pada data keuangan yang diberikan di bawah ini — jangan mengarang angka. Beri saran yang praktis dan konkret, bukan nasihat umum. Jangan berikan nasihat hukum atau investasi berisiko tinggi.

Kamu punya akses ke fungsi (tools) untuk benar-benar melakukan aksi di aplikasi: menambah tagihan/tanggungan, mencatat transaksi, menandai tagihan lunas, mengatur anggaran, menambah tugas kuliah, dan menandai tugas selesai. Ketika pengguna memerintahkan sesuatu yang konkret (misalnya "catat tagihan bayar kos 500rb jatuh tempo tanggal 25", "tandai tagihan wifi lunas", "tambah pengeluaran jajan 20rb hari ini", "catat tugas laporan fisika deadline jumat"), langsung panggil fungsi yang sesuai — jangan hanya menjelaskan caranya. Jika ada data wajib yang belum jelas (misalnya jumlah atau tanggal), tanya balik ke pengguna dulu sebelum memanggil fungsi, jangan menebak angka. Setelah fungsi dijalankan, konfirmasikan hasilnya secara singkat dan ramah ke pengguna berdasarkan pesan hasil fungsi tersebut.`;

// ----- Definisi fungsi (tools) yang boleh dijalankan AI, dibentuk ulang sesuai format tiap provider -----
const AI_TOOL_DEFS = [
  {
    name: 'tambah_tagihan',
    description: 'Menambahkan tagihan/tanggungan baru ke fitur Tagihan pada aplikasi, lengkap dengan pihak yang dibayar, jumlah, dan tanggal jatuh tempo.',
    parameters: {
      type: 'object',
      properties: {
        nama: { type: 'string', description: 'Nama tagihan, contoh: Bayar kos September, Wifi Indihome' },
        pihak: { type: 'string', description: 'Pihak yang dibayar, contoh: Ibu Kos, PLN, Andi' },
        jumlah: { type: 'number', description: 'Jumlah tagihan dalam Rupiah, contoh 750000' },
        tanggal_jatuh_tempo: { type: 'string', description: 'Tanggal jatuh tempo, format YYYY-MM-DD' },
        pengulangan: { type: 'string', enum: ['sekali','bulanan'], description: 'Apakah tagihan ini berulang tiap bulan atau hanya sekali bayar' },
        kategori: { type: 'string', enum: expenseCategories, description: 'Kategori pengeluaran yang paling sesuai untuk tagihan ini' },
        catatan: { type: 'string', description: 'Catatan tambahan opsional' }
      },
      required: ['nama','jumlah','tanggal_jatuh_tempo']
    }
  },
  {
    name: 'tambah_transaksi',
    description: 'Mencatat transaksi baru (pemasukan atau pengeluaran) langsung ke daftar Transaksi pada aplikasi.',
    parameters: {
      type: 'object',
      properties: {
        nama: { type: 'string', description: 'Nama transaksi, contoh: Jajan siang, Uang bulanan dari orang tua' },
        jumlah: { type: 'number', description: 'Jumlah transaksi dalam Rupiah' },
        tanggal: { type: 'string', description: 'Tanggal transaksi, format YYYY-MM-DD' },
        jenis: { type: 'string', enum: ['pemasukan','pengeluaran'] },
        kategori: { type: 'string', enum: [...expenseCategories, ...incomeCategories], description: 'Kategori yang sesuai dengan jenis transaksinya' }
      },
      required: ['nama','jumlah','tanggal','jenis','kategori']
    }
  },
  {
    name: 'tandai_tagihan_lunas',
    description: 'Menandai sebuah tagihan yang sudah ada sebagai lunas/sudah dibayar, dicari berdasarkan nama tagihan.',
    parameters: {
      type: 'object',
      properties: {
        nama_tagihan: { type: 'string', description: 'Nama atau sebagian nama tagihan yang ingin ditandai lunas' }
      },
      required: ['nama_tagihan']
    }
  },
  {
    name: 'atur_anggaran',
    description: 'Mengatur atau mengubah batas anggaran bulanan untuk sebuah kategori pengeluaran.',
    parameters: {
      type: 'object',
      properties: {
        kategori: { type: 'string', enum: budgetCategories },
        jumlah: { type: 'number', description: 'Batas anggaran baru dalam Rupiah' }
      },
      required: ['kategori','jumlah']
    }
  },
  {
    name: 'tambah_tugas',
    description: 'Menambahkan tugas kuliah baru ke fitur Tugas Kampus, lengkap dengan mata kuliah dan deadline.',
    parameters: {
      type: 'object',
      properties: {
        judul: { type: 'string', description: 'Judul tugas, contoh: Laporan praktikum fisika' },
        mata_kuliah: { type: 'string', description: 'Nama mata kuliah, contoh: Fisika Dasar' },
        tanggal_deadline: { type: 'string', description: 'Tanggal deadline, format YYYY-MM-DD' },
        jam_deadline: { type: 'string', description: 'Jam deadline opsional, format HH:MM (24 jam)' },
        prioritas: { type: 'string', enum: ['rendah','sedang','tinggi'], description: 'Seberapa penting/mendesak tugas ini' },
        bobot_nilai: { type: 'number', description: 'Bobot nilai tugas dalam persen, opsional, contoh 20' },
        catatan: { type: 'string', description: 'Catatan tambahan opsional' }
      },
      required: ['judul','mata_kuliah','tanggal_deadline']
    }
  },
  {
    name: 'tandai_tugas_selesai',
    description: 'Menandai sebuah tugas kuliah yang sudah ada sebagai selesai, dicari berdasarkan judul tugas.',
    parameters: {
      type: 'object',
      properties: {
        judul_tugas: { type: 'string', description: 'Judul atau sebagian judul tugas yang ingin ditandai selesai' }
      },
      required: ['judul_tugas']
    }
  }
];

function buildAiTools(){
  if(getAiProvider()==='gemini') return [{ functionDeclarations: AI_TOOL_DEFS }];
  return AI_TOOL_DEFS.map(fn => ({ type: 'function', function: fn }));
}

function isValidIsoDate(str){
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str+'T00:00:00'));
}

// ----- Eksekusi aksi nyata di aplikasi berdasarkan perintah AI -----
function executeAiTool(name, rawArgs){
  const args = rawArgs || {};
  try{
    if(name==='tambah_tagihan') return toolTambahTagihan(args);
    if(name==='tambah_transaksi') return toolTambahTransaksi(args);
    if(name==='tandai_tagihan_lunas') return toolTandaiTagihanLunas(args);
    if(name==='atur_anggaran') return toolAturAnggaran(args);
    if(name==='tambah_tugas') return toolTambahTugas(args);
    if(name==='tandai_tugas_selesai') return toolTandaiTugasSelesai(args);
    return { success:false, message:'Fungsi tidak dikenal: '+name };
  }catch(err){
    return { success:false, message:'Terjadi error saat menjalankan aksi: '+(err && err.message || err) };
  }
}

function toolTambahTagihan(args){
  const nama=String(args.nama||'').trim();
  const pihak=String(args.pihak||'').trim();
  const jumlah=Number(args.jumlah);
  const tanggal=String(args.tanggal_jatuh_tempo||'').trim();
  const pengulangan = args.pengulangan==='bulanan' ? 'monthly' : 'once';
  const kategori = expenseCategories.includes(args.kategori) ? args.kategori : 'Lainnya';
  const catatan=String(args.catatan||'').trim();

  if(!nama) return { success:false, message:'Nama tagihan wajib diisi.' };
  if(!jumlah || jumlah<=0) return { success:false, message:'Jumlah tagihan tidak valid.' };
  if(!isValidIsoDate(tanggal)) return { success:false, message:'Format tanggal jatuh tempo tidak valid, harus YYYY-MM-DD.' };

  bills.push({ id: Date.now(), name: nama, party: pihak, amount: jumlah, dueDate: tanggal, repeat: pengulangan, category: kategori, walletId: null, note: catatan, paid: false, paidDate: null });
  saveBills();
  renderAll();
  return { success:true, message: `Tagihan "${nama}"${pihak?' ke '+pihak:''} sebesar ${currency.format(jumlah)} berhasil ditambahkan, jatuh tempo ${formatDate(tanggal)}${pengulangan==='monthly' ? ' (berulang tiap bulan)' : ''}.` };
}

function toolTambahTransaksi(args){
  const nama=String(args.nama||'').trim();
  const jumlah=Number(args.jumlah);
  const tanggal=String(args.tanggal||'').trim();
  const jenis = args.jenis==='pemasukan' ? 'income' : 'expense';
  const allCats = jenis==='income' ? incomeCategories : expenseCategories;
  const kategori = allCats.includes(args.kategori) ? args.kategori : (jenis==='income' ? 'Kerja sampingan' : 'Lainnya');

  if(!nama) return { success:false, message:'Nama transaksi wajib diisi.' };
  if(!jumlah || jumlah<=0) return { success:false, message:'Jumlah transaksi tidak valid.' };
  if(!isValidIsoDate(tanggal)) return { success:false, message:'Format tanggal tidak valid, harus YYYY-MM-DD.' };

  transactions.push({ id: Date.now(), name: nama, amount: jumlah, date: tanggal, category: kategori, type: jenis, walletId: null });
  saveTransactions();
  renderAll();
  return { success:true, message: `${jenis==='income'?'Pemasukan':'Pengeluaran'} "${nama}" sebesar ${currency.format(jumlah)} pada ${formatDate(tanggal)} berhasil dicatat.` };
}

function toolTandaiTagihanLunas(args){
  const q=String(args.nama_tagihan||'').trim().toLowerCase();
  if(!q) return { success:false, message:'Nama tagihan tidak boleh kosong.' };
  const candidate = unpaidBills().find(b=>b.name.toLowerCase().includes(q));
  if(!candidate) return { success:false, message:`Tidak ditemukan tagihan aktif dengan nama mengandung "${args.nama_tagihan}".` };

  candidate.paid=true;
  candidate.paidDate=localToday();
  if(candidate.repeat==='monthly'){
    bills.push({ id: Date.now()+1, name: candidate.name, party: candidate.party, amount: candidate.amount, dueDate: addOneMonth(candidate.dueDate), repeat:'monthly', category: candidate.category, walletId: candidate.walletId, note: candidate.note, paid:false, paidDate:null });
  }
  saveBills();
  renderAll();
  return { success:true, message: `Tagihan "${candidate.name}" sebesar ${currency.format(candidate.amount)} ditandai lunas.` };
}

function toolAturAnggaran(args){
  const kategori = args.kategori;
  const jumlah = Number(args.jumlah);
  if(!budgetCategories.includes(kategori)) return { success:false, message:'Kategori anggaran tidak dikenal.' };
  if(!jumlah || jumlah<0) return { success:false, message:'Jumlah anggaran tidak valid.' };
  budgetTargets[kategori]=jumlah;
  saveBudgetTargets();
  renderAll();
  return { success:true, message: `Anggaran kategori "${kategori}" diatur ke ${currency.format(jumlah)}.` };
}

function toolTambahTugas(args){
  const judul=String(args.judul||'').trim();
  const matkul=String(args.mata_kuliah||'').trim();
  const tanggal=String(args.tanggal_deadline||'').trim();
  const jam=String(args.jam_deadline||'').trim();
  const prioritas = ['rendah','sedang','tinggi'].includes(args.prioritas) ? args.prioritas : 'sedang';
  const bobot = args.bobot_nilai ? Number(args.bobot_nilai) : null;
  const catatan=String(args.catatan||'').trim();

  if(!judul) return { success:false, message:'Judul tugas wajib diisi.' };
  if(!isValidIsoDate(tanggal)) return { success:false, message:'Format tanggal deadline tidak valid, harus YYYY-MM-DD.' };
  if(jam && !/^\d{2}:\d{2}$/.test(jam)) return { success:false, message:'Format jam deadline tidak valid, harus HH:MM.' };

  campusTasks.push({ id: Date.now(), title: judul, subject: matkul, deadlineDate: tanggal, deadlineTime: jam, priority: prioritas, status: 'belum', weight: bobot, link: '', note: catatan });
  saveCampusTasks();
  renderAll();
  return { success:true, message: `Tugas "${judul}"${matkul?' ('+matkul+')':''} berhasil ditambahkan, deadline ${formatDate(tanggal)}${jam?' jam '+jam:''}, prioritas ${prioritas}.` };
}

function toolTandaiTugasSelesai(args){
  const q=String(args.judul_tugas||'').trim().toLowerCase();
  if(!q) return { success:false, message:'Judul tugas tidak boleh kosong.' };
  const candidate = activeTasks().find(t=>t.title.toLowerCase().includes(q));
  if(!candidate) return { success:false, message:`Tidak ditemukan tugas aktif dengan judul mengandung "${args.judul_tugas}".` };

  candidate.status='selesai';
  saveCampusTasks();
  renderAll();
  return { success:true, message: `Tugas "${candidate.title}" ditandai selesai. Mantap!` };
}

// ----- Render bubble chat -----
function renderAiChat(){
  if(!aiChatWindow) return;
  if(aiChatHistory.length===0){
    if(aiChatEmpty) aiChatEmpty.style.display='block';
    aiChatWindow.querySelectorAll('.ai-bubble').forEach(el=>el.remove());
    return;
  }
  if(aiChatEmpty) aiChatEmpty.style.display='none';
  aiChatWindow.querySelectorAll('.ai-bubble').forEach(el=>el.remove());
  aiChatHistory.forEach(m=>{
    const div=document.createElement('div');
    div.className = 'ai-bubble ' + (m.role==='user' ? 'ai-bubble-user' : 'ai-bubble-ai');
    div.innerHTML = escapeHtml(m.text).replace(/\n/g,'<br>');
    aiChatWindow.appendChild(div);
  });
  aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
}

function addAiMessage(role, text){
  aiChatHistory.push({role, text});
  sessionStorage.setItem('aiChatHistory', JSON.stringify(aiChatHistory));
  renderAiChat();
}

function setAiLoading(loading){
  if(aiSendBtn) aiSendBtn.disabled=loading;
  if(aiInsightBtn) aiInsightBtn.disabled=loading;
  if(aiChatInput) aiChatInput.disabled=loading;
  let bubble=document.getElementById('aiLoadingBubble');
  if(loading){
    if(!bubble && aiChatWindow){
      bubble=document.createElement('div');
      bubble.id='aiLoadingBubble';
      bubble.className='ai-bubble ai-bubble-ai ai-bubble-loading';
      bubble.textContent='Mengetik…';
      aiChatWindow.appendChild(bubble);
      aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
    }
  } else if(bubble){
    bubble.remove();
  }
}

// ----- Panggil Groq API (langsung atau lewat proxy), mendukung function calling -----
// ----- Panggil API provider yang aktif (langsung atau lewat proxy), mendukung function calling -----
async function callAiOnce(payload, key){
  const provider = getAiProvider();
  const cfg = currentProvider();
  const useProxy = isAiProxyMode();
  const endpoint = useProxy ? cfg.proxyUrl : cfg.endpoint;
  const headers = { 'Content-Type': 'application/json' };
  let body;

  if(provider==='gemini'){
    body = {
      system_instruction: { parts: [{ text: payload.systemText }] },
      contents: payload.geminiContents,
      tools: buildAiTools(),
      generationConfig: { temperature: 0.4, maxOutputTokens: 800 }
    };
    if(!useProxy) headers['x-goog-api-key'] = key;
  } else {
    body = {
      model: cfg.model,
      messages: payload.openaiMessages,
      tools: buildAiTools(),
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens: 800
    };
    if(!useProxy) headers['Authorization'] = 'Bearer ' + key;
  }

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });

  if(!res.ok){
    let detail='';
    try{ const errJson=await res.json(); detail=errJson?.error?.message || ''; }catch(_){}
    if(provider==='gemini'){
      if(res.status===400 && /API key/i.test(detail)) throw new Error('BAD_KEY');
      if(res.status===403) throw new Error('BAD_KEY');
    } else {
      if(res.status===401) throw new Error('BAD_KEY');
    }
    if(res.status===429) throw new Error('RATE_LIMIT');
    throw new Error('HTTP_'+res.status+(detail?': '+detail:''));
  }
  return res.json();
}

async function callAi(userPrompt){
  const provider = getAiProvider();
  const key = isAiProxyMode() ? null : getAiKey();
  if(!isAiProxyMode() && !key) throw new Error('NO_KEY');

  const systemText = AI_SYSTEM_PROMPT + '\n\nTanggal hari ini: ' + localToday() + ' (' + dayNamesID[new Date().getDay()] + ').\n\n' + buildFinanceContext();

  if(provider==='gemini'){
    const contents = aiChatHistory
      .filter(m=>m.role==='user' || m.role==='ai')
      .slice(-10)
      .map(m=>({ role: m.role==='user' ? 'user' : 'model', parts: [{ text: m.text }] }));
    contents.push({ role:'user', parts:[{ text:userPrompt }] });

    let steps=0;
    while(steps<4){
      steps++;
      const data = await callAiOnce({ systemText, geminiContents: contents }, key);
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const fnCalls = parts.filter(p=>p.functionCall);

      if(fnCalls.length===0){
        const text = parts.map(p=>p.text||'').join('').trim();
        if(!text){
          if(candidate?.finishReason==='SAFETY') throw new Error('BLOCKED');
          throw new Error('EMPTY');
        }
        return text;
      }

      contents.push({ role:'model', parts });
      const responseParts = fnCalls.map(p=>{
        const fc=p.functionCall;
        const result = executeAiTool(fc.name, fc.args);
        const fr = { name: fc.name, response: { success: result.success, message: result.message } };
        if(fc.id) fr.id = fc.id;
        return { functionResponse: fr };
      });
      contents.push({ role:'user', parts: responseParts });
    }
    throw new Error('TOO_MANY_STEPS');
  }

  // ----- Groq / provider bergaya OpenAI -----
  const systemMsg = { role: 'system', content: systemText };
  const history = aiChatHistory
    .filter(m=>m.role==='user' || m.role==='ai')
    .slice(-10)
    .map(m=>({ role: m.role==='user' ? 'user' : 'assistant', content: m.text }));
  const messages = [systemMsg, ...history, { role:'user', content:userPrompt }];

  let steps=0;
  while(steps<4){
    steps++;
    const data = await callAiOnce({ openaiMessages: messages }, key);
    const choice = data?.choices?.[0];
    const message = choice?.message;
    const toolCalls = message?.tool_calls || [];

    if(toolCalls.length===0){
      const text = String(message?.content || '').trim();
      if(!text){
        if(choice?.finish_reason==='content_filter') throw new Error('BLOCKED');
        throw new Error('EMPTY');
      }
      return text;
    }

    // AI meminta eksekusi fungsi -> jalankan nyata di aplikasi, lalu kirim hasilnya balik
    messages.push(message);
    toolCalls.forEach(tc=>{
      let args={};
      try{ args = JSON.parse(tc.function.arguments || '{}'); }catch(_){}
      const result = executeAiTool(tc.function.name, args);
      messages.push({ role:'tool', tool_call_id: tc.id, content: JSON.stringify({ success: result.success, message: result.message }) });
    });
  }
  throw new Error('TOO_MANY_STEPS');
}

function friendlyAiError(err){
  const cfg = currentProvider();
  const msg=String(err && err.message || err);
  if(msg==='NO_KEY') return '⚠️ Kamu belum menyetel ' + cfg.label + ' API Key. Atur dulu di halaman Profil.';
  if(msg==='BAD_KEY') return '⚠️ API key sepertinya tidak valid atau ditolak. Cek lagi di ' + cfg.keyLink.replace('https://','') + ', lalu simpan ulang di halaman Profil.';
  if(msg==='RATE_LIMIT') return '⏳ Kena batas pemakaian gratis ' + cfg.label + ' untuk saat ini. Coba lagi sebentar lagi, atau ganti AI-nya di halaman Profil.';
  if(msg==='BLOCKED') return '🚫 Jawaban diblokir oleh filter keamanan. Coba tulis ulang pertanyaanmu.';
  if(msg==='TOO_MANY_STEPS') return '⚠️ AI mencoba menjalankan terlalu banyak aksi sekaligus. Coba pecah perintahmu jadi lebih sederhana.';
  return '⚠️ Gagal menghubungi ' + cfg.label + '. Cek koneksi internet kamu dan coba lagi. (' + msg + ')';
}

async function sendAiPrompt(promptText, displayText){
  updateAiKeyWarning();
  if(!isAiProxyMode() && !getAiKey()){
    addAiMessage('ai', friendlyAiError({message:'NO_KEY'}));
    return;
  }
  addAiMessage('user', displayText!==undefined ? displayText : promptText);
  setAiLoading(true);
  try{
    const reply=await callAi(promptText);
    addAiMessage('ai', reply);
  }catch(err){
    addAiMessage('ai', friendlyAiError(err));
  }finally{
    setAiLoading(false);
  }
}

if(aiChatForm){
  aiChatForm.addEventListener('submit', e=>{
    e.preventDefault();
    const val=aiChatInput.value.trim();
    if(!val) return;
    aiChatInput.value='';
    sendAiPrompt(val);
  });
}

if(aiInsightBtn){
  aiInsightBtn.addEventListener('click', ()=>{
    const prompt='Tolong beri ringkasan singkat kondisi keuanganku bulan ini, sorot kategori yang paling boros, dan kasih 2-3 saran praktis biar lebih hemat sisa bulan ini.';
    sendAiPrompt(prompt, '✨ Minta ringkasan & saran otomatis');
  });
}

if(aiClearChatBtn){
  aiClearChatBtn.addEventListener('click', ()=>{
    if(!confirm('Hapus semua riwayat obrolan dengan Asisten AI?')) return;
    aiChatHistory=[];
    sessionStorage.removeItem('aiChatHistory');
    renderAiChat();
  });
}

renderAiChat();
updateAiKeyWarning();

// =========================================================
// ===== FITUR TUGAS KAMPUS ================================
// =========================================================
let campusTasks = JSON.parse(localStorage.getItem('campusTasks') || '[]');
let taskFilter = 'active';

function saveCampusTasks(){ localStorage.setItem('campusTasks', JSON.stringify(campusTasks)); }

const taskModalBackdrop=document.getElementById('taskModalBackdrop');
const taskForm=document.getElementById('taskForm');
const taskListEl=document.getElementById('taskList');
const taskEmptyState=document.getElementById('taskEmptyState');
const taskWidgetList=document.getElementById('taskWidgetList');
const taskWidgetEmpty=document.getElementById('taskWidgetEmpty');
const taskWidgetTotal=document.getElementById('taskWidgetTotal');
const taskWidgetSubtitle=document.getElementById('taskWidgetSubtitle');
const editingTaskIdInput=document.getElementById('editingTaskId');
const menuTaskDot=document.getElementById('menuTaskDot');

const priorityLabels={rendah:'Rendah', sedang:'Sedang', tinggi:'Tinggi'};
const priorityIcons={rendah:'🟢', sedang:'🟡', tinggi:'🔴'};

// ----- Status & urgensi tugas (pakai daysUntil/dayNameOf dari modul Tagihan) -----
function taskStatus(t){
  if(t.status==='selesai') return {key:'paid', label:'Selesai', short:'Selesai'};
  const d=daysUntil(t.deadlineDate);
  const jam = t.deadlineTime ? ` jam ${t.deadlineTime}` : '';
  if(d<0) return {key:'late', label:`Terlambat ${Math.abs(d)} hari`, short:`Telat ${Math.abs(d)}h`};
  if(d===0) return {key:'today', label:`Deadline HARI INI${jam}`, short:'Hari ini'};
  if(d<=billReminderDays) return {key:'soon', label:`${d} hari lagi${jam}`, short:`H-${d}`};
  return {key:'safe', label:`${d} hari lagi${jam}`, short:`${d} hari`};
}

function activeTasks(){ return campusTasks.filter(t=>t.status!=='selesai'); }
function sortedTasks(list){ return [...list].sort((a,b)=> (a.deadlineDate+(a.deadlineTime||'99:99')).localeCompare(b.deadlineDate+(b.deadlineTime||'99:99')) || a.id-b.id); }

function getTaskAlerts(){
  return sortedTasks(activeTasks().filter(t=>{
    const st=taskStatus(t);
    return st.key==='late' || st.key==='today' || st.key==='soon';
  }));
}

// ----- Modal tambah/edit tugas -----
function openTaskModal(){
  if(!taskModalBackdrop) return;
  taskForm.reset();
  editingTaskIdInput.value='';
  document.getElementById('taskDeadlineDate').value=localToday();
  document.getElementById('taskPriority').value='sedang';
  document.getElementById('taskStatusInput').value='belum';
  document.getElementById('taskModalTitle').textContent='Tambah Tugas';
  taskForm.querySelector('button[type="submit"]').textContent='Simpan Tugas';
  taskModalBackdrop.classList.add('show');
  document.getElementById('taskTitle').focus();
}
function closeTaskModal(){ if(taskModalBackdrop) taskModalBackdrop.classList.remove('show'); }

function openEditTaskModal(id){
  const t=campusTasks.find(x=>x.id===id);
  if(!t) return;
  editingTaskIdInput.value=t.id;
  document.getElementById('taskTitle').value=t.title;
  document.getElementById('taskSubject').value=t.subject||'';
  document.getElementById('taskDeadlineDate').value=t.deadlineDate;
  document.getElementById('taskDeadlineTime').value=t.deadlineTime||'';
  document.getElementById('taskPriority').value=t.priority||'sedang';
  document.getElementById('taskStatusInput').value=t.status||'belum';
  document.getElementById('taskWeight').value=t.weight||'';
  document.getElementById('taskLink').value=t.link||'';
  document.getElementById('taskNote').value=t.note||'';
  document.getElementById('taskModalTitle').textContent='Edit Tugas';
  taskForm.querySelector('button[type="submit"]').textContent='Simpan Perubahan';
  taskModalBackdrop.classList.add('show');
}

if(taskForm){
  taskForm.addEventListener('submit', e=>{
    e.preventDefault();
    const data={
      title: document.getElementById('taskTitle').value.trim(),
      subject: document.getElementById('taskSubject').value.trim(),
      deadlineDate: document.getElementById('taskDeadlineDate').value,
      deadlineTime: document.getElementById('taskDeadlineTime').value || '',
      priority: document.getElementById('taskPriority').value,
      status: document.getElementById('taskStatusInput').value,
      weight: document.getElementById('taskWeight').value ? Number(document.getElementById('taskWeight').value) : null,
      link: document.getElementById('taskLink').value.trim(),
      note: document.getElementById('taskNote').value.trim()
    };
    const editingId=editingTaskIdInput.value;
    if(editingId){
      const idx=campusTasks.findIndex(t=>t.id===Number(editingId));
      if(idx>-1) campusTasks[idx]={...campusTasks[idx], ...data};
    } else {
      campusTasks.push({ id: Date.now(), ...data });
    }
    saveCampusTasks();
    closeTaskModal();
    renderTasksAll();
  });
}

['closeTaskModal','cancelTaskModal'].forEach(id=>{
  const btn=document.getElementById(id);
  if(btn) btn.addEventListener('click', closeTaskModal);
});
if(taskModalBackdrop) taskModalBackdrop.addEventListener('click', e=>{ if(e.target===taskModalBackdrop) closeTaskModal(); });

// ----- Aksi tugas -----
function markTaskDone(id){
  const t=campusTasks.find(x=>x.id===id);
  if(!t) return;
  t.status='selesai';
  saveCampusTasks();
  renderAll();
}
function unmarkTaskDone(id){
  const t=campusTasks.find(x=>x.id===id);
  if(!t) return;
  t.status='belum';
  saveCampusTasks();
  renderTasksAll();
}
function deleteTask(id){
  const t=campusTasks.find(x=>x.id===id);
  if(!t) return;
  if(!confirm(`Hapus tugas "${t.title}"?`)) return;
  campusTasks=campusTasks.filter(x=>x.id!==id);
  saveCampusTasks();
  renderTasksAll();
}

// ----- Render daftar tugas -----
function renderTaskList(){
  if(!taskListEl) return;
  let list;
  if(taskFilter==='active') list=activeTasks();
  else if(taskFilter==='done') list=campusTasks.filter(t=>t.status==='selesai');
  else if(taskFilter==='due') list=getTaskAlerts();
  else list=campusTasks;

  list=sortedTasks(list);
  if(taskFilter==='done') list.reverse();

  if(list.length===0){
    taskListEl.innerHTML='';
    if(taskEmptyState) taskEmptyState.classList.add('show');
    return;
  }
  if(taskEmptyState) taskEmptyState.classList.remove('show');

  taskListEl.innerHTML = list.map(t=>{
    const st=taskStatus(t);
    const weightTag = t.weight ? `<span class="bill-tag">⚖️ Bobot ${t.weight}%</span>` : '';
    const linkTag = t.link ? `<a href="${escapeHtml(t.link)}" target="_blank" rel="noopener" class="bill-tag">🔗 Link tugas</a>` : '';
    const noteTag = t.note ? `<span class="bill-tag">📝 ${escapeHtml(t.note)}</span>` : '';
    return `
    <div class="bill-item bill-${st.key}" data-id="${t.id}">
      <div class="bill-status-bar"></div>
      <div class="bill-main">
        <div class="bill-top">
          <span class="bill-name">${priorityIcons[t.priority]||'🟡'} ${escapeHtml(t.title)}</span>
          <span class="bill-badge bill-badge-${st.key}">${st.label}</span>
        </div>
        <div class="bill-meta">
          <span>📚 ${escapeHtml(t.subject||'-')}</span>
          <span>📅 ${dayNameOf(t.deadlineDate)}, ${formatDate(t.deadlineDate)}${t.deadlineTime?' · '+t.deadlineTime:''}</span>
          <span>Prioritas: ${priorityLabels[t.priority]||'Sedang'}</span>
        </div>
        <div class="bill-tags">${weightTag}${linkTag}${noteTag}</div>
      </div>
      <div class="bill-amount"></div>
      <div class="bill-actions">
        ${t.status==='selesai'
          ? `<button type="button" class="btn btn-secondary task-undone" data-id="${t.id}">↺ Batal Selesai</button>`
          : `<button type="button" class="btn btn-primary task-done" data-id="${t.id}">✓ Selesai</button>`}
        <button type="button" class="trans-edit task-edit" data-id="${t.id}" title="Edit">✏️</button>
        <button type="button" class="trans-delete task-delete" data-id="${t.id}" title="Hapus">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// ----- Ringkasan halaman Tugas Kampus -----
function renderTaskSummary(){
  const active=activeTasks();
  const alerts=getTaskAlerts();
  const thisMonth=localToday().slice(0,7);
  const doneThisMonth=campusTasks.filter(t=>t.status==='selesai' && t.deadlineDate && t.deadlineDate.slice(0,7)===thisMonth);

  const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
  set('taskActiveCount', active.length);
  set('taskActiveNote', active.length ? `${active.length} tugas belum selesai` : 'Belum ada tugas');
  set('taskDueCount', alerts.length);
  set('taskDueNote', alerts.length ? `${alerts.length} tugas mendesak` : 'Aman, tidak ada yang mendesak');
  set('taskDoneCount', doneThisMonth.length);
  set('taskDoneNote', doneThisMonth.length ? `${doneThisMonth.length} tugas kelar bulan ini` : 'Belum ada yang selesai');
}

// ----- Widget dashboard -----
function renderTaskWidget(){
  if(!taskWidgetList) return;
  const active=sortedTasks(activeTasks());
  if(taskWidgetTotal) taskWidgetTotal.textContent = `${active.length} tugas`;

  if(active.length===0){
    taskWidgetList.innerHTML='';
    if(taskWidgetEmpty) taskWidgetEmpty.style.display='block';
    if(taskWidgetSubtitle) taskWidgetSubtitle.textContent='Tidak ada tugas aktif';
    return;
  }
  if(taskWidgetEmpty) taskWidgetEmpty.style.display='none';
  const alerts=getTaskAlerts();
  if(taskWidgetSubtitle) taskWidgetSubtitle.textContent = alerts.length ? `⚠️ ${alerts.length} tugas mendesak` : 'Deadline terdekat';

  taskWidgetList.innerHTML = active.slice(0,4).map(t=>{
    const st=taskStatus(t);
    return `<div class="wallet-mini-item">
      <div>
        <div class="wallet-mini-name">${priorityIcons[t.priority]||'🟡'} ${escapeHtml(t.title)}</div>
        <div class="wallet-mini-type">${escapeHtml(t.subject||'-')} · ${dayNameOf(t.deadlineDate)}, ${formatDate(t.deadlineDate)}</div>
      </div>
      <div class="bill-badge bill-badge-${st.key}">${st.short}</div>
    </div>`;
  }).join('');
}

// ----- Navigasi ke halaman Tugas Kampus -----
function goToTasksPage(){
  document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));
  const menu=document.querySelector('.menu-item[data-page="tugas"]');
  if(menu) menu.classList.add('active');
  document.querySelectorAll('.page-section').forEach(sec=>sec.classList.remove('active'));
  const page=document.getElementById('page-tugas');
  if(page){ void page.offsetWidth; page.classList.add('active'); }
  window.scrollTo({top:0, behavior:'smooth'});
}

// ----- Event listener halaman Tugas Kampus -----
const addTaskBtn=document.getElementById('addTaskBtn');
if(addTaskBtn) addTaskBtn.addEventListener('click', openTaskModal);
const widgetAddTaskBtn=document.getElementById('widgetAddTaskBtn');
if(widgetAddTaskBtn) widgetAddTaskBtn.addEventListener('click', openTaskModal);
const goToTasksBtn=document.getElementById('goToTasksBtn');
if(goToTasksBtn) goToTasksBtn.addEventListener('click', goToTasksPage);

if(taskListEl){
  taskListEl.addEventListener('click', e=>{
    const done=e.target.closest('.task-done');
    const undone=e.target.closest('.task-undone');
    const edit=e.target.closest('.task-edit');
    const del=e.target.closest('.task-delete');
    if(done) markTaskDone(Number(done.dataset.id));
    else if(undone) unmarkTaskDone(Number(undone.dataset.id));
    else if(edit) openEditTaskModal(Number(edit.dataset.id));
    else if(del) deleteTask(Number(del.dataset.id));
  });
}

document.querySelectorAll('.task-tabs .media-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.task-tabs .media-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    taskFilter=tab.dataset.taskFilter;
    renderTaskList();
  });
});

// ----- Render semua bagian tugas kampus -----
function renderTasksAll(){
  renderTaskSummary();
  renderTaskList();
  renderTaskWidget();
  if(menuTaskDot) menuTaskDot.style.display = getTaskAlerts().length ? 'block' : 'none';
  renderNotifications(lastOverBudget);
}

function renderAll(){
  renderMonthOptions();
  const selectedYM = monthFilter.value;
  const prevYM = shiftYM(selectedYM, -1);
  const monthTx = transactions.filter(t=>ymOf(t.date)===selectedYM);
  const prevTx = transactions.filter(t=>ymOf(t.date)===prevYM);

  const income=sumByType(monthTx,'income'), expense=sumByType(monthTx,'expense'), balance=income-expense;
  const prevIncome=sumByType(prevTx,'income'), prevExpense=sumByType(prevTx,'expense'), prevBalance=prevIncome-prevExpense;

  animateNumber(balanceAmountEl, balance);
  animateNumber(incomeAmountEl, income);
  animateNumber(expenseAmountEl, expense);

  setChangeText(balanceChangeEl, balance, prevBalance);
  setChangeText(incomeChangeEl, income, prevIncome);
  setChangeText(expenseChangeEl, expense, prevExpense, true);

  renderBudget(monthTx);
  renderTopCategoryInsight(monthTx);
  renderChart(monthTx, selectedYM);
  renderTransactionList();
  renderPaydayBanner();
  renderWallets();
  renderWalletWidget();
  renderSavingsGoalWidgets();
  renderBillsAll();
  renderTasksAll();
  if (typeof updateAiKeyWarning === 'function') updateAiKeyWarning();
}

monthFilter.addEventListener('change', renderAll);
[txSearch,txTypeFilter,txCategoryFilter].forEach(el=> el && el.addEventListener('input', renderTransactionList));

// ===== Modal tambah/edit transaksi =====
function openModal(){
  editingIdInput.value='';
  document.getElementById('transactionForm').reset();
  typeInput.value='expense';
  document.querySelectorAll('.type-switch button').forEach(b=>b.classList.toggle('active', b.dataset.type==='expense'));
  updateCategoryOptions('expense');
  dateInput.value=localToday();
  if(transactionWalletSelect) transactionWalletSelect.value='';
  document.querySelector('#transactionForm .modal-head h2').textContent='Tambah Transaksi';
  document.querySelector('#transactionForm button[type="submit"]').textContent='Simpan Transaksi';
  modal.classList.add('show');
  document.getElementById('name').focus();
}
function closeModal(){modal.classList.remove('show')}

function openEditModal(id){
  const t=transactions.find(x=>x.id===id);
  if(!t) return;
  editingIdInput.value=t.id;
  document.getElementById('name').value=t.name;
  document.getElementById('amount').value=t.amount;
  dateInput.value=t.date;
  typeInput.value=t.type;
  document.querySelectorAll('.type-switch button').forEach(b=>b.classList.toggle('active', b.dataset.type===t.type));
  updateCategoryOptions(t.type);
  categorySelect.value=t.category;
  if(transactionWalletSelect) transactionWalletSelect.value = t.walletId ? String(t.walletId) : '';
  document.querySelector('#transactionForm .modal-head h2').textContent='Edit Transaksi';
  document.querySelector('#transactionForm button[type="submit"]').textContent='Simpan Perubahan';
  modal.classList.add('show');
}

function handleDeleteTransaction(id){
  if(!confirm('Hapus transaksi ini?')) return;
  transactions = transactions.filter(t=>t.id!==id);
  saveTransactions();
  renderAll();
}

document.getElementById('addTransaction').addEventListener('click',openModal);
document.getElementById('closeModal').addEventListener('click',closeModal);
document.getElementById('cancelModal').addEventListener('click',closeModal);
modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});

document.querySelectorAll('.type-switch button').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.type-switch button').forEach(b=>b.classList.remove('active'));
  button.classList.add('active');
  typeInput.value=button.dataset.type;
  updateCategoryOptions(button.dataset.type);
}));

document.getElementById('transactionForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=document.getElementById('name').value.trim();
  const amount=Number(document.getElementById('amount').value);
  const dateValue=dateInput.value;
  const category=categorySelect.value;
  const type=typeInput.value;
  const editingId=editingIdInput.value;
  const walletId = transactionWalletSelect && transactionWalletSelect.value ? Number(transactionWalletSelect.value) : null;

  if(editingId){
    const idx=transactions.findIndex(t=>t.id===Number(editingId));
    if(idx>-1){ transactions[idx]={...transactions[idx], name, amount, date:dateValue, category, type, walletId}; }
  } else {
    transactions.push({ id: Date.now(), name, amount, date:dateValue, category, type, walletId });
  }
  saveTransactions();
  renderAll();
  e.target.reset();
  editingIdInput.value='';
  typeInput.value='expense';
  document.querySelectorAll('.type-switch button').forEach(b=>b.classList.toggle('active',b.dataset.type==='expense'));
  closeModal();
});

list.addEventListener('click', (e)=>{
  const editBtn=e.target.closest('.trans-edit');
  const delBtn=e.target.closest('.trans-delete');
  if(editBtn) openEditModal(Number(editBtn.dataset.id));
  if(delBtn) handleDeleteTransaction(Number(delBtn.dataset.id));
});

document.getElementById('showAll').addEventListener('click',()=>document.getElementById('transaksi').scrollIntoView({behavior:'smooth',block:'start'}));

// ===== Export CSV & Cetak =====
if(exportCsvBtn) exportCsvBtn.addEventListener('click', ()=>{
  const rows=[['Tanggal','Nama','Jenis','Kategori','Rekening','Jumlah']];
  getFilteredTransactions().forEach(t=>{
    const wallet = t.walletId ? wallets.find(w=>w.id===t.walletId) : null;
    rows.push([t.date, t.name, t.type==='income'?'Pemasukan':'Pengeluaran', t.category, wallet?wallet.name:'-', t.amount]);
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`transaksi-statistikdompet-${localToday()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
if(printReportBtn) printReportBtn.addEventListener('click', ()=>window.print());

// ===== Modal atur anggaran =====
if(openBudgetModalBtn) openBudgetModalBtn.addEventListener('click', ()=>{
  budgetCategories.forEach(cat=>{
    const input=document.getElementById('budgetInput-'+catKey(cat));
    if(input) input.value = budgetTargets[cat] || '';
  });
  budgetModalBackdrop.classList.add('show');
});
['closeBudgetModal','cancelBudgetModal'].forEach(id=>{
  const btn=document.getElementById(id);
  if(btn) btn.addEventListener('click', ()=>budgetModalBackdrop.classList.remove('show'));
});
budgetModalBackdrop.addEventListener('click', e=>{ if(e.target===budgetModalBackdrop) budgetModalBackdrop.classList.remove('show'); });
document.getElementById('budgetForm').addEventListener('submit', e=>{
  e.preventDefault();
  budgetCategories.forEach(cat=>{
    const input=document.getElementById('budgetInput-'+catKey(cat));
    budgetTargets[cat]=Number(input.value)||0;
  });
  saveBudgetTargets();
  budgetModalBackdrop.classList.remove('show');
  renderAll();
});

// ===== Notifikasi dropdown =====
if(notifBtn) notifBtn.addEventListener('click', (e)=>{ e.stopPropagation(); notifDropdown.classList.toggle('show'); });

// ===== Dark mode =====
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  if(themeToggle) themeToggle.textContent = theme==='dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}
applyTheme(localStorage.getItem('theme') || 'dark');
if(themeToggle) themeToggle.addEventListener('click', ()=>{
  const current=document.documentElement.getAttribute('data-theme')||'light';
  applyTheme(current==='dark' ? 'light' : 'dark');
});

// ===== Sapaan & tanggal dinamis =====
function renderGreeting(){
  const now=new Date();
  const greetingDate=document.getElementById('greetingDate');
  const greetingTitle=document.getElementById('greetingTitle');
  if(greetingDate) greetingDate.textContent = `${dayNamesID[now.getDay()]}, ${now.getDate()} ${monthNamesID[now.getMonth()]} ${now.getFullYear()}`;
  if(greetingTitle){
    const profile=getSavedProfile();
    const firstName = profile.name ? profile.name.trim().split(/\s+/)[0] : 'Anak Kos';
    greetingTitle.textContent = 'Halo, ';
    const nameEl = document.createElement('span');
    nameEl.className = 'greet-name';
    nameEl.textContent = `${firstName}!`;
    greetingTitle.appendChild(nameEl);
  }
}

// ===== Navigasi antar menu sidebar =====
const menuItems = document.querySelectorAll('.menu-item');
const pageSections = document.querySelectorAll('.page-section');

menuItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault(); // biar link # gak bikin halaman lompat ke atas

    const targetPage = item.dataset.page;

    // update tampilan menu aktif
    menuItems.forEach(m => m.classList.remove('active'));
    item.classList.add('active');

    // cek apakah targetnya page-section penuh (dashboard / profil)
    const targetSection = document.getElementById('page-' + targetPage);

    if (targetSection) {
      // pindah halaman penuh
      pageSections.forEach(section => section.classList.remove('active'));
      targetSection.classList.remove('active'); // reset dulu biar animasi replay
      void targetSection.offsetWidth; // trigger reflow
      targetSection.classList.add('active');
    } else {
      // targetnya bagian DI DALAM dashboard (transaksi/anggaran/laporan)
      // -> tampilkan dashboard dulu, lalu scroll ke bagian tersebut
      pageSections.forEach(section => section.classList.remove('active'));
      const dash = document.getElementById('page-dashboard');
      void dash.offsetWidth;
      dash.classList.add('active');

      const anchor = document.getElementById(targetPage);
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ===== Klik logo/brand di pojok kiri atas -> balik ke Dashboard =====
const brandHome = document.getElementById('brandHome');
if (brandHome) {
  brandHome.addEventListener('click', (e) => {
    e.preventDefault();
    menuItems.forEach(m => m.classList.remove('active'));
    const dashboardMenu = document.querySelector('.menu-item[data-page="dashboard"]');
    if (dashboardMenu) dashboardMenu.classList.add('active');
    pageSections.forEach(section => section.classList.remove('active'));
    const dash = document.getElementById('page-dashboard');
    void dash.offsetWidth;
    dash.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== Avatar profil (dropdown, info, upload foto) =====
const avatarBtn = document.getElementById('avatarBtn');
const avatarDropdown = document.getElementById('avatarDropdown');
const dropdownAvatarPreview = document.getElementById('dropdownAvatarPreview');
const dropdownName = document.getElementById('dropdownName');
const dropdownUsername = document.getElementById('dropdownUsername');
const avatarUploadInput = document.getElementById('avatarUploadInput');
const removePhotoBtn = document.getElementById('removePhotoBtn');
const dropdownViewProfile = document.getElementById('dropdownViewProfile');
const dropdownLogout = document.getElementById('dropdownLogout');

function getInitials(name) {
  if (!name) return 'AP';
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

function refreshAvatarUI() {
  const profile = getSavedProfile();
  const photo = localStorage.getItem('profilePhoto');
  const initials = getInitials(profile.name);

  [avatarBtn, dropdownAvatarPreview].forEach(el => {
    if (!el) return;
    if (photo) {
      el.innerHTML = `<img src="${photo}" alt="Foto profil">`;
    } else {
      el.textContent = initials;
    }
  });

  if (dropdownName) dropdownName.textContent = profile.name || 'Anak Kos';
  if (dropdownUsername) dropdownUsername.textContent = profile.username ? '@' + profile.username : '@username';
  if (removePhotoBtn) removePhotoBtn.style.display = photo ? 'block' : 'none';
  renderGreeting();
}

if (avatarBtn) {
  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    avatarDropdown.classList.toggle('show');
  });
}

document.addEventListener('click', (e) => {
  if (avatarDropdown && avatarDropdown.classList.contains('show') && !e.target.closest('.avatar-wrap')) {
    avatarDropdown.classList.remove('show');
  }
  if (notifDropdown && notifDropdown.classList.contains('show') && !e.target.closest('.notif-wrap')) {
    notifDropdown.classList.remove('show');
  }
});

if (avatarUploadInput) {
  avatarUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem('profilePhoto', reader.result);
      refreshAvatarUI();
    };
    reader.readAsDataURL(file);
    avatarUploadInput.value = '';
  });
}

if (removePhotoBtn) {
  removePhotoBtn.addEventListener('click', () => {
    localStorage.removeItem('profilePhoto');
    refreshAvatarUI();
  });
}

if (dropdownViewProfile) {
  dropdownViewProfile.addEventListener('click', (e) => {
    e.preventDefault();
    avatarDropdown.classList.remove('show');
    const profileMenu = document.querySelector('.menu-item[data-page="profil"]');
    if (profileMenu) profileMenu.click();
  });
}

if (dropdownLogout) {
  dropdownLogout.addEventListener('click', () => {
    avatarDropdown.classList.remove('show');
    document.getElementById('logoutBtn')?.click();
  });
}

// ===== Toggle show/hide password =====
const togglePwBtn = document.getElementById('togglePassword');
const pwInput = document.getElementById('profilePassword');

if (togglePwBtn) {
  togglePwBtn.addEventListener('click', () => {
    const isPassword = pwInput.type === 'password';
    pwInput.type = isPassword ? 'text' : 'password';
    togglePwBtn.textContent = isPassword ? '🙈' : '👁️';
  });
}

// ===== Hash password sederhana (SHA-256, dengan fallback) =====
async function hashText(text){
  try{
    if (window.crypto && crypto.subtle) {
      const enc = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
  }catch(err){ /* lanjut ke fallback */ }
  let hash = 0;
  for (let i=0;i<text.length;i++){ hash=((hash<<5)-hash)+text.charCodeAt(i); hash|=0; }
  return 'fb_'+Math.abs(hash).toString(16);
}

// ===== Simpan profil =====
const profileForm = document.getElementById('profileForm');
const profileMsg = document.getElementById('profileMsg');

if (profileForm) {
  // load data lama saat halaman dibuka
  const savedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
  if (savedProfile.name) document.getElementById('profileName').value = savedProfile.name;
  if (savedProfile.username) document.getElementById('profileUsername').value = savedProfile.username;
  if (savedProfile.payday) document.getElementById('profilePayday').value = savedProfile.payday;

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const current = getSavedProfile();
    const newPassword = document.getElementById('profilePassword').value;
    const passwordHash = newPassword ? await hashText(newPassword) : (current.passwordHash || '');

    const profileData = {
      name: document.getElementById('profileName').value,
      username: document.getElementById('profileUsername').value,
      passwordHash,
      payday: Number(document.getElementById('profilePayday').value) || null
    };

    localStorage.setItem('userProfile', JSON.stringify(profileData));
    refreshAvatarUI();
    renderPaydayBanner();

    profileMsg.textContent = 'Profil berhasil disimpan!';
    profileMsg.style.display = 'block';
    setTimeout(() => { profileMsg.style.display = 'none'; }, 2500);

    document.getElementById('profilePassword').value = '';
  });
}

// ===== LOGIN / REGISTER / LOGOUT =====
const loginScreen = document.getElementById('loginScreen');
const appRoot = document.getElementById('appRoot');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginFormWrapper = document.getElementById('loginFormWrapper');
const registerFormWrapper = document.getElementById('registerFormWrapper');
const loginMsg = document.getElementById('loginMsg');
const registerMsg = document.getElementById('registerMsg');

function showApp() {
  loginScreen.style.display = 'none';
  appRoot.style.display = 'block';

  // pastikan yang tampil pertama adalah Dashboard
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const dashboardSection = document.getElementById('page-dashboard');
  if (dashboardSection) dashboardSection.classList.add('active');

  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  const dashboardMenu = document.querySelector('.menu-item[data-page="dashboard"]');
  if (dashboardMenu) dashboardMenu.classList.add('active');

  updateCategoryOptions('expense');
  populateCategoryFilter();
  refreshAvatarUI();
  populateGoalForm();
  renderAll();
  setTimeout(maybeShowBillToast, 800);
}

function getSavedProfile() {
  return JSON.parse(localStorage.getItem('userProfile') || '{}');
}

// cek: kalau belum ada akun sama sekali, langsung tampilkan form Daftar
const existingProfile = getSavedProfile();
if (!existingProfile.username) {
  loginFormWrapper.style.display = 'none';
  registerFormWrapper.style.display = 'block';
}

// cek sesi yang masih aktif (biar gak perlu login ulang tiap refresh)
if (sessionStorage.getItem('isLoggedIn') === 'true' && existingProfile.username) {
  showApp();
}

// pindah ke form Daftar
document.getElementById('showRegister').addEventListener('click', (e) => {
  e.preventDefault();
  loginFormWrapper.style.display = 'none';
  registerFormWrapper.style.display = 'block';
  loginMsg.style.display = 'none';
});

// pindah ke form Masuk
document.getElementById('showLogin').addEventListener('click', (e) => {
  e.preventDefault();
  registerFormWrapper.style.display = 'none';
  loginFormWrapper.style.display = 'block';
  registerMsg.style.display = 'none';
});

// proses Daftar
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('registerName').value.trim();
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;

  if (!name || !username || !password) {
    registerMsg.textContent = 'Semua kolom wajib diisi.';
    registerMsg.style.display = 'block';
    return;
  }

  const passwordHash = await hashText(password);
  const profileData = { name, username, passwordHash, payday: null };
  localStorage.setItem('userProfile', JSON.stringify(profileData));
  sessionStorage.setItem('isLoggedIn', 'true');

  // sinkronkan ke form Profil di dalam app
  const pn = document.getElementById('profileName');
  const pu = document.getElementById('profileUsername');
  if (pn) pn.value = name;
  if (pu) pu.value = username;

  showApp();
});

// proses Masuk
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const saved = getSavedProfile();

  if (!saved.username) {
    loginMsg.textContent = 'Belum ada akun. Silakan daftar dulu.';
    loginMsg.style.display = 'block';
    return;
  }

  const passwordHash = await hashText(password);
  const legacyMatch = !saved.passwordHash && saved.password === password;
  const hashMatch = saved.passwordHash && passwordHash === saved.passwordHash;

  if (username === saved.username && (hashMatch || legacyMatch)) {
    if (legacyMatch) {
      // migrasi akun lama (password polos) ke hash
      saved.passwordHash = passwordHash;
      delete saved.password;
      localStorage.setItem('userProfile', JSON.stringify(saved));
    }
    sessionStorage.setItem('isLoggedIn', 'true');
    loginMsg.style.display = 'none';
    showApp();
  } else {
    loginMsg.textContent = 'Username atau password salah.';
    loginMsg.style.display = 'block';
  }
});

// toggle show/hide password di form login & register
document.getElementById('toggleLoginPassword').addEventListener('click', () => {
  const input = document.getElementById('loginPassword');
  input.type = input.type === 'password' ? 'text' : 'password';
});

document.getElementById('toggleRegisterPassword').addEventListener('click', () => {
  const input = document.getElementById('registerPassword');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// proses Keluar (logout)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('isLoggedIn');
    appRoot.style.display = 'none';
    loginScreen.style.display = 'flex';
    document.getElementById('loginPassword').value = '';
  });
}

// ===== Backup & Impor data =====
const backupDataBtn = document.getElementById('backupDataBtn');
const restoreDataInput = document.getElementById('restoreDataInput');

if (backupDataBtn) {
  backupDataBtn.addEventListener('click', () => {
    const data = {
      userProfile: getSavedProfile(),
      transactions,
      budgetTargets,
      wallets,
      bills,
      billReminderDays,
      campusTasks,
      savingsGoal,
      mediaImages,
      mediaVideos,
      mediaLinks,
      theme: localStorage.getItem('theme') || 'light',
      profilePhoto: localStorage.getItem('profilePhoto') || null
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'statistikdompet-backup.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });
}

if (restoreDataInput) {
  restoreDataInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirm('Impor data ini akan menimpa data yang ada saat ini. Lanjutkan?')) return;
        if (data.userProfile) localStorage.setItem('userProfile', JSON.stringify(data.userProfile));
        if (data.transactions) localStorage.setItem('transactions', JSON.stringify(data.transactions));
        if (data.budgetTargets) localStorage.setItem('budgetTargets', JSON.stringify(data.budgetTargets));
        if (data.wallets) localStorage.setItem('wallets', JSON.stringify(data.wallets));
        if (data.bills) localStorage.setItem('bills', JSON.stringify(data.bills));
        if (data.billReminderDays) localStorage.setItem('billReminderDays', String(data.billReminderDays));
        if (data.campusTasks) localStorage.setItem('campusTasks', JSON.stringify(data.campusTasks));
        if (data.savingsGoal) localStorage.setItem('savingsGoal', JSON.stringify(data.savingsGoal));
        if (data.mediaImages) localStorage.setItem('mediaImages', JSON.stringify(data.mediaImages));
        if (data.mediaVideos) localStorage.setItem('mediaVideos', JSON.stringify(data.mediaVideos));
        if (data.mediaLinks) localStorage.setItem('mediaLinks', JSON.stringify(data.mediaLinks));
        if (data.theme) localStorage.setItem('theme', data.theme);
        if (data.profilePhoto) localStorage.setItem('profilePhoto', data.profilePhoto);
        alert('Data berhasil diimpor. Halaman akan dimuat ulang.');
        location.reload();
      } catch (err) {
        alert('File tidak valid.');
      }
    };
    reader.readAsText(file);
    restoreDataInput.value = '';
  });
}

// =====================================================================
// NAVIGASI HP: menu bawah + lembar "Menu"
// Hanya "menekan" menu sidebar yang sudah ada, jadi semua logika lama
// (halaman, scroll ke bagian dashboard, titik peringatan) tetap dipakai.
// =====================================================================
(function setupMobileNav(){
  const bottomNav = document.getElementById('bottomNav');
  const sheet = document.getElementById('moreSheet');
  const grid = document.getElementById('moreGrid');
  const nav = document.querySelector('.sidebar .nav');
  if(!bottomNav || !sheet || !grid || !nav) return;

  const barPages = ['dashboard','dompet','tagihan'];            // ada di menu bawah
  const dashboardAnchors = ['transaksi','anggaran','laporan'];  // bagian di dalam Beranda

  function goPage(page){
    const item = nav.querySelector('.menu-item[data-page="'+page+'"]');
    if(!item) return;
    item.click();
    if(document.getElementById('page-'+page)) window.scrollTo(0,0);
  }

  function openSheet(){ sheet.classList.add('show'); document.body.style.overflow='hidden'; }
  function closeSheet(){ sheet.classList.remove('show'); document.body.style.overflow=''; }

  // isi lembar "Menu" dari menu sidebar (selalu sinkron dengan menu utama)
  function buildSheet(){
    grid.innerHTML = '';
    nav.querySelectorAll('.menu-item').forEach(item=>{
      const page = item.dataset.page;
      if(barPages.includes(page)) return;
      const icon = item.querySelector('.nav-icon');
      const label = item.querySelector('span:not(.nav-icon):not(.menu-dot)');
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'sheet-tile';
      tile.dataset.go = page;
      tile.innerHTML = '<span class="st-ico">'+(icon?icon.innerHTML:'')+'</span><span class="st-label">'+(label?label.textContent:page)+'</span>'
        + (page==='tugas' ? '<i class="bn-dot" id="sheetTaskDot"></i>' : '');
      grid.appendChild(tile);
    });
    const theme = document.createElement('button');
    theme.type='button'; theme.className='sheet-tile'; theme.dataset.action='theme';
    theme.innerHTML = '<span class="st-ico"><svg class="icon" viewBox="0 0 20 20"><path d="M16.5 11.6A6.6 6.6 0 0 1 8.4 3.5a6.6 6.6 0 1 0 8.1 8.1Z"/></svg></span><span class="st-label">Tema</span>';
    grid.appendChild(theme);
    const out = document.createElement('button');
    out.type='button'; out.className='sheet-tile sheet-tile-danger'; out.dataset.action='logout';
    out.innerHTML = '<span class="st-ico"><svg class="icon" viewBox="0 0 20 20"><path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/><path d="M12 6.5 15.5 10 12 13.5M15.5 10H8"/></svg></span><span class="st-label">Keluar</span>';
    grid.appendChild(out);
    syncDots();
  }

  // tandai menu yang sedang aktif (mengikuti menu sidebar)
  function syncActive(){
    const active = nav.querySelector('.menu-item.active');
    let page = active ? active.dataset.page : 'dashboard';
    if(dashboardAnchors.includes(page)) page = 'dashboard';
    bottomNav.querySelectorAll('.bn-item[data-go]').forEach(b=> b.classList.toggle('active', b.dataset.go===page));
    const more = document.getElementById('bnMore');
    if(more) more.classList.toggle('active', !barPages.includes(page));
  }

  // titik merah peringatan (tagihan/tugas) mengikuti titik di sidebar
  function syncDots(){
    const show = (id, on)=>{ const el=document.getElementById(id); if(el) el.classList.toggle('on', !!on); };
    const visible = id=>{ const el=document.getElementById(id); return !!el && el.style.display!=='none' && el.style.display!==''; };
    show('bnBillDot', visible('menuBillDot'));
    show('bnMoreDot', visible('menuTaskDot'));
    show('sheetTaskDot', visible('menuTaskDot'));
  }

  bottomNav.addEventListener('click', e=>{
    const go = e.target.closest('[data-go]');
    if(go){ goPage(go.dataset.go); return; }
    if(e.target.closest('#bnAdd')){ document.getElementById('addTransaction').click(); return; }
    if(e.target.closest('#bnMore')){ openSheet(); }
  });

  grid.addEventListener('click', e=>{
    const tile = e.target.closest('.sheet-tile');
    if(!tile) return;
    closeSheet();
    if(tile.dataset.go){ goPage(tile.dataset.go); }
    else if(tile.dataset.action==='theme'){ document.getElementById('themeToggle')?.click(); }
    else if(tile.dataset.action==='logout'){ document.getElementById('logoutBtn')?.click(); }
  });
  sheet.addEventListener('click', e=>{ if(e.target===sheet) closeSheet(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeSheet(); });

  // pintasan cepat di Beranda
  document.getElementById('page-dashboard')?.addEventListener('click', e=>{
    const qa = e.target.closest('.qa-item');
    if(qa) goPage(qa.dataset.go);
  });

  document.getElementById('topbarBrand')?.addEventListener('click', e=>{ e.preventDefault(); goPage('dashboard'); });

  new MutationObserver(syncActive).observe(nav, {subtree:true, attributes:true, attributeFilter:['class']});
  ['menuBillDot','menuTaskDot'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) new MutationObserver(syncDots).observe(el, {attributes:true, attributeFilter:['style']});
  });

  buildSheet();
  syncActive();
})();
