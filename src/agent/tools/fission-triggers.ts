import { getFissionApiBaseUrl } from "./fission-config.js";

type ListFunctionsResponse = {
  namespace: string;
  functions: { name: string; code: string; route: string | null; method: string | null }[];
};

export type FunctionInfo = {
  name: string;
  code: string;
  route: string | null;
  method: string | null;
};

export async function listFunctionsWithRoutes(): Promise<FunctionInfo[]> {
  const res = await fetch(`${getFissionApiBaseUrl()}/list-functions`);
  if (!res.ok) {
    throw new Error(`Failed to list functions: ${res.status} ${await res.text()}`);
  }
  const { functions } = (await res.json()) as ListFunctionsResponse;
  return functions;
}
