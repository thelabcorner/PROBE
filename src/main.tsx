import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Apply saved theme before first paint to avoid flash
try {
  const saved = localStorage.getItem('probe-theme') as 'dark' | 'light' | null;
  document.documentElement.setAttribute('data-theme', saved || 'dark');
} catch {
  document.documentElement.setAttribute('data-theme', 'dark');
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
