import { fetchTeamByCode, registerTeam } from "../api.js";
import { brand, escapeHTML, setButtonBusy, showFormMessage } from "../ui.js";

const TEAM_KEY = "bg_team_code";

export async function renderTeamEntry(root, { navigate }) {
  document.title = "Team Portal · BigGame";
  const savedCode = localStorage.getItem(TEAM_KEY) || "";
  root.innerHTML = `
    <div class="page">
      <header class="header"><div class="header-inner" style="justify-content:center">${brand()}</div></header>
      <main class="main"><div class="container narrow stack">
        <div class="center"><p class="eyebrow">Team portal</p><h1 class="page-title">Join the game</h1><p class="muted">Create a team or use your team code to rejoin.</p></div>
        ${savedCode ? `<a href="/team?code=${encodeURIComponent(savedCode)}" data-link class="alert alert-info" style="display:block;text-decoration:none"><strong>Resume saved team</strong><br><span class="small mono">${escapeHTML(savedCode)}</span> →</a>` : ""}
        <div class="tabs" role="tablist" aria-label="Team access">
          <button id="register-tab" class="tab active" type="button" role="tab" aria-selected="true">Register a team</button>
          <button id="join-tab" class="tab" type="button" role="tab" aria-selected="false">I have a code</button>
        </div>
        <section id="team-form-panel"></section>
      </div></main>
    </div>`;

  const panel = root.querySelector("#team-form-panel");
  const registerTab = root.querySelector("#register-tab");
  const joinTab = root.querySelector("#join-tab");

  function activate(tab) {
    const isRegister = tab === "register";
    registerTab.classList.toggle("active", isRegister);
    joinTab.classList.toggle("active", !isRegister);
    registerTab.setAttribute("aria-selected", String(isRegister));
    joinTab.setAttribute("aria-selected", String(!isRegister));
    if (isRegister) renderRegister();
    else renderJoin();
  }

  function renderRegister() {
    panel.innerHTML = `
      <form id="register-form" class="card card-pad stack-sm">
        <div class="field"><label class="label" for="team-name">Team name</label><input id="team-name" name="name" class="input" placeholder="e.g. Lightning Bolts" maxlength="40" required autocomplete="organization"></div>
        <div class="field">
          <div style="display:flex;justify-content:space-between;align-items:center"><label class="label" style="margin:0">Team members</label><span id="member-count" class="xsmall quiet">0 added</span></div>
          <div id="member-rows"></div>
          <button id="add-member" class="btn-link" type="button">+ Add member</button>
        </div>
        <div id="register-message"></div>
        <button id="register-submit" class="btn btn-primary w-full" type="submit">Create team & play →</button>
        <p class="center xsmall quiet" style="margin-bottom:0">You’ll receive a code that lets the team rejoin later.</p>
      </form>`;

    const rows = panel.querySelector("#member-rows");
    const count = panel.querySelector("#member-count");
    let memberNumber = 0;

    function updateCount() {
      count.textContent = `${rows.querySelectorAll("input").length ? Array.from(rows.querySelectorAll("input")).filter((input) => input.value.trim()).length : 0} added`;
    }

    function addMember(value = "") {
      memberNumber += 1;
      const row = document.createElement("div");
      row.className = "member-row";
      row.innerHTML = `<label class="sr-only" for="member-${memberNumber}">Member ${memberNumber}</label><input id="member-${memberNumber}" class="input member-input" maxlength="40" placeholder="Member ${memberNumber}" value="${escapeHTML(value)}"><button class="btn btn-ghost btn-small remove-member" type="button" aria-label="Remove member">✕</button>`;
      row.querySelector(".remove-member").addEventListener("click", () => {
        if (rows.children.length > 1) row.remove();
        else row.querySelector("input").value = "";
        updateCount();
      });
      row.querySelector("input").addEventListener("input", updateCount);
      rows.append(row);
    }

    addMember();
    addMember();
    panel.querySelector("#add-member").addEventListener("click", () => {
      addMember();
      rows.lastElementChild.querySelector("input").focus();
    });

    panel.querySelector("#register-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = panel.querySelector("#register-message");
      const button = panel.querySelector("#register-submit");
      showFormMessage(message, "");
      setButtonBusy(button, true, "Creating…");
      try {
        const name = panel.querySelector("#team-name").value;
        const members = Array.from(panel.querySelectorAll(".member-input"), (input) => input.value);
        const team = await registerTeam(name, members);
        localStorage.setItem(TEAM_KEY, team.code);
        navigate(`/team?code=${encodeURIComponent(team.code)}`);
      } catch (error) {
        showFormMessage(message, error.message || "Could not create the team.");
        setButtonBusy(button, false);
      }
    });
  }

  function renderJoin() {
    panel.innerHTML = `
      <form id="join-form" class="card card-pad stack-sm">
        <div class="field"><label class="label" for="team-code">Team code</label><input id="team-code" class="input input-code" placeholder="FX7Q2" maxlength="8" required autocomplete="off" autocapitalize="characters"></div>
        <div id="join-message"></div>
        <button id="join-submit" class="btn btn-primary w-full" type="submit">Join team →</button>
      </form>`;
    const input = panel.querySelector("#team-code");
    input.addEventListener("input", () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); });
    panel.querySelector("#join-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = panel.querySelector("#join-message");
      const button = panel.querySelector("#join-submit");
      showFormMessage(message, "");
      setButtonBusy(button, true, "Checking…");
      try {
        const team = await fetchTeamByCode(input.value);
        if (!team) throw new Error("No team was found with that code.");
        localStorage.setItem(TEAM_KEY, team.code);
        navigate(`/team?code=${encodeURIComponent(team.code)}`);
      } catch (error) {
        showFormMessage(message, error.message || "Could not look up the team.");
        setButtonBusy(button, false);
      }
    });
    input.focus();
  }

  registerTab.addEventListener("click", () => activate("register"));
  joinTab.addEventListener("click", () => activate("join"));
  renderRegister();
}
