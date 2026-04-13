export default function Layout({ content, pathname }) {
  return `
    <header class="nav">
      <a href="/">FastScript</a>
      <nav>
        <a href="/">Home</a>
        <a href="/blog/hello">Blog</a>
      </nav>
    </header>
    <main class="page">${content}</main>
    <footer class="footer">Built with FastScript</footer>
  `;
}
