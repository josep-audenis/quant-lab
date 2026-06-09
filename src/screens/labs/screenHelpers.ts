export function statusLabel(status: "loading" | "ready" | "error") {
  if (status === "loading") {
    return "Loading API";
  }
  if (status === "error") {
    return "API offline";
  }
  return "API connected";
}
