# Velox Recipes

## Conditional UI

```vx
component Status(active) {
  render {
    {#if active}<span>Online</span>{:else}<span>Offline</span>{/if}
  }
}
```

## Repeating Lists

```vx
component Menu(items) {
  render {
    <ul>{#each items as item, i}<li>{i}: {item}</li>{/each}</ul>
  }
}
```

## Component Events

```vx
component SaveButton(onSave) {
  render { <button on:click={onSave}>Save</button> }
}
```

## Route Layout

`pages/_layout.vx`:

```vx
component RootLayout(content) {
  render {
    <div>
      <header>Velox</header>
      <main>{content}</main>
    </div>
  }
}
```

## Route Data Module

`pages/dashboard.vx`:

```vx
component Dashboard(data) {
  render { <pre>{data}</pre> }
}
```

`pages/dashboard.data.js`:

```js
export async function load(ctx) {
  return { data: "dashboard:" + ctx.pathname };
}
```

## Redirect from Data Load

```js
export async function load() {
  return { redirect: "/login" };
}
```

## Not Found from Data Load

```js
export async function load() {
  return { notFound: true };
}
```

## Fallback Error from Data Load

```js
export async function load() {
  return { error: "Failed to fetch data" };
}
```
