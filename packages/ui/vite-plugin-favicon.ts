import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

const FAVICON_SIZE = 144;

export function faviconPlugin(): Plugin {
	return {
		name: "favicon-png-generator",
		apply: "build",
		writeBundle(options) {
			const outDir = options.dir;
			if (!outDir) return;

			const svgPath = join(outDir, "favicon.svg");
			const pngPath = join(outDir, "favicon.png");

			try {
				const svg = readFileSync(svgPath, "utf-8");
				const resvg = new Resvg(svg, {
					fitTo: {
						mode: "width",
						value: FAVICON_SIZE,
					},
				});
				const pngData = resvg.render();
				const pngBuffer = pngData.asPng();
				writeFileSync(pngPath, pngBuffer);
				console.log(`Generated ${pngPath} (${FAVICON_SIZE}x${FAVICON_SIZE})`);
			} catch (error) {
				console.error("Failed to generate favicon PNG:", error);
			}
		},
	};
}
