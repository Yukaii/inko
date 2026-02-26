import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { WordBankPage } from "./pages/WordBankPage.js";
import { PracticePage } from "./pages/PracticePage.js";
import { SettingsPage } from "./pages/SettingsPage.js";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
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
