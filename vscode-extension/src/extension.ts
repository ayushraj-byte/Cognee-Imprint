import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import * as url from "url";

/* ─── Platform detection ─── */
function detectPlatform(): string {
  const cfg = vscode.workspace.getConfiguration("imprint").get<string>("platform");
  if (cfg && cfg !== "auto") return cfg;
  if (vscode.extensions.getExtension("Anysphere.cursorpro") ||
      vscode.extensions.getExtension("anysphere.cursorpro") ||
      vscode.extensions.getExtension("cursor.cursor")) return "cursor";
  if (vscode.extensions.getExtension("github.copilot") ||
      vscode.extensions.getExtension("github.copilot-chat")) return "copilot";
  if (vscode.extensions.getExtension("antigravity.antigravity")) return "antigravity";
  return "vscode";
}

/* ─── Workspace context ─── */
interface WorkspaceContext {
  name: string;
  branch: string;
  openFiles: string[];
  recentlySaved: string[];
}

async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const name = vscode.workspace.name || vscode.workspace.workspaceFolders?.[0]?.name || "unknown";

  // Git branch via built-in git extension
  let branch = "";
  try {
    const gitExt = vscode.extensions.getExtension<any>("vscode.git");
    const git = gitExt?.isActive ? gitExt.exports?.getAPI?.(1) : null;
    branch = git?.repositories?.[0]?.state?.HEAD?.name || "";
  } catch {}

  const openFiles = vscode.workspace.textDocuments
    .filter((d: vscode.TextDocument) => !d.isUntitled && d.uri.scheme === "file")
    .map((d: vscode.TextDocument) => d.fileName.split(/[/\\]/).pop() || "")
    .filter(Boolean)
    .slice(0, 8);

  const recentlySaved = recentSaveLog.slice(-5);

  return { name, branch, openFiles, recentlySaved };
}

/* ─── Recent save tracking ─── */
const recentSaveLog: string[] = [];
function trackSave(doc: vscode.TextDocument) {
  if (doc.uri.scheme !== "file") return;
  const name = doc.fileName.split(/[/\\]/).pop() || "";
  if (name && !recentSaveLog.includes(name)) {
    recentSaveLog.unshift(name);
    if (recentSaveLog.length > 10) recentSaveLog.pop();
  }
}

/* ─── LM-based extraction ─── */
async function extractWithLM(ctx: WorkspaceContext): Promise<string[]> {
  try {
    const models = await vscode.lm.selectChatModels({});
    if (!models.length) return [];

    const model = models[0];
    const prompt =
      `You are a memory extraction assistant for Imprint, a persistent memory system for developers.\n` +
      `The developer is currently working in VS Code.\n` +
      `Workspace: "${ctx.name}"` +
      (ctx.branch ? ` on branch "${ctx.branch}"` : "") + `.\n` +
      (ctx.openFiles.length ? `Open files: ${ctx.openFiles.join(", ")}.\n` : "") +
      (ctx.recentlySaved.length ? `Recently saved: ${ctx.recentlySaved.join(", ")}.\n` : "") +
      `\nBased on this context, generate 2-4 memory facts about what the developer is likely working on or what their preferences/stack might be.\n` +
      `These should be useful for an AI assistant to know in future sessions.\n` +
      `Reply ONLY with a JSON array of strings. No explanation. Example: ["Working on Imprint dashboard in Next.js", "Uses TypeScript"]`;

    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const cts = new vscode.CancellationTokenSource();
    setTimeout(() => cts.cancel(), 10_000);

    const response = await model.sendRequest(messages, {}, cts.token);
    let text = "";
    for await (const chunk of response.text) text += chunk;

    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed: unknown = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return (parsed as unknown[])
          .filter((x): x is string => typeof x === "string" && x.length > 5)
          .slice(0, 4);
      }
    }
  } catch (e) {
    // LM not available or timed out — fall through to checkpoint
  }
  return [];
}

/* ─── Imprint API ─── */
async function saveMemory(
  apiUrl: string,
  userId: string,
  content: string,
  platform: string,
  topic = "projects"
): Promise<void> {
  const body = JSON.stringify({ userId, content, topic, source: platform });
  const parsed = url.parse(apiUrl);
  const isHttps = parsed.protocol === "https:";
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: "/api/memories",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      res => {
        res.resume();
        res.on("end", () => resolve());
      }
    );
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}

async function getMemoryCount(apiUrl: string, userId: string): Promise<number> {
  const parsed = url.parse(apiUrl);
  const isHttps = parsed.protocol === "https:";
  const lib = isHttps ? https : http;

  return new Promise(resolve => {
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `/api/memories?userId=${encodeURIComponent(userId)}`,
        method: "GET",
      },
      res => {
        let data = "";
        res.on("data", c => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)?.memories?.length || 0); }
          catch { resolve(0); }
        });
      }
    );
    req.on("error", () => resolve(0));
    req.setTimeout(5000, () => { req.destroy(); resolve(0); });
    req.end();
  });
}

/* ─── Status bar ─── */
let statusBar: vscode.StatusBarItem;

async function updateStatusBar() {
  const cfg = vscode.workspace.getConfiguration("imprint");
  const userId = cfg.get<string>("userId", "");
  const apiUrl = cfg.get<string>("apiUrl", "https://imprint-ebon.vercel.app");
  if (!userId) {
    statusBar.text = "$(brain) Imprint";
    statusBar.tooltip = "Click to configure your User ID";
    statusBar.command = "imprint.configure";
    return;
  }
  statusBar.text = "$(brain) …";
  const count = await getMemoryCount(apiUrl, userId);
  statusBar.text = `$(brain) ${count}`;
  statusBar.tooltip = `Imprint: ${count} memories — click to open dashboard`;
  statusBar.command = "imprint.openDashboard";
}

/* ─── Main extraction ─── */
let lastExtractionTime = 0;
let extracting = false;

async function runExtraction(manual = false): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("imprint");
  if (!cfg.get<boolean>("autoExtract", true) && !manual) return;

  const userId = cfg.get<string>("userId", "");
  const apiUrl = cfg.get<string>("apiUrl", "https://imprint-ebon.vercel.app");
  const debounceMs = (cfg.get<number>("debounceMinutes", 2)) * 60 * 1000;

  if (!userId) {
    if (manual) {
      const action = await vscode.window.showWarningMessage(
        "Imprint: No User ID configured.",
        "Configure Now"
      );
      if (action) vscode.commands.executeCommand("imprint.configure");
    }
    return;
  }

  const now = Date.now();
  if (!manual && now - lastExtractionTime < debounceMs) return;
  if (extracting) return;

  extracting = true;
  lastExtractionTime = now;
  const platform = detectPlatform();

  statusBar.text = "$(brain) $(sync~spin)";

  try {
    const ctx = await getWorkspaceContext();
    const facts = await extractWithLM(ctx);

    if (facts.length > 0) {
      // LM gave us real facts
      for (const fact of facts) {
        await saveMemory(apiUrl, userId, fact, platform);
      }
      statusBar.text = `$(brain) +${facts.length}`;
      if (manual) {
        vscode.window.showInformationMessage(`Imprint: saved ${facts.length} memor${facts.length === 1 ? "y" : "ies"} from ${platform}`);
      }
    } else {
      // Fallback: save a workspace checkpoint
      const checkpoint =
        `${platform} session: working in "${ctx.name}"` +
        (ctx.branch ? ` on branch ${ctx.branch}` : "") +
        (ctx.openFiles.length ? ` · files: ${ctx.openFiles.slice(0, 3).join(", ")}` : "");
      await saveMemory(apiUrl, userId, checkpoint, platform);
      statusBar.text = `$(brain) ✓`;
    }

    setTimeout(() => updateStatusBar(), 3000);
  } catch (e) {
    statusBar.text = "$(brain) !";
    if (manual) vscode.window.showErrorMessage(`Imprint: extraction failed — ${e}`);
    setTimeout(() => updateStatusBar(), 5000);
  } finally {
    extracting = false;
  }
}

/* ─── Activation ─── */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Status bar
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(statusBar);
  statusBar.show();
  updateStatusBar();

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("imprint.extractNow", () => runExtraction(true)),

    vscode.commands.registerCommand("imprint.openDashboard", () => {
      const cfg = vscode.workspace.getConfiguration("imprint");
      const apiUrl = cfg.get<string>("apiUrl", "https://imprint-ebon.vercel.app");
      vscode.env.openExternal(vscode.Uri.parse(`${apiUrl}/dashboard`));
    }),

    vscode.commands.registerCommand("imprint.configure", async () => {
      const current = vscode.workspace.getConfiguration("imprint").get<string>("userId", "");
      const input = await vscode.window.showInputBox({
        prompt: "Enter your Imprint User ID (find it at imprint-ebon.vercel.app/dashboard → Connect)",
        value: current,
        placeHolder: "e.g. user_2abc123...",
      });
      if (input !== undefined) {
        await vscode.workspace.getConfiguration("imprint").update(
          "userId", input.trim(), vscode.ConfigurationTarget.Global
        );
        vscode.window.showInformationMessage("Imprint: User ID saved ✓");
        updateStatusBar();
        if (input.trim()) runExtraction(true);
      }
    })
  );

  // Auto-extract on focus loss, so in-progress context is saved before a switch
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state: vscode.WindowState) => {
      if (!state.focused) runExtraction();
    })
  );

  // Auto-extract on file save (debounced)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
      trackSave(doc);
      runExtraction();
    })
  );

  // Refresh status bar when config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
      if (e.affectsConfiguration("imprint")) updateStatusBar();
    })
  );

  // Prompt for user ID on first install
  const cfg = vscode.workspace.getConfiguration("imprint");
  if (!cfg.get<string>("userId")) {
    const action = await vscode.window.showInformationMessage(
      "Imprint is active! Set your User ID to start saving memories.",
      "Configure"
    );
    if (action) vscode.commands.executeCommand("imprint.configure");
  }
}

export function deactivate(): void {}
