import { Clock3, FolderKanban, LayoutDashboard, NotebookPen } from 'lucide-react';

import type { Viewer } from '@/lib/viewer';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/', label: '總覽', icon: LayoutDashboard },
  { href: '/weekly', label: '我的週報', icon: NotebookPen },
  { href: '/projects', label: '專案時數', icon: FolderKanban },
] as const;

export function AppShell({
  viewer,
  active,
  children,
}: {
  viewer: Viewer;
  active: '/' | '/weekly' | '/projects';
  children: React.ReactNode;
}) {
  const initials = viewer.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-8 px-5 lg:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="人力投入管理首頁">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Clock3 className="size-5" />
            </span>
            <div>
              <p className="font-heading text-sm font-bold tracking-tight">人力投入管理</p>
              <p className="text-[11px] text-muted-foreground">Project Pulse</p>
            </div>
          </a>

          <nav className="hidden items-center gap-1 md:flex" aria-label="主要導覽">
            {navigation.map(({ href, label, icon: Icon }) => (
              <a key={href} className={cn('nav-link', active === href && 'nav-link-active')} href={href}>
                <Icon className="size-4" />{label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{viewer.displayName}</p>
              <p className="max-w-48 truncate text-xs text-muted-foreground">
                {viewer.isPreview ? '本機預覽身分' : viewer.email}
              </p>
            </div>
            <div className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
              {initials || 'U'}
            </div>
          </div>
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-card/96 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="行動版導覽">
        {navigation.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} className={cn('mobile-nav-link', active === href && 'mobile-nav-link-active')}>
            <Icon className="size-5" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
