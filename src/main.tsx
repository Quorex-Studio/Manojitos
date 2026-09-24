import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { reloadForNewVersion } from "./lib/chunkReload";

// Vite avisa cuando no puede cargar un archivo de una versión anterior: recargar
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
