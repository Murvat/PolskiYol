import { GraduationCap, Lightbulb, LogOut, MoreHorizontal, UserRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Link } from 'react-router-dom';
import { Avatar, Brand, menuClass, menuItemClass } from './shared.jsx';
import { sections } from './navigation.js';

export default function Sidebar({ data, section, href, signOut, onSignOut, onNavigate, mobile = false }) {
  const isTutor = data.role === 'tutor';
  const unread = data.messages.filter((message) => !message.read_at && message.sender_role !== data.role).length;

  return (
    <aside className={`portal-sidebar flex h-full min-h-0 flex-col ${mobile ? 'w-full' : ''}`}>
      <div className="side-brand">
        <Link className="brand" to={href('home')} onClick={onNavigate}><Brand /></Link>
        <span className="brand-sub">Polyak dili, birlikdə.</span>
      </div>
      <div className="side-content flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="workspace-badge">
          <span className="workspace-icon"><GraduationCap size={20} /></span>
          <div><strong>{isTutor ? 'Müəllim məkanı' : 'Öyrənmə məkanım'}</strong><span>Azərbaycan dili → Polyak dili</span></div>
        </div>
        <span className="nav-caption">İŞ MƏKANI</span>
        <nav className="flex flex-col gap-1" aria-label="İş məkanı">
          {Object.entries(sections).map(([name, { label, icon: Icon }]) => {
            if (name === 'students' && !isTutor) return null;
            return (
              <Link
                key={name}
                to={href(name)}
                className="nav-item"
                data-active={name === section}
                aria-current={name === section ? 'page' : undefined}
                onClick={onNavigate}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{name === 'home' ? 'Ana səhifə' : label}</span>
                {name === 'messages' && unread > 0 && <span className="nav-count">{unread}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="word-card">
          <span><Lightbulb size={16} /> GÜNÜN SÖZÜ</span>
          <strong lang="pl">razem <small>/ˈra.zɛm/</small></strong>
          <p>birlikdə</p>
          <div><span lang="pl">Uczymy się razem.</span><br /><span>Biz birlikdə öyrənirik.</span></div>
        </div>
      </div>
      <div className="side-footer">
        <div className="side-person">
          <Avatar name={data.name} />
          <div><strong>{data.name}</strong><span>{isTutor ? 'Polyak dili müəllimi' : 'Polyak dili tələbəsi'}</span></div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="icon-button" aria-label="Hesab menyusu"><MoreHorizontal size={20} /></button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={5} className={menuClass}>
                <DropdownMenu.Item asChild className={menuItemClass}>
                  <Link to="/account" onClick={onNavigate}><UserRound /> Hesabım</Link>
                </DropdownMenu.Item>
                {!data.demo && <DropdownMenu.Item asChild className={menuItemClass}>
                  {onSignOut ? <button type="button" onClick={onSignOut}><LogOut /> Çıxış</button> : <a href={signOut} target="_top"><LogOut /> Çıxış</a>}
                </DropdownMenu.Item>}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <span className="sidebar-bottom">Kiçik addımlarla, hər gün irəli.</span>
      </div>
    </aside>
  );
}
