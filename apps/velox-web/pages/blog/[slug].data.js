const POSTS = {
  "v1-status": {
    title: "Velox v1 status update",
    author: "Velox Team",
    date: "2026-04-13",
    summary: "Core language and framework gates are stable.",
    content: "The next focus is production frontend adoption and v3 SSR planning.",
    points: [
      "Compiler and checks are stable",
      "Cloud deploy bundles are ready",
      "AI context docs are complete"
    ]
  },
  "compiler-roadmap": {
    title: "Compiler roadmap for v3",
    author: "Velox Team",
    date: "2026-04-13",
    summary: "v3 targets SSR and SSG maturity.",
    content: "The roadmap introduces rendering modes and hydration contracts.",
    points: [
      "RFC approved",
      "Prototype static generation",
      "Hydration mismatch tests"
    ]
  }
};

export function load(ctx) {
  const slug = ctx.params.slug;
  const post = POSTS[slug];
  if (!post) {
    return { notFound: true };
  }
  return { data: post };
}
