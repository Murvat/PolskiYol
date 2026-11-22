import { BookOpen, CalendarDays, LayoutDashboard, MessagesSquare, Rss, UsersRound, Wallet } from 'lucide-react';

export const sections = {
  home: {
    label: 'İcmal',
    icon: LayoutDashboard,
    action: ['Dərs planlaşdır', 'lesson'],
  },
  students: {
    label: 'Tələbələr',
    icon: UsersRound,
    summary: 'Hər tələbənin yolunu yaxından izlə.',
    action: ['Tələbə əlavə et', 'student'],
  },
  lessons: {
    label: 'Dərs cədvəli',
    icon: CalendarDays,
    summary: 'Dərslərin və planların bir yerdə. Bütün saatlar Varşava vaxtı ilədir.',
    action: ['Dərs planlaşdır', 'lesson'],
  },
  materials: {
    label: 'Materiallar',
    icon: BookOpen,
    summary: 'Kiçik məşqlərdən sərbəst danışığa.',
    action: ['Material əlavə et', 'material'],
  },
  feed: {
    label: 'Xəbər lenti',
    icon: Rss,
    summary: 'Yeniliklər, faydalı qeydlər və bir az motivasiya.',
    action: ['Paylaşım yarat', 'post'],
  },
  messages: {
    label: 'Mesajlar',
    icon: MessagesSquare,
    summary: 'Öyrənmək yaxşı bir söhbətlə başlayır.',
  },
  payments: {
    label: 'Ödənişlər',
    icon: Wallet,
    summary: 'Dərs ödənişləri və ödəniş tarixçəsi.',
    action: ['Ödəniş əlavə et', 'payment'],
  },
};

export const sectionPath = (section) => section === 'home' ? '/' : '/' + section;
