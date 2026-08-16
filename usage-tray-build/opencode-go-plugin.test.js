import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCtx } from "../test-helpers.js";

const AUTH_PATH = "~/.local/share/opencode/auth.json";
const USAGE_URL = "https://opencode.ai/zen/go/v1/usage";

const loadPlugin = async () => {
  await import("./plugin.js");
  return globalThis.__openusage_plugin;
};

function setAuth(ctx, value = "go-key") {
  ctx.host.fs.writeText(
    AUTH_PATH,
    JSON.stringify({
      "opencode-go": { type: "api-key", key: value },
    }),
  );
}

function setUsageResponse(ctx, body, status = 200) {
  ctx.host.http.request.mockReturnValue({
    status,
    bodyText: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function usageBody(overrides = {}) {
  return {
    useBalance: false,
    rollingUsage: { status: "ok", resetInSec: 60, usagePercent: 42 },
    weeklyUsage: { status: "ok", resetInSec: 120, usagePercent: 35 },
    monthlyUsage: { status: "ok", resetInSec: 180, usagePercent: 28 },
    ...overrides,
  };
}

describe("opencode-go plugin", () => {
  beforeEach(() => {
    delete globalThis.__openusage_plugin;
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("ships plugin metadata with links and expected line layout", () => {
    const manifest = JSON.parse(readFileSync("plugins/opencode-go/plugin.json", "utf8"));
    expect(manifest.id).toBe("opencode-go");
    expect(manifest.name).toBe("OpenCode Go");
    expect(manifest.brandColor).toBe("#000000");
    expect(manifest.lines).toEqual([
      { type: "progress", label: "5h", scope: "overview", primaryOrder: 1 },
      { type: "progress", label: "Weekly", scope: "detail" },
      { type: "progress", label: "Monthly", scope: "detail" },
    ]);
  });

  it("requires an OpenCode Go API key", async () => {
    const ctx = makeCtx();
    const plugin = await loadPlugin();
    expect(() => plugin.probe(ctx)).toThrow("OpenCode Go not detected. Log in with OpenCode Go first.");
    expect(ctx.host.http.request).not.toHaveBeenCalled();
  });

  it("discovers OpenCode Go auth from Windows user profile", async () => {
    const ctx = makeCtx();
    ctx.app.platform = "windows";
    ctx.host.windows.knownPath.mockImplementation((name) => {
      if (String(name).toLowerCase() === "userprofile") return "C:/Users/tester";
      if (String(name).toLowerCase() === "localappdata") return "C:/Users/tester/AppData/Local";
      return null;
    });
    ctx.host.fs.writeText(
      "C:/Users/tester/.local/share/opencode/auth.json",
      JSON.stringify({ "opencode-go": { type: "api-key", key: "windows-go-key" } }),
    );
    setUsageResponse(ctx, usageBody());
    const plugin = await loadPlugin();
    plugin.probe(ctx);
    expect(ctx.host.http.request).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer windows-go-key" }) }),
    );
  });

  it("falls back to Windows LocalAppData OpenCode auth", async () => {
    const ctx = makeCtx();
    ctx.app.platform = "windows";
    ctx.host.windows.knownPath.mockImplementation((name) => {
      if (String(name).toLowerCase() === "localappdata") return "C:/Users/tester/AppData/Local";
      return null;
    });
    ctx.host.fs.writeText(
      "C:/Users/tester/AppData/Local/opencode/auth.json",
      JSON.stringify({ "opencode-go": { type: "api-key", key: "localappdata-go-key" } }),
    );
    setUsageResponse(ctx, usageBody());
    const plugin = await loadPlugin();
    plugin.probe(ctx);
    expect(ctx.host.http.request).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer localappdata-go-key" }) }),
    );
  });

  it("queries the authoritative Go usage API with the stored key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T18:00:00.000Z"));
    const ctx = makeCtx();
    setAuth(ctx, "secret-key");
    setUsageResponse(ctx, usageBody());
    const plugin = await loadPlugin();
    const result = plugin.probe(ctx);
    expect(ctx.host.http.request).toHaveBeenCalledWith({
      method: "GET",
      url: USAGE_URL,
      headers: { Authorization: "Bearer secret-key", Accept: "application/json" },
      timeoutMs: 10000,
    });
    expect(result.lines.map((line) => line.used)).toEqual([42, 35, 28]);
    expect(result.lines[0].resetsAt).toBe("2026-08-16T18:01:00.000Z");
    expect(result.lines[1].resetsAt).toBe("2026-08-16T18:02:00.000Z");
    expect(result.lines[2].resetsAt).toBe("2026-08-16T18:03:00.000Z");
  });

  it("uses API percentages directly instead of reconstructing usage from sqlite", async () => {
    const ctx = makeCtx();
    setAuth(ctx);
    setUsageResponse(ctx, usageBody({
      rollingUsage: { status: "limited", resetInSec: 10, usagePercent: 99.75 },
      weeklyUsage: { status: "ok", resetInSec: 20, usagePercent: 12.5 },
      monthlyUsage: { status: "ok", resetInSec: 30, usagePercent: 63.125 },
    }));
    const plugin = await loadPlugin();
    const result = plugin.probe(ctx);
    expect(result.lines.map((line) => line.used)).toEqual([99.75, 12.5, 63.125]);
    expect(ctx.host.sqlite.query).not.toHaveBeenCalled();
  });

  it("reports invalid API keys on 401", async () => {
    const ctx = makeCtx();
    setAuth(ctx);
    setUsageResponse(ctx, { type: "error" }, 401);
    const plugin = await loadPlugin();
    expect(() => plugin.probe(ctx)).toThrow("OpenCode API key invalid. Log in to OpenCode Go again.");
  });

  it("reports missing Go entitlement on 403", async () => {
    const ctx = makeCtx();
    setAuth(ctx);
    setUsageResponse(ctx, { type: "error" }, 403);
    const plugin = await loadPlugin();
    expect(() => plugin.probe(ctx)).toThrow("OpenCode Go subscription required.");
  });
});
