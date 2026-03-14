import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ReviewSchema } from "../schemas.js";
import { parseDocument, serializeDocument, getMissionsRoot } from "../parser.js";
import { existsSync, readdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";

export type ModuleStatus =
  | "seed"
  | "exploring"
  | "ready"
  | "planned"
  | "building"
  | "done"
  | "approved"
  | "shipped";

export async function deriveStatus(
  mission: string,
  moduleOrStage: string,
  module?: string
): Promise<{ status: ModuleStatus; artifacts: string[] }> {
  const root = getMissionsRoot();

  // Support both 2-arg (mission, module) and 3-arg (mission, stage, module) calls.
  // When called with 2 args: moduleOrStage is actually the module, stage defaults to '_backlog'.
  const stage = module !== undefined ? moduleOrStage : "_backlog";
  const mod = module !== undefined ? module : moduleOrStage;

  // Check archived first (archived lives at mission/archived/module)
  const archivedPath = join(root, mission, "archived", mod);
  if (existsSync(archivedPath) && statSync(archivedPath).isDirectory()) {
    return { status: "shipped", artifacts: ["archived/" + mod] };
  }

  const dir = join(root, mission, stage, mod);
  if (!existsSync(dir)) {
    return { status: "seed", artifacts: [] };
  }

  const artifacts: string[] = [];

  // Collect artifacts
  const checkFile = (name: string): boolean => {
    const p = join(dir, name);
    if (existsSync(p)) {
      artifacts.push(name);
      return true;
    }
    return false;
  };

  const hasDraft = checkFile("draft.md");
  // module.md is alias for prd.md in new hierarchy
  const hasPrd = checkFile("prd.md") || checkFile("module.md");
  const hasPlan = checkFile("plan.md");
  const hasResults = checkFile("results.md");
  const hasReview = checkFile("review.md");

  // Check cycles dir
  const cyclesDir = join(dir, "cycles");
  let hasCycles = false;
  if (existsSync(cyclesDir) && statSync(cyclesDir).isDirectory()) {
    const cycleFiles = readdirSync(cyclesDir).filter((f) => f.endsWith(".md"));
    if (cycleFiles.length > 0) {
      hasCycles = true;
      artifacts.push(...cycleFiles.map((f) => "cycles/" + f));
    }
  }

  // Derive status (highest wins)
  if (hasReview) {
    try {
      const doc = await parseDocument(join(dir, "review.md"));
      const parsed = ReviewSchema.safeParse(doc.data);
      if (parsed.success && parsed.data.decision === "approved") {
        return { status: "approved", artifacts };
      }
    } catch {
      // Fall through
    }
  }

  if (hasResults) {
    try {
      const doc = await parseDocument(join(dir, "results.md"));
      const content = doc.content;
      // Parse key-value blocks written by /launchpad:delivery:
      //   status: success | partial | failed
      // Logic mirrors derive-status.sh: all tasks done when every `status:` line
      // is either "success" or "partial" and at least one exists.
      // Reference: scripts/derive-status.sh derive_status() results.md block.
      const allStatusLines = content.match(/^status:\s*\S+/gm) ?? [];
      const notDoneLines = allStatusLines.filter(
        (line) => !/^status:\s*(success|partial)$/.test(line)
      );
      if (allStatusLines.length > 0 && notDoneLines.length === 0) {
        return { status: "done", artifacts };
      }
    } catch {
      // Fall through
    }
    return { status: "building", artifacts };
  }

  if (hasPlan) {
    return { status: "planned", artifacts };
  }

  if (hasPrd) {
    return { status: "ready", artifacts };
  }

  if (hasCycles) {
    return { status: "exploring", artifacts };
  }

  // suppress unused variable warning
  void hasDraft;

  return { status: "seed", artifacts };
}

/**
 * Writes derived status back to draft.md frontmatter as cache.
 * Only updates if draft.md exists and status actually changed.
 */
export async function updateStatusCache(
  mission: string,
  stageOrModule: string,
  module?: string
): Promise<void> {
  const root = getMissionsRoot();

  // Support both 2-arg (mission, module) and 3-arg (mission, stage, module) calls.
  const stage = module !== undefined ? stageOrModule : "_backlog";
  const mod = module !== undefined ? module : stageOrModule;

  const draftPath = join(root, mission, stage, mod, "draft.md");
  if (!existsSync(draftPath)) return;

  const { status } = await deriveStatus(mission, stage, mod);

  try {
    const doc = await parseDocument(draftPath);
    if (doc.data.status === status) return; // no change
    doc.data.status = status;
    const serialized = serializeDocument(doc.data, doc.content);
    writeFileSync(draftPath, serialized, "utf-8");
  } catch {
    // Best-effort cache — don't break the caller
  }
}

export function register(server: McpServer): void {
  server.tool(
    "init_get_status",
    "Derives the current lifecycle status of an initiative by inspecting filesystem artifacts",
    {
      mission: z.string().describe("Mission name (e.g. 'fl', 'akn')"),
      stage: z
        .string()
        .optional()
        .describe("Stage slug. Defaults to '_backlog' if not provided."),
      module: z.string().describe("Module slug (e.g. 'query-layer')"),
    },
    async ({ mission, stage, module }) => {
      const resolvedStage = stage || "_backlog";
      const { status, artifacts } = await deriveStatus(mission, resolvedStage, module);

      const result = {
        mission,
        stage: resolvedStage,
        module,
        status,
        artifacts,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
