import { adminLogin, adminStatus, callAdmin, clearAdminToken } from "../admin-api.js";
import { subscribeToChanges } from "../realtime.js";
import { brand, copyText, escapeHTML, formatPoints, loadingPage, setButtonBusy, shell, showFormMessage, showToast, stat } from "../ui.js";

export async function renderAdmin(root, context) {
  document.title = "Admin · BigGame";
  root.innerHTML = loadingPage("Checking admin session…");
  if (!(await adminStatus())) {
    if (context.isActive()) renderLogin();
    return;
  }
  if (context.isActive()) await renderDashboard();

  function renderLogin() {
    root.innerHTML = `
      <div class="page">
        <header class="header"><div class="header-inner">${brand()}</div></header>
        <main class="main" style="display:grid;place-items:center"><div class="container narrow stack">
          <div class="center"><h1 class="page-title">Admin login</h1><p class="muted">Enter the organizer’s admin code.</p></div>
          <form id="admin-login" class="card card-pad stack-sm">
            <div><label class="label sr-only" for="admin-code">Admin code</label><input id="admin-code" type="password" class="input input-code" placeholder="ADMIN CODE" maxlength="80" autocomplete="current-password" required></div>
            <div id="admin-login-message"></div>
            <button id="admin-login-submit" class="btn btn-primary w-full" type="submit">Enter →</button>
          </form>
          <div class="center"><a href="/team" data-link class="small quiet" style="text-decoration:none">← Team portal</a></div>
        </div></main>
      </div>`;
    root.querySelector("#admin-login").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = root.querySelector("#admin-login-submit");
      const message = root.querySelector("#admin-login-message");
      setButtonBusy(button, true, "Checking…");
      showFormMessage(message, "");
      try {
        await adminLogin(root.querySelector("#admin-code").value);
        await renderDashboard();
      } catch (error) {
        showFormMessage(message, error.message || "Login failed.");
        setButtonBusy(button, false);
      }
    });
  }

  async function renderDashboard() {
    root.innerHTML = loadingPage("Loading admin data…");
    let stations = [];
    let teams = [];
    let board = [];
    let members = [];
    let settings = { id: 1, leaderboard_public: true };
    let firstLoad = true;

    async function load() {
      try {
        const data = await callAdmin("adminData");
        stations = data.stations || [];
        teams = data.teams || [];
        board = data.leaderboard || [];
        members = data.members || [];
        settings = data.settings || { id: 1, leaderboard_public: true };
        if (!context.isActive()) return;
        draw();
        if (firstLoad) {
          firstLoad = false;
          context.onCleanup(subscribeToChanges(["stations", "teams", "members", "completions", "settings"], load));
        }
      } catch (error) {
        if (!context.isActive()) return;
        root.innerHTML = shell(`<div class="card card-pad center"><h1>Couldn’t load admin data</h1><p class="alert alert-error">${escapeHTML(error.message)}</p><button id="admin-retry" class="btn btn-primary">Try again</button></div>`, { wide: true, action: logoutButton() });
        root.querySelector("#admin-retry")?.addEventListener("click", load);
        bindLogout();
      }
    }

    function logoutButton() {
      return `<button id="admin-logout" class="header-action" type="button">Logout</button>`;
    }

    function draw() {
      const memberMap = new Map(teams.map((team) => [team.id, []]));
      for (const member of members) memberMap.get(member.team_id)?.push(member);
      const stationRows = stations.length ? stations.map((station) => `<tr>
        <td>${escapeHTML(station.sort_order)}</td><td><strong>${escapeHTML(station.name)}</strong>${station.description ? `<div class="xsmall muted">${escapeHTML(station.description)}</div>` : ""}</td>
        <td><button class="btn-link copy-station" type="button" data-code="${escapeHTML(station.code)}">${escapeHTML(station.code)} ⧉</button></td><td>${formatPoints(station.max_score)}</td>
        <td class="table-action"><button class="btn-link danger delete-station" type="button" data-id="${station.id}">Delete</button></td>
      </tr>`).join("") : `<tr><td colspan="5" class="empty">No stations yet.</td></tr>`;

      const teamRows = teams.length ? teams.map((team) => {
        const teamMembers = memberMap.get(team.id) || [];
        return `<div style="padding:1rem 1.25rem;border-top:1px solid #f1f5f9">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap"><strong>${escapeHTML(team.name)}</strong><span class="code-badge">${escapeHTML(team.code)}</span></div>
          <div class="member-chips">${teamMembers.length ? teamMembers.map((member) => `<span class="member-chip">${escapeHTML(member.name)}<button type="button" class="remove-member" data-id="${member.id}" aria-label="Remove ${escapeHTML(member.name)}">×</button></span>`).join("") : `<span class="xsmall quiet">No members</span>`}</div>
          <form class="add-member-form inline-fields" data-team="${team.id}" style="margin-top:.65rem;max-width:26rem"><input class="input" name="member" maxlength="40" placeholder="Add a member" required><button class="btn btn-ghost btn-small" type="submit">Add</button></form>
        </div>`;
      }).join("") : `<div class="empty">No teams yet.</div>`;

      root.innerHTML = shell(`
        <section class="grid-3">${stat("Teams", teams.length)}${stat("Stations", stations.length)}${stat("Total scores", board.reduce((sum, row) => sum + Number(row.tasks_completed), 0))}</section>
        <section class="card toggle-card">
          <div class="toggle-icon">${settings.leaderboard_public ? "🌐" : "🔒"}</div>
          <div class="toggle-copy"><strong>Live leaderboard</strong><div class="small muted">${settings.leaderboard_public ? "Visible to teams" : "Hidden from teams"}</div><div class="xsmall quiet">${settings.leaderboard_public ? "Teams can see rankings and everyone’s points." : "Teams can see only their own progress."}</div></div>
          <button id="toggle-board" class="btn btn-ghost" type="button">${settings.leaderboard_public ? "Hide from teams" : "Show to teams"}</button>
        </section>
        <section class="card card-pad">
          <h2 class="section-title">Add a station</h2>
          <form id="add-station" class="form-grid">
            <div><label class="label" for="station-name">Station name *</label><input id="station-name" name="name" class="input" maxlength="60" required></div>
            <div><label class="label" for="station-description">Description</label><input id="station-description" name="description" class="input" maxlength="120"></div>
            <div><label class="label" for="new-station-code">Code (optional)</label><input id="new-station-code" name="code" class="input mono" maxlength="8" placeholder="Auto-generated"></div>
            <div class="inline-fields"><div><label class="label" for="station-order">Order</label><input id="station-order" name="sort_order" class="input" type="number" value="0"></div><div><label class="label" for="station-max">Max score</label><input id="station-max" name="max_score" class="input" type="number" min="0" max="100" value="10" required></div></div>
            <div id="station-message"></div><button id="station-submit" class="btn btn-primary" type="submit">Add station</button>
          </form>
        </section>
        <section class="card">
          <div class="card-header"><h2>Stations (${stations.length})</h2></div>
          <div class="table-wrap"><table><thead><tr><th>Order</th><th>Name</th><th>Code</th><th>Max</th><th></th></tr></thead><tbody>${stationRows}</tbody></table></div>
        </section>
        <section class="card"><div class="card-header"><h2>Teams & members</h2></div>${teamRows}</section>
        <section class="card card-pad">
          <h2 class="section-title">📱 QR code quiz</h2><p class="small muted">Create the quiz station, manage questions, monitor attempts, and print its QR code.</p>
          <div class="form-actions"><a href="/admin/quiz" data-link class="btn btn-primary">Open quiz manager</a><button id="create-qr-station" type="button" class="btn btn-ghost">Create QR station</button>${stations.some((item) => item.code === "QRQUIZ") ? `<button id="show-qr" type="button" class="btn btn-ghost">Show QR code</button>` : ""}</div>
        </section>
        <section class="card card-pad danger-zone"><h2 class="section-title">Danger zone</h2><p class="small">Delete all teams, members, quiz attempts, answers, and scores. Stations and questions are kept.</p><button id="reset-game" class="btn btn-danger" type="button">Reset game data</button></section>
      `, { wide: true, action: logoutButton() });
      bindEvents();
    }

    function bindLogout() {
      root.querySelector("#admin-logout")?.addEventListener("click", () => {
        clearAdminToken();
        context.navigate("/admin", { replace: true });
      });
    }

    function bindEvents() {
      bindLogout();
      root.querySelector("#toggle-board")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        setButtonBusy(button, true, "Saving…");
        try { await callAdmin("setLeaderboardPublic", { value: !settings.leaderboard_public }); await load(); }
        catch (error) { showToast(error.message, "error"); setButtonBusy(button, false); }
      });

      root.querySelector("#add-station")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = root.querySelector("#station-submit");
        const message = root.querySelector("#station-message");
        const values = Object.fromEntries(new FormData(form));
        values.code = values.code.trim().toUpperCase();
        values.sort_order = Number(values.sort_order) || 0;
        values.max_score = Number(values.max_score);
        setButtonBusy(button, true, "Adding…");
        showFormMessage(message, "");
        try { await callAdmin("createStation", { station: values }); showToast("Station added", "success"); await load(); }
        catch (error) { showFormMessage(message, error.message); setButtonBusy(button, false); }
      });

      root.querySelectorAll(".delete-station").forEach((button) => button.addEventListener("click", async () => {
        if (!window.confirm("Delete this station and all of its scores?")) return;
        try { await callAdmin("deleteStation", { id: button.dataset.id }); showToast("Station deleted", "success"); await load(); }
        catch (error) { showToast(error.message, "error"); }
      }));
      root.querySelectorAll(".copy-station").forEach((button) => button.addEventListener("click", () => copyText(button.dataset.code)));

      root.querySelectorAll(".add-member-form").forEach((form) => form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = form.elements.member;
        const submit = form.querySelector("button");
        setButtonBusy(submit, true, "…");
        try { await callAdmin("addMember", { teamId: form.dataset.team, name: input.value }); await load(); }
        catch (error) { showToast(error.message, "error"); setButtonBusy(submit, false); }
      }));
      root.querySelectorAll(".remove-member").forEach((button) => button.addEventListener("click", async () => {
        if (!window.confirm("Remove this member?")) return;
        try { await callAdmin("removeMember", { id: button.dataset.id }); await load(); }
        catch (error) { showToast(error.message, "error"); }
      }));

      root.querySelector("#create-qr-station")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        setButtonBusy(button, true, "Creating…");
        try { await callAdmin("createQRStation"); showToast("QR quiz station is ready", "success"); await load(); }
        catch (error) { showToast(error.message, "error"); setButtonBusy(button, false); }
      });
      root.querySelector("#show-qr")?.addEventListener("click", showQRModal);
      root.querySelector("#reset-game")?.addEventListener("click", async (event) => {
        if (!window.confirm("Delete ALL teams, members, scores, and quiz attempts? This cannot be undone.")) return;
        const button = event.currentTarget;
        setButtonBusy(button, true, "Resetting…");
        try { await callAdmin("resetGame"); showToast("Game data reset", "success"); await load(); }
        catch (error) { showToast(error.message, "error"); setButtonBusy(button, false); }
      });
    }

    function showQRModal() {
      const url = `${window.location.origin}/team/QRQUIZ/qr-form`;
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.id = "qr-modal";
      backdrop.innerHTML = `<div class="modal card center"><h2>QR Quiz</h2><p class="small muted">Teams scan this code to open the quiz.</p><div id="qr-output" class="qr-box"></div><p class="mono xsmall" style="overflow-wrap:anywhere">${escapeHTML(url)}</p><div class="form-actions no-print" style="justify-content:center"><button id="copy-qr-link" class="btn btn-ghost">Copy link</button><button id="print-qr" class="btn btn-primary">Print</button><button id="close-qr" class="btn btn-ghost">Close</button></div></div>`;
      document.body.append(backdrop);
      if (window.QRCode) new window.QRCode(backdrop.querySelector("#qr-output"), { text: url, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.H });
      else backdrop.querySelector("#qr-output").textContent = "QR library unavailable";
      backdrop.querySelector("#copy-qr-link").addEventListener("click", () => copyText(url));
      backdrop.querySelector("#print-qr").addEventListener("click", () => window.print());
      backdrop.querySelector("#close-qr").addEventListener("click", () => backdrop.remove());
      backdrop.addEventListener("click", (event) => { if (event.target === backdrop) backdrop.remove(); });
    }

    await load();
  }
}
