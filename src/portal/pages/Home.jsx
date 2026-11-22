import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChevronRight,
  MessagesSquare, Plus, Rss, UsersRound, Video, Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { dayKey, fmtDate, fmtTime, money } from '../format.js';
import { Avatar, Badge, Blank } from '../shared.jsx';
import { MaterialCard } from './Materials.jsx';
import { PostCard } from './Feed.jsx';

const weekNames = ['B.e.', 'Ç.a.', 'Çər.', 'C.a.', 'Cüm.', 'Şən.', 'Baz.'];

const quickActions = [
  { kind: 'student', label: 'Tələbə əlavə et', tone: 'green', icon: UsersRound },
  { kind: 'material', label: 'Material paylaş', tone: 'blue', icon: BookOpen },
  { kind: 'post', label: 'Lentdə paylaş', tone: 'amber', icon: Rss },
];

function StatCard({ to, icon: Icon, tone, label, value, unit, children }) {
  return (
    <Link className="stat-card min-w-0" to={to}>
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}><Icon size={20} /></span>
      </div>
      <strong>
        {value}
        {unit && <small>{unit}</small>}
      </strong>
      <span className="stat-note">{children}</span>
    </Link>
  );
}

function LessonRow({ lesson, students, tutorName, tutor, open }) {
  const studentIndex = students.findIndex(student => student.id === lesson.student_id);
  const student = students[studentIndex];
  const accent = { B1: 'purple', A1: 'amber' };

  return (
    <button type="button" className="lesson-row" onClick={() => open('lessonDetail', lesson)}>
      <span className="lesson-time">
        {fmtTime(lesson.starts_at)}
        <small>{lesson.duration} dəqiqə</small>
      </span>
      <span className={`lesson-line ${accent[student?.level] || ''}`} aria-hidden="true" />
      <Avatar name={student?.name || tutorName} tone={Math.max(0, studentIndex)} />
      <span className="lesson-info">
        <strong>{tutor ? student?.name : tutorName}</strong>
        <span>{lesson.title}</span>
      </span>
      <Badge tone={student?.level === 'B1' ? 'purple' : 'green'}>{student?.level || 'A1'}</Badge>
      <ChevronRight className="muted" size={17} />
    </button>
  );
}

function WeekAgenda({ data, tutor, scheduled, selectedDay, setSelectedDay, href, open }) {
  const monday = new Date(`${data.today}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const daysWithLessons = new Set(scheduled.map(lesson => dayKey(lesson.starts_at)));
  const selectedLessons = scheduled.filter(lesson => dayKey(lesson.starts_at) === selectedDay);

  return (
    <section className="panel agenda-panel">
      <div className="panel-heading">
        <h2>Bugünkü proqram</h2>
        <Link className="text-link" to={href('lessons')}>Təqvimə bax <ArrowUpRight size={16} /></Link>
      </div>
      <div className="week-strip" role="group" aria-label="Həftənin günləri">
        {weekNames.map((name, index) => {
          const date = new Date(monday);
          date.setUTCDate(monday.getUTCDate() + index);
          const key = date.toISOString().slice(0, 10);
          const selected = selectedDay === key;
          return (
            <button
              key={key}
              type="button"
              aria-label={fmtDate(key)}
              aria-pressed={selected}
              className={selected ? 'selected' : undefined}
              onClick={() => setSelectedDay(key)}
            >
              <span>{name}</span>
              <strong>{date.getUTCDate()}</strong>
              <span
                className={`calendar-dot ${daysWithLessons.has(key) ? 'has-lesson' : ''}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <div className="agenda-date">
        <span>{fmtDate(selectedDay)}{selectedDay === data.today && ' · Bu gün'}</span>
        <span>Varşava vaxtı</span>
      </div>
      <div className="lesson-list">
        {selectedLessons.map(lesson => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            students={data.students}
            tutorName={data.tutorName}
            tutor={tutor}
            open={open}
          />
        ))}
        {selectedLessons.length === 0 && (
          <Blank
            title="Bu gün üçün planın yoxdur"
            body={tutor ? 'Yeni dərs planlaşdıraraq gününü təşkil et.' : 'Növbəti dərsin tezliklə burada görünəcək.'}
            icon={CalendarDays}
          />
        )}
      </div>
    </section>
  );
}

function NextLesson({ lesson, students, tutorName, tutor, open }) {
  const student = students.find(item => item.id === lesson?.student_id);
  const name = tutor ? student?.name || 'Tələbə' : tutorName;
  const [title, subtitle = 'Fərdi polyak dili dərsi'] = lesson?.title.split(' — ') ?? [];

  return (
    <section className="next-lesson">
      <div className="next-top">
        <span><span className="live-dot" /> NÖVBƏTİ DƏRS</span>
        <Video size={21} />
      </div>
      {lesson ? (
        <>
          <span className="next-date">{fmtDate(lesson.starts_at)} · {fmtTime(lesson.starts_at)}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          <div className="next-person">
            <Avatar name={name} />
            <div>
              <strong>{name}</strong>
              <span>{student?.level && `${student.level} səviyyəsi · `}{lesson.duration} dəqiqə</span>
            </div>
          </div>
          <button type="button" className="btn light full" onClick={() => open('lessonDetail', lesson)}>
            Dərsə bax <ArrowRight size={17} />
          </button>
        </>
      ) : (
        <>
          <h2>Növbəti addımı<br />birlikdə ataq.</h2>
          <p>{tutor ? 'İlk tələbəni əlavə et və dərs planlaşdır.' : 'Müəllimin dərs planlaşdırdıqda burada görünəcək.'}</p>
          {tutor && (
            <button
              type="button"
              className="btn light full"
              onClick={() => open(students.length ? 'lesson' : 'student')}
            >
              <Plus size={17} /> {students.length ? 'Dərs planlaşdır' : 'Tələbə əlavə et'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function QuickPanel({ tutor, student, open }) {
  const progress = student?.progress ?? 0;

  return (
    <section className="panel quick-panel">
      <h2>{tutor ? 'Sürətli əməliyyatlar' : 'Öyrənmə irəliləyişim'}</h2>
      {tutor ? quickActions.map(({ kind, label, tone, icon: Icon }) => (
        <button type="button" key={kind} onClick={() => open(kind)}>
          <span className={`quick-icon ${tone}`}><Icon size={19} /></span>
          <span>{label}</span>
          <Plus size={17} />
        </button>
      )) : (
        <div className="learning-progress">
          <div>
            <Badge>{student?.level}</Badge>
            <strong>{progress}%</strong>
          </div>
          <div
            data-slot="progress"
            className="overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Öyrənmə irəliləyişim"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div data-slot="progress-indicator" className="h-full rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p>{student?.goal || 'Hər gün bir addım irəli.'}</p>
          <span>Müəllimin qiymətləndirməsi</span>
        </div>
      )}
    </section>
  );
}

export default function Home({ data, tutor, href, open, selectedDay, setSelectedDay }) {
  const scheduled = data.lessons
    .filter(lesson => lesson.status === 'scheduled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const todayLessons = scheduled.filter(lesson => dayKey(lesson.starts_at) === data.today);
  const nextLesson = scheduled.find(lesson => data.demo || Date.parse(lesson.starts_at) + lesson.duration * 60000 > Date.now());
  const payments = data.payments.filter(payment => payment.status === (tutor ? 'paid' : 'pending'));
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const pending = data.payments.filter(payment => payment.status === 'pending').length;
  const unread = data.messages.filter(message => !message.read_at && message.sender_role !== data.role).length;

  return (
    <>
      <div className="stats-grid">
        <StatCard
          to={href(tutor ? 'students' : 'lessons')}
          icon={UsersRound}
          tone="green"
          label={tutor ? 'Tələbələrim' : 'Planlaşdırılan dərslər'}
          value={tutor ? data.students.length : scheduled.length}
          unit={tutor ? 'tələbə' : 'dərs'}
        >
          {tutor
            ? <><span className="green-text">{data.students.filter(student => student.user_id).length} aktiv hesab</span> · birlikdə öyrənirik</>
            : 'Növbəti addımına hazır ol'}
        </StatCard>
        <StatCard to={href('lessons')} icon={CalendarDays} tone="blue" label="Bugünkü dərslər" value={todayLessons.length} unit="dərs">
          {todayLessons.length ? `${fmtTime(todayLessons[0].starts_at)} · ilk dərsin vaxtı` : 'Bu gün üçün dərs yoxdur'}
        </StatCard>
        <StatCard to={href('payments')} icon={Wallet} tone="amber" label={tutor ? 'Ümumi ödənişlər' : 'Gözləyən ödəniş'} value={money(total)}>
          {tutor ? `${pending} ödəniş gözlənilir` : 'Müəllimin qeydlərinə əsasən'}
        </StatCard>
        <StatCard to={href('messages')} icon={MessagesSquare} tone="purple" label="Yeni mesajlar" value={unread} unit="mesaj">
          {unread ? 'Söhbətə davam etməyin vaxtıdır' : 'Bütün mesajları oxumusan'}
        </StatCard>
      </div>

      <div className="dashboard-columns">
        <div className="dashboard-left">
          <WeekAgenda
            data={data}
            tutor={tutor}
            scheduled={scheduled}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            href={href}
            open={open}
          />
          <section className="panel feed-preview">
            <div className="panel-heading">
              <h2>Xəbər lentindən</h2>
              <Link className="text-link" to={href('feed')}>Hamısına bax <ArrowUpRight size={16} /></Link>
            </div>
            {data.posts.length ? (
              <PostCard post={data.posts[0]} data={data} compact feedHref={href('feed')} />
            ) : (
              <Blank
                title="İlk paylaşımını gözləyir"
                body={tutor ? 'Tələbələrinə bir salam və ya faydalı qeyd paylaş.' : 'Müəllimin yenilikləri burada görünəcək.'}
              />
            )}
          </section>
        </div>
        <aside className="dashboard-right">
          <NextLesson lesson={nextLesson} students={data.students} tutorName={data.tutorName} tutor={tutor} open={open} />
          <QuickPanel tutor={tutor} student={data.students[0]} open={open} />
          <div className="language-note">
            <span>🇦🇿</span><span className="dashed-line" /><BookOpen size={19} />
            <span className="dashed-line" /><span>🇵🇱</span>
            <p>Bir dil. Saysız imkanlar.</p>
          </div>
        </aside>
      </div>

      <section className="materials-preview">
        <div className="panel-heading">
          <div>
            <h2>Öyrənmə rəfində yenilər</h2>
            <p>Dərsdən əvvəl, dərsdən sonra, istədiyin zaman.</p>
          </div>
          <Link to={href('materials')} className="text-link">Bütün materiallar <ArrowUpRight size={16} /></Link>
        </div>
        {data.materials.length ? (
          <div className="material-grid">
            {data.materials.slice(0, 3).map((material, index) => (
              <MaterialCard key={material.id} material={material} index={index} tutor={tutor} open={open} />
            ))}
          </div>
        ) : (
          <div className="panel">
            <Blank
              title="Öyrənmə rəfin hazırdır"
              body={tutor ? 'İlk dərs materialını əlavə et.' : 'Müəllimin paylaşdığı materiallar burada görünəcək.'}
              icon={BookOpen}
            />
          </div>
        )}
      </section>
    </>
  );
}
