import { useState } from 'react';
import { CalendarDays, Link2, MessagesSquare, MoreHorizontal, Pencil, Search, Trash2, UsersRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Blank } from '../shared.jsx';

const columns = ['Tələbə', 'Səviyyə', 'Məqsəd', 'İrəliləyiş', 'Hesab'];
const menuItem = 'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-accent [&_svg]:size-4';

function StudentMenu({ student, api, open, invite, setConfirm, onMessage }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="icon-button" aria-label={student.name + ' — seçimlər'}>
          <MoreHorizontal size={20} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {!api && <DropdownMenu.Item className={menuItem} onSelect={() => open('student', student)}>
            <Pencil /> Düzəliş et
          </DropdownMenu.Item>}
          <DropdownMenu.Item className={menuItem} onSelect={() => open('lesson', { student_id: student.id })}>
            <CalendarDays /> Dərs planlaşdır
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItem} onSelect={() => onMessage(student.id)}>
            <MessagesSquare /> Mesajlar
          </DropdownMenu.Item>
          {!student.user_id && (
            <DropdownMenu.Item className={menuItem} onSelect={() => invite(student)}>
              <Link2 /> Dəvət keçidi yarat
            </DropdownMenu.Item>
          )}
          {!api && <><DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className={`${menuItem} danger-text`}
            onSelect={() => setConfirm({ entity: 'students', id: student.id, title: student.name })}
          >
            <Trash2 /> Tələbəni sil
          </DropdownMenu.Item></>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default function Students({ data, open, invite, setConfirm, selectConversation, href }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const normalizedQuery = query.trim().toLocaleLowerCase('az-AZ');
  const students = data.students.filter(student =>
    `${student.name} ${student.email}`.toLocaleLowerCase('az-AZ').includes(normalizedQuery)
  );

  function openConversation(id) {
    selectConversation(id);
    navigate(href('messages'));
  }

  return (
    <section className="panel student-panel">
      <div className="table-toolbar">
        <h2>Bütün tələbələr <span className="count-pill">{data.students.length}</span></h2>
        <label className="search-field">
          <Search size={17} />
          <input
            type="search"
            aria-label="Tələbə axtar"
            placeholder="Tələbə axtar…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              {(data.api ? ['Tələbə', 'Telefon'] : columns).map(label => <th key={label} scope="col">{label}</th>)}
              <th scope="col"><span className="sr-only">Əməliyyatlar</span></th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr className="border-b last:border-b-0" key={student.id}>
                <td>
                  {data.api ? <span className="table-person"><Avatar name={student.name} tone={index} /><strong>{student.name}</strong></span> : (
                  <button type="button" className="table-person" onClick={() => open('student', student)}>
                    <Avatar name={student.name} tone={index} />
                    <span>
                      <strong>{student.name}</strong>
                      <small>{student.email}</small>
                    </span>
                  </button>)}
                </td>
                {data.api ? <td>{student.phone}</td> : (<>
                <td><Badge tone={student.level.startsWith('B') ? 'purple' : 'green'}>{student.level}</Badge></td>
                <td className="muted">{student.goal || '—'}</td>
                <td>
                  <div className="table-progress">
                    <span>{student.progress}%</span>
                    <div
                      data-slot="progress"
                      className="overflow-hidden rounded-full"
                      role="progressbar"
                      aria-label={student.name + ' — irəliləyiş'}
                      aria-valuenow={student.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div data-slot="progress-indicator" className="h-full rounded-full" style={{ width: `${student.progress}%` }} />
                    </div>
                  </div>
                </td>
                <td><Badge tone={student.user_id ? 'green' : 'neutral'}>{student.user_id ? 'Aktiv' : 'Dəvət gözləyir'}</Badge></td></>)}
                <td>
                  <StudentMenu
                    api={data.api}
                    student={student}
                    open={open}
                    invite={invite}
                    setConfirm={setConfirm}
                    onMessage={openConversation}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.students.length && (
        <Blank title="İlk tələbənlə başla" body={data.api ? "Tələbələr administrator tərəfindən təyin edilir." : "Tələbə əlavə et, sonra ona şəxsi dəvət keçidini göndər."} icon={UsersRound} />
      )}
      {!!data.students.length && !students.length && (
        <Blank title="Tələbə tapılmadı" body="Fərqli ad və ya e-poçtla axtar." />
      )}
      <div className="table-footer">{data.students.length} tələbə · hər biri üçün fərdi öyrənmə yolu</div>
    </section>
  );
}
