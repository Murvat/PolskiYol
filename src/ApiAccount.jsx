import { useState } from 'react';
import { Link } from 'react-router-dom';
import { assignTeacher, loginAccount, logoutAccount, registerAccount } from './dotnetApi.js';

export default function ApiAccount({ user }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const admin = user?.roles.includes('Admin');

  async function run(operation) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    void run(async () => {
      if (admin) {
        await assignTeacher(fields);
        setNotice('Müəllim təyin edildi.');
      } else if (mode === 'login') {
        await loginAccount(fields);
        window.location.assign('/');
      } else {
        await registerAccount(mode, fields);
        await loginAccount({ email: fields.email, password: fields.password });
        window.location.assign('/');
      }
    });
  }

  return (
    <main className="error-screen">
      <span className="brand-mark" aria-hidden="true">P<span>•</span></span>
      <h1>{user ? 'Hesabım' : mode === 'login' ? 'Daxil ol' : 'Qeydiyyat'}</h1>
      {user && <p>{user.email}</p>}
      {(!user || admin) && (
        <form onSubmit={submit} className="grid gap-3 text-left w-full max-w-sm">
          {admin ? (
            <>
              <label>Tələbənin e-poçtu <input className="w-full rounded border p-2" name="studentEmail" type="email" required /></label>
              <label>Müəllimin e-poçtu <input className="w-full rounded border p-2" name="teacherEmail" type="email" required /></label>
            </>
          ) : (
            <>
              <label>E-poçt <input className="w-full rounded border p-2" name="email" type="email" autoComplete="username" required /></label>
              <label>Şifrə <input className="w-full rounded border p-2" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 12} required /></label>
              {mode !== 'login' && (
                <>
                  <label>Ad <input className="w-full rounded border p-2" name="firstName" autoComplete="given-name" maxLength={100} required /></label>
                  <label>Soyad <input className="w-full rounded border p-2" name="lastName" autoComplete="family-name" maxLength={100} required /></label>
                  <label>Telefon <input className="w-full rounded border p-2" name="phoneNumber" type="tel" autoComplete="tel" maxLength={30} required /></label>
                </>
              )}
            </>
          )}
          <button className="btn primary" disabled={busy}>{admin ? 'Müəllim təyin et' : mode === 'login' ? 'Daxil ol' : 'Hesab yarat'}</button>
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!user ? (
        <div className="flex flex-wrap justify-center gap-3">
          {mode !== 'login' && <button className="text-link" onClick={() => setMode('login')}>Daxil ol</button>}
          {mode !== 'student' && <button className="text-link" onClick={() => setMode('student')}>Tələbə qeydiyyatı</button>}
          {mode !== 'teacher' && <button className="text-link" onClick={() => setMode('teacher')}>Müəllim qeydiyyatı</button>}
          <Link className="text-link" to="/?demo=student">Nümunə görünüşü</Link>
        </div>
      ) : (
        <div className="flex gap-3">
          {!admin && <Link className="btn primary" to="/">Portala keç</Link>}
          <button className="btn secondary" disabled={busy} onClick={() => run(async () => {
            await logoutAccount();
            window.location.assign('/account');
          })}>Çıxış</button>
        </div>
      )}
    </main>
  );
}
