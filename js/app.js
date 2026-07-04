/* ── State ──────────────────────────────────────────────────────────── */
const S = {
  lists: [], supermarkets: [],
  currentListId: null, items: [], sortMode: 'aisle',
  selectedEmoji: '🛒', editingItemId: null,
  settingsSupermarketId: null, editingSupermarketId: null, editingAisleId: null,
};

const SORT_MODES  = ['aisle','alpha','added'];
const SORT_LABELS = { aisle:'Aisle order', alpha:'A → Z', added:'Recently added' };

/* ── Boot ───────────────────────────────────────────────────────────── */
bootApp();

function bootApp() {
  S.supermarkets = Store.getSupermarkets();
  S.lists = Store.getLists();
  renderListsScreen();
  showScreen('screen-lists');
  registerServiceWorker();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

/* ── Lists Screen ───────────────────────────────────────────────────── */
function renderListsScreen() {
  const grid = document.getElementById('lists-grid');
  if (!S.lists.length) {
    grid.innerHTML = `<div class="empty-lists"><div class="empty-lists-circle"><img src="icons/logo.png" class="empty-lists-logo"/></div><p>No lists yet.<br/>Tap + to create your first list.</p></div>`;
    return;
  }
  grid.innerHTML = S.lists.map(l => {
    const sup = S.supermarkets.find(s => s.id === l.supermarketId);
    const items = Store.getItems(l.id);
    const rem = items.filter(i => !i.checked).length;
    const countText = items.length === 0 ? 'Empty' : `${rem} of ${items.length} remaining`;
    return `<div class="list-card" onclick="openList('${l.id}')">
      <div class="list-card-top">
        <div class="list-card-emoji"><img src="icons/logo.png" style="width:72px;height:72px;object-fit:contain;"/></div>
        <div class="list-card-title">
          <div class="list-card-name">${esc(l.name)}</div>
          <div class="list-card-meta">${countText}</div>
        </div>
      </div>
      ${sup ? `<span class="list-card-super">${sup.emoji} ${esc(sup.name)}</span>` : ''}
    </div>`;
  }).join('');
}

/* ── Open List ──────────────────────────────────────────────────────── */
function openList(id) {
  S.currentListId = id;
  const list = S.lists.find(l => l.id === id);
  const sup  = S.supermarkets.find(s => s.id === list?.supermarketId);

  document.getElementById('shop-emoji').innerHTML = `<img src="icons/logo.png" style="width:52px;height:52px;object-fit:contain;vertical-align:middle;"/>`;
  document.getElementById('shop-name').textContent  = list?.name || '';
  document.getElementById('supermarket-badge').textContent = sup ? `${sup.emoji} ${sup.name}` : '';
  document.getElementById('sort-label').textContent = SORT_LABELS[S.sortMode];

  S.items = Store.getItems(id);
  renderItems();
  showScreen('screen-shop');
}

function goBack() {
  S.currentListId = null;
  renderListsScreen();
  showScreen('screen-lists');
}

/* ── Screen transitions ─────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active','behind');
    if (s.id === id) s.classList.add('active');
    else if (id === 'screen-shop' && s.id === 'screen-lists') s.classList.add('behind');
  });
}

/* ── Render Items ───────────────────────────────────────────────────── */
function currentSupermarketId() {
  const list = S.lists.find(l => l.id === S.currentListId);
  return list?.supermarketId;
}

function aisleInfoFor(item) {
  return Store.resolveAisleForCategory(currentSupermarketId(), item.category);
}

function renderItems() {
  const container = document.getElementById('items-container');
  const items = sortItems([...S.items]);

  if (!items.length) {
    container.innerHTML = `<div class="empty-items"><div class="e-icon">📋</div><p>List is empty — add items above.</p></div>`;
    return;
  }

  if (S.sortMode === 'aisle') {
    const groups = {};
    items.forEach(item => {
      const info = aisleInfoFor(item);
      (groups[info.aisleNumber] ??= { info, items: [] }).items.push(item);
    });
    const keys = Object.keys(groups).sort((a, b) => Number(a) - Number(b));
    container.innerHTML = keys.map(key => {
      const { info, items: gr } = groups[key];
      const rem = gr.filter(i => !i.checked).length;
      return `<div class="aisle-group">
        <div class="aisle-header">
          <span class="aisle-header-emoji">${info.emoji}</span>
          <span class="aisle-header-label">${esc(info.label)}</span>
          <span class="aisle-header-count">${rem}/${gr.length}</span>
        </div>
        <div class="items-grid">${gr.map(tileHTML).join('')}</div>
      </div>`;
    }).join('');
  } else {
    container.innerHTML = `<div class="items-grid">${items.map(tileHTML).join('')}</div>`;
  }

  document.querySelectorAll('.item-tile').forEach(attachSwipe);
}

function tileHTML(item) {
  const showIt = item.nameDisplay && item.nameDisplay !== item.name;
  return `<div class="item-tile ${item.checked ? 'checked' : ''}" id="tile-${item.id}" onclick="toggleItem('${item.id}')">
    <div class="item-check">${item.checked ? '✓' : ''}</div>
    <div class="item-emoji">${item.emoji || '🛒'}</div>
    <div class="item-body">
      <span class="item-name">${esc(item.name)}</span>
      ${showIt ? `<span class="item-name-it">${esc(item.nameDisplay)}</span>` : ''}
      <div class="item-meta">
        ${item.quantity ? `<span class="item-qty">${esc(item.quantity)}</span>` : ''}
        ${item.note ? `<span class="item-note">📝 ${esc(item.note)}</span>` : ''}
      </div>
    </div>
    <button class="item-edit-btn" onclick="event.stopPropagation();openItemEdit('${item.id}')" title="Edit">✏️</button>
  </div>`;
}

function sortItems(items) {
  if (S.sortMode === 'aisle') {
    return items.sort((a, b) => aisleInfoFor(a).aisleNumber - aisleInfoFor(b).aisleNumber || a.name.localeCompare(b.name));
  }
  if (S.sortMode === 'alpha') return items.sort((a, b) => a.name.localeCompare(b.name));
  return items.sort((a, b) => b.addedAt - a.addedAt);
}

/* ── Swipe to check / delete ────────────────────────────────────────── */
function attachSwipe(el) {
  let startX = 0, startY = 0, dx = 0;
  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; dx = 0;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > 10) return;
    el.classList.toggle('swiping-check',  dx > 40);
    el.classList.toggle('swiping-delete', dx < -40);
  }, { passive: true });
  el.addEventListener('touchend', () => {
    const id = el.id.replace('tile-', '');
    if (dx > 60) toggleItem(id);
    else if (dx < -60) removeItem(id);
    el.classList.remove('swiping-check', 'swiping-delete');
  });
}

/* ── Add Item ───────────────────────────────────────────────────────── */
function addItem() {
  const input    = document.getElementById('item-input');
  const qtyEl    = document.getElementById('qty-input');
  const noteEl   = document.getElementById('add-note-input');
  const glutenEl = document.getElementById('add-gluten-free');
  const name     = input.value.trim();
  if (!name) return;
  if (!S.currentListId) { showToast('Open a list first'); return; }
  const quantity   = qtyEl.value.trim();
  const extraNote  = noteEl.value.trim();
  const glutenFree = glutenEl.checked;
  const note = [glutenFree ? 'Gluten Free' : '', extraNote].filter(Boolean).join(' — ');
  hideSuggestions();

  const item = Store.addItem(S.currentListId, { name, quantity, note });
  input.value = ''; qtyEl.value = ''; noteEl.value = ''; glutenEl.checked = false;
  S.items.push(item);
  renderItems();
  if (item.unknown) showSavePrompt(item);
  input.focus();
}

function toggleItem(id) {
  const item = S.items.find(i => i.id === id);
  if (!item) return;
  const updated = Store.updateItem(S.currentListId, id, { checked: !item.checked });
  const idx = S.items.findIndex(i => i.id === id);
  if (idx >= 0) S.items[idx] = updated;
  renderItems();
}

function removeItem(id) {
  Store.removeItem(id);
  S.items = S.items.filter(i => i.id !== id);
  renderItems();
}

function clearChecked() {
  if (!S.currentListId) return;
  if (!confirm('Remove all checked items?')) return;
  Store.clearChecked(S.currentListId);
  S.items = S.items.filter(i => !i.checked);
  renderItems();
}

/* ── Sort ───────────────────────────────────────────────────────────── */
function cycleSort() {
  const idx = SORT_MODES.indexOf(S.sortMode);
  S.sortMode = SORT_MODES[(idx + 1) % SORT_MODES.length];
  document.getElementById('sort-label').textContent = SORT_LABELS[S.sortMode];
  renderItems();
  showToast(SORT_LABELS[S.sortMode]);
}

/* ── Suggestions ────────────────────────────────────────────────────── */
const itemInput = document.getElementById('item-input');
let suggHL = -1;

itemInput.addEventListener('input', () => {
  const q = itemInput.value.trim();
  if (q.length < 1) { hideSuggestions(); return; }
  showSuggestions(Store.getSuggestions(q), q);
});

itemInput.addEventListener('keydown', e => {
  const chips = document.querySelectorAll('.suggestion-chip');
  if (e.key === 'ArrowRight') { e.preventDefault(); suggHL = Math.min(suggHL + 1, chips.length - 1); hlChips(chips); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); suggHL = Math.max(suggHL - 1, -1); hlChips(chips); }
  else if (e.key === 'Enter') { e.preventDefault(); chips[suggHL]?.click() ?? addItem(); }
  else if (e.key === 'Escape') hideSuggestions();
});

function hlChips(chips) { chips.forEach((c, i) => c.classList.toggle('highlighted', i === suggHL)); }

function positionSuggestions() {
  const bar = document.querySelector('.add-bar');
  const box = document.getElementById('suggestions');
  if (!bar || !box) return;
  const r = bar.getBoundingClientRect();
  box.style.top   = (r.bottom + 6) + 'px';
  box.style.left  = r.left + 'px';
  box.style.width = r.width + 'px';
}

function showSuggestions(results, query) {
  const box = document.getElementById('suggestions');
  suggHL = -1;
  const supId = currentSupermarketId();

  const chips = results.map(r => {
    const lang = r.name_it && r.name_it.toLowerCase().includes(query.toLowerCase()) ? 'IT' : 'EN';
    const aisle = Store.resolveAisleForCategory(supId, r.category);
    return `<div class="suggestion-chip" onclick="selectSugg('${esc(r.name_en)}')">
      <span class="suggestion-chip-emoji">${r.emoji || '🛒'}</span>
      <span class="suggestion-chip-name">${esc(r.name_en)}</span>
      ${r.name_it ? `<span class="suggestion-chip-lang">${lang}</span>` : ''}
      <span class="suggestion-chip-aisle">${esc(aisle.label === 'General' ? 'General' : aisle.label.replace(/^Aisle\s*/i, 'A'))}</span>
    </div>`;
  }).join('');

  const exact = results.some(r => r.name_en.toLowerCase() === query.toLowerCase() || (r.name_it || '').toLowerCase() === query.toLowerCase());
  let newChip = '';
  if (!exact && query) {
    const meta = Store.resolveItemMeta(query);
    newChip = `<div class="suggestion-chip suggestion-new" onclick="selectSugg('${esc(query)}')">
      <span class="suggestion-chip-emoji">${meta.emoji || '🛒'}</span>
      <span class="suggestion-chip-name">${esc(query)}</span>
      <span class="suggestion-chip-lang">New</span>
    </div>`;
  }

  box.innerHTML = `<div class="suggestions-grid">${chips}${newChip}</div>`;
  positionSuggestions();
  box.classList.remove('hidden');
}

function selectSugg(name) {
  itemInput.value = name;
  hideSuggestions();
  document.getElementById('qty-input').focus();
}

function hideSuggestions() {
  const box = document.getElementById('suggestions');
  box.classList.add('hidden');
  box.innerHTML = '';
  suggHL = -1;
}

document.addEventListener('click', e => { if (!e.target.closest('.add-input-wrap')) hideSuggestions(); });

/* ── New List Modal ─────────────────────────────────────────────────── */
function openNewListModal() {
  const picker = document.getElementById('emoji-picker');
  picker.innerHTML = LIST_EMOJIS.map(e =>
    `<span class="emoji-opt ${e === S.selectedEmoji ? 'selected' : ''}" onclick="pickEmoji('${e}')">${e}</span>`
  ).join('');

  const sel = document.getElementById('new-list-super');
  sel.innerHTML = S.supermarkets.map(s =>
    `<option value="${s.id}" ${s.isDefault ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`
  ).join('');

  document.getElementById('new-list-name').value = '';
  openModal('modal-new-list');
  setTimeout(() => document.getElementById('new-list-name').focus(), 50);
}

function pickEmoji(e) {
  S.selectedEmoji = e;
  document.querySelectorAll('.emoji-opt').forEach(el => el.classList.toggle('selected', el.textContent === e));
}

function createList() {
  const name = document.getElementById('new-list-name').value.trim();
  const supermarketId = document.getElementById('new-list-super').value;
  if (!name) return;
  const list = Store.createList({ name, emoji: S.selectedEmoji, supermarketId });
  S.lists = Store.getLists();
  renderListsScreen();
  closeModal('modal-new-list');
  openList(list.id);
}

document.getElementById('new-list-name').addEventListener('keydown', e => { if (e.key === 'Enter') createList(); });

/* ── Delete List ────────────────────────────────────────────────────── */
function deleteListConfirm() {
  if (!S.currentListId) return;
  if (!confirm('Delete this list and all items?')) return;
  Store.deleteList(S.currentListId);
  S.lists = Store.getLists();
  goBack();
}

/* ── Item Edit Modal ────────────────────────────────────────────────── */
function openItemEdit(id) {
  const item = S.items.find(i => i.id === id);
  if (!item) return;
  S.editingItemId = id;
  document.getElementById('item-modal-title').textContent = item.name;
  document.getElementById('edit-qty').value  = item.quantity || '';
  document.getElementById('edit-note').value = (item.note || '').replace(/^Gluten Free\s*([—\-,;]\s*)?/i, '').trim();
  document.getElementById('edit-gluten-free').checked = /gluten free/i.test(item.note || '');

  const isEdible = EDIBLE_CATEGORIES.has(item.category);
  document.getElementById('edit-gluten-free').closest('.checkbox-label').style.display = isEdible ? '' : 'none';

  openModal('modal-item');
}

function saveItemEdit() {
  const id = S.editingItemId; if (!id) return;
  const qty = document.getElementById('edit-qty').value.trim();
  const glutenFree = document.getElementById('edit-gluten-free').checked;
  const extraNote  = document.getElementById('edit-note').value.trim();
  const note = [glutenFree ? 'Gluten Free' : '', extraNote].filter(Boolean).join(' — ');
  const updated = Store.updateItem(S.currentListId, id, { quantity: qty, note });
  const idx = S.items.findIndex(i => i.id === id);
  if (idx >= 0) S.items[idx] = updated;
  renderItems();
  closeModal('modal-item');
}

/* ── Catalogue Edit ─────────────────────────────────────────────────── */
function openCatalogueEdit() {
  const item = S.items.find(i => i.id === S.editingItemId);
  if (!item) return;

  const emoji = item.emoji || '🛒';
  document.getElementById('cat-emoji').value = emoji;
  document.getElementById('cat-emoji-preview').textContent = emoji;
  document.getElementById('cat-name-en').value  = item.name || '';
  document.getElementById('cat-name-it').value  = item.nameDisplay !== item.name ? (item.nameDisplay || '') : '';
  document.getElementById('cat-category').value = item.category || '';

  const grid = document.getElementById('cat-emoji-grid');
  grid.innerHTML = SUGGESTED_EMOJIS.map(e =>
    `<button class="cat-emoji-btn${e === emoji ? ' selected' : ''}" onclick="pickCatEmoji('${e}')">${e}</button>`
  ).join('');

  const emojiInput = document.getElementById('cat-emoji');
  emojiInput.oninput = () => {
    document.getElementById('cat-emoji-preview').textContent = emojiInput.value || '🛒';
  };

  const savedId = S.editingItemId;
  closeModal('modal-item');
  S.editingItemId = savedId;
  openModal('modal-catalogue');
}

function pickCatEmoji(e) {
  document.getElementById('cat-emoji').value = e;
  document.getElementById('cat-emoji-preview').textContent = e;
  document.querySelectorAll('.cat-emoji-btn').forEach(b => b.classList.toggle('selected', b.textContent === e));
}

function saveCatalogueEdit() {
  const item = S.items.find(i => i.id === S.editingItemId);
  if (!item) return;

  const nameEn  = document.getElementById('cat-name-en').value.trim();
  if (!nameEn) { alert('Name is required'); return; }
  const body = {
    emoji: document.getElementById('cat-emoji').value.trim() || '🛒',
    nameEn,
    nameIt: document.getElementById('cat-name-it').value.trim(),
    category: document.getElementById('cat-category').value || 'General',
  };

  Store.upsertCustomItem(body);
  const updated = Store.updateItem(S.currentListId, item.id, { name: body.nameEn, emoji: body.emoji, category: body.category });
  const idx = S.items.findIndex(i => i.id === item.id);
  if (idx >= 0) S.items[idx] = updated;
  renderItems();

  closeModal('modal-catalogue');
  showToast('Catalogue updated');
}

/* ── Frequent Items ─────────────────────────────────────────────────── */
let freqSelected = new Set();

function openFrequent() {
  freqSelected = new Set();
  const items = Store.getFrequentItems(30);
  const list = document.getElementById('freq-list');
  if (!items.length) {
    list.innerHTML = '<p class="freq-empty">No data yet — start adding items to your lists!</p>';
  } else {
    const inList = new Set(S.items.map(i => i.name.toLowerCase()));
    list.innerHTML = items.map(item => {
      const already = inList.has(item.name.toLowerCase());
      return `<div class="freq-row${already ? ' selected' : ''}" onclick="toggleFreq(this,'${esc(item.name)}')" data-name="${esc(item.name)}">
        <div class="freq-check">${already ? '✓' : ''}</div>
        <span class="freq-emoji">${item.emoji || '🛒'}</span>
        <div class="freq-info">
          <div class="freq-name">${esc(item.name)}</div>
          <div class="freq-meta">${esc(item.category)}</div>
        </div>
        <span class="freq-count">×${item.count}</span>
      </div>`;
    }).join('');
    items.filter(i => inList.has(i.name.toLowerCase())).forEach(i => freqSelected.add(i.name));
  }
  document.getElementById('freq-overlay').classList.remove('hidden');
  document.getElementById('freq-sheet').classList.remove('hidden');
  document.getElementById('freq-sheet').classList.add('open');
}

function toggleFreq(el, name) {
  el.classList.toggle('selected');
  const check = el.querySelector('.freq-check');
  if (el.classList.contains('selected')) { freqSelected.add(name); check.textContent = '✓'; }
  else { freqSelected.delete(name); check.textContent = ''; }
}

function closeFrequent() {
  document.getElementById('freq-sheet').classList.remove('open');
  document.getElementById('freq-overlay').classList.add('hidden');
  setTimeout(() => document.getElementById('freq-sheet').classList.add('hidden'), 280);
}

function addFreqSelected() {
  if (!S.currentListId) return;
  const inList = new Set(S.items.map(i => i.name.toLowerCase()));
  const toAdd = [...freqSelected].filter(n => !inList.has(n.toLowerCase()));
  closeFrequent();
  toAdd.forEach(name => {
    const item = Store.addItem(S.currentListId, { name, quantity: '' });
    S.items.push(item);
  });
  renderItems();
  if (toAdd.length) showToast(`Added ${toAdd.length} item${toAdd.length > 1 ? 's' : ''}`);
}

/* ── Settings Screen ────────────────────────────────────────────────── */
function openSettings() {
  renderSettingsScreen();
  showScreen('screen-settings');
}

function renderSettingsScreen() {
  const list = document.getElementById('settings-supermarkets-list');
  list.innerHTML = S.supermarkets.map(s => `
    <div class="settings-row" onclick="openAisles('${s.id}')">
      <span class="settings-row-emoji">${s.emoji}</span>
      <div class="settings-row-info">
        <div class="settings-row-name">${esc(s.name)}${s.isDefault ? ' <span class="list-card-super">Default</span>' : ''}</div>
        <div class="settings-row-meta">${[s.city, s.country].filter(Boolean).map(esc).join(', ') || 'Tap to edit aisles'}</div>
      </div>
      <div class="settings-row-actions">
        <button class="icon-btn" onclick="event.stopPropagation();editSupermarket('${s.id}')" title="Edit">✏️</button>
        <button class="icon-btn" onclick="event.stopPropagation();deleteSupermarketConfirm('${s.id}')" title="Delete">🗑</button>
      </div>
    </div>`).join('');
}

function openSupermarketModal() {
  S.editingSupermarketId = null;
  document.getElementById('modal-supermarket-title').textContent = 'Add supermarket';
  document.getElementById('super-emoji').value = '🛒';
  document.getElementById('super-name').value = '';
  document.getElementById('super-city').value = '';
  document.getElementById('super-country').value = '';
  openModal('modal-supermarket');
}

function editSupermarket(id) {
  const s = S.supermarkets.find(x => x.id === id);
  if (!s) return;
  S.editingSupermarketId = id;
  document.getElementById('modal-supermarket-title').textContent = 'Edit supermarket';
  document.getElementById('super-emoji').value = s.emoji;
  document.getElementById('super-name').value = s.name;
  document.getElementById('super-city').value = s.city || '';
  document.getElementById('super-country').value = s.country || '';
  openModal('modal-supermarket');
}

function saveSupermarket() {
  const name = document.getElementById('super-name').value.trim();
  if (!name) { alert('Name is required'); return; }
  const fields = {
    name,
    emoji: document.getElementById('super-emoji').value.trim() || '🛒',
    city: document.getElementById('super-city').value.trim(),
    country: document.getElementById('super-country').value.trim(),
  };
  if (S.editingSupermarketId) Store.updateSupermarket(S.editingSupermarketId, fields);
  else Store.createSupermarket(fields);
  S.supermarkets = Store.getSupermarkets();
  renderSettingsScreen();
  closeModal('modal-supermarket');
}

function deleteSupermarketConfirm(id) {
  if (S.supermarkets.length <= 1) { showToast('You need at least one supermarket'); return; }
  if (!confirm('Delete this supermarket and its aisle layout? Lists using it will move to your other supermarket.')) return;
  Store.deleteSupermarket(id);
  S.supermarkets = Store.getSupermarkets();
  renderSettingsScreen();
}

/* ── Aisles Screen ──────────────────────────────────────────────────── */
function openAisles(supermarketId) {
  S.settingsSupermarketId = supermarketId;
  renderAislesScreen();
  showScreen('screen-aisles');
}

function backToSettings() {
  showScreen('screen-settings');
}

function renderAislesScreen() {
  const sup = S.supermarkets.find(s => s.id === S.settingsSupermarketId);
  document.getElementById('aisles-title').textContent = sup ? `${sup.emoji} ${sup.name}` : 'Aisles';
  const rows = Store.getAisles(S.settingsSupermarketId);
  const list = document.getElementById('aisles-list');
  if (!rows.length) {
    list.innerHTML = `<p class="muted" style="padding:16px">No aisles yet. Add your store's aisles below — items in a matching category will group under them automatically.</p>`;
    return;
  }
  list.innerHTML = rows.map((a, idx) => `
    <div class="aisle-row">
      <span class="aisle-row-emoji">${a.emoji}</span>
      <div class="aisle-row-info">
        <div class="aisle-row-label">${esc(a.label)}</div>
        <div class="aisle-row-category">${esc(a.category)}</div>
      </div>
      <div class="aisle-row-actions">
        <button class="icon-btn" onclick="moveAisle('${a.id}',-1)" ${idx === 0 ? 'disabled' : ''} title="Move up">▲</button>
        <button class="icon-btn" onclick="moveAisle('${a.id}',1)" ${idx === rows.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
        <button class="icon-btn" onclick="editAisle('${a.id}')" title="Edit">✏️</button>
        <button class="icon-btn" onclick="deleteAisleConfirm('${a.id}')" title="Delete">🗑</button>
      </div>
    </div>`).join('');
}

function moveAisle(id, dir) {
  const rows = Store.getAisles(S.settingsSupermarketId);
  const idx = rows.findIndex(a => a.id === id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= rows.length) return;
  [rows[idx], rows[swapIdx]] = [rows[swapIdx], rows[idx]];
  Store.reorderAisles(S.settingsSupermarketId, rows.map(a => a.id));
  renderAislesScreen();
}

function populateCategorySelect(selectId) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function openAisleModal() {
  S.editingAisleId = null;
  document.getElementById('modal-aisle-title').textContent = 'Add aisle';
  populateCategorySelect('aisle-category');
  document.getElementById('aisle-emoji').value = '🛒';
  document.getElementById('aisle-label').value = '';
  document.getElementById('aisle-category').value = 'General';
  openModal('modal-aisle');
}

function editAisle(id) {
  const a = Store.getAisles(S.settingsSupermarketId).find(x => x.id === id);
  if (!a) return;
  S.editingAisleId = id;
  document.getElementById('modal-aisle-title').textContent = 'Edit aisle';
  populateCategorySelect('aisle-category');
  document.getElementById('aisle-emoji').value = a.emoji;
  document.getElementById('aisle-label').value = a.label;
  document.getElementById('aisle-category').value = a.category;
  openModal('modal-aisle');
}

function saveAisle() {
  const label = document.getElementById('aisle-label').value.trim();
  if (!label) { alert('Label is required'); return; }
  const fields = {
    label,
    emoji: document.getElementById('aisle-emoji').value.trim() || '🛒',
    category: document.getElementById('aisle-category').value,
  };
  if (S.editingAisleId) Store.updateAisle(S.editingAisleId, fields);
  else Store.createAisle(S.settingsSupermarketId, fields);
  renderAislesScreen();
  closeModal('modal-aisle');
}

function deleteAisleConfirm(id) {
  if (!confirm('Delete this aisle?')) return;
  Store.deleteAisle(id);
  renderAislesScreen();
}

/* ── Backup / Restore ───────────────────────────────────────────────── */
function exportData() {
  const blob = new Blob([Store.exportData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `supermarket-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
}

function triggerImport() {
  document.getElementById('import-file-input').click();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('Importing will replace all current lists, items and settings on this device. Continue?')) {
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      Store.importData(reader.result);
      location.reload();
    } catch (err) {
      alert('Invalid backup file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ── Modal helpers ──────────────────────────────────────────────────── */
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); S.editingItemId = null; }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
});

/* ── Toast ──────────────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

/* ── Save-for-future prompt ─────────────────────────────────────────── */
function showSavePrompt(item) {
  const el = document.getElementById('save-prompt');
  document.getElementById('save-prompt-name').textContent = item.name;
  document.getElementById('save-prompt-icon').textContent = item.emoji || '🛒';
  el.classList.remove('hidden');
  el._item = item;
}

function savePromptYes() {
  const el = document.getElementById('save-prompt');
  const item = el._item;
  el.classList.add('hidden');
  if (!item) return;
  Store.upsertCustomItem({
    emoji: item.emoji || '🛒',
    nameEn: item.name,
    nameIt: '',
    category: item.category || 'General',
  });
  showToast(`"${item.name}" saved for future use`);
}

function savePromptNo() {
  document.getElementById('save-prompt').classList.add('hidden');
}

/* ── Escape ─────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
