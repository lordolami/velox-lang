export default function Showcase() {
  return `
    <section>
      <p class="eyebrow">Showcase</p>
      <h1>What you can build with FastScript</h1>
      <div class="grid">
        <article><h3>Starter app</h3><p>SSR + hydration + actions.</p></article>
        <article><h3>Commerce API</h3><p>Orders endpoint + queue job email.</p></article>
        <article><h3>Secure webhook</h3><p>Signature verify + replay protection.</p></article>
        <article><h3>Portable exports</h3><p>.fs -> .js/.ts with one command.</p></article>
      </div>
    </section>
  `;
}
