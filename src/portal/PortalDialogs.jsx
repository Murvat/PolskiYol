import { useRef } from 'react';
import { AlertDialog, Dialog } from 'radix-ui';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Pencil,
  ShieldCheck,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { fmtDate, fmtTime, localInput } from './format';
import { Avatar, Badge } from './shared';

const levels = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const materialCategories = ['Danışıq', 'Qrammatika', 'Tələffüz', 'Lüğət', 'Oxu'];
const postCategories = ['Elan', 'Məsləhət', 'Yenilik'];
const lessonStatuses = {
  scheduled: 'Planlaşdırılıb',
  completed: 'Tamamlanıb',
  cancelled: 'Ləğv edilib',
};
const formTitles = {
  student: ['Yeni tələbə', 'Tələbəyə düzəliş et'],
  lesson: ['Dərs planlaşdır', 'Dərsə düzəliş et'],
  material: ['Yeni material', 'Materiala düzəliş et'],
  post: ['Yeni paylaşım', 'Paylaşıma düzəliş et'],
  payment: ['Ödəniş əlavə et', 'Ödəniş əlavə et'],
};
const dialogDescriptions = {
  auth: 'Bu nümunə məkanında dəyişikliklər saxlanmır. Öz hesabında tələbələri, dərsləri və materialları idarə et.',
  invite: 'Bu keçidi yalnız həmin tələbə ilə paylaş. Dəvət 7 gün ərzində bir dəfə istifadə oluna bilər.',
  lessonDetail: 'Bütün saatlar Varşava vaxtı ilə göstərilir.',
  student: 'Tələbənin məlumatlarını daxil et. Yeni tələbə üçün şəxsi dəvət keçidi yaradılacaq.',
  lesson: 'Vaxtı Varşava vaxtı (Europe/Warsaw) ilə daxil et.',
  payment: 'Bu qeyd ödənişi izləmək üçündür. Məbləğ kartdan tutulmur.',
  material: 'Bu məzmun bütün qeydiyyatlı tələbələrə görünəcək.',
  post: 'Bu məzmun bütün qeydiyyatlı tələbələrə görünəcək.',
};

const overlayClass = 'fixed inset-0 bg-black/35';
const dialogClass =
  'fixed top-1/2 left-1/2 max-h-[90dvh] w-[calc(100%_-_2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[14px] border border-[#dce5d6] bg-white p-6 shadow-xl sm:p-7';
const titleClass = 'pr-7 text-[21px] leading-snug font-semibold text-[#29493a]';
const descriptionClass = 'mt-1 mb-4 text-sm leading-relaxed text-[#566c55]';
const fieldClass = 'flex min-w-0 flex-col gap-2 text-sm font-medium text-[#49623e]';
const inputClass =
  'min-h-11 w-full rounded-lg border border-[#dce5d6] bg-white px-3 py-2.5 text-sm font-normal text-[#34543f] placeholder:text-[#6e7c74] focus:border-[#87b478] focus:ring-3 focus:ring-[#ecf5e7] focus:outline-none';
const columnsClass = 'grid gap-3 sm:grid-cols-2 sm:gap-4';
const hintClass = 'rounded-lg bg-[#f5f8f1] px-3.5 py-3 text-sm leading-relaxed text-[#52674c]';

function Field({ label, children, optional }) {
  return (
    <label className={fieldClass}>
      <span>{label}{optional && <small className="ml-1 text-xs font-normal text-[#6e7c74]">(istəyə bağlı)</small>}</span>
      {children}
    </label>
  );
}

function SelectField({ name, label, defaultValue, options }) {
  return (
    <Field label={label}>
      <select className={inputClass} name={name} defaultValue={defaultValue} required>
        {options.map(option => {
          const value = typeof option === 'string' ? option : option.value;
          const text = typeof option === 'string' ? option : option.label;
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
    </Field>
  );
}

function StudentFields({ item, busy, invite, setConfirm }) {
  return (
    <>
      <Field label="Ad və soyad">
        <input className={inputClass} name="name" required maxLength={180} placeholder="Məsələn, Aysel Məmmədova" defaultValue={item?.name} />
      </Field>
      <Field label="E-poçt ünvanı">
        <input className={inputClass} name="email" type="email" required maxLength={254} placeholder="aysel@example.com" defaultValue={item?.email} />
      </Field>
      <div className={columnsClass}>
        <SelectField label="Dil səviyyəsi" name="level" defaultValue={item?.level || 'A1'} options={levels} />
        <Field label="İrəliləyiş (%)">
          <input className={inputClass} name="progress" type="number" min="0" max="100" required defaultValue={item?.progress ?? 0} />
        </Field>
      </div>
      <Field label="Öyrənmə məqsədi">
        <input className={inputClass} name="goal" maxLength={500} placeholder="Məsələn, Polşada təhsil" defaultValue={item?.goal} />
      </Field>
      {item?.id && (
        <div className="flex flex-wrap justify-between gap-3">
          {!item.user_id && (
            <button type="button" className="text-link" disabled={busy} onClick={() => invite(item)}>
              <Link2 size={16} /> Dəvət keçidi yarat
            </button>
          )}
          <button
            type="button"
            className="text-link danger-text"
            disabled={busy}
            onClick={() => setConfirm({ entity: 'students', id: item.id, title: item.name })}
          >
            <Trash2 size={16} /> Tələbəni sil
          </button>
        </div>
      )}
    </>
  );
}

function LessonFields({ item, selectedDay }) {
  const chosenDuration = item?.duration ?? 60;
  const durations = [...new Set([30, 45, 60, 90, 120, chosenDuration])].sort((a, b) => a - b);
  return (
    <>
      <div className={columnsClass}>
        <Field label="Tarix və saat">
          <input
            className={inputClass}
            type="datetime-local"
            name="starts_at"
            required
            defaultValue={item?.starts_at ? localInput(item.starts_at) : selectedDay + 'T16:00'}
          />
        </Field>
        <SelectField
          label="Müddət"
          name="duration"
          defaultValue={String(chosenDuration)}
          options={durations.map(duration => ({ value: String(duration), label: duration + ' dəqiqə' }))}
        />
      </div>
      <Field label="Onlayn dərs keçidi" optional>
        <input className={inputClass} name="meeting_url" type="url" placeholder="https://meet.google.com/…" defaultValue={item?.meeting_url} maxLength={2000} />
      </Field>
    </>
  );
}

function PaymentFields({ today }) {
  return (
    <div className={columnsClass}>
      <Field label="Məbləğ (PLN)">
        <input className={inputClass} name="amount" type="number" min="0.01" max="1000000" step="0.01" required placeholder="240.00" />
      </Field>
      <Field label="Son ödəniş tarixi">
        <input className={inputClass} name="due_date" type="date" required defaultValue={today} />
      </Field>
    </div>
  );
}

function ContentFields({ kind, item }) {
  const isPost = kind === 'post';
  return (
    <>
      <Field label="Başlıq">
        <input
          className={inputClass}
          name="title"
          required
          maxLength={180}
          defaultValue={item?.title}
          placeholder={isPost ? 'Nə bölüşmək istəyirsən?' : 'Məsələn, İlk polyakca söhbətin'}
        />
      </Field>
      <div className={columnsClass}>
        <SelectField
          label="Kateqoriya"
          name="category"
          defaultValue={item?.category || (isPost ? 'Elan' : 'Danışıq')}
          options={isPost ? postCategories : materialCategories}
        />
        {!isPost && <SelectField label="Səviyyə" name="level" defaultValue={item?.level || 'A1'} options={levels} />}
      </div>
      <Field label="Məzmun">
        <textarea
          className={inputClass + ' resize-y leading-relaxed'}
          name="body"
          rows={6}
          required
          maxLength={15000}
          defaultValue={item?.body}
          placeholder={isPost ? 'Tələbələrin üçün bir qeyd yaz…' : 'Dərs izahı, nümunələr və tapşırıqlar…'}
        />
      </Field>
      {!isPost && (
        <Field label="Əlavə mənbə keçidi" optional>
          <input className={inputClass} name="url" type="url" placeholder="https://…" maxLength={2000} defaultValue={item?.url} />
        </Field>
      )}
    </>
  );
}

function PortalForm({ modal, data, busy, formError, formSubmit, close, selectedDay, open, invite, setConfirm }) {
  const { kind, item } = modal;
  const isLesson = kind === 'lesson';
  const requiresStudent = isLesson || kind === 'payment';
  const submitLabel = busy
    ? 'Saxlanılır…'
    : item?.id
      ? 'Dəyişiklikləri saxla'
      : { post: 'Paylaş', lesson: 'Dərsi planlaşdır' }[kind] || 'Əlavə et';
  return (
    <form className="grid gap-[18px]" onSubmit={formSubmit}>
      {kind === 'student' && <StudentFields item={item} busy={busy} invite={invite} setConfirm={setConfirm} />}
      {requiresStudent && (
        <>
          {data.students.length ? (
            <SelectField
              label="Tələbə"
              name="student_id"
              defaultValue={item?.student_id || data.students[0].id}
              options={data.students.map(student => ({ value: student.id, label: student.name }))}
            />
          ) : (
            <div className={hintClass}>
              Əvvəlcə tələbə əlavə edin.{' '}
              <button type="button" className="text-link" onClick={() => open('student')}>
                Tələbə əlavə et <ArrowRight size={15} />
              </button>
            </div>
          )}
          <Field label={isLesson ? 'Dərsin mövzusu' : 'Ödənişin təsviri'}>
            <input
              className={inputClass}
              name="title"
              required
              maxLength={180}
              defaultValue={item?.title}
              placeholder={isLesson ? 'Məsələn, Kafedə ünsiyyət' : 'Məsələn, Oktyabr · 4 fərdi dərs'}
            />
          </Field>
        </>
      )}
      {isLesson && <LessonFields item={item} selectedDay={selectedDay} />}
      {kind === 'payment' && <PaymentFields today={data.today} />}
      {(kind === 'material' || kind === 'post') && <ContentFields kind={kind} item={item} />}
      {formError && <p role="alert" className="form-error">{formError}</p>}
      <div className="mt-1.5 flex flex-wrap justify-end gap-2.5 border-t border-[#edf1e8] pt-4">
        <button type="button" className="btn secondary" onClick={close}>Vaz keç</button>
        <button className="btn primary" disabled={busy || (requiresStudent && !data.students.length)}>
          {submitLabel} <Check size={17} />
        </button>
      </div>
    </form>
  );
}

function Invitation({ code }) {
  const link = new URL('/account', window.location.origin);
  link.searchParams.set('invite', code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.href);
      toast.success('Dəvət keçidi kopyalandı.');
    } catch {
      toast.error('Keçidi seçərək kopyalaya bilərsiniz.');
    }
  }

  return (
    <div className="grid gap-4">
      <Field label="Dəvət keçidi">
        <input className={inputClass} readOnly value={link.href} onFocus={event => event.target.select()} />
      </Field>
      <button type="button" className="btn primary" onClick={copy}><Copy size={17} /> Keçidi kopyala</button>
      <p className={hintClass}>Tələbə keçidi açıb ChatGPT hesabı ilə daxil olduqdan sonra “Dərslərimə qoşul” düyməsinə basmalıdır.</p>
    </div>
  );
}

function LessonDetail({ item, student, tutor, tutorName, busy, open, quick, setConfirm }) {
  const learner = student(item.student_id);
  const person = tutor ? learner?.name : tutorName;
  const scheduled = item.status === 'scheduled';
  return (
    <>
      {learner?.level && <Badge>{learner.level}</Badge>}
      <h2 className="mt-3 mb-5 text-2xl font-semibold leading-snug text-[#426333]">{item.title}</h2>
      {person && <div className="mb-5 flex items-center gap-2.5 text-sm"><Avatar name={person} /><strong>{person}</strong></div>}
      <div className="mb-4 flex flex-wrap gap-5 text-sm text-[#566c55]">
        <span className="inline-flex items-center gap-2"><CalendarDays size={18} /> {fmtDate(item.starts_at)}</span>
        <span className="inline-flex items-center gap-2"><Clock size={18} /> {fmtTime(item.starts_at)} · {item.duration} dəqiqə</span>
      </div>
      <Badge tone={scheduled ? 'blue' : 'neutral'}>{lessonStatuses[item.status]}</Badge>
      {item.meeting_url && scheduled && (
        <a className="btn primary full mt-5" href={item.meeting_url} target="_blank" rel="noopener noreferrer">
          <Video size={18} /> Dərsə qoşul <ExternalLink size={16} />
        </a>
      )}
      {!item.meeting_url && <p className={hintClass + ' mt-5 flex items-center gap-2'}><Video size={16} /> Dərs keçidi hələ əlavə edilməyib.</p>}
      {tutor && scheduled && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button className="btn secondary" onClick={() => open('lesson', item)}><Pencil size={16} /> Düzəliş et</button>
            <button
              disabled={busy}
              className="btn primary"
              onClick={() => quick({ action: 'lesson_status', id: item.id, status: 'completed' }, 'Dərs tamamlandı.')}
            >
              <Check size={17} /> Tamamla
            </button>
          </div>
          <button
            disabled={busy}
            className="text-link danger-text mt-5"
            onClick={() => setConfirm({ entity: 'lesson_cancel', id: item.id, title: item.title })}
          >
            Dərsi ləğv et
          </button>
        </>
      )}
    </>
  );
}

function MaterialReading({ item, tutor, busy, open, setConfirm }) {
  return (
    <>
      <div className="py-4 text-base leading-loose whitespace-pre-wrap wrap-anywhere text-[#49623e]">{item.body}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {item.url && (
          <a className="btn primary" href={item.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={17} /> Mənbəni aç
          </a>
        )}
        {tutor && (
          <>
            <button className="btn secondary" onClick={() => open('material', item)}><Pencil size={16} /> Düzəliş et</button>
            <button
              className="icon-button danger-text"
              aria-label="Materialı sil"
              disabled={busy}
              onClick={() => setConfirm({ entity: 'materials', id: item.id, title: item.title })}
            >
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>
    </>
  );
}

function dialogHeading(modal) {
  if (!modal) return {};
  const { kind, item } = modal;
  if (kind === 'read') return { title: item.title, description: item.category + ' · ' + item.level + ' səviyyəsi' };
  const titles = { auth: 'Öz öyrənmə məkanına keç', invite: 'Tələbənin dəvəti hazırdır', lessonDetail: 'Dərs məlumatları' };
  return { title: formTitles[kind]?.[item?.id ? 1 : 0] || titles[kind], description: dialogDescriptions[kind] };
}

function useDialogFocus() {
  const trigger = useRef(null);
  return {
    onOpenAutoFocus() {
      trigger.current = document.activeElement;
    },
    onCloseAutoFocus(event) {
      const element = trigger.current;
      if (element?.isConnected && typeof element.focus === 'function') {
        event.preventDefault();
        element.focus();
      }
    },
  };
}

function ConfirmAction({ confirm, busy, setConfirm, quick }) {
  const focus = useDialogFocus();
  const cancelling = confirm?.entity === 'lesson_cancel';
  const impact = {
    students: ' və tələbəyə aid dərslər, ödənişlər və mesajlar silinəcək. Tələbənin portala girişi ləğv olunacaq.',
    lesson_cancel: ' dərsi ləğv edilmiş kimi qeyd olunacaq.',
  }[confirm?.entity] || ' silinəcək.';
  function apply() {
    if (!confirm) return;
    if (cancelling) {
      quick({ action: 'lesson_status', id: confirm.id, status: 'cancelled' }, 'Dərs ləğv edildi.');
    } else {
      quick({ action: 'delete', entity: confirm.entity, id: confirm.id }, 'Qeyd silindi.');
    }
  }
  return (
    <AlertDialog.Root open={Boolean(confirm)} onOpenChange={open => { if (!open) setConfirm(null); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClass + ' z-60'} />
        <AlertDialog.Content className={dialogClass + ' z-60 max-w-md'} {...focus}>
          <AlertDialog.Title className={titleClass}>{cancelling ? 'Dərs ləğv edilsin?' : 'Bu qeyd silinsin?'}</AlertDialog.Title>
          <AlertDialog.Description className={descriptionClass}>
            “{confirm?.title}”{impact} Bu əməliyyatı geri qaytarmaq mümkün deyil.
          </AlertDialog.Description>
          <div className="flex flex-wrap justify-end gap-2.5">
            <AlertDialog.Cancel className="btn secondary">Vaz keç</AlertDialog.Cancel>
            <AlertDialog.Action className="btn danger-button" disabled={busy} onClick={apply}>
              {cancelling ? 'Dərsi ləğv et' : 'Bəli, sil'}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export default function PortalDialogs({ data, tutor, signedIn, signIn, modal, setModal, formError, setFormError, busy, formSubmit, selectedDay, open, invite, confirm, setConfirm, quick, student }) {
  const focus = useDialogFocus();
  const kind = modal?.kind;
  const { title, description } = dialogHeading(modal);
  function close() {
    setModal(null);
    setFormError('');
  }
  return (
    <>
      <Dialog.Root open={Boolean(modal)} onOpenChange={open => { if (!open) close(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className={overlayClass + ' z-50'} />
          <Dialog.Content
            className={dialogClass + ' z-50 ' + (kind === 'read' ? 'max-w-[650px]' : 'max-w-lg')}
            {...focus}
          >
            <Dialog.Title className={titleClass}>{title}</Dialog.Title>
            <Dialog.Description className={descriptionClass}>{description}</Dialog.Description>
            {kind === 'auth' && (
              <div className="flex flex-col gap-3.5">
                <div className="mx-auto my-4 rounded-[18px] bg-[#f1f7ea] p-6 text-[#6d9b4e]"><ShieldCheck size={36} /></div>
                <a className="btn primary full" href={signedIn ? '/account' : signIn} target="_top">
                  {signedIn ? 'Hesabıma keç' : 'ChatGPT ilə daxil ol'} <ArrowRight size={18} />
                </a>
                <button className="btn secondary full" onClick={close}>Nümunəyə baxmağa davam et</button>
              </div>
            )}
            {kind === 'invite' && <Invitation code={modal.code} />}
            {kind === 'read' && <MaterialReading item={modal.item} tutor={tutor} busy={busy} open={open} setConfirm={setConfirm} />}
            {kind === 'lessonDetail' && (
              <LessonDetail item={modal.item} student={student} tutor={tutor} tutorName={data.tutorName} busy={busy} open={open} quick={quick} setConfirm={setConfirm} />
            )}
            {formTitles[kind] && (
              <PortalForm key={kind + ':' + (modal.item?.id || '')} {...{ modal, data, busy, formError, formSubmit, close, selectedDay, open, invite, setConfirm }} />
            )}
            <Dialog.Close className="icon-button absolute top-4 right-4" aria-label="Bağla"><X size={19} /></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ConfirmAction {...{ confirm, busy, setConfirm, quick }} />
    </>
  );
}
