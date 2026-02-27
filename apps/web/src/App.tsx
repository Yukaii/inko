import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useKeyboardShortcuts } from "./hooks/useKeyboard";
import { Layout } from "./components/Layout";

const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const WordBankPage = lazy(() => import("./pages/WordBankPage").then((m) => ({ default: m.WordBankPage })));
const PracticePage = lazy(() => import("./pages/PracticePage").then((m) => ({ default: m.PracticePage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })));

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  // Initialize keyboard shortcuts system
  useKeyboardShortcuts();

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
}

function RouteFallback() {
  return <div className="p-[60px] text-center text-base text-text-secondary">Loading...</div>;
}

export function App() {
  return (
    <AuthProvider>
      <a
        href="#main-content"
        className="absolute left-1/2 top-[-100%] z-[10000] -translate-x-1/2 rounded-b-[10px] bg-accent-orange px-5 py-3 font-semibold text-text-on-accent transition-[top] focus:top-0"
      >
        Skip to main content
      </a>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedLayout>
                <DashboardPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/word-bank"
            element={
              <ProtectedLayout>
                <WordBankPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/word-bank/:deckId"
            element={
              <ProtectedLayout>
                <WordBankPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/practice/:deckId"
            element={
              <ProtectedLayout>
                <PracticePage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedLayout>
                <SettingsPage />
              </ProtectedLayout>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
