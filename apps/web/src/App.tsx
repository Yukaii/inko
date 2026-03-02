import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useKeyboardShortcuts } from "./hooks/useKeyboard";
import { Layout } from "./components/Layout";
import { PwaUpdateBanner } from "./components/PwaUpdateBanner";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { applyNoIndexMetadata } from "./lib/seo";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const WordBankPage = lazy(() => import("./pages/WordBankPage").then((m) => ({ default: m.WordBankPage })));
const PracticePage = lazy(() => import("./pages/PracticePage").then((m) => ({ default: m.PracticePage })));
const SessionDetailsPage = lazy(() => import("./pages/SessionDetailsPage").then((m) => ({ default: m.SessionDetailsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const CommunityDecksPage = lazy(() => import("./pages/CommunityDecksPage").then((m) => ({ default: m.CommunityDecksPage })));
const CommunityDeckDetailPage = lazy(() => import("./pages/CommunityDeckDetailPage").then((m) => ({ default: m.CommunityDeckDetailPage })));
const AnkiImportPage = lazy(() => import("./pages/AnkiImportPage").then((m) => ({ default: m.AnkiImportPage })));

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  // Initialize keyboard shortcuts system
  useKeyboardShortcuts();

  useEffect(() => {
    applyNoIndexMetadata("Inko App");
  }, []);

  if (isLoading) {
    return <RouteFallback />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
}

function RouteFallback() {
  return <div className="p-[60px] text-center text-base text-text-secondary">Loading...</div>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </ProtectedLayout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <PwaUpdateBanner />
      <a
        href="#main-content"
        className="absolute left-1/2 top-[-100%] z-[10000] -translate-x-1/2 rounded-b-[10px] bg-accent-orange px-5 py-3 font-semibold text-text-on-accent transition-[top] focus:top-0"
      >
        Skip to main content
      </a>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/community"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CommunityDecksPage />
            </Suspense>
          }
        />
        <Route
          path="/community/decks/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CommunityDeckDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/word-bank"
          element={
            <ProtectedRoute>
              <WordBankPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/word-bank/:deckId"
          element={
            <ProtectedRoute>
              <WordBankPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/:deckId"
          element={
            <ProtectedRoute>
              <PracticePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sessions/:sessionId"
          element={
            <ProtectedRoute>
              <SessionDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/imports/anki"
          element={
            <ProtectedRoute>
              <AnkiImportPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
