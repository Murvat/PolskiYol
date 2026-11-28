import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, ChevronRight, Eye, Menu, Plus, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Link, Outlet, useMatches } from 'react-router-dom';
import { toast } from 'sonner';
import { portalError, useChangePortalMutation } from '../store.js';
import { Badge } from './shared.jsx';
import { sections, sectionPath } from './navigation.js';
import { warsawISO } from './format.js';
import Sidebar from './Sidebar.jsx';
import PortalDialogs from './PortalDialogs.jsx';
import { useBrowserTools } from './useBrowserTools.js';

export default function PortalLayout({ session, refresh }) {
  const { data, signIn, signOut, user } = session;
  const tutor = data.role === 'tutor';
  const section = useMatches().at(-1).handle.section;
  const page = sections[section];
  const href = (name) => sectionPath(name) + (data.demo ? '?demo=' + data.role : '');

  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [formError, setFormError] = useState('');
  const [selectedDay, setSelectedDay] = useState(data.today);
  const [conversation, setConversation] = useState(data.studentId || data.students[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const activeWrite = useRef(false);
  const [changePortal] = useChangePortalMutation();

  useLayoutEffect(() => {
    setModal(null);
    setConfirm(null);
    setMobileOpen(false);
  }, [section]);

  const open = useCallback((kind, item) => {
    setFormError('');
    setModal({ kind, item });
  }, []);
  useBrowserTools(data, open);

  const mutate = useCallback(async (payload, { quiet = false } = {}) => {
    if (data.demo) {
      if (!quiet) open('auth');
      throw new Error('Nümunə görünüşüdür. Dəyişiklik etmək üçün hesabınıza keçin.');
    }
    if (!quiet && activeWrite.current) throw new Error('Əvvəlki əməliyyat hələ tamamlanmayıb.');
    if (!quiet) {
      activeWrite.current = true;
      setBusy(true);
    }
    try {
      return await changePortal(payload).unwrap();
    } catch (error) {
      throw new Error(portalError(error));
    } finally {
      if (!quiet) {
        activeWrite.current = false;
        setBusy(false);
      }
    }
  }, [changePortal, data.demo, open]);

  async function quick(payload, message) {
    try {
      await mutate(payload);
      setModal(null);
      toast.success(message);
    } catch (error) {
      if (!data.demo) toast.error(error.message);
    }
  }

  async function invite(student) {
    try {
      const result = await mutate({ action: 'invite', id: student.id });
      setModal({ kind: 'invite', code: result.code });
    } catch (error) {
      if (!data.demo) toast.error(error.message);
    }
  }

  async function formSubmit(event) {
    event.preventDefault();
    if (!modal || busy) return;
    const { kind, item } = modal;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form);
    const payload = { ...values, action: 'save_' + kind };
    if (item?.id) payload.id = item.id;
    setFormError('');

    try {
      if (kind === 'student') payload.progress = Number(values.progress);
      if (kind === 'lesson') {
        payload.student_ids = form.getAll('student_ids');
        if (!payload.student_ids.length) throw new Error('Ən azı bir tələbə seçin.');
        payload.meeting_url = values.meeting_url ?? '';
        payload.duration = Number(values.duration);
        payload.starts_at = warsawISO(values.starts_at);
      }
      if (kind === 'payment') payload.amount = Math.round(Number(values.amount) * 100);

      const result = await mutate(payload);
      setModal(null);
      toast.success('Dəyişikliklər saxlanıldı.');
      if (kind === 'student' && !item?.id) await invite({ id: result.id });
    } catch (error) {
      if (!data.demo) setFormError(error.message);
    }
  }

  const student = (id) => data.students.find((item) => item.id === id);
  const pageProps = {
    data, tutor, href, open, invite, quick, setConfirm, selectedDay, setSelectedDay,
    student, conversation, setConversation, selectConversation: setConversation, mutate, busy, refresh,
  };
  const summary = section !== 'home' ? page.summary : tutor
    ? 'Yeni bir gün, yeni irəliləyişlər. Gəlin başlayaq.'
    : 'Cześć! Polyak dilində növbəti addımına hazırsan?';
  const sidebar = { data, section, href, signOut };
  const demoLink = (role) => sectionPath(section === 'students' && role === 'student' ? 'home' : section) + '?demo=' + role;

  return (
    <div data-slot="sidebar-wrapper" className="portal-layout flex min-h-svh w-full">
      <div className="portal-sidebar-rail sticky top-0 hidden h-svh shrink-0 md:block">
        <Sidebar {...sidebar} />
      </div>
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="portal-main min-w-0 flex-1">
          <header className="topbar">
            <div className="breadcrumb">
              <Dialog.Trigger asChild>
                <button type="button" className="mobile-menu icon-button" aria-label="Menyunu aç"><Menu size={20} /></button>
              </Dialog.Trigger>
              <span>İş məkanım</span><ChevronRight size={14} aria-hidden="true" /><strong>{page.label}</strong>
            </div>
            <div className="topbar-right">
              <span className="language-label">🇦🇿 <span>Azərbaycan dili</span></span>
              <span className="topbar-divider" />
              {data.demo ? (
                <div className="role-tabs flex items-center gap-1" aria-label="Nümunə görünüşü">
                  <Link data-slot="tabs-trigger" data-state={tutor ? 'active' : 'inactive'} aria-current={tutor ? 'true' : undefined} to={demoLink('tutor')}>Müəllim</Link>
                  <Link data-slot="tabs-trigger" data-state={!tutor ? 'active' : 'inactive'} aria-current={!tutor ? 'true' : undefined} to={demoLink('student')}>Tələbə</Link>
                </div>
              ) : tutor ? (
                <Link to="/?demo=student" className="student-preview"><Eye size={16} /> Tələbə görünüşü</Link>
              ) : <Badge>{data.students[0]?.level} səviyyəsi</Badge>}
            </div>
          </header>
          <main className="page-content">
            {data.demo && (
              <div className="demo-notice">
                <span><Eye size={15} /><strong>Nümunə məkanı</strong><span> — məlumatlar yalnız tanışlıq üçündür.</span></span>
                {user ? <Link to="/account">Hesabıma keç</Link> : <a href={signIn} target="_top">Daxil ol</a>}
              </div>
            )}
            <div className="page-heading">
              <div>
                <span className="eyebrow">{tutor ? 'MÜƏLLİM PANELİ' : 'MƏNİM ÖYRƏNMƏ YOLUM'}</span>
                <h1>{section === 'home' ? <>Salam, {data.name.split(' ')[0]} <span className="wave">👋</span></> : page.label}</h1>
                <p>{summary}</p>
              </div>
              {tutor && page.action ? (
                <button type="button" className="btn primary" onClick={() => open(page.action[1])}><Plus size={18} />{page.action[0]}</button>
              ) : section === 'home' && (
                <Link className="btn primary" to={href('materials')}><BookOpen size={18} /> Öyrənməyə davam et</Link>
              )}
            </div>
            <Outlet context={pageProps} />
            <footer className="page-footer">
              <span>PolskiYol <span>·</span> Polyak dili, birlikdə.</span>
              <span>🇦🇿 <ChevronRight size={12} aria-hidden="true" /> 🇵🇱</span>
            </footer>
          </main>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(18rem,90vw)] outline-none md:hidden">
            <Dialog.Title className="sr-only">İş məkanı</Dialog.Title>
            <Dialog.Description className="sr-only">Portal bölmələri</Dialog.Description>
            <Dialog.Close asChild>
              <button type="button" className="icon-button absolute right-2 top-2 z-10" aria-label="Menyunu bağla"><X size={18} /></button>
            </Dialog.Close>
            <Sidebar {...sidebar} mobile onNavigate={() => setMobileOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <PortalDialogs {...pageProps} signedIn={Boolean(user)} signIn={signIn} modal={modal} setModal={setModal}
        confirm={confirm} formError={formError} setFormError={setFormError} formSubmit={formSubmit} />
    </div>
  );
}
