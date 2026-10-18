import React, {useState} from 'react';
import {continueAsGuest, authenticate, logoutAccount, syncHistory, importGuestHistory, guestHistoryCount, useAppState} from './store.js';
import './account.css';

export default function Account() {
  const {user, accountReady, syncError} = useAppState();
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function run(action) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (err) { setError(err.message || 'Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    run(() => authenticate(mode, fields));
  }
  return <section className="account-panel">
    <header className="page-head"><h1>{user ? 'Your profile' : 'Welcome'}</h1></header>
    {!accountReady ? <p>Checking your account…</p> : user ? <>
      <h2>{user.name}</h2><p>{user.email}</p>
      <p>Your interviews are saved to this account. Log in on another device at the same website to see them.</p>
      {!!guestHistoryCount() && <div className="account-import"><h3>Keep this browser’s previous interviews</h3>
        <p>{guestHistoryCount()} guest interviews are available. Import them only if they belong to you. They will be attached to {user.email}.</p>
        <button className="main-button" disabled={busy} onClick={() => run(async () => { await importGuestHistory(); setNotice('Previous interviews imported.'); })}>Import previous interviews</button>
      </div>}
      <button className="main-button" disabled={busy} onClick={() => run(async () => { await syncHistory(); setNotice('History is up to date.'); })}>Refresh history</button>
      <button className="text-button" disabled={busy} onClick={() => run(logoutAccount)}>Log out</button>
    </> : <>
      <p>Save your interview history across devices, or continue practicing as a guest.</p>
      <div className="account-tabs"><button aria-pressed={mode === 'login'} onClick={() => {setMode('login'); setError('');}} disabled={busy}>Log in</button>
        <button aria-pressed={mode === 'signup'} onClick={() => {setMode('signup'); setError('');}} disabled={busy}>Create account</button></div>
      <form key={mode} onSubmit={submit}>
        {mode === 'signup' && <label>Name<input name="name" autoComplete="name" required maxLength={80}/></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
        <label>Password<input name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={10} maxLength={128} required/></label>
        <small>Use at least 10 characters. Password recovery is not available yet.</small>
        <button className="main-button" disabled={busy} type="submit">{busy ? 'Connecting…' : mode === 'signup' ? 'Create account' : 'Log in'}</button>
      </form>
      <button className="text-button account-guest-button" disabled={busy} onClick={continueAsGuest}>Use as a guest</button>
    </>}
    {error && <p role="alert" className="account-error">{error}</p>}
    {syncError && <p role="alert" className="account-error">{syncError} Your local copy is kept on this device. Use Refresh history to retry.</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
