import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { App } from "./App";
import { makeStore } from "./store/store";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root was not found");
}

createRoot(root).render(
  <StrictMode>
    <Provider store={makeStore()}>
      <App />
    </Provider>
  </StrictMode>,
);
