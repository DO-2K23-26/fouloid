function normalizeUrl(url: string) {
  return url.endsWith("/")
    ? url.slice(0, -1)
    : url;
}

export function getFissionApiBaseUrl() {
  return normalizeUrl(
    process.env.FISSION_ENDPOINT ?? "http://localhost:8888"
  );
}

export function getFissionRouterUrl() {
  return normalizeUrl(
    process.env.FISSION_ROUTER_URL ?? getFissionApiBaseUrl()
  );
}

export function getFissionFunctionServiceAccount() {
  return process.env.FISSION_FUNCTION_SA ?? "";
}
