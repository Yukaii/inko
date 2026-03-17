import { NavLink } from "react-router-dom";
import type { TFunction } from "i18next";
import { SUPPORTED_UI_LANGUAGES } from "../i18n";

type UserInfo = {
  displayName: string;
  email: string;
  canModerateCommunity?: boolean;
};

type NavItem = {
  to: string;
  label: string;
  mobileLabel: string;
  key: string;
};

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function DecksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 4H9l-3-4H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CommunityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const ICONS = {
  dashboard: HomeIcon,
  wordBank: DecksIcon,
  settings: SettingsIcon,
  community: CommunityIcon,
};

export function AppShellNavigation({
  t,
  i18n,
  currentLangLabel,
  user,
  navLinks,
  locationPathname,
  showProfileMenu,
  setShowProfileMenu,
  showLangSubMenu,
  setShowLangSubMenu,
  onSignOut,
  onShowHelp,
  showMobileNav,
}: {
  t: TFunction;
  i18n: { language: string; changeLanguage: (lang: string) => Promise<unknown> | void };
  currentLangLabel: string;
  user: UserInfo | undefined;
  navLinks: NavItem[];
  locationPathname: string;
  showProfileMenu: boolean;
  setShowProfileMenu: (value: boolean) => void;
  showLangSubMenu: boolean;
  setShowLangSubMenu: (value: boolean) => void;
  onSignOut: () => void;
  onShowHelp: () => void;
  showMobileNav: boolean;
}) {
  return (
    <>
      <aside className="hidden h-screen flex-col gap-3 overflow-y-auto border-r border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-page p-6 md:flex">
        <div className="mb-4 text-[22px] text-accent-orange [font-family:var(--font-display)]" role="banner">
          <span lang="ja">inkō</span>
        </div>
        <nav className="flex flex-col gap-1" aria-label={t("common.main_navigation")}>
          {navLinks.map((link, index) => (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                `flex items-center justify-between whitespace-nowrap rounded-xl px-3.5 py-2.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus:bg-bg-elevated focus:text-text-primary ${isActive ? "bg-bg-elevated text-text-primary" : ""}`
              }
              to={link.to}
              tabIndex={0}
              aria-current={locationPathname === link.to ? "page" : undefined}
            >
              <span>{t(link.label)}</span>
              <kbd className="shrink-0 rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card px-1.5 py-0.5 font-mono text-[11px] text-text-secondary opacity-60 transition-all" aria-label={`Shortcut: press ${index + 1}`}>
                {index + 1}
              </kbd>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] pt-4">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center justify-between whitespace-nowrap rounded-xl px-3.5 py-2.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus:bg-bg-elevated focus:text-text-primary ${isActive ? "bg-bg-elevated text-text-primary" : ""}`
            }
            aria-current={locationPathname === "/settings" ? "page" : undefined}
          >
            <span className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              {t("nav.settings")}
            </span>
            <kbd className="shrink-0 rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card px-1.5 py-0.5 font-mono text-[11px] text-text-secondary opacity-60">
              s
            </kbd>
          </NavLink>

          <div className="relative">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl bg-transparent px-3.5 py-2.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus:bg-bg-elevated focus:text-text-primary"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-expanded={showProfileMenu}
              aria-haspopup="menu"
            >
              <span className="flex items-center gap-2 truncate">
                <UserIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{user?.displayName || t("auth.profile")}</span>
              </span>
              <span className="text-xs text-text-secondary">⌄</span>
            </button>

            {showProfileMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card p-1 shadow-lg">
                <div className="border-b border-[var(--border-subtle)] px-3 py-2">
                  <p className="m-0 truncate text-sm font-medium text-text-primary">{user?.displayName}</p>
                  <p className="m-0 truncate text-xs text-text-secondary">{user?.email}</p>
                </div>

                <div className="flex flex-col pt-1">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg bg-transparent px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowLangSubMenu(!showLangSubMenu);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <GlobeIcon className="h-4 w-4" />
                      <span>{currentLangLabel}</span>
                    </div>
                    <span className={`text-[10px] transition-transform ${showLangSubMenu ? "rotate-180" : ""}`}>▼</span>
                  </button>

                  {showLangSubMenu && (
                    <div className="flex flex-col gap-0.5 py-1 pl-6">
                      {SUPPORTED_UI_LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void i18n.changeLanguage(lang.code);
                            setShowLangSubMenu(false);
                          }}
                          className={`flex w-full items-center rounded-md bg-transparent px-3 py-1.5 text-left text-xs transition-colors hover:bg-bg-elevated ${i18n.language.startsWith(lang.code) ? "text-accent-teal" : "text-text-secondary"}`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <NavLink
                  to="/settings"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <SettingsIcon className="h-4 w-4" />
                  {t("auth.settings")}
                </NavLink>
                <NavLink
                  to="/community/submissions"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <InboxIcon className="h-4 w-4 shrink-0" />
                  {t("nav.my_submissions")}
                </NavLink>
                {user?.canModerateCommunity ? (
                  <NavLink
                    to="/community/moderation"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <ShieldIcon className="h-[18px] w-[18px] shrink-0" />
                    {t("nav.community_moderation")}
                  </NavLink>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-sm text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-bg)]"
                  onClick={onSignOut}
                >
                  <LogoutIcon className="h-4 w-4" />
                  {t("auth.sign_out")}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-[10px] border border-dashed border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-transparent px-3.5 py-2.5 text-[13px] font-normal text-text-secondary transition-all hover:border-accent-orange hover:bg-bg-elevated hover:text-text-primary focus:border-accent-orange focus:bg-bg-elevated focus:text-text-primary"
            onClick={onShowHelp}
            aria-label={`${t("nav.shortcuts")} (Shift+?)`}
          >
            <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card px-1.5 py-0.5 font-mono text-[11px]">?</kbd>
            <span>{t("nav.shortcuts")}</span>
          </button>
        </div>
      </aside>

      <nav className={`fixed inset-x-0 bottom-0 z-[9999] h-16 items-center justify-around border-t border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-page px-2 shadow-[0_-2px_10px_color-mix(in_oklab,var(--text-primary)_18%,transparent)] md:hidden ${showMobileNav ? "flex" : "hidden"}`} aria-label={t("common.mobile_navigation")}>
        {navLinks.map((link) => {
          const isActive = locationPathname === link.to;
          const Icon = ICONS[link.key === "d" ? "dashboard" : link.key === "w" ? "wordBank" : "community"];
          return (
            <NavLink
              key={link.to}
              className={`flex min-w-0 max-w-20 flex-1 flex-col items-center justify-center gap-1 bg-transparent px-4 py-2 transition-colors ${isActive ? "text-accent-orange" : "text-text-secondary hover:text-text-primary focus:text-text-primary"}`}
              to={link.to}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-[22px] w-[22px]" />
              <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[11px] font-medium leading-none">
                {t(link.mobileLabel)}
              </span>
            </NavLink>
          );
        })}

        <NavLink
          to="/settings"
          className={`flex min-w-0 max-w-20 flex-1 flex-col items-center justify-center gap-1 bg-transparent px-4 py-2 transition-colors ${locationPathname === "/settings" ? "text-accent-orange" : "text-text-secondary hover:text-text-primary focus:text-text-primary"}`}
          aria-current={locationPathname === "/settings" ? "page" : undefined}
        >
          <SettingsIcon className="h-[22px] w-[22px]" />
          <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[11px] font-medium leading-none">
            {t("nav.settings")}
          </span>
        </NavLink>
      </nav>
    </>
  );
}
