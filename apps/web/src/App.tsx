import { AuthProvider } from "./hooks/useAuth";
import { AppRoutes } from "./app/AppRoutes";

export function App() {
  return (
    <AuthProvider>
      <a
        href="#main-content"
        className="absolute left-1/2 top-[-100%] z-[10000] -translate-x-1/2 rounded-b-[10px] bg-accent-orange px-5 py-3 font-semibold text-text-on-accent transition-[top] focus:top-0"
      >
        Skip to main content
      </a>
      <AppRoutes />
    </AuthProvider>
  );
}
