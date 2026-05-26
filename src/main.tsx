import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./tableGames/rouletteLandscape.css";
import "./tableGames/overUnder.css";
import "./tableGames/crash.css";
import "./tableGames/treasureDig.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
