import { Inbox } from 'lucide-react';

export function Avatar({ name = '', size = 'normal', tone = 0 }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
  return <span className={`avatar ${size} tone-${Math.max(tone, 0) % 5}`} aria-hidden="true">{initials}</span>;
}

export function Badge({ children, tone = 'green' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Blank({ title, body, icon: Icon = Inbox }) {
  return (
    <div className="blank flex w-full flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex max-w-sm flex-col items-center gap-1.5">
        <span className="grid size-9 place-items-center rounded-lg bg-[#eaf3eb] text-[#518472]" data-slot="empty-icon">
          <Icon size={19} aria-hidden="true" />
        </span>
        <h3 className="font-semibold" data-slot="empty-title">{title}</h3>
        <p data-slot="empty-description">{body}</p>
      </div>
    </div>
  );
}

export function Brand() {
  return <><span className="brand-mark" aria-hidden="true">P<span>•</span></span>Polski<span>Yol</span></>;
}

export const menuClass = 'z-[70] min-w-44 rounded-lg border border-border bg-white p-1 text-sm text-foreground shadow-lg';
export const menuItemClass = 'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-none data-highlighted:bg-accent [&_svg]:size-4';
