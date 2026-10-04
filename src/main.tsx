
  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import { preloadStoredLocale } from "./app/components/I18nProvider";
  import "./styles/index.css";

  // Chinese catalogs are split out; load the saved locale first so the first paint is in it.
  void preloadStoredLocale().then(() => {
    createRoot(document.getElementById("root")!).render(<App />);
  });

