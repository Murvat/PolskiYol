import { ArrowRight, Globe2, GraduationCap, MoreHorizontal, Pencil, Plus, Rss, Trash2 } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Link } from 'react-router-dom';
import { fmtDate } from '../format.js';
import { Avatar, Badge, Blank } from '../shared.jsx';

export function ActionsMenu({ label, actions }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="icon-button" aria-label={label}>
          <MoreHorizontal size={19} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-32 rounded-md border border-[#e5ebe7] bg-white p-1 text-sm text-[#455a53] shadow-md"
        >
          {actions.map(({ text, icon: Icon, run, destructive }) => (
            <DropdownMenu.Item
              key={text}
              onSelect={run}
              className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 outline-none select-none data-highlighted:bg-[#eff5f1] ${destructive ? 'danger-text' : ''}`}
            >
              <Icon size={16} aria-hidden="true" /> {text}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function PostCard({ post, data, tutor, open, setConfirm, compact = false, feedHref = '/feed' }) {
  const actions = [
    { text: 'Düzəliş et', icon: Pencil, run: () => open('post', post) },
    {
      text: 'Sil',
      icon: Trash2,
      destructive: true,
      run: () => setConfirm({ entity: 'posts', id: post.id, title: post.title }),
    },
  ];

  return (
    <article className={`post-card ${compact ? 'compact' : ''}`}>
      <div className="post-author">
        <Avatar name={data.tutorName} />
        <div className="min-w-0">
          <strong>{data.tutorName} <span>Müəllim</span></strong>
          <small>{fmtDate(post.created_at)} · Bütün tələbələr üçün</small>
        </div>
        <Badge tone={post.category === 'Elan' ? 'blue' : 'amber'}>{post.category}</Badge>
        {tutor && !compact && <ActionsMenu label="Paylaşım seçimləri" actions={data.api ? actions.slice(1) : actions} />}
      </div>
      <h3>{post.title}</h3>
      <p>{post.body}</p>
      {compact ? (
        <Link className="text-link small" to={feedHref}>Paylaşıma bax <ArrowRight size={15} aria-hidden="true" /></Link>
      ) : (
        <div className="post-footer"><Globe2 size={14} aria-hidden="true" /> Öyrənmə məkanımızdan</div>
      )}
    </article>
  );
}

function FeedSidebar({ students, tutor }) {
  return (
    <aside className="feed-aside">
      <div className="feed-welcome">
        <span className="stat-icon green"><GraduationCap size={25} aria-hidden="true" /></span>
        <h2>Birlikdə daha irəli.</h2>
        <p>Bura bizim öyrənmə məkanımızdır. Dərs yenilikləri, faydalı ifadələr və gündəlik ilham burada görüşür.</p>
        <div className="community-avatars">
          {students.slice(0, 4).map((student, index) => <Avatar key={student.id} name={student.name} tone={index} />)}
          <span>{tutor ? `${students.length} tələbə` : 'Sənin öyrənmə məkanın'}</span>
        </div>
      </div>
      <div className="phrase-card">
        <span>BUGÜN POLYAKCA DE</span>
        <h3 lang="pl">Miłego dnia!</h3>
        <p>Günün xoş keçsin!</p>
        <small>Kiçik bir ifadə, gözəl bir başlanğıc.</small>
      </div>
    </aside>
  );
}

export default function Feed({ data, tutor, open, setConfirm }) {
  return (
    <div className="feed-layout">
      <div className="min-w-0">
        {tutor && (
          <button type="button" className="post-compose" onClick={() => open('post')}>
            <Avatar name={data.name} />
            <span>Tələbələrinlə nə bölüşmək istəyirsən?</span>
            <Plus size={21} aria-hidden="true" />
          </button>
        )}
        {data.posts.map(post => (
          <PostCard key={post.id} post={post} data={data} tutor={tutor} open={open} setConfirm={setConfirm} />
        ))}
        {!data.posts.length && (
          <section className="panel">
            <Blank
              title="Hələ paylaşım yoxdur"
              body={tutor ? 'İlk paylaşımını yaradaraq söhbətə başla.' : 'Müəllimin elanları burada görünəcək.'}
              icon={Rss}
            />
          </section>
        )}
      </div>
      <FeedSidebar students={data.students} tutor={tutor} />
    </div>
  );
}
