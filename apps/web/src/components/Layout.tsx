import { NavLink } from "react-router-dom";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">inkō</div>
        <NavLink className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} to="/dashboard">
          dashboard
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} to="/word-bank">
          word_bank
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} to="/settings">
          settings
        </NavLink>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
