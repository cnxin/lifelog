import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfirmProvider } from "./context/ConfirmContext";
import { ToastProvider } from "./context/ToastContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { LifeLogProvider } from "./context/LifeLogContext";
import App from "./App";
import { registerServiceWorker } from "./registerServiceWorker";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <LifeLogProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </ToastProvider>
        </LifeLogProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
