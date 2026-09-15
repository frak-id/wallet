---
"@frak-labs/components": patch
---

Make the package installable from npm.

`@frak-labs/design-system` was listed as a runtime dependency, but it is a private workspace package that is never published — every release since 1.0.13 shipped a manifest pointing at a registry entry that does not exist, so `npm install @frak-labs/components` failed on resolution. The build already inlines design-system into `dist/`, so the entry declared a dependency the bundle does not have. It is now a devDependency, which the publish step strips.
