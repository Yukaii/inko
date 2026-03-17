import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ThemeConfig, ThemeMode } from "@inko/shared";
import { getShortcutsList } from "../hooks/useKeyboard";
import { shouldResetAuth, useAuth } from "../hooks/useAuth";
import { api } from "../api/client";
import { authQueryKey } from "../lib/queryKeys";
import { applyThemePreferences, saveThemePreferences } from "../theme/theme";
import { AppShellNavigation } from "./AppShellNavigation";
import { KeyboardHelpModal } from "./KeyboardHelpModal";
import { SUPPORTED_UI_LANGUAGES } from "../i18n";

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, signOut } = useAuth();
  const [showHelp, setShowHelp] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLangSubMenu, setShowLangSubMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const currentLangLabel = SUPPORTED_UI_LANGUAGES.find((lang) => i18n.language.startsWith(lang.code))?.label || t("common.language_english");

  const meQuery = useQuery({
    queryKey: authQueryKey(token, "me"),
    queryFn: () => api.me(token ?? ""),
    enabled: Boolean(token),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const user = meQuery.data as { displayName: string; email: string; themeMode: ThemeMode; themes: ThemeConfig; canModerateCommunity?: boolean } | undefined;

  useEffect(() => {
    if (!meQuery.error || !shouldResetAuth(meQuery.error)) {
      return;
    }

    void signOut().finally(() => {
      navigate("/login", { replace: true });
    });
  }, [meQuery.error, navigate, signOut]);

  useEffect(() => {
    const me = meQuery.data as { themeMode: ThemeMode; themes: ThemeConfig } | undefined;
    if (!me) return;

    const preferences = { themeMode: me.themeMode, themes: me.themes };
    applyThemePreferences(preferences);
    saveThemePreferences(preferences);
  }, [meQuery.data]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
        setShowLangSubMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/login", { replace: true });
  }, [navigate, signOut]);

  const shortcuts = getShortcutsList();
  const isPracticeRoute = matchPath("/practice/:deckId", location.pathname) !== null;

  return (
    <div className="grid h-screen grid-cols-1 grid-rows-[1fr_auto] overflow-hidden md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1">
      <div ref={profileMenuRef} className="contents">
        <AppShellNavigation
          t={t}
          i18n={i18n}
          currentLangLabel={currentLangLabel}
          user={user}
          navLinks={[
            { to: "/dashboard", label: "nav.dashboard", mobileLabel: "nav.home", key: "d" },
            { to: "/word-bank", label: "nav.word_bank", mobileLabel: "nav.decks", key: "w" },
            { to: "/community", label: "nav.community", mobileLabel: "nav.community", key: "c" },
          ]}
          locationPathname={location.pathname}
          showProfileMenu={showProfileMenu}
          setShowProfileMenu={setShowProfileMenu}
          showLangSubMenu={showLangSubMenu}
          setShowLangSubMenu={setShowLangSubMenu}
          onSignOut={() => void handleSignOut()}
          onShowHelp={() => setShowHelp(true)}
          showMobileNav={!isPracticeRoute}
        />
      </div>

      <main id="main-content" className={`h-screen overflow-y-auto px-5 pt-5 ${!isPracticeRoute ? "pb-[84px]" : "pb-5"} md:px-10 md:py-8`} tabIndex={-1}>
        {children}
      </main>

      {showHelp && <KeyboardHelpModal shortcuts={shortcuts} onClose={() => setShowHelp(false)} />}
    </div>
  );
}
