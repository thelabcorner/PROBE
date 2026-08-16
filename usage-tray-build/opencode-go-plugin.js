(function () {
  const PROVIDER_ID = "opencode-go";
  const DEFAULT_AUTH_PATH = "~/.local/share/opencode/auth.json";
  const USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
  const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  function readNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function clampPercent(value) {
    const n = readNumber(value);
    if (n === null) return null;
    return Math.max(0, Math.min(100, n));
  }

  function joinPath(base, suffix) {
    return String(base || "").replace(/[\\/]+$/, "") + "/" + String(suffix || "").replace(/^[\\/]+/, "");
  }

  function isWindowsPlatform(ctx) {
    return !!ctx.app && (ctx.app.platform === "windows" || ctx.app.platform === "win32");
  }

  function resolveAuthPaths(ctx) {
    const paths = [];
    const windowsHost = ctx.host && ctx.host.windows;

    if (isWindowsPlatform(ctx) && windowsHost && typeof windowsHost.knownPath === "function") {
      try {
        const userProfile = windowsHost.knownPath("userProfile");
        if (typeof userProfile === "string" && userProfile.trim()) {
          paths.push(joinPath(userProfile.trim(), ".local/share/opencode/auth.json"));
        }
      } catch (e) {
        ctx.host.log.warn("OpenCode userProfile lookup failed: " + String(e));
      }

      try {
        const localAppData = windowsHost.knownPath("localAppData");
        if (typeof localAppData === "string" && localAppData.trim()) {
          paths.push(joinPath(localAppData.trim(), "opencode/auth.json"));
        }
      } catch (e) {
        ctx.host.log.warn("OpenCode localAppData lookup failed: " + String(e));
      }
    }

    paths.push(DEFAULT_AUTH_PATH);
    return Array.from(new Set(paths));
  }

  function readKeyFromAuthFile(ctx, authPath) {
    if (!ctx.host.fs.exists(authPath)) return null;

    try {
      const text = ctx.host.fs.readText(authPath);
      const parsed = ctx.util.tryParseJson(text);
      if (!parsed || typeof parsed !== "object") {
        ctx.host.log.warn("opencode auth file is not valid json: " + authPath);
        return null;
      }

      const entry = parsed[PROVIDER_ID];
      if (!entry || typeof entry !== "object") return null;

      const key = typeof entry.key === "string" ? entry.key.trim() : "";
      if (!key) return null;

      ctx.host.log.debug("OpenCode Go auth loaded from " + authPath);
      return key;
    } catch (e) {
      ctx.host.log.warn("opencode auth read failed at " + authPath + ": " + String(e));
      return null;
    }
  }

  function loadAuthKey(ctx) {
    const paths = resolveAuthPaths(ctx);
    for (let i = 0; i < paths.length; i += 1) {
      const key = readKeyFromAuthFile(ctx, paths[i]);
      if (key) return key;
    }
    return null;
  }

  function readUsageWindow(value, name) {
    if (!value || typeof value !== "object") {
      throw "Usage response invalid: missing " + name + ".";
    }

    const usagePercent = clampPercent(value.usagePercent);
    const resetInSec = readNumber(value.resetInSec);
    const status = typeof value.status === "string" ? value.status : null;

    if (usagePercent === null || resetInSec === null || resetInSec < 0 || !status) {
      throw "Usage response invalid: malformed " + name + ".";
    }

    return { usagePercent, resetInSec, status };
  }

  function fetchUsage(ctx, apiKey) {
    let resp;
    try {
      resp = ctx.util.request({
        method: "GET",
        url: USAGE_URL,
        headers: {
          Authorization: "Bearer " + apiKey,
          Accept: "application/json",
        },
        timeoutMs: 10000,
      });
    } catch (e) {
      ctx.host.log.error("OpenCode Go usage request exception: " + String(e));
      throw "Usage request failed. Check your connection.";
    }

    if (resp.status === 401) throw "OpenCode API key invalid. Log in to OpenCode Go again.";
    if (resp.status === 403) throw "OpenCode Go subscription required.";
    if (resp.status < 200 || resp.status >= 300) {
      throw "Usage request failed (HTTP " + String(resp.status) + "). Try again later.";
    }

    const parsed = ctx.util.tryParseJson(resp.bodyText);
    if (!parsed || typeof parsed !== "object") {
      throw "Usage response invalid. Try again later.";
    }

    return {
      useBalance: parsed.useBalance === true,
      rollingUsage: readUsageWindow(parsed.rollingUsage, "rollingUsage"),
      weeklyUsage: readUsageWindow(parsed.weeklyUsage, "weeklyUsage"),
      monthlyUsage: readUsageWindow(parsed.monthlyUsage, "monthlyUsage"),
    };
  }

  function resetAt(resetInSec, nowMs) {
    return new Date(nowMs + resetInSec * 1000).toISOString();
  }

  function progressLine(ctx, label, window, nowMs, periodDurationMs) {
    const opts = {
      label,
      used: window.usagePercent,
      limit: 100,
      format: { kind: "percent" },
      resetsAt: resetAt(window.resetInSec, nowMs),
    };
    if (periodDurationMs) opts.periodDurationMs = periodDurationMs;
    return ctx.line.progress(opts);
  }

  function probe(ctx) {
    const apiKey = loadAuthKey(ctx);
    if (!apiKey) {
      throw "OpenCode Go not detected. Log in with OpenCode Go first.";
    }

    const usage = fetchUsage(ctx, apiKey);
    const nowMs = Date.now();

    return {
      plan: "Go",
      lines: [
        progressLine(ctx, "5h", usage.rollingUsage, nowMs, FIVE_HOURS_MS),
        progressLine(ctx, "Weekly", usage.weeklyUsage, nowMs, WEEK_MS),
        progressLine(ctx, "Monthly", usage.monthlyUsage, nowMs),
      ],
    };
  }

  globalThis.__openusage_plugin = { id: PROVIDER_ID, probe };
})();
