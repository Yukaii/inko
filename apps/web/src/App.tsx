import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useKeyboardShortcuts } from "./hooks/useKeyboard";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { WordBankPage } from "./pages/WordBankPage";
import { PracticePage } from "./pages/PracticePage";
import { SettingsPage } from "./pages/SettingsPage";
import { LandingPage } from "./pages/LandingPage";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  // Initialize keyboard shortcuts system
  useKeyboardShortcuts();

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
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
    </AuthProvider>
  );
}
