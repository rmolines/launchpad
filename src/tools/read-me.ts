import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SCHEMAS, DOCUMENT_TYPES } from "../schemas.js";
import { listProjects, listStages, listModules, getMissionsRoot } from "../parser.js";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

function buildSchemaSummary(): Record<string, { required: string[]; optional: string[] }> {
  const summary: Record<string, { required: string[]; optional: string[] }> = {};

  for (const [docType, schema] of Object.entries(SCHEMAS)) {
    const shape = schema.shape;
    const required: string[] = [];
    const optional: string[] = [];

    for (const [key, def] of Object.entries(shape)) {
      const isOptional =
        def instanceof Object &&
        "_def" in def &&
        (def._def as { typeName?: string }).typeName === "ZodOptional";
      if (isOptional) {
        optional.push(key);
      } else {
        required.push(key);
      }
    }

    summary[docType] = { required, optional };
  }

  return summary;
}

function buildPortfolioStats(): Record<string, { stages: number; modules: number; documents: Record<string, number> }> {
  const root = getMissionsRoot();
  const missions = listProjects();
  const stats: Record<string, { stages: number; modules: number; documents: Record<string, number> }> = {};

  for (const mission of missions) {
    const stages = listStages(mission);
    const docCounts: Record<string, number> = {};
    let totalModules = 0;

    for (const stage of stages) {
      const modules = listModules(mission, stage);
      totalModules += modules.length;

      for (const module of modules) {
        const initDir = join(root, mission, stage, module);
        if (!existsSync(initDir)) continue;

        const files = readdirSync(initDir).filter((f) => DOCUMENT_TYPES.includes(f));
        for (const file of files) {
          docCounts[file] = (docCounts[file] ?? 0) + 1;
        }
      }
    }

    stats[mission] = {
      stages: stages.length,
      modules: totalModules,
      documents: docCounts,
    };
  }

  return stats;
}

export function register(server: McpServer): void {
  server.tool(
    "init_read_me",
    "Returns schema summary, available tools, and portfolio state for the initiatives database",
    {},
    async () => {
      const schemaSummary = buildSchemaSummary();
      const portfolioStats = buildPortfolioStats();

      const tools = [
        {
          name: "init_read_me",
          description: "Returns schema summary, available tools, and portfolio state",
          parameters: "none",
        },
        {
          name: "init_list",
          description: "Lists module documents with optional filtering",
          parameters: "type (optional): document type filename; mission (optional): mission name; stage (optional): stage slug",
        },
        {
          name: "init_create",
          description: "Creates a new module document with Zod-validated frontmatter",
          parameters: "type, mission, stage (optional, default '_backlog'), module (optional for mission.md and stage-level docs), fields, content (optional)",
        },
        {
          name: "init_update_fields",
          description: "Merges new frontmatter fields into an existing document, validates against schema",
          parameters: "mission, stage (optional, default '_backlog'), module, file, fields",
        },
        {
          name: "init_update_section",
          description: "Replaces the content of a specific ## Heading section",
          parameters: "mission, stage (optional, default '_backlog'), module, file, heading, content",
        },
        {
          name: "init_get_status",
          description: "Derives lifecycle status from filesystem artifacts",
          parameters: "mission, stage (optional, default '_backlog'), module",
        },
        {
          name: "init_finalize",
          description: "Promotes draft to ready by creating prd.md (or stage.md for stage-level) from draft",
          parameters: "mission, stage (optional, default '_backlog'), module (optional for stage-level)",
        },
        {
          name: "init_archive",
          description: "Archives a module by moving it to {mission}/archived/{module}/",
          parameters: "mission, stage (optional, default '_backlog'), module",
        },
        {
          name: "init_validate",
          description: "Validates a document's frontmatter against its schema without modifying",
          parameters: "mission, stage (optional, default '_backlog'), module, file",
        },
        {
          name: "init_add_cycle",
          description: "Adds a new cycle document to a module's cycles/ directory",
          parameters: "mission, stage (optional, default '_backlog'), module, type, description, content (optional)",
        },
      ];

      const result = {
        schema_summary: schemaSummary,
        document_types: DOCUMENT_TYPES,
        available_tools: tools,
        portfolio: portfolioStats,
        missions_root: getMissionsRoot(),
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
