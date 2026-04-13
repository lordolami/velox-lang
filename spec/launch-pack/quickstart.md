# Quickstart (v1)

```bash
npm install
npm run build
npm test
```

Single file compile:

```bash
node dist/cli.js build examples/counter.vx -o dist-example/counter.js
```

Pages app compile:

```bash
node dist/cli.js build examples/showcase/todo/pages -o dist-showcase-todo
node dist/cli.js preview dist-showcase-todo --port 4173
```

Registry smoke command (clean directory):

```bash
npx -y @lakesbim/velox build ./path/to/file.vx -o ./out.js
```
