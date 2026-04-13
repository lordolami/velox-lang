# Learn Velox Quickstart

## 1) Create a Project

```bash
velox init my-app --template pages
cd my-app
```

## 2) Run Dev Server

```bash
velox dev
```

Open the local URL shown by the CLI.

## 3) Basic Component

Create `pages/index.vx`:

```vx
component Home(title, inc) {
  ~count = 0
  ~items = [1, 2, 3]
  render {
    <main>
      <h1>{title}</h1>
      <p>Count: {count}</p>
      {#if count > 0}<small>active</small>{:else}<small>idle</small>{/if}
      <ul>{#each items as item, i}<li>{i}:{item}</li>{/each}</ul>
      <button on:click={inc}>Increment</button>
    </main>
  }
}
```

## 4) Add a Fast Function

Create `math.vx`:

```vx
@fast add(a: i32, b: i32) -> i32 {
  return a + b
}
```

Import it in your page:

```vx
import { add } from "./math.vx"

component Home(title, inc) {
  ~count = add(2, 3)
  render { <h1>{title}: {count}</h1> }
}
```

## 5) Build and Preview

```bash
velox build
velox preview
```

## 6) Deploy Locally (Artifact Registry)

```bash
velox deploy --name first-release
velox deployments
```

## 7) Prepare Cloud Bundle

```bash
velox deploy . --target vercel --name first-release
```

The command prints an output directory containing `DEPLOY.md` with provider-specific final publish command.
