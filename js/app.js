import { isConfigured, loadConfig } from "./config.js";
import { initSupabase } from "./supabase-client.js";
import { escapeHTML } from "./ui.js";
import { renderTeamEntry } from "./pages/team-entry.js";
import { renderTeamDashboard } from "./pages/team-dashboard.js";
import { renderAdvisorEntry } from "./pages/advisor-entry.js";
import { renderAdvisorDashboard } from "./pages/advisor-dashboard.js";
import { renderScoreboard } from "./pages/scoreboard.js";
import { renderAdmin } from "./pages/admin.js";
import { renderAdminQuiz } from "./pages/admin-quiz.js";
import { renderQuiz } from "./pages/quiz.js";

const root = document.querySelector("#app");
let cleanups = [];
let routeVersion = 0;

function runCleanups() {
  for (const cleanup of cleanups.splice(0)) {
    try { cleanup(); } catch (error) { console.warn("Cleanup failed", error); }
  }
}

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  renderRoute();
}

function makeContext(params, version) {
  return {
    params,
    navigate,
    isActive: () => version === routeVersion,
    onCleanup: (callback) => cleanups.push(callback),
  };
}

async function renderRoute() {
  runCleanups();
  routeVersion += 1;
  const version = routeVersion;
  window.scrollTo({ top: 0, behavior: "instant" });
  let path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/") {
    navigate("/team", { replace: true });
    return;
  }

  let match;
  let page;
  let params = {};

  if (path === "/team") page = renderTeamEntry;
  else if ((match = path.match(/^\/team\/([^/]+)\/qr-form$/))) {
    page = renderQuiz;
    params = { stationCode: safeDecode(match[1]) };
  } else if ((match = path.match(/^\/team\/([^/]+)$/))) {
    page = renderTeamDashboard;
    params = { code: safeDecode(match[1]) };
  } else if (path === "/advisor") page = renderAdvisorEntry;
  else if ((match = path.match(/^\/advisor\/([^/]+)$/))) {
    page = renderAdvisorDashboard;
    params = { code: safeDecode(match[1]) };
  } else if (path === "/scoreboard") page = renderScoreboard;
  else if (path === "/admin/quiz") page = renderAdminQuiz;
  else if (path === "/admin") page = renderAdmin;

  if (!page) {
    document.title = "Page not found · BigGame";
    root.innerHTML = `<div class="setup-screen"><div class="card card-pad center"><h1>404</h1><p class="muted">That BigGame page does not exist.</p><a href="/team" data-link class="btn btn-primary">Team portal</a></div></div>`;
    return;
  }

  try {
    await page(root, makeContext(params, version));
  } catch (error) {
    if (version !== routeVersion) return;
    console.error(error);
    root.innerHTML = `<div class="setup-screen"><div class="card card-pad center"><h1>Something went wrong</h1><p class="alert alert-error">${escapeHTML(error.message || "Unexpected application error")}</p><button id="app-retry" class="btn btn-primary">Reload page</button></div></div>`;
    root.querySelector("#app-retry")?.addEventListener("click", () => window.location.reload());
  }
}

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function setupNavigation() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-link]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    navigate(`${url.pathname}${url.search}${url.hash}`);
  });
  window.addEventListener("popstate", renderRoute);
}

function renderSetup(error = "") {
  document.title = "Configure BigGame";
  root.innerHTML = `<div class="setup-screen"><div class="card card-pad" style="max-width:38rem;text-align:left"><div class="center"><div class="brand" style="justify-content:center"><span class="brand-mark">B</span><span>BigGame</span></div><h1 style="margin-top:1.25rem">Connect Supabase</h1></div>${error ? `<p class="alert alert-error">${escapeHTML(error)}</p>` : ""}<p>This vanilla app is ready, but <code>config.json</code> still contains placeholder values.</p><ol class="small muted" style="line-height:1.8"><li>Open <code>config.json</code>.</li><li>Set your Supabase project URL and public anon key.</li><li>Run <code>supabase/schema.sql</code> in the Supabase SQL editor.</li><li>Deploy the two Edge Functions using the README instructions.</li><li>Reload this page.</li></ol><p class="xsmall quiet" style="margin-bottom:0">Never put the service-role key or admin code in config.json.</p></div></div>`;
}

async function boot() {
  setupNavigation();
  try {
    const config = await loadConfig();
    window.bigGameConfig = config;
    if (!isConfigured(config)) {
      renderSetup();
      return;
    }
    await initSupabase();
    await renderRoute();
  } catch (error) {
    renderSetup(error.message || "Could not start the application.");
  }
}

boot();
