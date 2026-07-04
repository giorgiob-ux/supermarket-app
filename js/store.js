/* ── Local data layer ───────────────────────────────────────────────────
   Everything the reference app kept in SQLite lives in localStorage here.
   No network calls, no accounts — single device, single user. */
const STORAGE_KEY = 'supermarket_app_v1';

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function now() { return Math.floor(Date.now() / 1000); }

const Store = {
  data: null,

  load() {
    if (this.data) return this.data;
    const raw = localStorage.getItem(STORAGE_KEY);
    this.data = raw ? JSON.parse(raw) : this.seed();
    return this.data;
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  },

  seed() {
    const supermarketId = uid();
    const aisles = DEFAULT_SUPERMARKET_AISLES.map((a, idx) => ({
      id: uid(), supermarketId, aisleNumber: a.num, label: a.label,
      emoji: a.emoji, category: a.category, sortOrder: (idx + 1) * 10,
    }));
    return {
      lists: [],
      items: [],
      itemStats: {},
      supermarkets: [{
        id: supermarketId, name: 'Carrefour Mirdif City Centre', emoji: '🛒',
        city: 'Dubai', country: 'UAE', isDefault: true,
      }],
      aisles,
      customItems: [],
    };
  },

  // ── Supermarkets ─────────────────────────────────────────────────────
  getSupermarkets() { return this.load().supermarkets; },

  createSupermarket({ name, emoji, city, country }) {
    const d = this.load();
    const sup = { id: uid(), name, emoji: emoji || '🛒', city: city || '', country: country || '', isDefault: d.supermarkets.length === 0 };
    d.supermarkets.push(sup);
    this.save();
    return sup;
  },

  updateSupermarket(id, fields) {
    const d = this.load();
    const sup = d.supermarkets.find(s => s.id === id);
    if (!sup) return null;
    Object.assign(sup, fields);
    this.save();
    return sup;
  },

  setDefaultSupermarket(id) {
    const d = this.load();
    d.supermarkets.forEach(s => { s.isDefault = s.id === id; });
    this.save();
  },

  deleteSupermarket(id) {
    const d = this.load();
    if (d.supermarkets.length <= 1) return false;
    d.supermarkets = d.supermarkets.filter(s => s.id !== id);
    d.aisles = d.aisles.filter(a => a.supermarketId !== id);
    if (!d.supermarkets.some(s => s.isDefault)) d.supermarkets[0].isDefault = true;
    const fallbackId = d.supermarkets[0].id;
    d.lists.forEach(l => { if (l.supermarketId === id) l.supermarketId = fallbackId; });
    this.save();
    return true;
  },

  // ── Aisles ───────────────────────────────────────────────────────────
  getAisles(supermarketId) {
    return this.load().aisles
      .filter(a => a.supermarketId === supermarketId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  createAisle(supermarketId, { label, emoji, category }) {
    const d = this.load();
    const rows = this.getAisles(supermarketId);
    const maxOrder = rows.length ? Math.max(...rows.map(r => r.sortOrder)) : 0;
    const maxNum = rows.length ? Math.max(...rows.map(r => r.aisleNumber)) : 0;
    const aisle = {
      id: uid(), supermarketId, aisleNumber: maxNum + 1,
      label, emoji: emoji || '🛒', category: category || 'General',
      sortOrder: maxOrder + 10,
    };
    d.aisles.push(aisle);
    this.save();
    return aisle;
  },

  updateAisle(id, fields) {
    const d = this.load();
    const aisle = d.aisles.find(a => a.id === id);
    if (!aisle) return null;
    Object.assign(aisle, fields);
    this.save();
    return aisle;
  },

  deleteAisle(id) {
    const d = this.load();
    d.aisles = d.aisles.filter(a => a.id !== id);
    this.save();
  },

  reorderAisles(supermarketId, orderedIds) {
    const d = this.load();
    orderedIds.forEach((id, idx) => {
      const aisle = d.aisles.find(a => a.id === id);
      if (aisle) aisle.sortOrder = (idx + 1) * 10;
    });
    this.save();
  },

  resolveAisleForCategory(supermarketId, category) {
    const rows = this.getAisles(supermarketId);
    const match = rows.find(a => a.category === category);
    return match || GENERAL_AISLE;
  },

  // ── Lists ────────────────────────────────────────────────────────────
  getLists() { return this.load().lists; },

  createList({ name, emoji, supermarketId }) {
    const d = this.load();
    const list = { id: uid(), name, emoji: emoji || '🛒', supermarketId, createdAt: now(), updatedAt: now() };
    d.lists.unshift(list);
    this.save();
    return list;
  },

  updateList(id, fields) {
    const d = this.load();
    const list = d.lists.find(l => l.id === id);
    if (!list) return null;
    Object.assign(list, fields, { updatedAt: now() });
    this.save();
    return list;
  },

  deleteList(id) {
    const d = this.load();
    d.lists = d.lists.filter(l => l.id !== id);
    d.items = d.items.filter(i => i.listId !== id);
    this.save();
  },

  // ── Items ────────────────────────────────────────────────────────────
  getItems(listId) {
    return this.load().items
      .filter(i => i.listId === listId)
      .sort((a, b) => (a.checked - b.checked) || a.name.localeCompare(b.name));
  },

  addItem(listId, { name, quantity, note }) {
    const d = this.load();
    const list = d.lists.find(l => l.id === listId);
    const meta = this.resolveItemMeta(name);
    const isBuiltIn = ITEM_DB.some(i =>
      i.name_en.toLowerCase() === name.toLowerCase() ||
      (i.name_it && i.name_it.toLowerCase() === name.toLowerCase()));
    const isCustom = d.customItems.some(c =>
      c.nameEn.toLowerCase() === name.toLowerCase() ||
      (c.nameIt && c.nameIt.toLowerCase() === name.toLowerCase()));
    const unknown = !isBuiltIn && !isCustom;

    const item = {
      id: uid(), listId,
      name: meta.name_en, nameDisplay: meta.name_display,
      category: meta.category, emoji: meta.emoji,
      quantity: quantity || '', note: note || '',
      checked: 0, addedAt: now(),
    };
    d.items.push(item);
    if (list) list.updatedAt = now();

    const stats = d.itemStats[item.name] || { count: 0 };
    d.itemStats[item.name] = {
      emoji: item.emoji, category: item.category,
      count: stats.count + 1, lastAdded: now(),
    };
    this.save();
    return { ...item, unknown };
  },

  updateItem(listId, itemId, fields) {
    const d = this.load();
    const item = d.items.find(i => i.id === itemId);
    if (!item) return null;
    if (fields.checked !== undefined) fields.checked = fields.checked ? 1 : 0;
    Object.assign(item, fields);
    const list = d.lists.find(l => l.id === listId);
    if (list) list.updatedAt = now();
    this.save();
    return item;
  },

  removeItem(itemId) {
    const d = this.load();
    d.items = d.items.filter(i => i.id !== itemId);
    this.save();
  },

  clearChecked(listId) {
    const d = this.load();
    d.items = d.items.filter(i => !(i.listId === listId && i.checked));
    this.save();
  },

  // ── Frequent items ───────────────────────────────────────────────────
  getFrequentItems(limit = 30) {
    return Object.entries(this.load().itemStats)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.count - a.count || b.lastAdded - a.lastAdded)
      .slice(0, limit);
  },

  // ── Custom items catalogue ───────────────────────────────────────────
  getCustomItems() { return this.load().customItems; },

  upsertCustomItem({ nameEn, nameIt, category, emoji }) {
    const d = this.load();
    const existing = d.customItems.find(c => c.nameEn.toLowerCase() === nameEn.toLowerCase());
    if (existing) {
      Object.assign(existing, { nameIt, category, emoji });
      this.save();
      return existing;
    }
    const item = { id: uid(), nameEn, nameIt: nameIt || '', category, emoji, createdAt: now() };
    d.customItems.push(item);
    this.save();
    return item;
  },

  // ── Suggestions ──────────────────────────────────────────────────────
  getSuggestions(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const d = this.load();
    const custom = d.customItems
      .filter(c => c.nameEn.toLowerCase().includes(q) || (c.nameIt || '').toLowerCase().includes(q))
      .map(c => ({ name_en: c.nameEn, name_it: c.nameIt, category: c.category, emoji: c.emoji }));
    const seen = new Set(custom.map(i => i.name_en.toLowerCase()));
    const builtIn = ITEM_DB.filter(i =>
      (i.name_en.toLowerCase().includes(q) || (i.name_it && i.name_it.toLowerCase().includes(q))) &&
      !seen.has(i.name_en.toLowerCase()));
    return [...custom, ...builtIn].slice(0, 20);
  },

  // ── Item meta resolution (ported from server.js resolveItemMeta, minus
  //    the remote Claude fallback — keyword inference only, fully local) ──
  resolveItemMeta(inputName) {
    const d = this.load();
    const lower = inputName.toLowerCase().trim();

    let found = ITEM_DB.find(i => i.name_en.toLowerCase() === lower);
    if (!found) found = ITEM_DB.find(i => i.name_it && i.name_it.toLowerCase() === lower);

    if (!found) {
      const custom = d.customItems.find(c => c.nameEn.toLowerCase() === lower || (c.nameIt || '').toLowerCase() === lower);
      if (custom) return { name_en: custom.nameEn, name_display: inputName, category: custom.category, emoji: custom.emoji };
    }

    if (!found) {
      const words = lower.split(/\s+/).filter(w => w.length > 2);
      let bestScore = 0, bestItem = null;
      for (const item of ITEM_DB) {
        const enWords = item.name_en.toLowerCase().split(/[\s()&,]+/).filter(w => w.length > 2);
        const itWords = (item.name_it || '').toLowerCase().split(/[\s()&,]+/).filter(w => w.length > 2);
        const allWords = [...enWords, ...itWords];
        const score = words.reduce((s, w) => s + (allWords.some(iw => iw === w || (w.length >= 5 && iw.startsWith(w)) || (iw.length >= 5 && w.startsWith(iw))) ? 1 : 0), 0);
        if (score > bestScore) { bestScore = score; bestItem = item; }
      }
      if (bestScore > 0 && bestItem) {
        return { name_en: inputName, name_display: inputName, category: bestItem.category, emoji: bestItem.emoji };
      }
    }

    if (!found) return { name_en: inputName, name_display: inputName, category: 'General', emoji: inferEmoji(lower) || '🛒' };

    return { name_en: found.name_en, name_display: inputName, category: found.category, emoji: found.emoji };
  },

  // ── Backup / restore ─────────────────────────────────────────────────
  exportData() {
    return JSON.stringify(this.load(), null, 2);
  },

  importData(json) {
    const parsed = JSON.parse(json);
    if (!parsed.lists || !parsed.supermarkets) throw new Error('Invalid backup file');
    this.data = parsed;
    this.save();
  },
};
