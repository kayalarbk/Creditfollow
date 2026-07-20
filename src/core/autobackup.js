import { toast } from '../ui/toast.js';

const DB_NAME = 'kartpanel_fs';
const IDB_STORE = 'handles';
const HANDLE_KEY = 'autoBackupFile';
const WRITE_DELAY = 800;

/* FileSystemFileHandle localStorage'a yazılamaz; IndexedDB structured clone destekler. */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, val) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(val, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDel(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Otomatik dosya yedeği: kullanıcının seçtiği JSON dosyasına her değişiklikte yazar.
 * Tarayıcı site verilerini silse bile dosya diskte kaldığından veri kaybolmaz.
 * File System Access API gerektirir (masaüstü Chrome/Edge).
 */
export const AutoBackup = {
  handle: null,
  status: 'showSaveFilePicker' in window ? 'off' : 'unsupported', // off | on | needs-permission | unsupported
  writeTimer: null,
  pendingData: null,
  warnedWrite: false,

  isSupported() {
    return this.status !== 'unsupported';
  },

  fileName() {
    return this.handle ? this.handle.name : '';
  },

  /**
   * Kayıtlı dosya tanıtıcısını yükler.
   * Dönüş: null (kapalı) | 'needs-permission' | dosyadaki veri (object).
   */
  async init() {
    if (!this.isSupported()) return null;
    try { this.handle = (await idbGet(HANDLE_KEY)) || null; } catch { this.handle = null; }
    if (!this.handle) return null;

    let perm = 'prompt';
    try { perm = await this.handle.queryPermission({ mode: 'readwrite' }); } catch { /* eski API yoksa prompt say */ }
    if (perm !== 'granted') {
      this.status = 'needs-permission';
      return 'needs-permission';
    }
    this.status = 'on';
    return this.readFile();
  },

  /** Kullanıcı tıklamasıyla çağrılmalı: izni yeniler, dosyadaki veriyi döner. */
  async reconnect() {
    if (!this.handle) return null;
    const perm = await this.handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return null;
    this.status = 'on';
    return this.readFile();
  },

  /** Kullanıcı tıklamasıyla çağrılmalı: yedek dosyasını seçtirir ve ilk yazımı yapar. */
  async enable(data) {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'kartpanel-otomatik-yedek.json',
      types: [{ description: 'JSON yedeği', accept: { 'application/json': ['.json'] } }]
    });
    this.handle = handle;
    this.status = 'on';
    this.warnedWrite = false;
    try { await idbSet(HANDLE_KEY, handle); } catch { /* tanıtıcı saklanamazsa oturum boyu yine çalışır */ }
    await this.writeNow(data);
  },

  async disable() {
    this.handle = null;
    this.status = 'off';
    clearTimeout(this.writeTimer);
    this.pendingData = null;
    try { await idbDel(HANDLE_KEY); } catch { /* yoksay */ }
  },

  async readFile() {
    try {
      const file = await this.handle.getFile();
      const text = await file.text();
      if (!text.trim()) return null;
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.cards) || !Array.isArray(parsed.transactions)) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  /** Ardışık kayıtları tek yazıma indirger; Store.save() her çağrıda tetikler. */
  schedule(data) {
    if (this.status !== 'on') return;
    this.pendingData = data;
    clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => this.writeNow(this.pendingData), WRITE_DELAY);
  },

  async writeNow(data) {
    if (this.status !== 'on' || !data) return;
    clearTimeout(this.writeTimer);
    this.pendingData = null;
    try {
      const writable = await this.handle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      this.warnedWrite = false;
    } catch {
      if (!this.warnedWrite) {
        this.warnedWrite = true;
        toast('Otomatik yedek dosyasına yazılamadı. Dosya taşınmış veya silinmiş olabilir; Ayarlar\'dan yeniden seçin.', 'danger');
      }
    }
  }
};

// Sekme kapanırken/gizlenirken bekleyen yazımı kaçırma
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && AutoBackup.pendingData) {
    AutoBackup.writeNow(AutoBackup.pendingData);
  }
});
