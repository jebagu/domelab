import type { ProjectState } from "../types";
import { normalizeProjectState } from "../configuration";

export const createProjectJson = (state: ProjectState): string =>
  JSON.stringify(
    {
      schema: "domelab.project.v2",
      savedAt: new Date().toISOString(),
      state: normalizeProjectState(state)
    },
    null,
    2
  );

export const parseProjectJson = (text: string): ProjectState => {
  const parsed = JSON.parse(text);
  if (
    (parsed.schema === "domelab.project.v2" ||
      parsed.schema === "domelab.project.v1" ||
      parsed.schema === "domeforge.project.v1") &&
    parsed.state
  ) {
    return normalizeProjectState(parsed.state as ProjectState);
  }
  return normalizeProjectState(parsed as ProjectState);
};
