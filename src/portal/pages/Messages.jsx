import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, MessageCircle, MessagesSquare, Send, ShieldCheck } from 'lucide-react';
import { fmtDate, fmtTime } from '../format.js';
import { Avatar, Blank } from '../shared.jsx';

function groupThreads(messages, role) {
  const threads = new Map();

  for (const message of messages) {
    const id = message.student_id;
    if (!threads.has(id)) threads.set(id, { messages: [], unread: 0 });
    const thread = threads.get(id);
    thread.messages.push(message);
    if (message.sender_role !== role && !message.read_at) thread.unread += 1;
  }

  for (const thread of threads.values()) {
    thread.messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  return threads;
}

function ConversationList({ students, threads, tutorName, activeId, selectConversation }) {
  return (
    <aside className="chat-contacts" aria-label="Söhbətlər">
      <h2>
        Söhbətlər <span className="count-pill">{students.length}</span>
      </h2>
      {students.map((student, index) => {
        const thread = threads.get(student.id);
        const active = activeId === student.id;
        const name = tutorName ?? student.name;

        return (
          <button
            key={student.id}
            type="button"
            className={active ? 'chat-contact active' : 'chat-contact'}
            aria-pressed={active}
            onClick={() => selectConversation(student.id)}
          >
            <Avatar name={name} tone={index} />
            <div>
              <strong>{name}</strong>
              <span>{thread?.messages.at(-1)?.body || 'Söhbətə başla'}</span>
            </div>
            {!!thread?.unread && <span className="nav-count">{thread.unread}</span>}
          </button>
        );
      })}
      {students.length === 0 && (
        <Blank
          title="Hələ söhbət yoxdur"
          body="Tələbə əlavə etdikdən sonra mesajlaşa bilərsiniz."
          icon={MessagesSquare}
        />
      )}
    </aside>
  );
}

function Message({ message, own }) {
  const DeliveryIcon = message.read_at ? CheckCheck : Check;

  return (
    <div className={own ? 'message mine' : 'message theirs'}>
      <p>{message.body}</p>
      <span>
        <time dateTime={message.created_at}>
          {fmtDate(message.created_at)} · {fmtTime(message.created_at)}
        </time>
        {own && (
          <DeliveryIcon size={14} aria-label={message.read_at ? 'Oxunub' : 'Göndərilib'} />
        )}
      </span>
    </div>
  );
}

export default function Messages({
  data,
  tutor,
  busy,
  mutate,
  open,
  refresh,
  conversation,
  setConversation,
}) {
  const [drafts, setDrafts] = useState({});
  const [sendError, setSendError] = useState(null);
  const [pollError, setPollError] = useState('');
  const messagesList = useRef(null);
  const reading = useRef(new Set());

  const students = tutor ? data.students : data.students.slice(0, 1);
  const activeStudent = students.find(student => student.id === conversation) ?? students[0];
  const activeId = activeStudent?.id;
  const threads = useMemo(() => groupThreads(data.messages, data.role), [data.messages, data.role]);
  const thread = threads.get(activeId);
  const latestId = thread?.messages.at(-1)?.id;
  const unread = thread?.unread ?? 0;
  const draft = drafts[activeId] ?? '';
  const activeError = sendError && sendError.id === activeId ? sendError.message : pollError;
  const name = tutor ? activeStudent?.name : data.tutorName;

  useEffect(() => {
    if (data.demo) return;

    let alive = true;
    let pending = false;

    async function poll() {
      if (document.hidden || pending) return;
      pending = true;
      try {
        await refresh();
        if (alive) setPollError('');
      } catch {
        if (alive) setPollError('Mesajlar yenilənmədi. Bir azdan yenidən yoxlanacaq.');
      } finally {
        pending = false;
      }
    }

    const timer = window.setInterval(poll, 8000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [data.demo, refresh]);

  useEffect(() => {
    const pending = reading.current;
    if (data.demo || !activeId || !unread || pending.has(activeId)) return;

    pending.add(activeId);
    void mutate({ action: 'read_messages', student_id: activeId }, { quiet: true })
      .catch(() => {})
      .finally(() => pending.delete(activeId));
  }, [activeId, data.demo, latestId, mutate, unread]);

  useEffect(() => {
    const list = messagesList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [activeId, latestId]);

  async function send(event) {
    event.preventDefault();
    if (!draft.trim() || !activeId || busy) return;

    setSendError(null);

    if (data.demo) {
      open('auth');
      return;
    }

    try {
      await mutate({ action: 'send_message', student_id: activeId, body: draft });
      setDrafts(current => current[activeId] === draft ? { ...current, [activeId]: '' } : current);
    } catch (error) {
      setSendError({ id: activeId, message: error.message });
    }
  }

  return (
    <section className="chat-panel panel" aria-label="Şəxsi mesajlar">
      <ConversationList
        students={students}
        threads={threads}
        tutorName={tutor ? null : data.tutorName}
        activeId={activeId}
        selectConversation={id => {
          setConversation(id);
          setSendError(null);
        }}
      />
      <div className="chat-thread">
        {activeStudent ? (
          <>
            <header className="chat-header">
              <Avatar name={name} />
              <div>
                <h3>{name}</h3>
                <span>
                  <ShieldCheck size={12} aria-hidden="true" />
                  Şəxsi söhbət · {tutor ? activeStudent.level + ' səviyyəsi' : 'Müəllimin'}
                </span>
              </div>
            </header>
            <div className="chat-messages" role="log" aria-label={name} ref={messagesList}>
              <span className="chat-start">Söhbətin başlanğıcı</span>
              {thread ? (
                thread.messages.map(message => (
                  <Message key={message.id} message={message} own={message.sender_role === data.role} />
                ))
              ) : (
                <Blank
                  title="İlk mesajını yaz"
                  body="Sualın, ev tapşırığın və ya kiçik bir salamın varsa, paylaş."
                  icon={MessageCircle}
                />
              )}
            </div>
            {activeError && (
              <p className="form-error chat-error" role="status">{activeError}</p>
            )}
            <form className="chat-composer focus-within:bg-[#fbfcfa]" onSubmit={send}>
              <textarea
                aria-label="Mesajınız"
                placeholder="Mesajını yaz…"
                value={draft}
                onChange={event => {
                  const value = event.target.value;
                  setDrafts(current => ({ ...current, [activeId]: value }));
                }}
                maxLength={4000}
                rows={1}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    send(event);
                  }
                }}
              />
              <button className="btn primary" disabled={!draft.trim() || busy} aria-label="Mesajı göndər">
                <Send size={19} aria-hidden="true" />
              </button>
            </form>
          </>
        ) : (
          <Blank
            title="Söhbət seçin"
            body="Tələbənizlə şəxsi söhbət burada açılacaq."
            icon={MessagesSquare}
          />
        )}
      </div>
    </section>
  );
}
