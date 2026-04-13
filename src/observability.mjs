export function createTracer({ service = "fastscript" } = {}) {
  return {
    span(name, attrs = {}) {
      const start = Date.now();
      return {
        end(extra = {}) {
          console.log(JSON.stringify({ type: "trace", service, name, ms: Date.now() - start, ...attrs, ...extra }));
        },
      };
    },
  };
}

export async function createOtelExporter() {
  try {
    const api = await import("@opentelemetry/api");
    return api.trace.getTracer("fastscript");
  } catch {
    return null;
  }
}
