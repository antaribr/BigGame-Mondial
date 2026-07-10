import { fetchStationByCode } from "../api.js";
import { brand, escapeHTML, setButtonBusy, showFormMessage } from "../ui.js";

const STATION_KEY = "bg_station_code";

export async function renderAdvisorEntry(root, { navigate }) {
  document.title = "Advisor Portal · BigGame";
  const savedCode = localStorage.getItem(STATION_KEY) || "";
  root.innerHTML = `
    <div class="page">
      <header class="header"><div class="header-inner" style="justify-content:center">${brand()}</div></header>
      <main class="main" style="display:grid;place-items:center"><div class="container narrow stack">
        <div class="center"><div style="font-size:3rem;margin-bottom:.7rem">🎯</div><p class="eyebrow">Advisor portal</p><h1 class="page-title">Enter your station</h1><p class="muted">Use the private code supplied by the organizer.</p></div>
        ${savedCode ? `<a href="/advisor?code=${encodeURIComponent(savedCode)}" data-link class="alert alert-info" style="display:block;text-decoration:none"><strong>Resume station</strong><br><span class="small mono">${escapeHTML(savedCode)}</span> →</a>` : ""}
        <form id="advisor-form" class="card card-pad stack-sm">
          <div><label class="label" for="station-code">Station code</label><input id="station-code" class="input input-code" placeholder="STATION CODE" maxlength="8" autocomplete="off" autocapitalize="characters" required></div>
          <div id="advisor-message"></div>
          <button id="advisor-submit" class="btn btn-primary w-full" type="submit">Open station →</button>
        </form>
      </div></main>
    </div>`;

  const form = root.querySelector("#advisor-form");
  const input = root.querySelector("#station-code");
  input.addEventListener("input", () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = root.querySelector("#advisor-message");
    const button = root.querySelector("#advisor-submit");
    showFormMessage(message, "");
    setButtonBusy(button, true, "Checking…");
    try {
      const station = await fetchStationByCode(input.value);
      if (!station) throw new Error("No station was found with that code.");
      localStorage.setItem(STATION_KEY, station.code);
      navigate(`/advisor?code=${encodeURIComponent(station.code)}`);
    } catch (error) {
      showFormMessage(message, error.message || "Could not open the station.");
      setButtonBusy(button, false);
    }
  });
}
