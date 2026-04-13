import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import type { ExpressionNode, ProgramNode } from "./ast";
import { emitJavaScript } from "./codegen";
import { lex } from "./lexer";
import { parse } from "./parser";
import { collectFileRoutes, emitRouterHtml, emitRouterRuntimeModule } from "./router";

export interface CompileOptions {
  inputPath: string;
  outputPath?: string;
}

export interface CompileResult {
  outputPath: string;
  code: string;
}

export interface CompileProjectOptions {
  inputPath: string;
  outputPath?: string;
  outputDir?: string;
  routerEnabled?: boolean;
  routerTitle?: string;
  copyPublic?: boolean;
}

export interface CompileProjectResult {
  outputPaths: string[];
}

export interface VeloxBuildManifest {
  version: 1;
  generatedAt: string;
  sourceRoot: string;
  outputRoot: string;
  files: {
    modules: string[];
    routeData: string[];
    public: string[];
  };
  router: {
    enabled: boolean;
    title: string;
    routeCount: number;
    notFoundModulePath: string | null;
    routes: Array<{
      path: string;
      modulePath: string;
      layoutModulePaths: string[];
      loadingModulePath: string | null;
      errorModulePath: string | null;
    }>;
  };
}

export interface CheckProjectOptions {
  inputPath: string;
}

export interface CheckProjectResult {
  fileCount: number;
}

type VeloxDiagnosticCode =
  | "VX2001"
  | "VX2002"
  | "VX2003"
  | "VX2004"
  | "VX2005"
  | "VX2006"
  | "VX3001"
  | "VX3002"
  | "VX3003"
  | "VX3004"
  | "VX3005"
  | "VX3006"
  | "VX3007"
  | "VX3008"
  | "VX3009"
  | "VX3010"
  | "VX3011"
  | "VX3012"
  | "VX3013"
  | "VX3014"
  | "VX3015"
  | "VX3016"
  | "VX3017"
  | "VX3018"
  | "VX3019"
  | "VX3020"
  | "VX3021"
  | "VX3022"
  | "VX3023"
  | "VX3024"
  | "VX3025"
  | "VX3026"
  | "VX3027"
  | "VX3028";

function vxError(code: VeloxDiagnosticCode, message: string): Error {
  return new Error(`[${code}] ${message}`);
}

export function compileFile(options: CompileOptions): CompileResult {
  const inputPath = resolve(options.inputPath);
  const parsed = parseSourceFile(inputPath);
  const outputPath = resolve(options.outputPath ?? inferOutputPath(inputPath));
  return emitParsedToFile(parsed, outputPath);
}

export function compileProject(options: CompileProjectOptions): CompileProjectResult {
  const inputPath = resolve(options.inputPath);
  const inputStats = statSync(inputPath);

  if (!inputStats.isDirectory()) {
    const result = compileFile({
      inputPath,
      outputPath: options.outputPath ? resolve(options.outputPath) : undefined,
    });
    return { outputPaths: [result.outputPath] };
  }

  const outputDir = resolve(options.outputDir ?? "dist");
  const routerEnabled = options.routerEnabled ?? true;
  const routerTitle = options.routerTitle ?? "Velox App";
  const copyPublic = options.copyPublic ?? true;
  const sourceFiles = listVxFiles(inputPath);
  if (sourceFiles.length === 0) {
    throw vxError("VX2006", `No .vx files found in ${inputPath}`);
  }
  const parsedByFile = new Map<string, ParsedSource>();
  for (const sourceFile of sourceFiles) {
    const abs = resolve(sourceFile);
    parsedByFile.set(abs, parseSourceFile(abs));
  }
  validatePageConventionFiles(inputPath, sourceFiles);
  validateProjectImports(sourceFiles, parsedByFile, inputPath);

  const outputPaths: string[] = [];
  for (const sourceFile of sourceFiles) {
    const absSource = resolve(sourceFile);
    const rel = relative(inputPath, absSource);
    const outputRel = toJsOutputPath(rel);
    const outputPath = join(outputDir, outputRel);
    const parsed = parsedByFile.get(absSource)!;
    const result = emitParsedToFile(parsed, outputPath);
    outputPaths.push(result.outputPath);
  }

  const copiedRouteData = copyRouteDataFiles(inputPath, outputDir);
  const copiedImportedCss = copyImportedCssFiles(inputPath, outputDir, parsedByFile);
  let copiedPublic: string[] = [];
  if (copyPublic) {
    copiedPublic = copyPublicDirIfPresent(inputPath, outputDir);
  }
  const manifest = collectFileRoutes(inputPath, sourceFiles);
  if (routerEnabled && (manifest.routes.length > 0 || manifest.notFoundModulePath)) {
    const routerModulePath = join(outputDir, "__velox_router.js");
    writeFileSync(routerModulePath, emitRouterRuntimeModule(manifest), "utf8");
    writeFileSync(
      join(outputDir, "index.html"),
      emitRouterHtml(routerTitle, { stylesheets: copiedImportedCss }),
      "utf8",
    );
  }
  const allPublicLike = [...copiedPublic, ...copiedImportedCss].sort();
  writeBuildManifest({
    outputDir,
    sourceRoot: inputPath,
    outputPaths,
    routeDataPaths: copiedRouteData,
    publicPaths: allPublicLike,
    routerEnabled,
    routerTitle,
    routes: manifest.routes,
    notFoundModulePath: manifest.notFoundModulePath,
  });
  return { outputPaths };
}

export function checkProject(options: CheckProjectOptions): CheckProjectResult {
  const inputPath = resolve(options.inputPath);
  const inputStats = statSync(inputPath);
  if (!inputStats.isDirectory()) {
    const parsed = parseSourceFile(inputPath);
    validateSingleFileImports(inputPath, parsed.ast);
    const parsedByFile = new Map<string, ParsedSource>([[inputPath, parsed]]);
    const importedSymbolsByFile = new Map<string, Map<string, ModuleExportSymbol>>([
      [inputPath, new Map<string, ModuleExportSymbol>()],
    ]);
    const importedLocalNamesByFile = new Map<string, Set<string>>([[inputPath, new Set<string>()]]);
    validateStateExpressionChecks(parsedByFile, importedSymbolsByFile, importedLocalNamesByFile);
    emitJavaScript(parsed.ast);
    return { fileCount: 1 };
  }

  const sourceFiles = listVxFiles(inputPath);
  if (sourceFiles.length === 0) {
    throw vxError("VX2006", `No .vx files found in ${inputPath}`);
  }
  const parsedByFile = new Map<string, ParsedSource>();
  for (const sourceFile of sourceFiles) {
    const abs = resolve(sourceFile);
    parsedByFile.set(abs, parseSourceFile(abs));
  }
  validatePageConventionFiles(inputPath, sourceFiles);
  validateProjectImports(sourceFiles, parsedByFile, inputPath);
  for (const parsed of parsedByFile.values()) {
    emitJavaScript(parsed.ast);
  }
  return { fileCount: sourceFiles.length };
}

function validateSingleFileImports(sourceFile: string, ast: ProgramNode): void {
  for (const node of ast.body) {
    if (node.kind !== "Import") {
      continue;
    }

    if (isAbsoluteImportSpecifier(node.source)) {
      throw vxError(
        "VX3022",
        `Import "${node.source}" in ${sourceFile} uses an absolute path. Use relative or package specifiers.`,
      );
    }

    if (node.sideEffectOnly && !node.source.startsWith(".")) {
      continue;
    }
    if (!node.sideEffectOnly && !node.source.startsWith(".")) {
      continue;
    }

    if (node.source.startsWith(".") && node.source.endsWith(".js")) {
      throw vxError(
        "VX3021",
        `Import "${node.source}" in ${sourceFile} uses .js specifier. Use .vx or extensionless import in source files.`,
      );
    }

    if (
      node.source.startsWith(".") &&
      hasExplicitRelativeExtension(node.source) &&
      !hasVxExtension(node.source)
    ) {
      if (node.sideEffectOnly && hasCssExtension(node.source)) {
        resolveRelativeAssetImport(node.source, sourceFile, dirname(sourceFile));
        continue;
      }
      throw vxError(
        "VX3024",
        `Import "${node.source}" in ${sourceFile} uses unsupported extension. ` +
          `Use ".vx" or extensionless relative imports.`,
      );
    }

    if (
      !node.sideEffectOnly &&
      node.defaultImport === null &&
      node.namespaceImport === null &&
      node.namedImports.length === 0
    ) {
      throw vxError(
        "VX3018",
        `Empty import clause is not allowed in ${sourceFile}. Use side-effect import syntax instead.`,
      );
    }

    if (!node.source.startsWith(".")) {
      continue;
    }

    if (hasVxExtension(node.source)) {
      const resolved = resolveVxFilePath(resolve(dirname(sourceFile), node.source));
      if (!existsSync(resolved)) {
        throw vxError(
          "VX2001",
          `Missing imported .vx module "${node.source}" referenced by ${sourceFile}. Expected file: ${resolved}`,
        );
      }
      if (node.defaultImport) {
        throw vxError(
          "VX2005",
          `Default import "${node.defaultImport}" from "${node.source}" in ${sourceFile} is not supported yet. ` +
            "Use named imports or namespace imports.",
        );
      }
      continue;
    }

    if (!hasExplicitRelativeExtension(node.source)) {
      const resolved = resolveVxFilePath(resolve(dirname(sourceFile), node.source), true);
      if (!existsSync(resolved)) {
        throw vxError(
          "VX2001",
          `Missing imported .vx module "${node.source}" referenced by ${sourceFile}. Expected file: ${resolved}`,
        );
      }
      if (node.defaultImport) {
        throw vxError(
          "VX2005",
          `Default import "${node.defaultImport}" from "${node.source}" in ${sourceFile} is not supported yet. ` +
            "Use named imports or namespace imports.",
        );
      }
    }
  }
}

function inferOutputPath(inputPath: string): string {
  return toJsOutputPath(inputPath);
}

function copyPublicDirIfPresent(sourceRoot: string, outputDir: string): string[] {
  const publicDir = join(sourceRoot, "public");
  if (!existsSync(publicDir) || !statSync(publicDir).isDirectory()) {
    return [];
  }
  return copyDirectoryRecursive(publicDir, outputDir);
}

function copyRouteDataFiles(sourceRoot: string, outputDir: string): string[] {
  const dataFiles = listRouteDataFiles(sourceRoot);
  const copied: string[] = [];
  for (const sourceFile of dataFiles) {
    const rel = relative(sourceRoot, sourceFile);
    const target = join(outputDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(sourceFile, target);
    copied.push(normalizeRelPath(rel));
  }
  copied.sort();
  return copied;
}

function copyImportedCssFiles(
  sourceRoot: string,
  outputDir: string,
  parsedByFile: Map<string, ParsedSource>,
): string[] {
  const cssFiles = collectImportedCssFiles(parsedByFile, sourceRoot);
  const copied: string[] = [];
  for (const sourceFile of cssFiles) {
    const rel = relative(sourceRoot, sourceFile);
    const target = join(outputDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(sourceFile, target);
    copied.push(normalizeRelPath(rel));
  }
  copied.sort();
  return copied;
}

function collectImportedCssFiles(parsedByFile: Map<string, ParsedSource>, sourceRoot: string): string[] {
  const css = new Set<string>();
  for (const [sourceFile, parsed] of parsedByFile) {
    for (const node of parsed.ast.body) {
      if (node.kind !== "Import") {
        continue;
      }
      if (!node.sideEffectOnly) {
        continue;
      }
      if (!node.source.startsWith(".")) {
        continue;
      }
      if (!hasCssExtension(node.source)) {
        continue;
      }
      const resolved = resolveRelativeAssetImport(node.source, sourceFile, sourceRoot);
      css.add(resolved);
    }
  }
  return [...css].sort();
}

function listRouteDataFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreSourceDir(entry.name)) {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (entry.isFile() && full.endsWith(".data.js")) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function copyDirectoryRecursive(sourceDir: string, targetDir: string, rootTargetDir: string = targetDir): string[] {
  const copied: string[] = [];
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const target = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copied.push(...copyDirectoryRecursive(source, target, rootTargetDir));
      continue;
    }
    if (entry.isFile()) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
      copied.push(normalizeRelPath(relative(rootTargetDir, target)));
    }
  }
  return copied;
}

function listVxFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreSourceDir(entry.name)) {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (entry.isFile() && hasVxExtension(full)) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function writeBuildManifest(input: {
  outputDir: string;
  sourceRoot: string;
  outputPaths: string[];
  routeDataPaths: string[];
  publicPaths: string[];
  routerEnabled: boolean;
  routerTitle: string;
  routes: Array<{
    path: string;
    modulePath: string;
    layoutModulePaths: string[];
    loadingModulePath: string | null;
    errorModulePath: string | null;
  }>;
  notFoundModulePath: string | null;
}): void {
  const modulePaths = input.outputPaths
    .map((outputPath) => normalizeRelPath(relative(input.outputDir, outputPath)))
    .sort();

  const manifest: VeloxBuildManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot: input.sourceRoot,
    outputRoot: input.outputDir,
    files: {
      modules: modulePaths,
      routeData: [...input.routeDataPaths].sort(),
      public: [...input.publicPaths].sort(),
    },
    router: {
      enabled: input.routerEnabled,
      title: input.routerTitle,
      routeCount: input.routes.length,
      notFoundModulePath: input.notFoundModulePath,
      routes: input.routes.map((route) => ({
        path: route.path,
        modulePath: route.modulePath,
        layoutModulePaths: [...route.layoutModulePaths],
        loadingModulePath: route.loadingModulePath,
        errorModulePath: route.errorModulePath,
      })),
    },
  };
  const outPath = join(input.outputDir, "velox-manifest.json");
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function normalizeRelPath(path: string): string {
  return path.split("\\").join("/");
}

function shouldIgnoreSourceDir(name: string): boolean {
  if (name === "node_modules") {
    return true;
  }
  if (name === ".git" || name === ".velox") {
    return true;
  }
  if (name === "dist" || name.startsWith("dist-")) {
    return true;
  }
  return false;
}

function validatePageConventionFiles(sourceRoot: string, sourceFiles: string[]): void {
  const pageModules = new Set<string>();
  const loadingModules: string[] = [];
  const errorModules: string[] = [];

  for (const sourceFile of sourceFiles) {
    const pagesRel = toPagesRelative(sourceRoot, sourceFile, ".vx");
    if (!pagesRel) {
      continue;
    }
    const baseName = pagesRel.split("/").at(-1) ?? "";
    if (baseName === "_layout" || baseName === "404" || baseName.startsWith("_")) {
      continue;
    }
    if (baseName.endsWith(".loading")) {
      loadingModules.push(pagesRel);
      continue;
    }
    if (baseName.endsWith(".error")) {
      errorModules.push(pagesRel);
      continue;
    }
    pageModules.add(pagesRel);
  }

  for (const loadingRel of loadingModules) {
    const pageRel = loadingRel.slice(0, -".loading".length);
    if (!pageModules.has(pageRel)) {
      throw vxError(
        "VX3026",
        `Route loading module "${loadingRel}.vx" has no matching page "${pageRel}.vx" in ${sourceRoot}.`,
      );
    }
  }

  for (const errorRel of errorModules) {
    const pageRel = errorRel.slice(0, -".error".length);
    if (!pageModules.has(pageRel)) {
      throw vxError(
        "VX3027",
        `Route error module "${errorRel}.vx" has no matching page "${pageRel}.vx" in ${sourceRoot}.`,
      );
    }
  }

  const dataFiles = listRouteDataFiles(sourceRoot);
  for (const dataFile of dataFiles) {
    const pagesRel = toPagesRelative(sourceRoot, dataFile, ".data.js");
    if (!pagesRel) {
      continue;
    }
    if (!pageModules.has(pagesRel)) {
      throw vxError(
        "VX3028",
        `Route data module "${pagesRel}.data.js" has no matching page "${pagesRel}.vx" in ${sourceRoot}.`,
      );
    }
  }
}

function toPagesRelative(sourceRoot: string, filePath: string, suffix: ".vx" | ".data.js"): string | null {
  const rel = normalizeRelPath(relative(sourceRoot, filePath));
  if (!hasSuffixIgnoreCase(rel, suffix)) {
    return null;
  }
  const base = rel.slice(0, -suffix.length);
  if (base.startsWith("pages/")) {
    return base.slice("pages/".length);
  }
  const rootLooksLikePages = /(^|[\\/])pages$/.test(sourceRoot);
  if (rootLooksLikePages) {
    return base;
  }
  return null;
}

function validateProjectImports(
  sourceFiles: string[],
  parsedByFile: Map<string, ParsedSource>,
  sourceRoot: string,
): void {
  const sourceSet = new Set(sourceFiles.map((file) => resolve(file)));
  const exportsByFile = new Map<string, Map<string, ModuleExportSymbol>>();
  const importedLocalNamesByFile = new Map<string, Set<string>>();

  for (const [file, parsed] of parsedByFile) {
    exportsByFile.set(file, collectModuleExports(parsed.ast, file));
    importedLocalNamesByFile.set(file, collectImportedLocalNames(parsed.ast));
  }

  const graph = new Map<string, string[]>();
  const importedSymbolsByFile = new Map<string, Map<string, ModuleExportSymbol>>();

  for (const sourceFile of sourceFiles) {
    const absSource = resolve(sourceFile);
    const ast = parsedByFile.get(absSource)!.ast;
    const deps: string[] = [];
    const importedSymbols = new Map<string, ModuleExportSymbol>();
    for (const node of ast.body) {
      if (node.kind !== "Import") {
        continue;
      }
      if (isAbsoluteImportSpecifier(node.source)) {
        throw vxError(
          "VX3022",
          `Import "${node.source}" in ${absSource} uses an absolute path. Use relative or package specifiers.`,
        );
      }
      if (node.sideEffectOnly && !node.source.startsWith(".")) {
        // External side-effect imports are allowed (for example polyfills from packages).
        continue;
      }
      if (!node.sideEffectOnly && !node.source.startsWith(".")) {
        // External package imports are allowed. Symbol validation is skipped for package specifiers.
        continue;
      }
      if (node.source.startsWith(".") && node.source.endsWith(".js")) {
        throw vxError(
          "VX3021",
          `Import "${node.source}" in ${absSource} uses .js specifier. Use .vx or extensionless import in source files.`,
        );
      }
      if (
        node.source.startsWith(".") &&
        hasExplicitRelativeExtension(node.source) &&
        !hasVxExtension(node.source)
      ) {
        if (node.sideEffectOnly && hasCssExtension(node.source)) {
          resolveRelativeAssetImport(node.source, absSource, sourceRoot);
          continue;
        }
        throw vxError(
          "VX3024",
          `Import "${node.source}" in ${absSource} uses unsupported extension. ` +
            `Use ".vx" or extensionless relative imports.`,
        );
      }
      if (
        !node.sideEffectOnly &&
        node.defaultImport === null &&
        node.namespaceImport === null &&
        node.namedImports.length === 0
      ) {
        throw vxError(
          "VX3018",
          `Empty import clause is not allowed in ${absSource}. Use side-effect import syntax instead.`,
        );
      }
      const spec = node.source;
      const depAbs = resolveProjectImport(spec, absSource, sourceSet, sourceRoot);
      if (!depAbs) {
        continue;
      }
      if (node.defaultImport) {
        throw vxError(
          "VX2005",
          `Default import "${node.defaultImport}" from "${spec}" in ${absSource} is not supported yet. ` +
            "Use named imports or namespace imports.",
        );
      }
      const depExports = exportsByFile.get(depAbs)!;
      for (const binding of node.namedImports) {
        const symbol = depExports.get(binding.imported);
        if (!symbol) {
          const available = [...depExports.keys()].sort().join(", ") || "(none)";
          throw vxError(
            "VX2003",
            `Unknown import "${binding.imported}" from "${spec}" in ${absSource}. ` +
              `Available exports: ${available}`,
          );
        }
        importedSymbols.set(binding.local, symbol);
      }
      deps.push(depAbs);
    }
    graph.set(absSource, deps);
    importedSymbolsByFile.set(absSource, importedSymbols);
  }

  detectImportCycles(graph);
  validateStateExpressionChecks(parsedByFile, importedSymbolsByFile, importedLocalNamesByFile);
}

function isAbsoluteImportSpecifier(spec: string): boolean {
  if (spec.startsWith("/") || spec.startsWith("\\")) {
    return true;
  }
  return /^[A-Za-z]:[\\/]/.test(spec);
}

function hasExplicitRelativeExtension(spec: string): boolean {
  return spec.startsWith(".") && extname(spec) !== "";
}

function detectImportCycles(graph: Map<string, string[]>): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (file: string): void => {
    if (visited.has(file)) {
      return;
    }
    if (visiting.has(file)) {
      const cycleStart = stack.indexOf(file);
      const cycle = [...stack.slice(cycleStart), file];
      throw vxError("VX2002", `Import cycle detected: ${cycle.join(" -> ")}`);
    }

    visiting.add(file);
    stack.push(file);
    const deps = graph.get(file) ?? [];
    for (const dep of deps) {
      visit(dep);
    }
    stack.pop();
    visiting.delete(file);
    visited.add(file);
  };

  for (const file of graph.keys()) {
    visit(file);
  }
}

interface ParsedSource {
  source: string;
  ast: ProgramNode;
}

function parseSourceFile(inputPath: string): ParsedSource {
  const source = readFileSync(inputPath, "utf8");
  const ast = parse(lex(source), source);
  return { source, ast };
}

function emitParsedToFile(parsed: ParsedSource, outputPath: string): CompileResult {
  const emitted = emitJavaScript(parsed.ast);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, emitted.code, "utf8");
  return { outputPath, code: emitted.code };
}

function collectModuleExports(ast: ProgramNode, sourceFile: string): Map<string, ModuleExportSymbol> {
  const out = new Map<string, ModuleExportSymbol>();
  const topLevelNames = new Set<string>();
  const importLocalNames = new Set<string>();
  const namespaceImportNames = new Set<string>();
  const componentNames = new Set<string>();
  const fastFunctionNames = new Set<string>();
  for (const node of ast.body) {
    if (node.kind === "Import") {
      if (node.defaultImport) {
        ensureUniqueImportLocalName(importLocalNames, node.defaultImport, sourceFile);
        ensureUniqueTopLevelName(topLevelNames, node.defaultImport, sourceFile);
      }
      if (node.namespaceImport) {
        ensureUniqueImportLocalName(importLocalNames, node.namespaceImport, sourceFile);
        ensureUniqueTopLevelName(topLevelNames, node.namespaceImport, sourceFile);
        namespaceImportNames.add(node.namespaceImport);
      }
      for (const named of node.namedImports) {
        ensureUniqueImportLocalName(importLocalNames, named.local, sourceFile);
        ensureUniqueTopLevelName(topLevelNames, named.local, sourceFile);
      }
      continue;
    }

    if (node.kind !== "Component" && node.kind !== "FastFunction") {
      continue;
    }
    if (node.kind === "Component") {
      if (namespaceImportNames.has(node.name)) {
        throw vxError(
          "VX3019",
          `Declaration "${node.name}" in ${sourceFile} collides with a namespace import alias.`,
        );
      }
      if (componentNames.has(node.name)) {
        throw vxError("VX3013", `Duplicate component "${node.name}" in ${sourceFile}.`);
      }
      componentNames.add(node.name);
    } else if (node.kind === "FastFunction") {
      if (namespaceImportNames.has(node.name)) {
        throw vxError(
          "VX3019",
          `Declaration "${node.name}" in ${sourceFile} collides with a namespace import alias.`,
        );
      }
      if (fastFunctionNames.has(node.name)) {
        throw vxError("VX3014", `Duplicate @fast function "${node.name}" in ${sourceFile}.`);
      }
      fastFunctionNames.add(node.name);
    }
    const existingExport = out.get(node.name);
    if (
      existingExport &&
      ((existingExport.kind === "Component" && node.kind === "FastFunction") ||
        (existingExport.kind === "FastFunction" && node.kind === "Component"))
    ) {
      throw vxError(
        "VX3015",
        `Name conflict "${node.name}" in ${sourceFile}: cannot declare ${node.kind} ` +
          `when ${existingExport.kind} with same name already exists.`,
      );
    }
    ensureUniqueTopLevelName(topLevelNames, node.name, sourceFile);
    if (out.has(node.name)) {
      throw vxError("VX2004", `Duplicate export "${node.name}" in ${sourceFile}`);
    }
    if (node.kind === "Component") {
      out.set(node.name, {
        kind: "Component",
        name: node.name,
        sourceFile,
        arity: node.params.length,
        paramTypes: node.params.map((p) => p.type),
      });
      continue;
    }
    out.set(node.name, {
      kind: "FastFunction",
      name: node.name,
      sourceFile,
      arity: node.params.length,
      paramTypes: node.params.map((p) => p.type),
      returnType: node.returnType,
    });
  }
  return out;
}

function collectImportedLocalNames(ast: ProgramNode): Set<string> {
  const out = new Set<string>();
  for (const node of ast.body) {
    if (node.kind !== "Import") {
      continue;
    }
    if (node.defaultImport) {
      out.add(node.defaultImport);
    }
    if (node.namespaceImport) {
      out.add(node.namespaceImport);
    }
    for (const named of node.namedImports) {
      out.add(named.local);
    }
  }
  return out;
}

interface ModuleExportSymbol {
  kind: "Component" | "FastFunction";
  name: string;
  sourceFile: string;
  arity: number;
  paramTypes: string[];
  returnType?: string;
}

function resolveProjectImport(
  spec: string,
  sourceFile: string,
  sourceSet: Set<string>,
  sourceRoot: string,
): string | null {
  if (!spec.startsWith(".")) {
    return null;
  }
  if (hasVxExtension(spec)) {
    const resolved = resolveVxFilePath(resolve(dirname(sourceFile), spec));
    if (!isPathWithinRoot(resolved, sourceRoot)) {
      throw vxError(
        "VX3023",
        `Relative import "${spec}" in ${sourceFile} escapes project root ${sourceRoot}.`,
      );
    }
    if (!sourceSet.has(resolved)) {
      throw vxError(
        "VX2001",
        `Missing imported .vx module "${spec}" referenced by ${sourceFile}. ` +
          `Expected file: ${resolved}`,
      );
    }
    return resolved;
  }
  if (extname(spec) !== "") {
    return null;
  }
  const resolved = resolveVxFilePath(resolve(dirname(sourceFile), spec), true);
  if (!isPathWithinRoot(resolved, sourceRoot)) {
    throw vxError(
      "VX3023",
      `Relative import "${spec}" in ${sourceFile} escapes project root ${sourceRoot}.`,
    );
  }
  if (!sourceSet.has(resolved)) {
    throw vxError(
      "VX2001",
      `Missing imported .vx module "${spec}" referenced by ${sourceFile}. ` +
        `Expected file: ${resolved}`,
    );
  }
  return resolved;
}

function toJsOutputPath(pathValue: string): string {
  if (hasVxExtension(pathValue)) {
    return pathValue.slice(0, -extname(pathValue).length) + ".js";
  }
  return `${pathValue}.js`;
}

function hasVxExtension(pathValue: string): boolean {
  return extname(pathValue).toLowerCase() === ".vx";
}

function hasSuffixIgnoreCase(value: string, suffix: string): boolean {
  return value.toLowerCase().endsWith(suffix.toLowerCase());
}

function hasCssExtension(pathValue: string): boolean {
  return extname(pathValue).toLowerCase() === ".css";
}

function resolveVxFilePath(pathValue: string, fromExtensionless: boolean = false): string {
  if (existsSync(pathValue)) {
    return pathValue;
  }
  if (hasVxExtension(pathValue)) {
    const base = pathValue.slice(0, -extname(pathValue).length);
    const swapped = base + (extname(pathValue) === ".vx" ? ".VX" : ".vx");
    if (existsSync(swapped)) {
      return swapped;
    }
    return pathValue;
  }
  if (fromExtensionless) {
    const lower = `${pathValue}.vx`;
    if (existsSync(lower)) {
      return lower;
    }
    const upper = `${pathValue}.VX`;
    if (existsSync(upper)) {
      return upper;
    }
    return lower;
  }
  return pathValue;
}

function resolveRelativeAssetImport(
  spec: string,
  sourceFile: string,
  sourceRoot: string,
): string {
  const resolved = resolve(dirname(sourceFile), spec);
  if (!isPathWithinRoot(resolved, sourceRoot)) {
    throw vxError(
      "VX3023",
      `Relative import "${spec}" in ${sourceFile} escapes project root ${sourceRoot}.`,
    );
  }
  if (!existsSync(resolved)) {
    throw vxError(
      "VX2001",
      `Missing imported asset "${spec}" referenced by ${sourceFile}. Expected file: ${resolved}`,
    );
  }
  return resolved;
}

function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  const rel = relative(resolve(rootPath), resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function ensureUniqueTopLevelName(names: Set<string>, name: string, sourceFile: string): void {
  if (names.has(name)) {
    throw vxError("VX2004", `Duplicate top-level name "${name}" in ${sourceFile}`);
  }
  names.add(name);
}

function ensureUniqueImportLocalName(names: Set<string>, name: string, sourceFile: string): void {
  if (names.has(name)) {
    throw vxError("VX3012", `Duplicate imported local name "${name}" in ${sourceFile}.`);
  }
  names.add(name);
}

function validateStateExpressionChecks(
  parsedByFile: Map<string, ParsedSource>,
  importedSymbolsByFile: Map<string, Map<string, ModuleExportSymbol>>,
  importedLocalNamesByFile: Map<string, Set<string>>,
): void {
  for (const [sourceFile, parsed] of parsedByFile) {
    const imported = importedSymbolsByFile.get(sourceFile) ?? new Map<string, ModuleExportSymbol>();
    const importedLocalNames = importedLocalNamesByFile.get(sourceFile) ?? new Set<string>();
    for (const node of parsed.ast.body) {
      if (node.kind !== "Component") {
        continue;
      }
      const seenParams = new Set<string>();
      for (const param of node.params) {
        if (param.name === node.name) {
          throw vxError(
            "VX3017",
            `Param "${param.name}" in component "${node.name}" cannot reuse the component name in ${sourceFile}.`,
          );
        }
        if (seenParams.has(param.name)) {
          throw vxError(
            "VX3011",
            `Duplicate param "${param.name}" in component "${node.name}" in ${sourceFile}.`,
          );
        }
        seenParams.add(param.name);
        if (importedLocalNames.has(param.name)) {
          throw vxError(
            "VX3010",
            `Param "${param.name}" in component "${node.name}" collides with an imported local name in ${sourceFile}.`,
          );
        }
      }
      const reservedNames = new Set<string>([...importedLocalNames, ...node.params.map((p) => p.name)]);
      const seenStateNames = new Set<string>();
      for (const stateDecl of node.state) {
        if (stateDecl.name === node.name) {
          throw vxError(
            "VX3016",
            `State "~${stateDecl.name}" in component "${node.name}" cannot reuse the component name in ${sourceFile}.`,
          );
        }
        if (reservedNames.has(stateDecl.name)) {
          throw vxError(
            "VX3009",
            `State "~${stateDecl.name}" in component "${node.name}" collides with an existing param/import name in ${sourceFile}.`,
          );
        }
        if (seenStateNames.has(stateDecl.name)) {
          throw vxError(
            "VX3008",
            `Duplicate state declaration "~${stateDecl.name}" in component "${node.name}" in ${sourceFile}.`,
          );
        }
        seenStateNames.add(stateDecl.name);
      }
      const knownIdentifiers = new Map<string, InferredType>();
      for (const name of importedLocalNames) {
        knownIdentifiers.set(name, "unknown");
      }
      for (const param of node.params) {
        knownIdentifiers.set(param.name, "unknown");
      }
      const allStateNames = new Set<string>(node.state.map((s) => s.name));
      const declaredStateNames = new Set<string>();
      for (const stateDecl of node.state) {
        if (expressionContainsIdentifier(stateDecl.value, stateDecl.name)) {
          throw vxError(
            "VX3006",
            `State "${stateDecl.name}" cannot reference itself in its initializer in ${sourceFile}.`,
          );
        }
        const forwardRef = findReferencedIdentifier(stateDecl.value, (name) => {
          if (!allStateNames.has(name)) {
            return false;
          }
          if (name === stateDecl.name) {
            return false;
          }
          return !declaredStateNames.has(name);
        });
        if (forwardRef) {
          throw vxError(
            "VX3007",
            `State "${stateDecl.name}" references later state "${forwardRef}" before it is declared in ${sourceFile}.`,
          );
        }
        const inferred = inferExpressionType(stateDecl.value, imported, knownIdentifiers, sourceFile);
        knownIdentifiers.set(stateDecl.name, inferred);
        declaredStateNames.add(stateDecl.name);
      }
    }
  }
}

type InferredPrimitiveType = "i32" | "string" | "boolean" | "unknown";

interface InferredArrayType {
  kind: "array";
  elementType: InferredType;
}

interface InferredObjectType {
  kind: "object";
  properties: Map<string, InferredType>;
}

type InferredType = InferredPrimitiveType | InferredArrayType | InferredObjectType;

function isArrayType(value: InferredType): value is InferredArrayType {
  return typeof value === "object" && value.kind === "array";
}

function isObjectType(value: InferredType): value is InferredObjectType {
  return typeof value === "object" && value.kind === "object";
}

function isUnknownType(value: InferredType): boolean {
  return value === "unknown";
}

function isI32Type(value: InferredType): boolean {
  return value === "i32";
}

function isStringType(value: InferredType): boolean {
  return value === "string";
}

function isBooleanType(value: InferredType): boolean {
  return value === "boolean";
}

function formatInferredType(value: InferredType): string {
  if (typeof value === "string") {
    return value;
  }
  if (value.kind === "array") {
    return `array<${formatInferredType(value.elementType)}>`;
  }
  const keys = [...value.properties.keys()];
  keys.sort();
  const entries = keys.map((key) => `${key}:${formatInferredType(value.properties.get(key) ?? "unknown")}`);
  return `object{${entries.join(",")}}`;
}

function areSameInferredType(a: InferredType, b: InferredType): boolean {
  if (typeof a === "string" || typeof b === "string") {
    return a === b;
  }
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === "array" && b.kind === "array") {
    return areSameInferredType(a.elementType, b.elementType);
  }
  if (a.kind === "object" && b.kind === "object") {
    if (a.properties.size !== b.properties.size) {
      return false;
    }
    for (const [key, value] of a.properties) {
      const right = b.properties.get(key);
      if (!right || !areSameInferredType(value, right)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function mergeInferredType(a: InferredType, b: InferredType): InferredType {
  if (isUnknownType(a)) {
    return b;
  }
  if (isUnknownType(b)) {
    return a;
  }
  if (areSameInferredType(a, b)) {
    return a;
  }
  return "unknown";
}

function throwInvalidOperandType(
  operator: string,
  left: InferredType,
  right: InferredType | null,
  sourceFile: string,
): never {
  if (right === null) {
    throw vxError(
      "VX3005",
      `Invalid operand type for "${operator}" in ${sourceFile}. Got ${formatInferredType(left)}.`,
    );
  }
  throw vxError(
    "VX3005",
    `Invalid operand types for "${operator}" in ${sourceFile}. Got ` +
      `${formatInferredType(left)} and ${formatInferredType(right)}.`,
  );
}

function inferExpressionType(
  expr: ExpressionNode,
  imported: Map<string, ModuleExportSymbol>,
  knownIdentifiers: Map<string, InferredType>,
  sourceFile: string,
): InferredType {
  switch (expr.kind) {
    case "NumberLiteral":
      return "i32";
    case "StringLiteral":
      return "string";
    case "BooleanLiteral":
      return "boolean";
    case "ArrayLiteral":
      if (expr.elements.length === 0) {
        return { kind: "array", elementType: "unknown" };
      }
      let elementType: InferredType = "unknown";
      for (const element of expr.elements) {
        const inferred = inferExpressionType(element, imported, knownIdentifiers, sourceFile);
        elementType = mergeInferredType(elementType, inferred);
      }
      return { kind: "array", elementType };
    case "ObjectLiteral":
      const properties = new Map<string, InferredType>();
      for (const property of expr.properties) {
        properties.set(
          property.key,
          inferExpressionType(property.value, imported, knownIdentifiers, sourceFile),
        );
      }
      return { kind: "object", properties };
    case "Identifier":
      if (!knownIdentifiers.has(expr.name)) {
        throw vxError("VX3004", `Unknown identifier "${expr.name}" in state expression in ${sourceFile}.`);
      }
      return knownIdentifiers.get(expr.name) ?? "unknown";
    case "MemberExpression": {
      const objectType = inferExpressionType(expr.object, imported, knownIdentifiers, sourceFile);
      if (expr.computed) {
        const keyType = inferExpressionType(expr.property, imported, knownIdentifiers, sourceFile);
        if (!isUnknownType(keyType) && !isI32Type(keyType) && !isStringType(keyType)) {
          throwInvalidOperandType("[]", keyType, null, sourceFile);
        }
        if (isArrayType(objectType)) {
          if (!isUnknownType(keyType) && !isI32Type(keyType)) {
            throwInvalidOperandType("[]", objectType, keyType, sourceFile);
          }
          return objectType.elementType;
        }
        if (isObjectType(objectType)) {
          if (expr.property.kind === "StringLiteral") {
            if (!objectType.properties.has(expr.property.value)) {
              throw vxError(
                "VX3005",
                `Unknown object property "${expr.property.value}" in ${sourceFile}.`,
              );
            }
            return objectType.properties.get(expr.property.value) ?? "unknown";
          }
          throw vxError(
            "VX3005",
            `Object index access in ${sourceFile} must use a string literal key when object shape is known.`,
          );
        }
        if (!isUnknownType(objectType)) {
          throwInvalidOperandType("[]", objectType, keyType, sourceFile);
        }
        return "unknown";
      }

      if (isObjectType(objectType) && expr.property.kind === "Identifier") {
        if (!objectType.properties.has(expr.property.name)) {
          throw vxError(
            "VX3005",
            `Unknown object property "${expr.property.name}" in ${sourceFile}.`,
          );
        }
        return objectType.properties.get(expr.property.name) ?? "unknown";
      }
      if (isArrayType(objectType) && expr.property.kind === "Identifier" && expr.property.name === "length") {
        return "i32";
      }
      if (!isUnknownType(objectType)) {
        throwInvalidOperandType(".", objectType, null, sourceFile);
      }
      return "unknown";
    }
    case "UnaryExpression": {
      const inner = inferExpressionType(expr.argument, imported, knownIdentifiers, sourceFile);
      if (expr.operator === "-") {
        if (isI32Type(inner)) {
          return "i32";
        }
        if (!isUnknownType(inner)) {
          throwInvalidOperandType(expr.operator, inner, null, sourceFile);
        }
        return "unknown";
      }
      if (expr.operator === "!") {
        if (isBooleanType(inner)) {
          return "boolean";
        }
        if (!isUnknownType(inner)) {
          throwInvalidOperandType(expr.operator, inner, null, sourceFile);
        }
        return "unknown";
      }
      return "unknown";
    }
    case "BinaryExpression": {
      const left = inferExpressionType(expr.left, imported, knownIdentifiers, sourceFile);
      const right = inferExpressionType(expr.right, imported, knownIdentifiers, sourceFile);
      switch (expr.operator) {
        case "+":
          if (isStringType(left) || isStringType(right)) {
            return "string";
          }
          if (isI32Type(left) && isI32Type(right)) {
            return "i32";
          }
          if (!isUnknownType(left) && !isUnknownType(right)) {
            throwInvalidOperandType(expr.operator, left, right, sourceFile);
          }
          return "unknown";
        case "-":
        case "*":
        case "/":
        case "%":
          if (isI32Type(left) && isI32Type(right)) {
            return "i32";
          }
          if (!isUnknownType(left) && !isUnknownType(right)) {
            throwInvalidOperandType(expr.operator, left, right, sourceFile);
          }
          return "unknown";
        case "==":
        case "!=":
          if (isUnknownType(left) || isUnknownType(right)) {
            return "unknown";
          }
          if (areSameInferredType(left, right)) {
            return "boolean";
          }
          throwInvalidOperandType(expr.operator, left, right, sourceFile);
        case "<":
        case ">":
        case "<=":
        case ">=":
          if (isI32Type(left) && isI32Type(right)) {
            return "boolean";
          }
          if (!isUnknownType(left) && !isUnknownType(right)) {
            throwInvalidOperandType(expr.operator, left, right, sourceFile);
          }
          return "unknown";
        case "&&":
        case "||":
          if (isBooleanType(left) && isBooleanType(right)) {
            return "boolean";
          }
          if (!isUnknownType(left) && !isUnknownType(right)) {
            throwInvalidOperandType(expr.operator, left, right, sourceFile);
          }
          return "unknown";
      }
      return "unknown";
    }
    case "CallExpression": {
      if (expr.callee.kind !== "Identifier") {
        for (const arg of expr.args) {
          inferExpressionType(arg, imported, knownIdentifiers, sourceFile);
        }
        return "unknown";
      }

      const importedSymbol = imported.get(expr.callee.name);
      if (importedSymbol && importedSymbol.kind === "Component") {
        throw vxError(
          "VX3003",
          `Imported component "${expr.callee.name}" cannot be called in state expression in ${sourceFile}. ` +
            "Only imported @fast functions are callable in this check path.",
        );
      }
      if (!importedSymbol || importedSymbol.kind !== "FastFunction") {
        if (!knownIdentifiers.has(expr.callee.name)) {
          throw vxError(
            "VX3004",
            `Unknown callable "${expr.callee.name}" in state expression in ${sourceFile}.`,
          );
        }
        for (const arg of expr.args) {
          inferExpressionType(arg, imported, knownIdentifiers, sourceFile);
        }
        return "unknown";
      }

      if (expr.args.length !== importedSymbol.arity) {
        throw vxError(
          "VX3001",
          `Imported @fast "${expr.callee.name}" expects ${importedSymbol.arity} argument(s) ` +
            `from ${importedSymbol.sourceFile}, but got ${expr.args.length} in ${sourceFile}.`,
        );
      }

      for (let i = 0; i < expr.args.length; i++) {
        const expected = importedSymbol.paramTypes[i] ?? "any";
        const actual = inferExpressionType(expr.args[i], imported, knownIdentifiers, sourceFile);
        if (expected === "i32" && !isI32Type(actual) && !isUnknownType(actual)) {
          throw vxError(
            "VX3002",
            `Imported @fast "${expr.callee.name}" argument ${i + 1} expects i32, ` +
              `but got ${formatInferredType(actual)} expression in ${sourceFile}.`,
          );
        }
      }
      return importedSymbol.returnType === "i32" ? "i32" : "unknown";
    }
  }
}

function expressionContainsIdentifier(expr: ExpressionNode, name: string): boolean {
  switch (expr.kind) {
    case "Identifier":
      return expr.name === name;
    case "MemberExpression":
      if (expressionContainsIdentifier(expr.object, name)) {
        return true;
      }
      if (expr.computed) {
        return expressionContainsIdentifier(expr.property, name);
      }
      return false;
    case "CallExpression":
      if (expressionContainsIdentifier(expr.callee, name)) {
        return true;
      }
      return expr.args.some((arg) => expressionContainsIdentifier(arg, name));
    case "UnaryExpression":
      return expressionContainsIdentifier(expr.argument, name);
    case "BinaryExpression":
      return (
        expressionContainsIdentifier(expr.left, name) ||
        expressionContainsIdentifier(expr.right, name)
      );
    case "ArrayLiteral":
      return expr.elements.some((element) => expressionContainsIdentifier(element, name));
    case "ObjectLiteral":
      return expr.properties.some((property) => expressionContainsIdentifier(property.value, name));
    default:
      return false;
  }
}

function findReferencedIdentifier(
  expr: ExpressionNode,
  predicate: (name: string) => boolean,
): string | null {
  switch (expr.kind) {
    case "Identifier":
      return predicate(expr.name) ? expr.name : null;
    case "MemberExpression": {
      const objectHit = findReferencedIdentifier(expr.object, predicate);
      if (objectHit) {
        return objectHit;
      }
      if (expr.computed) {
        return findReferencedIdentifier(expr.property, predicate);
      }
      return null;
    }
    case "CallExpression": {
      const calleeHit = findReferencedIdentifier(expr.callee, predicate);
      if (calleeHit) {
        return calleeHit;
      }
      for (const arg of expr.args) {
        const argHit = findReferencedIdentifier(arg, predicate);
        if (argHit) {
          return argHit;
        }
      }
      return null;
    }
    case "UnaryExpression":
      return findReferencedIdentifier(expr.argument, predicate);
    case "BinaryExpression":
      return (
        findReferencedIdentifier(expr.left, predicate) ??
        findReferencedIdentifier(expr.right, predicate)
      );
    case "ArrayLiteral":
      for (const element of expr.elements) {
        const hit = findReferencedIdentifier(element, predicate);
        if (hit) {
          return hit;
        }
      }
      return null;
    case "ObjectLiteral":
      for (const property of expr.properties) {
        const hit = findReferencedIdentifier(property.value, predicate);
        if (hit) {
          return hit;
        }
      }
      return null;
    default:
      return null;
  }
}
