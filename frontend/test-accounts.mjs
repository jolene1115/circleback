import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k)};
globalThis.window = {scrollTo() {}};
globalThis.document = {getElementById() { return null; }};
const guest = {id:'guest-1', topic:'Guest', date:'Oct 17, 2026', turns:[{q:'Old question',a:'Old answer'}]};
localStorage.setItem('cadence-sessions-v1', JSON.stringify([guest]));
let user = null;
let offline = false;
const archives = new Map();
globalThis.fetch = async (url, options) => {
  if (offline) throw new Error('Offline');
  const path = url.replace('/api/account/', '');
  let data;
  if (path === 'login') {
    const {email} = JSON.parse(options.body);
    user = {id: email, name:email};
    if (!archives.has(email)) archives.set(email, new Map());
    data = user;
  } else if (path === 'me') return {ok:false,json:async () => ({error:'Not logged in'})};
  else if (path === 'logout') {user=null; data={ok:true};}
  else if (path === 'history') {
    for (const entry of JSON.parse(options.body).entries) archives.get(user.id).set(entry.id, entry);
    data = {saved:true};
  } else if (path.startsWith('history?')) data = [...archives.get(user.id).values()];
  else throw new Error('Unexpected request: ' + path);
  return {ok:true,json:async () => data};
};
const store = await import('./src/store.js');

test('account switching, explicit guest import, and offline recovery preserve separate histories', async () => {
  await store.initializeAccount();
  assert.equal(store.getState().sessions[0].id, 'guest-1');
  store.explorePractice();
  assert.equal(store.getState().view, 'account');
  store.continueAsGuest();
  assert.equal(store.getState().view, 'home');
  assert.equal(store.getState().showPracticeChoices, true);
  assert.equal(store.getState().user, null);
  await store.authenticate('login', {email:'alice'});
  assert.equal(store.getState().view, 'home');
  assert.equal(store.getState().showPracticeChoices, true);
  assert.deepEqual(store.getState().sessions, []);
  assert.equal(store.guestHistoryCount(), 1);
  await store.importGuestHistory();
  assert.equal(archives.get('alice').size, 1);
  assert.equal(store.guestHistoryCount(), 0);
  offline = true;
  store.finishSession([{q:'New question',a:'New answer'}]);
  await assert.rejects(store.syncHistory());
  assert.match(store.getState().syncError, /not synced/);
  assert.equal(JSON.parse(localStorage.getItem('circleback-account-history-alice')).length, 2);
  offline = false;
  await store.syncHistory();
  assert.equal(archives.get('alice').size, 2);
  await store.logoutAccount();
  assert.equal(store.getState().view, 'home');
  assert.equal(store.getState().showPracticeChoices, false);
  assert.deepEqual(store.getState().sessions, []);
  await store.authenticate('login', {email:'bob'});
  assert.deepEqual(store.getState().sessions, []);
  await store.logoutAccount();
  await store.authenticate('login', {email:'alice'});
  assert.equal(store.getState().sessions.length, 2);
});
