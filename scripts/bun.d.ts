// `bun-types` is a per-workspace devDependency and `scripts/` is in no
// workspace. Only the surface these scripts use is declared, rather than
// adding a root dependency to typecheck two files.
interface ImportMeta {
    /** Absolute path of the directory holding this module. */
    readonly dir: string;
}
