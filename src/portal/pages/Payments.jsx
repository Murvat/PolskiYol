import { Check, Clock, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { fmtDate, money } from '../format.js';
import { Badge, Blank } from '../shared.jsx';
import { ActionsMenu } from './Feed.jsx';
import { FilterButtons } from './Materials.jsx';

const statusFilters = [
  ['all', 'Hamısı'],
  ['pending', 'Gözləyir'],
  ['paid', 'Ödənilib'],
];

function PaymentSummary({ payments, tutor }) {
  const paidTotal = payments.filter(({ status }) => status === 'paid').reduce((sum, { amount }) => sum + amount, 0);
  const pending = payments.filter(({ status }) => status === 'pending');
  const pendingTotal = pending.reduce((sum, { amount }) => sum + amount, 0);

  return (
    <div className="payment-stats">
      <div className="payment-total">
        <span><Wallet size={20} aria-hidden="true" /> {tutor ? 'Qəbul edilmiş ödənişlər' : 'Ödənilən məbləğ'}</span>
        <strong>{money(paidTotal)}</strong>
        <small>Bütün dövrlər üzrə</small>
      </div>
      <div className="payment-total pending">
        <span><Clock size={20} aria-hidden="true" /> Gözləyən ödənişlər</span>
        <strong>{money(pendingTotal)}</strong>
        <small>{pending.length} ödəniş gözlənilir</small>
      </div>
      <div className="payment-explainer">
        <ShieldCheck size={28} aria-hidden="true" />
        <h3>Aydın ödəniş tarixçəsi</h3>
        <p>
          {tutor
            ? 'Ödənişi qəbul etdikdən sonra “Ödənilib” kimi qeyd et.'
            : 'Ödəniş üsulunu müəlliminlə razılaşdır. Ödənişin qəbul edildikdən sonra müəllimin statusu yeniləyəcək.'}
        </p>
      </div>
    </div>
  );
}

function PaymentRow({ payment, today, tutor, api, quick, setConfirm, student }) {
  const paid = payment.status === 'paid';
  const actions = [
    {
      text: paid ? 'Gözləyən kimi qeyd et' : 'Ödənilib kimi qeyd et',
      icon: Check,
      run: () => quick({
        action: 'payment_status',
        id: payment.id,
        status: paid ? 'pending' : 'paid',
      }, 'Ödəniş statusu yeniləndi.'),
    },
    {
      text: 'Qeydi sil',
      icon: Trash2,
      destructive: true,
      run: () => setConfirm({ entity: 'payments', id: payment.id, title: payment.title }),
    },
  ];

  return (
    <tr className="border-b transition-colors hover:bg-[#f7faf6] last:border-0">
      {tutor && <td><strong>{student(payment.student_id)?.name}</strong></td>}
      <td>{payment.title}</td>
      <td>
        {fmtDate(payment.due_date)}
        {!paid && payment.due_date < today && <small className="overdue">Gecikib</small>}
      </td>
      <td><strong>{money(payment.amount)}</strong></td>
      <td>
        <Badge tone={paid ? 'green' : 'amber'}>
          {paid ? <><Check size={12} aria-hidden="true" /> Ödənilib</> : <><Clock size={12} aria-hidden="true" /> Gözləyir</>}
        </Badge>
      </td>
      {tutor && (
        <td>
          {(!api || !paid) && <ActionsMenu label={payment.title + ' — seçimlər'} actions={api ? actions.slice(0, 1) : actions} />}
        </td>
      )}
    </tr>
  );
}

export default function Payments({ data, tutor, filter, setFilter, quick, setConfirm, student }) {
  const payments = data.payments.filter(payment => filter === 'all' || payment.status === filter);

  return (
    <>
      <PaymentSummary payments={data.payments} tutor={tutor} />
      <section className="panel">
        <div className="panel-heading flex-wrap">
          <h2>Ödəniş tarixçəsi</h2>
          <FilterButtons label="Ödəniş statusu" options={statusFilters} value={filter} onChange={setFilter} />
        </div>
        <div className="relative w-full overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr>
                {tutor && <th scope="col">Tələbə</th>}
                <th scope="col">Təsvir</th>
                <th scope="col">Son tarix</th>
                <th scope="col">Məbləğ</th>
                <th scope="col">Status</th>
                {tutor && <th scope="col"><span className="sr-only">Seçimlər</span></th>}
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  today={data.today}
                  api={data.api}
                  tutor={tutor}
                  quick={quick}
                  setConfirm={setConfirm}
                  student={student}
                />
              ))}
            </tbody>
          </table>
        </div>
        {!payments.length && (
          <Blank
            title="Ödəniş qeydi yoxdur"
            body={tutor ? 'İlk ödəniş qeydini əlavə et.' : 'Ödənişlərin burada görünəcək.'}
            icon={Wallet}
          />
        )}
      </section>
    </>
  );
}
