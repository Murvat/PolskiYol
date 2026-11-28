import { useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { dayKey, fmtDate, fmtTime } from '../format.js';
import { lessonStudents } from '../lessons.js';
import { Avatar, Badge, Blank } from '../shared.jsx';

const monthNames = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];
const weekNames = ['B.e.', 'Ç.a.', 'Çər.', 'C.a.', 'Cüm.', 'Şən.', 'Baz.'];
const statuses = {
  scheduled: { label: 'Planlaşdırılıb', tone: 'blue' },
  completed: { label: 'Tamamlanıb', tone: 'green' },
  cancelled: { label: 'Ləğv edilib', tone: 'neutral' },
};
const historyFilters = [
  { value: 'all', label: 'Hamısı' },
  { value: 'scheduled', label: statuses.scheduled.label },
  { value: 'completed', label: statuses.completed.label },
];

function MonthCalendar({ today, selectedDay, setSelectedDay, lessonsByDay, tutor, studentNames }) {
  const [month, setMonth] = useState(() => selectedDay.slice(0, 7));
  const monthDate = new Date(month + '-01T12:00:00Z');
  const year = monthDate.getUTCFullYear();
  const monthIndex = monthDate.getUTCMonth();
  const offset = (monthDate.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  function shiftMonth(direction) {
    monthDate.setUTCMonth(monthIndex + direction);
    setMonth(monthDate.toISOString().slice(0, 7));
  }

  function goToToday() {
    setMonth(today.slice(0, 7));
    setSelectedDay(today);
  }

  return (
    <section className="panel full-calendar min-w-0">
      <div className="calendar-heading">
        <h2 aria-live="polite">{monthNames[monthIndex]} {year}</h2>
        <div>
          <button type="button" className="btn secondary small" onClick={goToToday}>Bu gün</button>
          <button type="button" className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Əvvəlki ay">
            <ChevronLeft size={19} />
          </button>
          <button type="button" className="icon-button" onClick={() => shiftMonth(1)} aria-label="Növbəti ay">
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <div className="month-grid">
        {weekNames.map(name => <span className="week-label" key={name}>{name}</span>)}
        {Array.from({ length: offset }, (_, index) => (
          <span className="calendar-cell outside" key={'blank-' + index} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const date = month + '-' + String(day).padStart(2, '0');
          const lessons = lessonsByDay.get(date) ?? [];
          const active = selectedDay === date;
          const isToday = date === today;
          return (
            <button
              type="button"
              key={date}
              className={['calendar-cell', active && 'active', isToday && 'today'].filter(Boolean).join(' ')}
              onClick={() => setSelectedDay(date)}
              aria-label={fmtDate(date) + ', ' + lessons.length + ' dərs'}
              aria-pressed={active}
              aria-current={isToday ? 'date' : undefined}
            >
              <span>{day}</span>
              {lessons.slice(0, 2).map(lesson => (
                <span className="calendar-event" key={lesson.id}>
                  <b>{fmtTime(lesson.starts_at)}</b>
                  <span>{tutor && lessonStudents(lesson).length === 1 ? studentNames.get(lessonStudents(lesson)[0])?.split(' ')[0] : lesson.title}</span>
                </span>
              ))}
              {lessons.length > 2 && <small>+{lessons.length - 2} dərs</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DayAgenda({ selectedDay, lessons, open, personName }) {
  return (
    <aside className="panel day-agenda block! min-w-0">
      <div className="panel-heading" aria-live="polite">
        <h2>{fmtDate(selectedDay)}</h2>
        <Badge>{lessons.length} dərs</Badge>
      </div>
      {lessons.map(lesson => {
        const person = personName(lesson);
        return (
          <button type="button" className="day-lesson" key={lesson.id} onClick={() => open('lessonDetail', lesson)}>
            <span><Clock size={15} />{fmtTime(lesson.starts_at)} · {lesson.duration} dəq.</span>
            <h3>{lesson.title}</h3>
            <div><Avatar size="small" name={person} /><span>{person}</span></div>
          </button>
        );
      })}
      {lessons.length === 0 && (
        <Blank title="Sərbəst gün" body="Bu tarixdə planlaşdırılmış dərs yoxdur." icon={CalendarDays} />
      )}
    </aside>
  );
}

function LessonHistory({ lessons, tutor, studentNames, open }) {
  const [filter, setFilter] = useState('all');
  const visibleLessons = filter === 'all' ? lessons : lessons.filter(lesson => lesson.status === filter);

  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <h2>Dərslər</h2>
        <div role="group" aria-label="Dərsin statusu" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {historyFilters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === filter}
              onClick={() => setFilter(value)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="w-full overflow-x-auto" role="region" aria-label="Dərslər cədvəli" tabIndex={0}>
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="border-b">
              <th scope="col">Mövzu</th>
              {tutor && <th scope="col">Tələbələr</th>}
              <th scope="col">Tarix və saat</th>
              <th scope="col">Müddət</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="sr-only">Əməliyyatlar</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleLessons.map(lesson => {
              const status = statuses[lesson.status];
              return (
                <tr key={lesson.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td><strong>{lesson.title}</strong></td>
                  {tutor && <td>{lessonStudents(lesson).map(id => studentNames.get(id)).filter(Boolean).join(', ')}</td>}
                  <td>{fmtDate(lesson.starts_at)} · {fmtTime(lesson.starts_at)}</td>
                  <td>{lesson.duration} dəq.</td>
                  <td><Badge tone={status.tone}>{status.label}</Badge></td>
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={lesson.title + ' — bax'}
                      onClick={() => open('lessonDetail', lesson)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibleLessons.length === 0 && (
        <Blank title="Dərs yoxdur" body="Bu bölmədə dərslər görünəcək." icon={CalendarDays} />
      )}
    </section>
  );
}

export default function Lessons({ data, tutor, open, selectedDay, setSelectedDay }) {
  const studentNames = new Map(data.students.map(student => [student.id, student.name]));
  const lessonsByDay = new Map();
  for (const lesson of data.lessons) {
    if (lesson.status !== 'scheduled') continue;
    const date = dayKey(lesson.starts_at);
    if (!lessonsByDay.has(date)) lessonsByDay.set(date, []);
    lessonsByDay.get(date).push(lesson);
  }

  return (
    <>
      <div className="calendar-layout">
        <MonthCalendar
          today={data.today}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          lessonsByDay={lessonsByDay}
          tutor={tutor}
          studentNames={studentNames}
        />
        <DayAgenda
          selectedDay={selectedDay}
          lessons={lessonsByDay.get(selectedDay) ?? []}
          open={open}
          personName={lesson => tutor ? lessonStudents(lesson).map(id => studentNames.get(id)).filter(Boolean).join(', ') : data.tutorName}
        />
      </div>
      <LessonHistory lessons={data.lessons} tutor={tutor} studentNames={studentNames} open={open} />
    </>
  );
}
