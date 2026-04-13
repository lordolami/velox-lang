export default function DocsIndex() {
  return `
    <section>
      <p class="eyebrow">Docs</p>
      <h1>FastScript Documentation</h1>
      <ul>
        <li><code>pages/</code> for file-based routing</li>
        <li><code>api/</code> for server endpoints</li>
        <li><code>middleware.fs</code> for guards/security</li>
        <li><code>db/</code> for migrations and seeds</li>
        <li><code>jobs/</code> for worker handlers</li>
      </ul>
      <p>Quality gate: <code>npm run qa:all</code></p>
    </section>
  `;
}
