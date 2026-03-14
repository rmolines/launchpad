import matter from "gray-matter";
import { existsSync, readdirSync, statSync } from "fs";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";

const MISSIONS_PATH = join(homedir(), ".claude", "missions");

// Keep old name for any code that might reference it directly
const INITIATIVES_PATH = MISSIONS_PATH;

const EXCLUDED_DIRS = new Set(["_reviews", "archived"]);

export function getMissionsRoot(): string {
  return MISSIONS_PATH;
}

// Backward-compat alias
export function getInitiativesRoot(): string {
  return getMissionsRoot();
}

export interface ParsedDocument {
  data: Record<string, unknown>;
  content: string;
  path: string;
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const raw = await readFile(filePath, "utf-8");
  const parsed = matter(raw);
  return {
    data: parsed.data as Record<string, unknown>,
    content: parsed.content,
    path: filePath,
  };
}

export function serializeDocument(
  data: Record<string, unknown>,
  content: string
): string {
  return matter.stringify(content, data);
}

export function listProjects(): string[] {
  const root = getMissionsRoot();
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root).filter((entry) => {
    if (EXCLUDED_DIRS.has(entry)) return false;
    if (entry.startsWith(".")) return false;
    const full = join(root, entry);
    return statSync(full).isDirectory();
  });
}

export function listStages(mission: string): string[] {
  const root = getMissionsRoot();
  const missionDir = join(root, mission);
  if (!existsSync(missionDir)) {
    return [];
  }
  return readdirSync(missionDir).filter((entry) => {
    if (EXCLUDED_DIRS.has(entry)) return false;
    if (entry.startsWith(".")) return false;
    const full = join(missionDir, entry);
    return statSync(full).isDirectory();
  });
}

export function listModules(mission: string, stage: string): string[] {
  const root = getMissionsRoot();
  const stageDir = join(root, mission, stage);
  if (!existsSync(stageDir)) {
    return [];
  }
  return readdirSync(stageDir).filter((entry) => {
    if (entry.startsWith(".")) return false;
    const full = join(stageDir, entry);
    return statSync(full).isDirectory();
  });
}

// Backward-compat alias: lists modules across all stages for a mission
export function listInitiatives(mission: string): string[] {
  const stages = listStages(mission);
  const modules: string[] = [];
  for (const stage of stages) {
    const stageModules = listModules(mission, stage);
    modules.push(...stageModules);
  }
  return modules;
}

export function resolveModulePath(mission: string, stage: string, module: string): string {
  const root = getMissionsRoot();
  return join(root, mission, stage, module);
}

// Backward-compat alias: defaults stage to '_backlog'
export function resolveInitiativePath(mission: string, initiative: string): string {
  return resolveModulePath(mission, "_backlog", initiative);
}
