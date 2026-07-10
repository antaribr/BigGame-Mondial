export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function brand(home = "") {
  const inner = `<span class="brand-mark" aria-hidden="true">B</span><span>BigGame</span>`;
  return home
    ? `<a class="brand" href="${escapeHTML(home)}" data-link>${inner}</a>`
    : `<div class="brand">${inner}</div>`;
}

export function shell(content, { back = "", backLabel = "← Back", wide = false, action = "" } = {}) {
  return `
    <div class="page">
      <header class="header">
        <div class="header-inner ${wide ? "wide" : ""}">
          ${brand(back)}
          ${action || (back ? `<a class="header-action" href="${escapeHTML(back)}" data-link>${escapeHTML(backLabel)}</a>` : "")}
        </div>
      </header>
      <main class="main"><div class="container ${wide ? "wide" : ""} stack">${content}</div></main>
    </div>`;
}

export function loadingPage(message = "Loading…", options = {}) {
  return shell(`<div class="loading-screen" style="min-height:55vh"><span class="spinner" aria-hidden="true"></span><p>${escapeHTML(message)}</p></div>`, options);
}

export function errorCard(title, message, retryId = "") {
  return `<div class="card card-pad center"><div style="font-size:2.5rem;margin-bottom:.75rem">⚠️</div><h1 class="section-title">${escapeHTML(title)}</h1><p class="muted">${escapeHTML(message)}</p>${retryId ? `<button id="${escapeHTML(retryId)}" class="btn btn-primary">Try again</button>` : ""}</div>`;
}

export function stat(label, value) {
  return `<div class="card stat"><span class="stat-value">${escapeHTML(value)}</span><span class="stat-label">${escapeHTML(label)}</span></div>`;
}

const MEDALS = ["🥇", "🥈", "🥉"];
export function leaderboardList(rows, currentTeamId = "") {
  if (!rows.length) return `<div class="card empty">No teams yet.</div>`;
  return `<div class="leaderboard-list">${rows.map((row) => {
    const me = row.team_id === currentTeamId;
    const rank = Number(row.rank);
    const stations = Number(row.stations_completed ?? row.tasks_completed ?? 0);
    const tasks = Number(row.stations_completed === undefined ? 0 : row.tasks_completed || 0);
    return `<div class="card leaderboard-item ${me ? "is-me" : ""}">
      <div class="leaderboard-row">
        <div class="rank-cell">${rank <= 3 ? MEDALS[rank - 1] : escapeHTML(rank)}</div>
        <div class="leaderboard-main"><div class="team-name">${escapeHTML(row.team_name)} ${me ? `<span class="badge badge-muted">you</span>` : ""}</div><div class="xsmall quiet">${stations} stations · ${tasks} tasks</div></div>
        <div class="points">${formatPoints(row.total_points)}<small>pts</small></div>
      </div>
    </div>`;
  }).join("")}</div>`;
}

export function formatPoints(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function setButtonBusy(button, busy, busyText = "Working…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

export function showToast(message, type = "") {
  const region = document.querySelector("#toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  region.append(item);
  window.setTimeout(() => item.remove(), 3600);
}

export function showFormMessage(element, message, type = "error") {
  if (!element) return;
  element.innerHTML = message ? `<div class="alert alert-${type}">${escapeHTML(message)}</div>` : "";
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard", "success");
  } catch {
    window.prompt("Copy this value:", text);
  }
}

export function debounce(fn, wait = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
