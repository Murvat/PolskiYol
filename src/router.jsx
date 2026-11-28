import { useCallback, useState } from 'react';
import {
  createBrowserRouter, Link, Outlet, useLocation, useMatches, useOutletContext, useSearchParams,
} from 'react-router-dom';
import { Toaster } from 'sonner';
import Account from './Account.jsx';
import PortalLayout from './portal/PortalLayout.jsx';
import Home from './portal/pages/Home.jsx';
import Students from './portal/pages/Students.jsx';
import Lessons from './portal/pages/Lessons.jsx';
import Materials from './portal/pages/Materials.jsx';
import Feed from './portal/pages/Feed.jsx';
import Messages from './portal/pages/Messages.jsx';
import Payments from './portal/pages/Payments.jsx';
import { portalError, useChangePortalMutation, useSessionQuery } from './store.js';

function Screen({ title, children }) {
  return (
    <main className="error-screen">
      <span className="brand-mark" aria-hidden="true">P<span>•</span></span>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

function NotFound() {
  return <Screen title="Səhifə tapılmadı"><Link className="btn primary" to="/">Ana səhifə</Link></Screen>;
}

function AccountPage({ session, invite }) {
  const [changePortal] = useChangePortalMutation();

  async function mutate(payload) {
    try {
      return await changePortal(payload).unwrap();
    } catch (error) {
      throw new Error(portalError(error));
    }
  }

  return <Account user={session.user} signIn={session.signIn} signOut={session.signOut} invite={invite} mutate={mutate} />;
}

function SessionRoute() {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const route = useMatches().at(-1).handle;
  const invite = searchParams.get('invite') || '';
  const demo = searchParams.get('demo');
  const request = route.account ? { account: '1', invite }
    : route.live ? { return_to: pathname.replace(/\/$/, '') }
    : { demo: demo === null || demo === '' ? undefined : demo };
  const { currentData: session, refetch, isError } = useSessionQuery(request);

  const refresh = useCallback(() => refetch().unwrap(), [refetch]);

  if (!session) {
    if (isError) {
      return <Screen title="Məlumatları yükləmək mümkün olmadı">
        <p>Bir qədər sonra yenidən cəhd edin. Məlumatlarınız qorunur.</p>
        <button className="btn primary" type="button" onClick={refetch}>Yenidən cəhd et</button>
      </Screen>;
    }
    return <Screen title="PolskiYol"><p role="status">Məlumatlar yüklənir…</p></Screen>;
  }

  if (route.account) return <AccountPage session={session} invite={invite} />;
  if (route.live) {
    if (!session.user) return <Screen title="Canlı dərs"><a className="btn primary" href={session.signIn} target="_top">Daxil ol</a></Screen>;
    if (session.data.demo) return <Screen title="Dərs hesabı aktiv deyil"><Link className="btn primary" to="/account">Hesabıma keç</Link></Screen>;
    return <Outlet />;
  }
  if (route.section === 'students' && session.data.role === 'student') return <NotFound />;

  const { demo: isDemo, role, studentId } = session.data;
  const key = [isDemo, role, studentId].join(':');
  return <PortalLayout key={key} session={session} refresh={refresh} />;
}

function PortalPage({ Page }) {
  const context = useOutletContext();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  return <Page {...context} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} />;
}

const portalRoutes = [
  ['home', Home], ['students', Students], ['lessons', Lessons], ['materials', Materials],
  ['feed', Feed], ['messages', Messages], ['payments', Payments],
].map(([section, Page]) => ({
  path: section,
  caseSensitive: true,
  handle: { section },
  element: <PortalPage key={section} Page={Page} />,
}));

export const router = createBrowserRouter([{
  element: <><Outlet /><Toaster position="bottom-right" richColors /></>,
  children: [
    {
      element: <SessionRoute />,
      children: [
        { index: true, handle: { section: 'home' }, element: <PortalPage key="home" Page={Home} /> },
        ...portalRoutes,
        { path: 'lessons/:lessonId/live', caseSensitive: true, handle: { live: true }, lazy: () => import('./live/LiveRoom.jsx') },
        { path: 'account', caseSensitive: true, handle: { account: true }, element: null },
      ],
    },
    { path: '*', element: <NotFound /> },
  ],
}]);
