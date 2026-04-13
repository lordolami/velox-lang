# 60-Second Demo Script

Target output:
- `spec/launch-pack/assets/velox-60s-demo.gif`

Recording sequence:

1. Show `examples/showcase/todo/pages/index.vx` in VS Code with Velox syntax highlighting active.
2. Run:
   ```bash
   node dist/cli.js dev examples/showcase/todo/pages --port 3000
   ```
3. Open `http://localhost:3000` and show live page render.
4. Edit one line in `index.vx` (headline text) and save.
5. Show hot update in browser.
6. Stop dev server and run:
   ```bash
   node dist/cli.js build examples/showcase/todo/pages -o dist-showcase-todo
   node dist/cli.js preview dist-showcase-todo --port 4173
   ```
7. Open preview URL and show production output.
8. End with terminal showing build success + output directory.

Capture tip:
- Use OBS or ScreenToGif with 1280x720 crop.
- Keep final GIF under 15 MB.
