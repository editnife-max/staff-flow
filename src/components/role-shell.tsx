// The signed-in app frame shared by the Manager, Staff, Admin and Agency areas.
//
//  • Wide screens: a frosted sticky header with the section links inline.
//  • Tablets (when there are many sections): a menu button opens the section list.
//  • Phones: a bottom tab bar with the main sections, plus "More" for the rest —
//    the standard mobile pattern, with every target at least 44px tall.
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

export interface RoleNavItem {
  to: string;
  label: string;
  /** Shorter label for the phone tab bar, when `label` is too long to fit. */
  short?: string;
  icon: LucideIcon;
  /** Show in the phone tab bar. When no item sets this, the first four are used. */
  tab?: boolean;
}

interface RoleShellProps {
  homeTo: string;
  /** "Manager", "Staff"… shown under the brand in the menu. */
  roleLabel: string;
  nav: RoleNavItem[];
  /** Extra header buttons (notification bell, language toggle…). */
  actions?: ReactNode;
  /** Content above the page (banners). */
  banner?: ReactNode;
  children: ReactNode;
  /** Show About / FAQ / Contact in the footer. */
  footerLinks?: boolean;
  mainClassName?: string;
}

/** Shared style for small icon buttons in the header (bell, language…): a 36px target. */
export const headerIconButton =
  "relative inline-grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground";

const MAX_TABS = 5;

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => pathname === to || pathname.startsWith(to + "/");
}

function Brand({ to, compact }: { to: string; compact?: boolean }) {
  return (
    <Link
      to={to}
      className="flex shrink-0 items-center gap-2.5 rounded-lg"
      aria-label="Staff-Flow home"
    >
      <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-primary text-primary-foreground shadow-sm">
        <Building2 className="h-4 w-4" />
      </span>
      <span
        className={cn("text-[15px] font-semibold tracking-tight", compact && "hidden sm:inline")}
      >
        Staff-Flow
      </span>
    </Link>
  );
}

export function RoleShell({
  homeTo,
  roleLabel,
  nav,
  actions,
  banner,
  children,
  footerLinks = true,
  mainClassName,
}: RoleShellProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isActive = useIsActive();
  const [menuOpen, setMenuOpen] = useState(false);

  // Many sections only fit inline on wide screens; a few fit from tablet width.
  const wide = nav.length > 6;
  const showTabs = nav.length >= 2;

  const flagged = nav.filter((n) => n.tab);
  const tabs =
    nav.length <= MAX_TABS ? nav : (flagged.length ? flagged : nav).slice(0, MAX_TABS - 1);
  const overflow = nav.filter((n) => !tabs.includes(n));
  const overflowActive = overflow.some((n) => isActive(n.to));

  const email = user?.email ?? "";
  const initials = (email || "U").slice(0, 2).toUpperCase();

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div
      className={cn("flex min-h-screen flex-col bg-background", showTabs && "pb-tabbar md:pb-0")}
    >
      <header className="glass-bar sticky top-0 z-40 border-b border-border/70 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
          {wide && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={cn(headerIconButton, "-ml-1 hidden md:inline-grid xl:hidden")}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <Brand to={homeTo} compact={nav.length > 1} />

          <nav
            aria-label="Main"
            className={cn(
              "min-w-0 flex-1 items-center",
              wide ? "hidden xl:flex" : "hidden md:flex",
            )}
          >
            <div className="fade-x -mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto px-1 no-scrollbar">
              {nav.map((n) => {
                const active = isActive(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-foreground/[0.07] text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            {actions}
            <DarkModeToggle className={headerIconButton} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-1 flex shrink-0 items-center gap-1 rounded-full p-0.5 transition-colors hover:bg-foreground/[0.06]"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="mr-1 hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm font-medium">{email}</div>
                  <div className="text-xs text-muted-foreground">{roleLabel}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {banner}

      <main className={cn("min-w-0 flex-1", mainClassName)}>{children}</main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <div>© {new Date().getFullYear()} Staff-Flow Agency. All rights reserved.</div>
          {footerLinks && (
            <div className="flex items-center gap-4">
              <Link to="/about" className="hover:text-foreground">
                About
              </Link>
              <Link to="/faq" className="hover:text-foreground">
                FAQ
              </Link>
              <Link to="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </div>
          )}
        </div>
      </footer>

      {/* Phone tab bar */}
      {showTabs && (
        <nav
          aria-label="Main"
          className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t border-border/70 pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div
            className="mx-auto grid h-16 max-w-lg"
            style={{
              gridTemplateColumns: `repeat(${tabs.length + (overflow.length ? 1 : 0)}, minmax(0, 1fr))`,
            }}
          >
            {tabs.map((n) => {
              const active = isActive(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10.5px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground active:text-foreground",
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="max-w-full truncate">{n.short ?? n.label}</span>
                </Link>
              );
            })}
            {overflow.length > 0 && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10.5px] font-medium transition-colors",
                  overflowActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <MoreHorizontal className="h-[22px] w-[22px]" />
                <span>More</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Section list: tablet menu button and the phone "More" tab */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-[300px] flex-col gap-0 p-0 sm:max-w-[300px]">
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2.5 text-base">
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="leading-tight">
                Staff-Flow
                <span className="block text-xs font-normal text-muted-foreground">{roleLabel}</span>
              </span>
            </SheetTitle>
          </SheetHeader>
          <nav aria-label="All sections" className="flex-1 overflow-y-auto p-3">
            {nav.map((n) => {
              const active = isActive(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-foreground/[0.05] hover:text-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t p-3">
            <div className="truncate px-3 pb-2 text-xs text-muted-foreground">{email}</div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-[18px] w-[18px]" /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
