import "@/styles.css";
import { createGame } from "@/app/bootstrap/createGame";

const container = document.getElementById("app");

if (!container) {
  throw new Error("App root not found");
}

createGame(container);

