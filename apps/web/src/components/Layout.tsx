import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DEFAULT_SRS_CONFIG, type ThemeMode, type UpdatePreferencesInput, type UserDTO } from "@inko/shared";
import { getShortcutsList, registerShortcut, useKeyboardShortcuts } from "../hooks/useKeyboard";
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
  const queryClient = useQueryClient();
  const [showHelp, setShowHelp] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLangSubMenu, setShowLangSubMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcuts();

  const currentLangLabel = SUPPORTED_UI_LANGUAGES.find((lang) => i18n.language.startsWith(lang.code))?.label || t("common.language_english");
  const navLinks = [
    { to: "/dashboard", label: "nav.dashboard", mobileLabel: "nav.home", key: "d" },
    { to: "/word-bank", label: "nav.word_bank", mobileLabel: "nav.decks", key: "w" },
    { to: "/reader", label: "nav.reader", mobileLabel: "nav.reader", key: "r" },
    { to: "/community", label: "nav.community", mobileLabel: "nav.community", key: "c" },
  ];

  const meQuery = useQuery({
    queryKey: authQueryKey(token, "me"),
    queryFn: () => api.me(token ?? ""),
    enabled: Boolean(token),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const user = meQuery.data as UserDTO | undefined;

  useEffect(() => {
    if (!meQuery.error || !shouldResetAuth(meQuery.error)) {
      return;
    }

    void signOut().finally(() => {
      navigate("/login", { replace: true });
    });
  }, [meQuery.error, navigate, signOut]);

  useEffect(() => {
    const me = meQuery.data as UserDTO | undefined;
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

  useEffect(() => {
    const cleanups = [
      registerShortcut({
        key: "1",
        handler: () => navigate("/dashboard"),
        description: t("shortcuts.go_dashboard", "Go to Dashboard"),
        scope: "global",
      }),
      registerShortcut({
        key: "2",
        handler: () => navigate("/word-bank"),
        description: t("shortcuts.go_word_bank", "Go to Word Bank"),
        scope: "global",
      }),
      registerShortcut({
        key: "3",
        handler: () => navigate("/reader"),
        description: t("shortcuts.go_reader", "Go to Reader"),
        scope: "global",
      }),
      registerShortcut({
        key: "4",
        handler: () => navigate("/community"),
        description: t("shortcuts.go_community", "Go to Community"),
        scope: "global",
      }),
      registerShortcut({
        key: "s",
        handler: () => navigate("/settings"),
        description: t("shortcuts.go_settings", "Go to Settings"),
        scope: "global",
      }),
      registerShortcut({
        key: "?",
        shift: true,
        handler: () => setShowHelp((current) => !current),
        description: t("shortcuts.toggle_help", "Toggle this help"),
        scope: "global",
      }),
    ];

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [navigate, t]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/login", { replace: true });
  }, [navigate, signOut]);

  const updateThemeModeMutation = useMutation({
    mutationFn: async ({ submitted }: { submitted: UpdatePreferencesInput; previousUser: UserDTO }) => {
      const updated = await api.updatePreferences(token ?? "", submitted);
      return { submitted, updated };
    },
    onMutate: ({ submitted, previousUser }) => {
      const nextUser = { ...previousUser, themeMode: submitted.themeMode };
      queryClient.setQueryData(authQueryKey(token, "me"), nextUser);
      applyThemePreferences({ themeMode: submitted.themeMode, themes: previousUser.themes });
      saveThemePreferences({ themeMode: submitted.themeMode, themes: previousUser.themes });
      return { previousUser };
    },
    onSuccess: ({ submitted, updated }) => {
      const nextUser = {
        ...updated,
        themeMode: submitted.themeMode,
        typingMode: submitted.typingMode,
        ttsEnabled: submitted.ttsEnabled,
        srsConfig: submitted.srsConfig,
      };
      queryClient.setQueryData(authQueryKey(token, "me"), nextUser);
      applyThemePreferences({ themeMode: submitted.themeMode, themes: nextUser.themes });
      saveThemePreferences({ themeMode: submitted.themeMode, themes: nextUser.themes });
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousUser) return;
      queryClient.setQueryData(authQueryKey(token, "me"), context.previousUser);
      applyThemePreferences({ themeMode: context.previousUser.themeMode, themes: context.previousUser.themes });
      saveThemePreferences({ themeMode: context.previousUser.themeMode, themes: context.previousUser.themes });
    },
  });

  const handleToggleTheme = useCallback(() => {
    if (!user || updateThemeModeMutation.isPending) return;
    const nextThemeMode: ThemeMode = user.themeMode === "dark" ? "light" : "dark";
    updateThemeModeMutation.mutate({
      submitted: {
        themeMode: nextThemeMode,
        typingMode: user.typingMode,
        ttsEnabled: user.ttsEnabled,
        srsConfig: { ...DEFAULT_SRS_CONFIG, ...user.srsConfig },
      },
      previousUser: user,
    });
  }, [updateThemeModeMutation, user]);

  const shortcuts = getShortcutsList();
  const isPracticeRoute =
    matchPath("/practice/:deckId", location.pathname) !== null ||
    matchPath("/reader/:documentId/practice", location.pathname) !== null;

  return (
    <div className="grid h-screen grid-cols-1 grid-rows-[1fr_auto] overflow-hidden md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1">
      <div ref={profileMenuRef} className="contents">
        <AppShellNavigation
          t={t}
          i18n={i18n}
          currentLangLabel={currentLangLabel}
          user={user}
          navLinks={navLinks}
          locationPathname={location.pathname}
          showProfileMenu={showProfileMenu}
          setShowProfileMenu={setShowProfileMenu}
          showLangSubMenu={showLangSubMenu}
          setShowLangSubMenu={setShowLangSubMenu}
          onSignOut={() => void handleSignOut()}
          onShowHelp={() => setShowHelp(true)}
          onToggleTheme={handleToggleTheme}
          showMobileNav={!isPracticeRoute}
          themeMode={user?.themeMode ?? "dark"}
          themeTogglePending={updateThemeModeMutation.isPending}
        />
      </div>

      <main
        id="main-content"
        className={`h-screen overflow-y-auto px-5 pt-5 [scrollbar-gutter:stable] ${!isPracticeRoute ? "pb-[84px]" : "pb-5"} md:px-10 md:py-8`}
        tabIndex={-1}
      >
        {children}
      </main>

      {showHelp && <KeyboardHelpModal shortcuts={shortcuts} onClose={() => setShowHelp(false)} />}
    </div>
  );
}
