import type { ProjectState } from "../types";

export const createProjectJson = (state: ProjectState): string =>
  JSON.stringify(
    {
      schema: "domelab.project.v1",
      savedAt: new Date().toISOString(),
      state
    },
    null,
    2
  );

export const parseProjectJson = (text: string): ProjectState => {
  const parsed = JSON.parse(text);
  if ((parsed.schema === "domelab.project.v1" || parsed.schema === "domeforge.project.v1") && parsed.state) {
    return parsed.state as ProjectState;
  }
  return parsed as ProjectState;
};
