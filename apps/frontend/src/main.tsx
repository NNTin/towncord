import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./ui";
import "./ui/theme/theme.css";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element '#root' was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
