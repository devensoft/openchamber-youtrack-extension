// service/main.ts
import http from "node:http";
// node_modules/@openchamber/sdk/dist/scrollbar-style.js
var GUEST_SCROLLING_ATTRIBUTE = "data-oc-scrolling";
var GUEST_SCROLLBAR_CSS = `
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${GUEST_SCROLLING_ATTRIBUTE}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${GUEST_SCROLLING_ATTRIBUTE}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;
function installGuestScrollbarActivity(doc) {
  const root = doc.documentElement;
  if (root.hasAttribute("data-oc-scrollbar-activity"))
    return;
  root.setAttribute("data-oc-scrollbar-activity", "");
  const timers = new WeakMap;
  doc.addEventListener("scroll", (event) => {
    const target = event.target === doc ? root : event.target;
    if (!(target instanceof Element))
      return;
    if (!target.hasAttribute("data-oc-scrolling"))
      target.setAttribute("data-oc-scrolling", "");
    const pending = timers.get(target);
    if (pending !== undefined)
      clearTimeout(pending);
    timers.set(target, setTimeout(() => {
      timers.delete(target);
      target.removeAttribute("data-oc-scrolling");
    }, 1000));
  }, { capture: true, passive: true });
}
var GUEST_SCROLLBAR_SCRIPT = `(${installGuestScrollbarActivity.toString()})(document);`;
// node_modules/@openchamber/sdk/dist/manifest.js
var TRACKER_URL_TOKENS = ["{id}", "{segment}", "{segments+}"];
var TRACKER_URL_TOKEN_SET = new Set(TRACKER_URL_TOKENS);
// node_modules/@openchamber/sdk/dist/session-events.js
var GUEST_SESSION_EVENT_TYPES = [
  "turn-finished",
  "turn-failed",
  "permission-asked",
  "question-asked",
  "turn-started",
  "session-created",
  "session-archived",
  "session-deleted"
];
var SESSION_EVENTS_PATH = "/session-events";
var SESSION_EVENTS_WIRE_VERSION = 1;
var SESSION_EVENTS_IDLE_MS = 10 * 60000;
var EVENT_TYPES = new Set(GUEST_SESSION_EVENT_TYPES);
var isGuestSessionEventType = (value) => EVENT_TYPES.has(value);
var readSessionEventRequest = (body) => {
  let wire;
  try {
    const parsed = JSON.parse(body);
    if (Object(parsed) !== parsed || parsed === null)
      return null;
    wire = parsed;
  } catch {
    return null;
  }
  const { v, requestId, event, content } = wire;
  if (v !== SESSION_EVENTS_WIRE_VERSION)
    return null;
  if (String(requestId) !== requestId || requestId.length === 0)
    return null;
  if (Object(event) !== event || event === undefined)
    return null;
  const { id, type, at, session, project, linked, permission, question } = event;
  if (String(id) !== id || id.length === 0)
    return null;
  if (String(type) !== type || !isGuestSessionEventType(type))
    return null;
  if (!Number.isFinite(at))
    return null;
  if (Object(session) !== session || session === undefined)
    return null;
  const sessionId = session.id;
  if (String(sessionId) !== sessionId || sessionId.length === 0)
    return null;
  const parentId = session.parentId;
  if (parentId !== null && (String(parentId) !== parentId || parentId.length === 0))
    return null;
  if (Object(project) !== project || project === undefined)
    return null;
  const directory = project.directory;
  if (directory !== null && (String(directory) !== directory || directory.length === 0))
    return null;
  if (!Array.isArray(linked))
    return null;
  const request = {
    v: SESSION_EVENTS_WIRE_VERSION,
    requestId,
    event: { id, type, at: Number(at), session: { id: sessionId, parentId }, project: { directory }, linked }
  };
  if (permission !== undefined) {
    if (Object(permission) !== permission)
      return null;
    const permissionRequestId = permission.requestId;
    if (String(permissionRequestId) !== permissionRequestId || permissionRequestId.length === 0)
      return null;
    request.event.permission = { requestId: permissionRequestId };
  }
  if (question !== undefined) {
    if (Object(question) !== question)
      return null;
    const { kind, id: questionId } = question;
    if (kind !== "form" && kind !== "page")
      return null;
    if (String(questionId) !== questionId || questionId.length === 0)
      return null;
    request.event.question = { kind, id: questionId };
  }
  if (content !== undefined) {
    if (Object(content) !== content || content.type !== type)
      return null;
    request.content = content;
  }
  return request;
};
// node_modules/@openchamber/sdk/dist/service-host.js
var SERVICE_SCHEDULE_IDLE_MS = 10 * 60000;
var MENTIONS_IDLE_MS = 10 * 60000;
// node_modules/@openchamber/sdk/dist/file-editor.js
var patternExpressions = new Map;
// node_modules/@openchamber/sdk/dist/contract.js
var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
var GUEST_GENERATE_LATE_KEEP_MS = 60 * 60000;
var HOST_REQUEST_ERROR_CODES = [
  "HOST_UNAVAILABLE",
  "HOST_TIMEOUT",
  "HOST_REJECTED",
  "DISCONNECTED",
  "DISABLED",
  "BAD_PATH",
  "NO_INTEGRATION",
  "NO_SERVICE",
  "SERVICE_FAILED",
  "REQUEST_FAILED",
  "RESPONSE_TOO_LARGE",
  "NO_SESSION",
  "SESSION_BUSY",
  "NOT_GRANTED",
  "NO_DIRECTORY",
  "NOT_FOUND",
  "FILE_TOO_LARGE",
  "DENIED",
  "NO_MODEL",
  "MODEL_FAILED",
  "UNSUPPORTED"
];
var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);
var HOST_PUSH_TYPES = new Set([
  "workspace",
  "shells",
  "ready",
  "directory",
  "session",
  "connection",
  "settings",
  "session-lifecycle",
  "item",
  "resolve",
  "action",
  "service-event",
  "status-control-event",
  "popover-closed",
  "file-open",
  "file-snapshot",
  "file-saved",
  "generate-late"
]);
// node_modules/@openchamber/sdk/dist/service-providers.js
var BROWSER_CONTROL_ACTIONS = [
  "browser.open",
  "browser.snapshot",
  "browser.click",
  "browser.type",
  "browser.select",
  "browser.scroll",
  "browser.back",
  "browser.forward",
  "browser.inspect",
  "browser.capture",
  "browser.resize",
  "browser.close"
];
var BROWSER_PROVIDER_IDLE_MS = 10 * 60000;
var CONTROL_ACTIONS = new Set(BROWSER_CONTROL_ACTIONS);
var SOURCE_CONTROL_PROVIDER_IDLE_MS = 10 * 60000;
var OPENCHAMBER_HOST_CALLBACK_URL = "OPENCHAMBER_HOST_CALLBACK_URL";
var postOutbound = async (url, handle, request, timeoutMs, fail) => {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${handle}`, "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs + 5000)
    });
  } catch (error) {
    throw fail(`OpenChamber did not answer: ${error instanceof Error ? error.message : String(error)}`, "HOST_UNAVAILABLE", 0);
  }
  let answer;
  try {
    answer = Object(await response.json());
  } catch {
    throw fail("OpenChamber answered with something other than JSON", "HOST_UNAVAILABLE", response.status);
  }
  if (!response.ok) {
    const message = answer.error?.message;
    const code = answer.error?.code;
    throw fail(String(message) === message && message.length > 0 ? message : `OpenChamber refused the request (${response.status})`, String(code) === code && code.length > 0 ? code : "OUTBOUND_REFUSED", response.status);
  }
  if (!Number.isSafeInteger(answer.status) || String(answer.body) !== answer.body) {
    throw fail("OpenChamber relayed a malformed answer", "HOST_UNAVAILABLE", response.status);
  }
  const headers = {};
  for (const [name, text] of Object.entries(Object(answer.headers ?? {}))) {
    if (String(text) === text)
      headers[name] = text;
  }
  return { status: Number(answer.status), headers, body: answer.body };
};
var NOTIFICATIONS_PROVIDER_IDLE_MS = 10 * 60000;
var readNotificationsAccount = (account) => {
  if (account === null)
    return null;
  if (Object(account) !== account || account === undefined)
    return;
  const { id, login } = account;
  if (String(id) !== id || id.length === 0)
    return;
  if (login !== null && (String(login) !== login || login.length === 0))
    return;
  return { id, login };
};
var TRACKER_PROVIDER_PATH = "/tracker";
var TRACKER_PROVIDER_WIRE_VERSION = 1;
var TRACKER_PROVIDER_METHODS = [
  "auth.probe",
  "auth.verify",
  "items.list",
  "items.get",
  "items.updateState",
  "items.liveSummaries",
  "states.list",
  "containers.list",
  "comments.create"
];
var TRACKER_PROVIDER_ERROR_MESSAGE_MAX = 2000;
var TRACKER_PROVIDER_IDLE_MS = 10 * 60000;
var TRACKER_OUTBOUND_PATH = "/tracker/outbound";
var TRACKER_OUTBOUND_TIMEOUT_MS = 20000;
var isTrackerProviderMethod = (value) => TRACKER_PROVIDER_METHODS.some((method) => method === value);
var readTrackerProviderRequest = (body) => {
  let wire;
  try {
    const parsed = JSON.parse(body);
    if (Object(parsed) !== parsed || parsed === null)
      return null;
    wire = parsed;
  } catch {
    return null;
  }
  const { v, requestId, method, provider, session, input } = wire;
  if (v !== TRACKER_PROVIDER_WIRE_VERSION)
    return null;
  if (String(requestId) !== requestId || requestId.length === 0)
    return null;
  if (String(provider) !== provider || provider.length === 0)
    return null;
  if (String(method) !== method || !isTrackerProviderMethod(method))
    return null;
  if (Object(input) !== input || Array.isArray(input))
    return null;
  if (Object(session) !== session || session === null || session === undefined)
    return null;
  const { instance, handle } = session;
  if (String(instance) !== instance || instance.length === 0 || String(handle) !== handle || handle.length === 0)
    return null;
  const account = readNotificationsAccount(session.account);
  if (account === undefined)
    return null;
  return { v: TRACKER_PROVIDER_WIRE_VERSION, requestId, method, provider, session: { instance, handle, account }, input };
};

class TrackerOutboundError extends Error {
  code;
  status;
  constructor(message, code, status) {
    super(message);
    this.name = "TrackerOutboundError";
    this.code = code;
    this.status = status;
  }
}
var createTrackerOutbound = ({ env }) => {
  const base = env[OPENCHAMBER_HOST_CALLBACK_URL];
  if (!base)
    throw new Error(`${OPENCHAMBER_HOST_CALLBACK_URL} is not set: only a service that provides "tracker" can reach a tracker's server.`);
  const url = `${base.replace(/\/+$/, "")}${TRACKER_OUTBOUND_PATH}`;
  return {
    request: (handle, request) => postOutbound(url, handle, request, TRACKER_OUTBOUND_TIMEOUT_MS, (message, code, status) => new TrackerOutboundError(message, code, status))
  };
};
var QUOTA_PROVIDER_IDLE_MS = 10 * 60000;
// node_modules/@openchamber/sdk/dist/service-surface.js
var SURFACE_CONTROLLERS = ["none", "agent", "user"];
var CONTROLLERS = new Set(SURFACE_CONTROLLERS);
// service/mapping.ts
var normaliseMineText = (value) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
var stripGitSuffix = (value) => value.replace(/\/+$/, "").replace(/\.git$/i, "");
var repoIdentityOf = (value) => {
  let text = value.trim();
  if (!text)
    return null;
  const scp = /^[^@\s]+@[^:\s]+:(.+)$/.exec(text);
  if (scp) {
    text = scp[1] ?? "";
  } else {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
      try {
        text = new URL(text).pathname;
      } catch {}
    }
    text = text.replace(/^\/+/, "");
    const hosted = /^[a-z0-9.-]+\.[a-z]{2,}\/(.+)$/i.exec(text);
    if (hosted)
      text = hosted[1] ?? text;
  }
  const parts = stripGitSuffix(text).split(/[\\/]+/).filter((part) => part.length > 0);
  if (parts.length === 0)
    return null;
  return parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : parts[0] ?? null;
};
var repoNameOf = (value) => {
  const identity = repoIdentityOf(value);
  if (!identity)
    return null;
  return identity.split("/").pop() ?? identity;
};
var formsOf = (value) => {
  const trimmed = value.trim();
  if (!trimmed)
    return [];
  const forms = [trimmed];
  for (const form of [repoIdentityOf(trimmed), repoNameOf(trimmed)]) {
    if (form && !forms.includes(form))
      forms.push(form);
  }
  return forms;
};
var DESCRIPTION_JSON_KEYS = new Set([
  "ocprojectname",
  "githuburl",
  "repourl",
  "repositoryurl",
  "gitremote",
  "giturl",
  "remoteurl",
  "remote",
  "reponame",
  "repositoryname",
  "projectname",
  "project",
  "repo",
  "repository",
  "youtrackproject",
  "youtrackprojectkey",
  "youtrackprojectid"
]);
var FENCED_BLOCK = /```[^\n]*\r?\n([\s\S]*?)```/g;
var collectJsonValues = (value, out) => {
  if (Array.isArray(value)) {
    for (const item of value)
      collectJsonValues(item, out);
    return;
  }
  if (!value || typeof value !== "object")
    return;
  for (const [key, child] of Object.entries(value)) {
    if (DESCRIPTION_JSON_KEYS.has(key.toLowerCase())) {
      if (typeof child === "string" && child.trim())
        out.push(child.trim());
      if (Array.isArray(child)) {
        for (const item of child) {
          if (typeof item === "string" && item.trim())
            out.push(item.trim());
        }
      }
      continue;
    }
    collectJsonValues(child, out);
  }
};
var jsonDescriptionValues = (description) => {
  const values = [];
  const blocks = [...description.matchAll(FENCED_BLOCK)].flatMap((match) => match[1] ? [match[1]] : []);
  const trimmed = description.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("["))
    blocks.push(trimmed);
  for (const block of blocks) {
    try {
      collectJsonValues(JSON.parse(block), values);
    } catch {}
  }
  return values;
};
var descriptionValues = (description) => {
  if (!description)
    return [];
  return [...new Set(jsonDescriptionValues(description))];
};
var descriptionMatches = (description, hints) => {
  const wanted = [...new Set(hints.flatMap(formsOf))].map(normaliseMineText);
  if (wanted.length === 0)
    return false;
  const described = descriptionValues(description).flatMap(formsOf).map(normaliseMineText);
  return wanted.some((form) => described.includes(form));
};

// service/project.ts
import { execFile } from "node:child_process";
import { basename, isAbsolute } from "node:path";

// service/ttl-cache.ts
var createTtlCache = (defaultTtlMs) => {
  const entries = new Map;
  return {
    get: (key) => {
      const entry = entries.get(key);
      if (!entry)
        return;
      if (Date.now() - entry.at >= entry.ttl) {
        entries.delete(key);
        return;
      }
      return entry.value;
    },
    set: (key, value, ttlMs = defaultTtlMs) => {
      entries.set(key, { at: Date.now(), ttl: ttlMs, value });
    },
    delete: (key) => {
      entries.delete(key);
    }
  };
};

// service/project.ts
var GIT_ANSWER_TTL_MS = 5 * 60000;
var runGit = (directory, args) => new Promise((resolve, reject) => {
  execFile("git", ["-C", directory, ...args], { timeout: 3000, maxBuffer: 64 * 1024 }, (error, stdout) => {
    if (error)
      reject(error);
    else
      resolve(String(stdout).trim());
  });
});
var remoteCache = createTtlCache(GIT_ANSWER_TTL_MS);
var rootCache = createTtlCache(GIT_ANSWER_TTL_MS);
var gitIdentityOf = async (directory) => {
  if (!directory || !isAbsolute(directory) || directory.includes("\x00"))
    return null;
  const cached = remoteCache.get(directory);
  if (cached !== undefined)
    return cached;
  let remote = "";
  try {
    remote = await runGit(directory, ["remote", "get-url", "origin"]);
  } catch {}
  if (!remote) {
    try {
      const names = (await runGit(directory, ["remote"])).split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
      if (names[0])
        remote = await runGit(directory, ["remote", "get-url", names[0]]);
    } catch {}
  }
  const value = remote ? { remote, repo: repoNameOf(remote) } : null;
  remoteCache.set(directory, value);
  return value;
};
var projectRootOf = async (directory) => {
  if (!directory || !isAbsolute(directory) || directory.includes("\x00"))
    return null;
  const cached = rootCache.get(directory);
  if (cached !== undefined)
    return cached;
  let value = null;
  try {
    const output = await runGit(directory, ["worktree", "list", "--porcelain"]);
    const first = output.split(/\r?\n/).find((line) => line.startsWith("worktree "));
    if (first)
      value = first.slice("worktree ".length).trim() || null;
  } catch {}
  value ??= directory;
  rootCache.set(directory, value);
  return value;
};
var textOf = (input, key) => {
  if (!input || typeof input !== "object")
    return null;
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};
var hintsOf = async (directory, projectName) => {
  const hints = [];
  const folder = directory ? basename(directory) : "";
  if (folder)
    hints.push({ value: folder });
  if (projectName)
    hints.push({ value: projectName });
  const git = await gitIdentityOf(directory);
  if (git?.remote)
    hints.push({ value: git.remote });
  if (git?.repo)
    hints.push({ value: git.repo });
  return hints;
};
var scopeOf = async (input, fallback) => {
  const requested = textOf(input, "directory") ?? textOf(input, "projectPath") ?? fallback;
  const directory = await projectRootOf(requested);
  const projectName = textOf(input, "projectName");
  return { directory, projectName, hints: await hintsOf(directory, projectName) };
};

// service/session-scope.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute as isAbsolute2, join } from "node:path";
var dataDir = process.env.OPENCHAMBER_SERVICE_DATA_DIR?.trim() || null;
var file = dataDir ? join(dataDir, "session-scope.json") : null;
var latest = null;
var latestSessionDirectory = () => latest;
var rememberSessionDirectory = (directory) => {
  if (!directory || !isAbsolute2(directory) || directory.includes("\x00"))
    return;
  latest = directory;
  if (!file)
    return;
  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(file, JSON.stringify({ directory }));
  } catch (error) {
    console.error(`[youtrack] could not save the session folder: ${error instanceof Error ? error.message : String(error)}`);
  }
};
if (file) {
  try {
    const stored = JSON.parse(readFileSync(file, "utf8"));
    if (typeof stored.directory === "string" && isAbsolute2(stored.directory)) {
      latest = stored.directory;
    }
  } catch {}
}

// service/query.ts
var quoteTerm = (term) => /\s/.test(term) ? `{${term}}` : term;
var valueListQuery = (field, names) => `${field}: ${names.map(quoteTerm).join(", ")}`;
var projectQuery = (containers) => {
  const terms = containers.map((container) => container.key ?? container.name).filter((term) => Boolean(term));
  if (terms.length === 0)
    return null;
  return `project: ${terms.map(quoteTerm).join(", ")}`;
};
var PRIORITY_QUERY = {
  urgent: ["Show-stopper", "Critical", "Blocker"],
  high: ["Major", "High"],
  medium: ["Normal", "Medium"],
  low: ["Minor", "Low"]
};
var priorityFilterQuery = (priority) => {
  if (priority === "all" || priority === "none")
    return null;
  const names = PRIORITY_QUERY[priority];
  if (!names)
    return null;
  return valueListQuery("Priority", names);
};
var peopleFilterQuery = (people) => {
  if (people === "me")
    return "for: me";
  if (people === "created")
    return "created by: me";
  return null;
};
var stateNameQuery = (names) => names.length === 0 ? null : valueListQuery("State", names);
var categoryFallback = (category) => category === "canceled" ? "#Resolved" : "#Unresolved";

// service/youtrack.ts
var ISSUE_FIELDS = [
  "id",
  "idReadable",
  "summary",
  "description",
  "created",
  "updated",
  "resolved",
  "project(id,name,shortName)",
  "tags(id,name,color(id))",
  "customFields(name,value(id,name,isResolved,login,fullName,avatarUrl))"
].join(",");
var ISSUE_FIELDS_WITH_COMMENTS = `${ISSUE_FIELDS},comments(id,text,created,author(id,login,name,fullName,avatarUrl))`;
var iso = (ms) => typeof ms === "number" && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
var absolute = (instance, url) => {
  if (!url)
    return null;
  if (/^https?:\/\//i.test(url))
    return url;
  return `${instance}${url.startsWith("/") ? "" : "/"}${url}`;
};
var single = (value) => {
  if (Array.isArray(value))
    return value[0] ?? null;
  return value ?? null;
};
var fieldNamed = (issue, name) => {
  const field = issue.customFields?.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  return single(field?.value);
};
var isStateValue = (value) => Object(value) === value && !Array.isArray(value) && typeof value.isResolved === "boolean";
var stateOf = (issue) => {
  for (const field of issue.customFields ?? []) {
    const candidates = Array.isArray(field.value) ? field.value : [field.value];
    const state = candidates.find(isStateValue);
    if (state)
      return { name: field.name, value: state };
  }
  return { name: "State", value: null };
};
var categoryOf = (name, isResolved) => {
  const text = (name ?? "").trim().toLowerCase();
  if (/won'?t fix|cancel|duplicate|obsolete|rejected|declined|invalid/.test(text))
    return "canceled";
  if (isResolved === true)
    return "done";
  if (!text)
    return null;
  if (/backlog|icebox/.test(text))
    return "backlog";
  if (/triage|inbox/.test(text))
    return "triage";
  if (/in progress|in review|review|testing|\bqa\b|doing|started|in dev|development|implement|pending/.test(text))
    return "in-progress";
  if (/to ?do|todo|submitted|open|new|ready|approved/.test(text))
    return "todo";
  return "todo";
};
var COMMON_STATE_NAMES = [
  "Triage",
  "Inbox",
  "Backlog",
  "Icebox",
  "Submitted",
  "Open",
  "New",
  "Ready",
  "Approved",
  "To Do",
  "In Progress",
  "In Review",
  "Review",
  "Testing",
  "QA",
  "Doing",
  "Started",
  "In Development",
  "Pending Deploy",
  "Won't fix",
  "Duplicate",
  "Obsolete",
  "Rejected",
  "Declined",
  "Invalid"
];
var commonStateNames = (category) => COMMON_STATE_NAMES.filter((name) => categoryOf(name, false) === category);
var PRIORITY_BY_NAME = {
  "show-stopper": "urgent",
  showstopper: "urgent",
  blocker: "urgent",
  critical: "urgent",
  highest: "urgent",
  major: "high",
  high: "high",
  normal: "medium",
  medium: "medium",
  minor: "low",
  low: "low",
  lowest: "low",
  "no priority": "none",
  none: "none"
};
var priorityOf = (name) => {
  if (!name)
    return "none";
  return PRIORITY_BY_NAME[name.trim().toLowerCase()] ?? "none";
};
var personOf = (instance, value) => {
  if (!value)
    return null;
  const name = ("fullName" in value ? value.fullName : undefined) ?? value.name ?? value.login ?? null;
  if (!name)
    return null;
  return { name, avatarUrl: absolute(instance, value.avatarUrl) };
};
var toContainer = (project) => ({
  id: project.id,
  key: project.shortName ?? project.name ?? null,
  name: project.name ?? project.shortName ?? project.id
});
var toSummary = (instance, raw) => {
  const identifier = (raw.idReadable ?? raw.id).toUpperCase();
  const state = stateOf(raw);
  const priority = fieldNamed(raw, "priority");
  const assignee = fieldNamed(raw, "assignee");
  return {
    id: raw.id,
    identifier,
    title: raw.summary ?? identifier,
    url: `${instance}/issue/${encodeURIComponent(identifier)}`,
    state: state.value ? {
      id: state.value.id ?? null,
      name: state.value.name ?? "",
      category: categoryOf(state.value.name, state.value.isResolved)
    } : null,
    priority: priorityOf(priority?.name),
    labels: (raw.tags ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name ?? tag.id,
      color: tag.color?.id ?? null
    })),
    assignee: personOf(instance, assignee),
    container: raw.project ? toContainer(raw.project) : null,
    updatedAt: iso(raw.updated)
  };
};
var toComment = (instance, raw) => ({
  id: raw.id,
  body: raw.text ?? "",
  createdAt: iso(raw.created),
  author: personOf(instance, raw.author)
});
var toItem = (instance, raw) => ({
  ...toSummary(instance, raw),
  description: raw.description ?? null,
  comments: (raw.comments ?? []).map((comment) => toComment(instance, comment))
});
var toWorkflowState = (value, position) => ({
  id: value.name ?? value.id ?? `state-${position}`,
  name: value.name ?? value.id ?? `State ${position}`,
  category: categoryOf(value.name, value.isResolved),
  position
});
var toLiveSummary = (instance, raw) => {
  const summary = toSummary(instance, raw);
  return {
    identifier: summary.identifier,
    title: summary.title,
    state: { name: summary.state?.name ?? "Open", category: summary.state?.category ?? "todo" }
  };
};

// service/main.ts
var port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
var serviceToken = process.env.OPENCHAMBER_SERVICE_TOKEN ?? "";
if (!port || !serviceToken) {
  console.error("OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN are required");
  process.exit(1);
}
var outbound = createTrackerOutbound({ env: process.env });
var PAGE_SIZE = 40;
var cacheKey = (call, ...parts) => [call.instance, call.accountId || `handle:${call.handle}`, ...parts].join("\x00");

class CallError extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
var serverFailure = (response) => {
  if (response.status === 401)
    return new CallError("YouTrack refused the credential.", 401);
  let message = `YouTrack answered ${response.status}.`;
  try {
    const parsed = JSON.parse(response.body);
    const detail = parsed.error_description ?? parsed.error ?? parsed.message;
    if (detail)
      message = `YouTrack answered ${response.status}: ${detail}`;
  } catch {}
  return new CallError(message, response.status);
};
var api = async (call, method, path, options = {}) => {
  const response = await outbound.request(call.handle, {
    method,
    path,
    query: options.query,
    headers: options.body ? { accept: "application/json", "content-type": "application/json" } : { accept: "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status >= 400)
    throw serverFailure(response);
  try {
    const data = JSON.parse(response.body);
    return data;
  } catch {
    throw new CallError("YouTrack answered with something other than JSON.", 502);
  }
};
var orNull = async (request) => {
  try {
    return await request;
  } catch (error) {
    if (error instanceof CallError && error.status === 404)
      return null;
    throw error;
  }
};
var seg = encodeURIComponent;
var PROJECTS_TTL_MS = 5 * 60000;
var PROJECTS_RETRY_MS = 30000;
var PROJECTS_CACHE = createTtlCache(PROJECTS_TTL_MS);
var PROJECTS_INFLIGHT = new Map;
var ALL_CONTAINERS = new Map;
var readProjects = async (call) => {
  const projects = new Map;
  for (let skip = 0;skip < 5000; skip += 100) {
    const page = await api(call, "GET", "/api/admin/projects", {
      query: {
        fields: "id,name,shortName",
        $top: "100",
        $skip: String(skip)
      }
    });
    for (const project of page) {
      if (project.id)
        projects.set(project.id, project);
    }
    if (page.length < 100)
      break;
  }
  return [...projects.values()].map(toContainer);
};
var loadProjects = async (call) => {
  const key = cacheKey(call);
  const cached = PROJECTS_CACHE.get(key);
  if (cached !== undefined)
    return cached;
  const inflight = PROJECTS_INFLIGHT.get(key);
  if (inflight)
    return inflight;
  const request = (async () => {
    try {
      const all = await readProjects(call);
      PROJECTS_CACHE.set(key, all);
      ALL_CONTAINERS.set(key, all);
      return all;
    } catch (error) {
      console.error(`[youtrack] could not read the project list: ${error instanceof Error ? error.message : String(error)}`);
      const fallback = PROJECTS_CACHE.get(key) ?? ALL_CONTAINERS.get(key) ?? [];
      PROJECTS_CACHE.set(key, fallback, PROJECTS_RETRY_MS);
      return fallback;
    } finally {
      PROJECTS_INFLIGHT.delete(key);
    }
  })();
  PROJECTS_INFLIGHT.set(key, request);
  return request;
};
var containerFilterQuery = async (call, containerId) => {
  const key = cacheKey(call);
  const known = ALL_CONTAINERS.get(key) ?? [];
  let container = known.find((entry) => entry.id === containerId);
  if (!container) {
    await loadProjects(call);
    container = (ALL_CONTAINERS.get(key) ?? []).find((entry) => entry.id === containerId);
  }
  if (container)
    return `project: ${quoteTerm(container.key ?? container.name)}`;
  try {
    const project = await orNull(api(call, "GET", `/api/admin/projects/${seg(containerId)}`, { query: { fields: "id,name,shortName" } }));
    if (project)
      return `project: ${quoteTerm(project.shortName ?? project.name ?? containerId)}`;
  } catch (error) {
    if (!(error instanceof CallError))
      throw error;
  }
  throw new CallError(`Unknown YouTrack project ${containerId}.`, 404);
};
var ISSUE_MAPPING_TTL_MS = 60000;
var ISSUE_MAPPING_CACHE = createTtlCache(ISSUE_MAPPING_TTL_MS);
var issueMappingOf = async (call, scope) => {
  if (scope.hints.length === 0)
    return null;
  const key = cacheKey(call, scope.directory ?? "", scope.projectName ?? "");
  const cached = ISSUE_MAPPING_CACHE.get(key);
  if (cached !== undefined)
    return cached;
  const values = scope.hints.map((hint) => hint.value).filter(Boolean);
  const terms = [...new Set(scope.hints.map((hint) => repoNameOf(hint.value) ?? hint.value.trim()).filter((term) => term.length >= 3))];
  const projects = new Map;
  const matchedTerms = new Set;
  for (const term of terms) {
    try {
      const issues = await api(call, "GET", "/api/issues", {
        query: {
          query: term,
          $top: "20",
          fields: "id,idReadable,project(id,shortName,name),description"
        }
      });
      for (const issue of issues) {
        if (!issue.project?.id)
          continue;
        if (!descriptionMatches(issue.description, values))
          continue;
        projects.set(issue.project.id, toContainer(issue.project));
        matchedTerms.add(term);
      }
    } catch (error) {
      if (error instanceof CallError && (error.status === 403 || error.status === 404))
        continue;
      throw error;
    }
  }
  const value = {
    projects: [...projects.values()],
    terms: [...matchedTerms]
  };
  ISSUE_MAPPING_CACHE.set(key, value);
  return value;
};
var STATE_NAMES_CACHE = new Map;
var loadStates = async (call, containerId) => {
  const stateKey = cacheKey(call, containerId);
  const cached = STATE_NAMES_CACHE.get(stateKey);
  if (cached)
    return cached;
  let states = [];
  try {
    const fields = await api(call, "GET", `/api/admin/projects/${seg(containerId)}/customFields`, { query: { fields: "id,name,field(name),bundle(values(id,name,isResolved))" } });
    const stateField = fields.find((field) => (field.bundle?.values ?? []).some(isStateValue));
    states = (stateField?.bundle?.values ?? []).map((value, position) => toWorkflowState(value, position));
  } catch (error) {
    if (!(error instanceof CallError && (error.status === 403 || error.status === 404)))
      throw error;
  }
  if (states.length === 0)
    states = await observedStates(call, containerId);
  STATE_NAMES_CACHE.set(stateKey, states);
  return states;
};
var observedStates = async (call, containerId) => {
  const container = (await loadProjects(call)).find((entry) => entry.id === containerId);
  if (!container)
    return [];
  const term = container.key ?? container.name;
  const issues = await api(call, "GET", "/api/issues", {
    query: {
      query: `project: ${/\s/.test(term) ? `{${term}}` : term}`,
      $top: "100",
      fields: "id,customFields(name,value(id,name,isResolved))"
    }
  });
  const byName = new Map;
  for (const issue of issues) {
    const value = stateOf(issue).value;
    if (value?.name)
      byName.set(value.name, value);
  }
  return [...byName.values()].map((value, position) => toWorkflowState(value, position));
};
var MAX_STATE_CONTAINERS = 40;
var statesForAll = async (call, containers) => {
  const queue = [...containers];
  const states = [];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    for (;; ) {
      const next = queue.shift();
      if (!next)
        return;
      try {
        states.push(...await loadStates(call, next.id));
      } catch (error) {
        console.error(`[youtrack] could not read the workflow of ${next.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });
  await Promise.all(workers);
  return states;
};
var stateFilterQuery = async (call, filter, containerId, containers) => {
  if (filter === "all")
    return null;
  if (filter === "open")
    return "#Unresolved";
  if (filter === "done")
    return "#Resolved";
  const categories = ["triage", "backlog", "todo", "in-progress", "canceled"];
  const category = categories.find((value) => value === filter);
  if (!category)
    return "#Unresolved";
  if (containerId) {
    const states = await loadStates(call, containerId);
    const names = states.filter((state) => state.category === category).map((state) => state.name);
    return stateNameQuery(names) ?? categoryFallback(category);
  }
  const visible = containers ?? await loadProjects(call);
  if (visible.length > MAX_STATE_CONTAINERS) {
    return stateNameQuery(commonStateNames(category)) ?? categoryFallback(category);
  }
  const states = await statesForAll(call, visible);
  const names = [...new Set(states.filter((state) => state.category === category).map((state) => state.name))];
  return stateNameQuery(names) ?? categoryFallback(category);
};
var handlers = {
  "auth.probe": async (call) => {
    const response = await outbound.request(call.handle, {
      method: "GET",
      path: "/api/config",
      query: { fields: "version" },
      headers: { accept: "application/json" }
    });
    if (response.status !== 200) {
      return { supported: false, message: `${call.instance} answered ${response.status} to /api/config.` };
    }
    try {
      const config = JSON.parse(response.body);
      return typeof config.version === "string" ? { supported: true } : { supported: false, message: `${call.instance} does not look like a YouTrack server.` };
    } catch {
      return { supported: false, message: `${call.instance} did not answer with JSON.` };
    }
  },
  "auth.verify": async (call) => {
    const me = await api(call, "GET", "/api/users/me", { query: { fields: "id,login,name,fullName,email,avatarUrl" } });
    const account = {
      id: me.id ?? me.login ?? "me",
      login: me.login ?? null
    };
    const name = me.fullName ?? me.name;
    if (name)
      account.name = name;
    const avatarUrl = absolute(call.instance, me.avatarUrl);
    if (avatarUrl)
      account.avatarUrl = avatarUrl;
    return { account };
  },
  "items.list": async (call, input) => {
    const skip = Math.max(0, Number(input.cursor ?? "0") || 0);
    const parts = [];
    const scope = await scopeOf(input, latestSessionDirectory());
    const mapping = await issueMappingOf(call, scope);
    const mapped = mapping && mapping.projects.length > 0 ? mapping : null;
    if (input.containerId) {
      parts.push(await containerFilterQuery(call, input.containerId));
    } else if (mapped) {
      const scope = projectQuery(mapped.projects);
      if (scope)
        parts.push(scope);
    } else {
      const scope = projectQuery(await loadProjects(call));
      if (scope)
        parts.push(scope);
    }
    const metadataTerm = mapped ? mapped.terms.find((term) => !/\s/.test(term)) ?? mapped.terms[0] ?? null : null;
    if (metadataTerm)
      parts.push(metadataTerm);
    const stateQuery = await stateFilterQuery(call, input.state, input.containerId, input.containerId ? null : mapped?.projects ?? null);
    if (stateQuery)
      parts.push(stateQuery);
    const peopleQuery = peopleFilterQuery(input.people);
    if (peopleQuery)
      parts.push(peopleQuery);
    const priorityQuery = priorityFilterQuery(input.priority);
    if (priorityQuery)
      parts.push(priorityQuery);
    if (input.query?.trim())
      parts.push(input.query.trim());
    const query = {
      fields: ISSUE_FIELDS,
      $top: String(PAGE_SIZE),
      $skip: String(skip)
    };
    if (parts.length > 0)
      query.query = parts.join(" and ");
    const page = await api(call, "GET", "/api/issues", { query });
    const items = metadataTerm && scope.hints.length > 0 ? page.filter((issue) => descriptionMatches(issue.description, scope.hints.map((hint) => hint.value))) : page;
    const hasMore = page.length >= PAGE_SIZE;
    return {
      items: items.map((issue) => toSummary(call.instance, issue)),
      cursor: hasMore ? String(skip + page.length) : null,
      hasMore
    };
  },
  "items.get": async (call, input) => {
    const issue = await orNull(api(call, "GET", `/api/issues/${seg(input.id)}`, { query: { fields: ISSUE_FIELDS_WITH_COMMENTS } }));
    return { item: issue ? toItem(call.instance, issue) : null };
  },
  "items.updateState": async (call, input) => {
    const current = await api(call, "GET", `/api/issues/${seg(input.id)}`, { query: { fields: `id,idReadable,${ISSUE_FIELDS}` } });
    const field = stateOf(current);
    const updated = await api(call, "POST", `/api/issues/${seg(input.id)}`, {
      query: { fields: ISSUE_FIELDS },
      body: { customFields: [{ name: field.name, value: { name: input.stateId } }] }
    });
    if (stateOf(updated).value?.name === input.stateId) {
      return { item: toItem(call.instance, updated) };
    }
    await api(call, "POST", "/api/commands", {
      query: { fields: "id" },
      body: {
        query: `${field.name} ${/\s/.test(input.stateId) ? `{${input.stateId}}` : input.stateId}`,
        issues: [{ idReadable: current.idReadable ?? input.id }]
      }
    });
    const again = await api(call, "GET", `/api/issues/${seg(input.id)}`, { query: { fields: ISSUE_FIELDS_WITH_COMMENTS } });
    return { item: toItem(call.instance, again) };
  },
  "items.liveSummaries": async (call, input) => {
    const items = [];
    const queue = [...input.identifiers];
    const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
      for (;; ) {
        const next = queue.shift();
        if (!next)
          return;
        const issue = await orNull(api(call, "GET", `/api/issues/${seg(next)}`, { query: { fields: ISSUE_FIELDS } }));
        if (issue)
          items.push(toLiveSummary(call.instance, issue));
      }
    });
    await Promise.all(workers);
    return { items };
  },
  "states.list": async (call, input) => ({
    states: await loadStates(call, input.containerId)
  }),
  "containers.list": async (call, input) => {
    const scope = await scopeOf(input, latestSessionDirectory());
    if (scope.directory || scope.projectName) {
      try {
        await issueMappingOf(call, scope);
      } catch (error) {
        console.error(`[youtrack] could not resolve the project mapping: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { containers: await loadProjects(call) };
  },
  "comments.create": async (call, input) => {
    const comment = await orNull(api(call, "POST", `/api/issues/${seg(input.identifier)}/comments`, { query: { fields: "id,text" }, body: { text: input.body } }));
    return { comment: comment ? { id: comment.id } : null };
  }
};
var failureOf = (error) => {
  const failure = {
    message: error.message.slice(0, TRACKER_PROVIDER_ERROR_MESSAGE_MAX) || "Unexpected failure"
  };
  if (error instanceof TrackerOutboundError) {
    if (error.status >= 400 && error.status <= 599)
      failure.status = error.status;
    if (/^[A-Z_]{1,64}$/.test(error.code))
      failure.code = error.code;
  } else if (error instanceof CallError) {
    failure.status = error.status;
  }
  return failure;
};
var answer = async (method, call, input) => {
  try {
    const data = await handlers[method](call, input);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: failureOf(error instanceof Error ? error : new Error(String(error))) };
  }
};
var send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
var readBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => resolve(body));
  req.on("error", reject);
});
var server = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${serviceToken}`) {
    send(res, 401, { error: "unauthorized" });
    return;
  }
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname === SESSION_EVENTS_PATH && req.method === "POST") {
    readBody(req).then((body) => {
      const event = readSessionEventRequest(body);
      if (!event) {
        send(res, 400, { ok: false, error: "not a session event this service understands" });
        return;
      }
      const directory = event.event.project.directory;
      const topLevel = event.event.session.parentId === null;
      if (topLevel && (event.event.type === "turn-started" || event.event.type === "session-created") && directory) {
        rememberSessionDirectory(directory);
      }
      send(res, 200, { ok: true });
    }).catch(() => send(res, 500, { ok: false, error: "could not read the event" }));
    return;
  }
  if (url.pathname !== TRACKER_PROVIDER_PATH || req.method !== "POST") {
    send(res, 404, { error: "not-found" });
    return;
  }
  readBody(req).then(async (body) => {
    const request = readTrackerProviderRequest(body);
    if (!request) {
      send(res, 400, { error: "not a tracker call this service understands" });
      return;
    }
    send(res, 200, await answer(request.method, {
      instance: request.session.instance,
      handle: request.session.handle,
      accountId: request.session.account?.id ?? ""
    }, request.input));
  }).catch(() => send(res, 500, { error: "could not read the request" }));
});
server.listen(port, "127.0.0.1");
