async function startup() {
  if (document.documentElement.classList.contains('refined-prun')) {
    // This message will trigger a reload for pre-24.12.18 builds.
    window.postMessage({ type: 'rp-reload-page' }, '*');
    return;
  }
  const userData = loadUserData();
  await waitDocumentReady();
  const container = document.createElement('refined-prun');
  document.documentElement.appendChild(container);
  const now = Date.now();
  const css = document.createElement('link');
  css.href = chrome.runtime.getURL('refined-prun.css') + '?' + now;
  css.rel = 'stylesheet';
  css.id = 'refined-prun-css';
  await new Promise(resolve => {
    css.onload = resolve;
    container.appendChild(css);
  });
  // This serialization is needed because accessing css.sheet in Firefox from the page script
  // will throw a CORS error.
  const rules: { [id: string]: string } = {};
  const sheet = css.sheet!;
  for (let i = 0; i < sheet.cssRules.length; i++) {
    const rule = sheet.cssRules.item(i);
    if (!rule) {
      continue;
    }
    rules[(rule as CSSStyleRule).selectorText] = rule.cssText;
  }
  css.textContent = JSON.stringify(rules);
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('refined-prun.js') + '?' + now;
  script.type = 'module';
  script.id = 'refined-prun-js';
  const config: RefinedPrunConfig = {
    userData: await userData,
    version: chrome.runtime.getManifest().version,
    url: {
      manifest: chrome.runtime.getURL('manifest.json'),
      allplanets: chrome.runtime.getURL('json/fallback-fio-responses/allplanets.json'),
    },
  };
  script.textContent = JSON.stringify(config);
  container.appendChild(script);
}

async function loadUserData() {
  const userDataKey = 'rp-user-data';
  const stored = await chrome.storage.local.get(userDataKey);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userData: any = stored[userDataKey];
  try {
    await mergeSyncedNotes(userData);
    await mergeSyncedFavorites(userData);
    if (userData) {
      await chrome.storage.local.set({ [userDataKey]: userData });
      sessionNoteIds = new Set((userData.notes as SyncNote[]).map(x => x.id));
    }
  } catch (e) {
    console.warn('Refined PrUn: notes sync failed on load', e);
  }
  window.addEventListener('message', async (e: MessageEvent) => {
    if (e.source !== window) {
      return;
    }
    if (e.data.type === 'rp-save-user-data') {
      await chrome.storage.local.set({
        [userDataKey]: e.data.userData,
      });
      window.postMessage({ type: 'rp-user-data-saved' }, '*');
      queueNotesPush(e.data.userData?.notes);
      queueFavoritesPush(e.data.userData?.conts?.favorites);
    }
  });
  return userData;
}

// Notes sync through storage.sync (Firefox Sync / Chrome Sync).
// Each note is stored as a meta entry plus text chunks, because storage.sync
// limits the size of one item. Deleted notes are kept as tombstones.

interface SyncNote {
  id: string;
  name: string;
  text: string;
}

interface SyncNoteMeta {
  id: string;
  name: string;
  updated: number;
  chunks: number;
  deleted?: boolean;
}

type SyncState = Record<string, { sig: string; updated: number }>;

const noteMetaPrefix = 'rp-note:';
const noteChunkPrefix = 'rp-notec:';
const syncStateKey = 'rp-notes-sync-state';
const chunkSize = 2000;

// Short hash of a note, so the local sync state does not duplicate the text.
function getNoteSignature(note: SyncNote) {
  const input = note.name + '\u0000' + note.text;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36) + ':' + input.length;
}

async function getSyncState(): Promise<SyncState> {
  const stored = await chrome.storage.local.get(syncStateKey);
  return (stored[syncStateKey] as SyncState | undefined) ?? {};
}

async function readSyncedNotes() {
  const all = await chrome.storage.sync.get(null);
  const metas = new Map<string, SyncNoteMeta>();
  for (const key of Object.keys(all)) {
    if (key.startsWith(noteMetaPrefix)) {
      const meta = all[key] as SyncNoteMeta;
      metas.set(meta.id, meta);
    }
  }
  const getText = (meta: SyncNoteMeta) => {
    let text = '';
    for (let i = 0; i < meta.chunks; i++) {
      text += (all[`${noteChunkPrefix}${meta.id}:${i}`] as string | undefined) ?? '';
    }
    return text;
  };
  return { metas, getText };
}

async function writeSyncedNote(note: SyncNote, updated: number, previousChunks: number) {
  const items: Record<string, unknown> = {};
  const chunks = Math.max(1, Math.ceil(note.text.length / chunkSize));
  for (let i = 0; i < chunks; i++) {
    items[`${noteChunkPrefix}${note.id}:${i}`] = note.text.slice(
      i * chunkSize,
      (i + 1) * chunkSize,
    );
  }
  const meta: SyncNoteMeta = { id: note.id, name: note.name, updated, chunks };
  items[noteMetaPrefix + note.id] = meta;
  await chrome.storage.sync.set(items);
  const extra: string[] = [];
  for (let i = chunks; i < previousChunks; i++) {
    extra.push(`${noteChunkPrefix}${note.id}:${i}`);
  }
  if (extra.length > 0) {
    await chrome.storage.sync.remove(extra);
  }
}

async function writeSyncedTombstone(id: string, updated: number, previousChunks: number) {
  const meta: SyncNoteMeta = { id, name: '', updated, chunks: 0, deleted: true };
  await chrome.storage.sync.set({ [noteMetaPrefix + id]: meta });
  const chunkKeys: string[] = [];
  for (let i = 0; i < previousChunks; i++) {
    chunkKeys.push(`${noteChunkPrefix}${id}:${i}`);
  }
  if (chunkKeys.length > 0) {
    await chrome.storage.sync.remove(chunkKeys);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mergeSyncedNotes(userData: any) {
  const state = await getSyncState();
  const { metas, getText } = await readSyncedNotes();
  const localNotes: SyncNote[] = Array.isArray(userData?.notes) ? userData.notes : [];
  const localById = new Map(localNotes.map(x => [x.id, x]));
  const now = Date.now();
  const merged: SyncNote[] = [];
  const newState: SyncState = {};

  for (const note of localNotes) {
    const sig = getNoteSignature(note);
    const known = state[note.id];
    const changedHere = known === undefined || known.sig !== sig;
    // A note changed on this PC since the last sync counts as the newest version.
    const localUpdated = changedHere ? now : known.updated;
    const remote = metas.get(note.id);
    const changedThere =
      remote !== undefined && known !== undefined && remote.updated > known.updated;
    if (changedHere && changedThere && !remote.deleted) {
      // Edited on both PCs since the last sync: keep both versions, lose nothing.
      const remoteText = getText(remote);
      if (remoteText !== note.text || remote.name !== note.name) {
        const copy = {
          id: `${note.id}-${remote.updated}`,
          name: `${remote.name} (other PC)`,
          text: remoteText,
        };
        merged.push(copy);
        newState[copy.id] = { sig: getNoteSignature(copy), updated: now };
        await writeSyncedNote(copy, now, 0);
      }
      merged.push(note);
      newState[note.id] = { sig, updated: now };
      await writeSyncedNote(note, now, remote.chunks);
      continue;
    }
    if (remote && remote.updated > localUpdated) {
      if (remote.deleted) {
        newState[note.id] = { sig: '', updated: remote.updated };
        continue;
      }
      const remoteNote = { id: note.id, name: remote.name, text: getText(remote) };
      merged.push(remoteNote);
      newState[note.id] = { sig: getNoteSignature(remoteNote), updated: remote.updated };
      continue;
    }
    merged.push(note);
    newState[note.id] = { sig, updated: localUpdated };
    if (!remote || remote.updated < localUpdated) {
      await writeSyncedNote(note, localUpdated, remote?.chunks ?? 0);
    }
  }

  for (const remote of metas.values()) {
    if (localById.has(remote.id) || remote.deleted) {
      continue;
    }
    // Missing on this PC: restore it. A note is only removed by an explicit deletion.
    const remoteNote = { id: remote.id, name: remote.name, text: getText(remote) };
    merged.push(remoteNote);
    newState[remote.id] = { sig: getNoteSignature(remoteNote), updated: remote.updated };
  }

  if (userData) {
    userData.notes = merged;
  }
  await chrome.storage.local.set({ [syncStateKey]: newState });
}

let pendingNotes: SyncNote[] | undefined;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
// Notes this tab has seen. Only a note that disappears from this set was deleted by the user
// in this tab. Other tabs or PCs never cause a deletion.
let sessionNoteIds: Set<string> | undefined;
const deletedInSession = new Set<string>();

function queueNotesPush(notes: SyncNote[] | undefined) {
  if (!Array.isArray(notes)) {
    return;
  }
  const ids = new Set(notes.map(x => x.id));
  if (sessionNoteIds) {
    for (const id of sessionNoteIds) {
      if (!ids.has(id)) {
        deletedInSession.add(id);
      }
    }
  }
  for (const id of ids) {
    deletedInSession.delete(id);
  }
  sessionNoteIds = ids;
  pendingNotes = notes;
  if (pushTimer !== undefined) {
    clearTimeout(pushTimer);
  }
  // Wait until typing stops, to stay far below the storage.sync write limits.
  pushTimer = setTimeout(async () => {
    pushTimer = undefined;
    try {
      await pushNotes();
    } catch (e) {
      console.warn('Refined PrUn: notes sync failed on save', e);
    }
  }, 5000);
}

async function pushNotes() {
  const notes = pendingNotes;
  if (!notes) {
    return;
  }
  const state = await getSyncState();
  const { metas } = await readSyncedNotes();
  const now = Date.now();
  for (const note of notes) {
    const sig = getNoteSignature(note);
    if (state[note.id]?.sig === sig) {
      continue;
    }
    await writeSyncedNote(note, now, metas.get(note.id)?.chunks ?? 0);
    state[note.id] = { sig, updated: now };
  }
  for (const id of deletedInSession) {
    await writeSyncedTombstone(id, now, metas.get(id)?.chunks ?? 0);
    state[id] = { sig: '', updated: now };
  }
  deletedInSession.clear();
  await chrome.storage.local.set({ [syncStateKey]: state });
}

// CONTD favorite recipients sync through storage.sync, like the notes.
// The newest list wins; a list changed on two PCs since the last sync is merged.

interface SyncFavorites {
  names: string[];
  updated: number;
}

const favoritesKey = 'rp-favorites';
const favoritesStateKey = 'rp-favorites-sync-state';

function getFavoritesSignature(names: string[]) {
  return names.join('\u0000');
}

async function getFavoritesState() {
  const stored = await chrome.storage.local.get(favoritesStateKey);
  return stored[favoritesStateKey] as { sig: string; updated: number } | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mergeSyncedFavorites(userData: any) {
  if (!userData) {
    return;
  }
  userData.conts ??= {};
  const local: string[] = Array.isArray(userData.conts.favorites) ? userData.conts.favorites : [];
  const state = await getFavoritesState();
  const stored = await chrome.storage.sync.get(favoritesKey);
  const remote = stored[favoritesKey] as SyncFavorites | undefined;
  const now = Date.now();
  const sig = getFavoritesSignature(local);
  const changedHere = state === undefined ? local.length > 0 : state.sig !== sig;
  const changedThere = remote !== undefined && remote.updated > (state?.updated ?? 0);
  let result = local;
  if (changedHere && changedThere) {
    const seen = new Set(local.map(x => x.toLowerCase()));
    result = [...local, ...remote.names.filter(x => !seen.has(x.toLowerCase()))];
  } else if (changedThere) {
    result = remote.names;
  }
  userData.conts.favorites = result;
  const updated = changedHere ? now : (remote?.updated ?? state?.updated ?? now);
  if (changedHere) {
    await chrome.storage.sync.set({ [favoritesKey]: { names: result, updated } });
  }
  await chrome.storage.local.set({
    [favoritesStateKey]: { sig: getFavoritesSignature(result), updated },
  });
}

let favoritesTimer: ReturnType<typeof setTimeout> | undefined;

function queueFavoritesPush(names: string[] | undefined) {
  if (!Array.isArray(names)) {
    return;
  }
  if (favoritesTimer !== undefined) {
    clearTimeout(favoritesTimer);
  }
  favoritesTimer = setTimeout(async () => {
    favoritesTimer = undefined;
    try {
      const state = await getFavoritesState();
      const sig = getFavoritesSignature(names);
      if (state?.sig === sig) {
        return;
      }
      const updated = Date.now();
      await chrome.storage.sync.set({ [favoritesKey]: { names, updated } });
      await chrome.storage.local.set({ [favoritesStateKey]: { sig, updated } });
    } catch (e) {
      console.warn('Refined PrUn: favorites sync failed on save', e);
    }
  }, 3000);
}

async function waitDocumentReady() {
  while (document.head === null || document.body === null) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

void startup();
