import { tools } from "@frak-labs/dev-tooling";
import { type LibConfig, defineConfig } from "@rslib/core";

function createLibConfig(config: LibConfig = {}): LibConfig {
	const basicConfig: LibConfig = {
		syntax: "es2022",
		dts: {
			bundle: true,
			autoExtension: true,
		},
		source: {
			entry: {
				index: "./src/index.ts",
				middleware: "./src/middleware/index.ts",
			},
		},
	};

	return {
		...basicConfig,
		...config,
	};
}

export default defineConfig({
	lib: [
		createLibConfig({
			format: "esm",
		}),
		createLibConfig({
			format: "cjs",
		}),
	],
	mode: "production",
	output: {
		target: "web",
		minify: true,
		cleanDistPath: true,
	},
	tools: {
		...tools,
	},
});
