// Barrel for the English locale bundle.
//
// Bundling both files behind a single module lets consumers replace two
// dynamic imports (`Promise.all([import(translation.json), import(customized.json)])`)
// with one. The native ESM module loader would have deduped the two
// fetches anyway since both originally compiled to the same bundler chunk,
// but the single-import form keeps source code clearer and trims one
// `__vitePreload` call per language switch.

export { default as customized } from "./customized.json";
export { default as translation } from "./translation.json";
