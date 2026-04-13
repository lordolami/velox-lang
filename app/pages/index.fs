export default function Home() {
  return `
    <section class="hero">
      <p class="eyebrow">FastScript v0.1</p>
      <h1>Full-stack speed with readable .fs syntax.</h1>
      <p>SSR, API routes, auth, DB, jobs, storage, and deploy adapters in one stack.</p>
      <div class="hero-links">
        <a href="/docs">Read docs</a>
        <a href="/benchmarks">See benchmarks</a>
        <a href="/showcase">View showcase</a>
      </div>
    </section>
  `;
}

export function hydrate({ root }) {
  for (const a of root.querySelectorAll('.hero-links a')) {
    a.style.transition = 'opacity .2s ease';
    a.addEventListener('mouseenter', () => (a.style.opacity = '0.8'));
    a.addEventListener('mouseleave', () => (a.style.opacity = '1'));
  }
}
