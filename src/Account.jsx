import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, ShieldCheck } from 'lucide-react';
import { Tabs } from 'radix-ui';
import { Link, useNavigate } from 'react-router-dom';

function AccountStory() {
  return (
    <div className="account-story">
      <Link to="/" className="brand">
        <span className="brand-mark">P<span>•</span></span>
        Polski<span>Yol</span>
      </Link>
      <div className="account-story-main">
        <span className="eyebrow">AZƏRBAYCANCADAN POLYAKCAYA</span>
        <h1>
          Yeni dil.<br />
          Yeni imkanlar.<br />
          <em>Sənin yolun.</em>
        </h1>
        <p>Müəllimin, dərslərin və öyrənmək üçün lazım olan hər şey bir yerdə.</p>
        <div className="language-pair">
          <span>Salam!</span>
          <ArrowRight aria-hidden="true" />
          <span lang="pl">Cześć!</span>
        </div>
      </div>
      <p className="account-story-footer">Birlikdə, addım-addım. 🇦🇿 → 🇵🇱</p>
    </div>
  );
}

function EnrollmentForm({ mode, invite, error, busy, onSubmit }) {
  const tutor = mode === 'tutor';

  return (
    <form onSubmit={onSubmit} className="form-grid">
      {tutor ? (
        <>
          <label>
            Adınız
            <input name="name" defaultValue="Murvat" required maxLength={180} autoComplete="name" />
          </label>
          <p className="form-hint">
            Artıq aktiv hesabınız varsa, <Link to="/">portala keçin</Link>. İlk quraşdırma üçün
            sizə verilmiş aktivləşdirmə kodunu daxil edin.
          </p>
        </>
      ) : (
        <p className="form-hint">Müəlliminizin sizə göndərdiyi dəvət kodunu daxil edin.</p>
      )}
      <label>
        {tutor ? 'Aktivləşdirmə kodu' : 'Dəvət kodu'}
        <input
          name="code"
          type="password"
          defaultValue={tutor ? '' : invite}
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Kodu buraya daxil edin"
        />
      </label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="btn primary full" disabled={busy}>
        {busy ? 'Yoxlanılır…' : tutor ? 'Müəllim hesabını aktivləşdir' : 'Dərslərimə qoşul'}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}

const accountModes = [
  { value: 'tutor', label: 'Müəllim' },
  { value: 'student', label: 'Tələbə' },
];

function AccountEnrollment({ user, signOut, invite, mutate }) {
  const [mode, setMode] = useState(invite ? 'student' : 'tutor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    setError('');
    setBusy(true);

    const fields = new FormData(event.currentTarget);
    const code = fields.get('code');
    const payload = mode === 'tutor'
      ? { action: 'activate', code, name: fields.get('name') }
      : { action: 'join', code };
    try {
      await mutate(payload);
      navigate('/', { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="signed-account">
        <ShieldCheck size={19} aria-hidden="true" />
        <div>
          <strong>Hesab təsdiqləndi</strong>
          <span>{user.email}</span>
        </div>
        <a href={signOut} target="_top">Çıxış</a>
      </div>
      <Tabs.Root
        value={mode}
        onValueChange={value => {
          setMode(value);
          setError('');
        }}
      >
        <Tabs.List className="account-tabs flex w-full gap-1 rounded-lg bg-[#f1f5ee] p-1" aria-label="Hesab növü">
          {accountModes.map(({ value, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              disabled={busy}
              data-slot="tabs-trigger"
              className="flex-1 rounded-md px-3 font-medium text-[#52674c] data-[state=active]:bg-white data-[state=active]:text-[#32563b] data-[state=active]:shadow-sm"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {accountModes.map(({ value }) => (
          <Tabs.Content key={value} value={value} className="outline-offset-2">
            {mode === value && (
              <EnrollmentForm mode={mode} invite={invite} error={error} busy={busy} onSubmit={submit} />
            )}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </>
  );
}

export default function Account({ user, signIn, signOut, invite, mutate }) {
  return (
    <main className="account-page">
      <AccountStory />
      <div className="account-form-wrap">
        <Link to="/" className="text-link">
          <ArrowLeft size={16} aria-hidden="true" /> Portala qayıt
        </Link>
        <div className="account-form">
          <div className="account-icon"><GraduationCap size={30} aria-hidden="true" /></div>
          <h2>PolskiYol-a xoş gəldin</h2>
          <p className="muted">Öyrənmə yoluna buradan davam et.</p>
          {user ? (
            <AccountEnrollment key={invite} user={user} signOut={signOut} invite={invite} mutate={mutate} />
          ) : (
            <>
              <a className="btn primary full auth-button" href={signIn} target="_top">
                <ShieldCheck size={19} aria-hidden="true" /> ChatGPT ilə daxil ol
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <p className="fineprint">
                Hesabına təhlükəsiz daxil ol, sonra müəlliminin dəvət kodunu istifadə et.
              </p>
            </>
          )}
          <div className="account-divider"><span>və ya</span></div>
          <Link className="btn secondary full" to="/?demo=student">
            <BookOpen size={18} aria-hidden="true" /> Nümunə tələbə panelinə bax
          </Link>
        </div>
        <p className="account-legal">
          <ShieldCheck size={14} aria-hidden="true" /> Şəxsi dərslərin. Təhlükəsiz məkanın.
        </p>
      </div>
    </main>
  );
}
