import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfirmProvider } from "./context/ConfirmContext";
import { LifeLogProvider } from "./context/LifeLogContext";
import App from "./App";
import { registerServiceWorker } from "./registerServiceWorker";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LifeLogProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </LifeLogProvider>
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
