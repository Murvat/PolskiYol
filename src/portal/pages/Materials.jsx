import { ArrowUpRight, AudioLines, BookOpen, MessageCircle, NotebookPen, Pencil, Search } from 'lucide-react';
import { Blank } from '../shared.jsx';

const materialFilters = [
  ['all', 'Hamısı'],
  ['Danışıq', 'Danışıq'],
  ['Qrammatika', 'Qrammatika'],
  ['Tələffüz', 'Tələffüz'],
];

const covers = {
  'Danışıq': { Icon: MessageCircle, phrase: 'Porozmawiajmy.' },
  'Tələffüz': { Icon: AudioLines, phrase: 'Cześć!' },
};
const defaultCover = { Icon: NotebookPen, phrase: 'Krok po kroku.' };

export function MaterialCard({ material, index = 0, open, tutor }) {
  const { Icon, phrase } = covers[material.category] ?? defaultCover;

  return (
    <article className={`material-card material-${index % 3}`}>
      <button type="button" className="material-open" onClick={() => open('read', material)}>
        <div className="material-cover">
          <span className="material-category">{material.category.toLocaleUpperCase('az-AZ')}</span>
          <Icon size={39} strokeWidth={1.35} aria-hidden="true" />
          <span className="material-level">{material.level}</span>
          <strong>{phrase}</strong>
        </div>
        <div className="material-text">
          <span className="muted">{material.category} <span>·</span> {material.level} səviyyəsi</span>
          <h3>{material.title}</h3>
          <div>Materialı aç <ArrowUpRight size={17} aria-hidden="true" /></div>
        </div>
      </button>
      {tutor && (
        <button
          type="button"
          className="material-edit icon-button"
          aria-label={material.title + ' — düzəliş et'}
          onClick={() => open(material.apiFile ? 'cover' : 'material', material)}
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
      )}
    </article>
  );
}

export function FilterButtons({ label, options, value, onChange, className = '' }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex max-w-full shrink-0 items-center overflow-x-auto rounded-lg bg-[#f1f5f2] p-1 text-[#63786b] ${className}`}
    >
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          data-slot="tabs-trigger"
          aria-pressed={option === value}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap hover:text-[#176e5d] aria-pressed:bg-white aria-pressed:text-[#176e5d] aria-pressed:shadow-sm focus-visible:-outline-offset-2"
          onClick={() => onChange(option)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export default function Materials({ data, tutor, open, filter, setFilter, query, setQuery }) {
  const searchTerm = query.toLocaleLowerCase('az-AZ');
  const materials = data.materials.filter(material =>
    (filter === 'all' || material.category === filter) &&
    `${material.title} ${material.body}`.toLocaleLowerCase('az-AZ').includes(searchTerm),
  );

  return (
    <>
      <div className="section-toolbar">
        <FilterButtons
          label="Material kateqoriyası"
          options={materialFilters}
          value={filter}
          onChange={setFilter}
          className="content-tabs"
        />
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Material axtar"
            placeholder="Material axtar…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
      </div>
      {materials.length ? (
        <div className="material-grid">
          {materials.map((material, index) => (
            <MaterialCard key={material.id} material={material} index={index} tutor={tutor} open={open} />
          ))}
        </div>
      ) : (
        <section className="panel">
          <Blank
            title="Material tapılmadı"
            body={tutor ? 'İlk materialını əlavə et və ya axtarışı dəyiş.' : 'Yeni materiallar tezliklə burada görünəcək.'}
            icon={BookOpen}
          />
        </section>
      )}
    </>
  );
}
