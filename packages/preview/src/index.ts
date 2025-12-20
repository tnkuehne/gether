import { WorkerEntrypoint } from "cloudflare:workers";
import { getSandbox, proxyToSandbox } from "@cloudflare/sandbox";

export { Sandbox } from "@cloudflare/sandbox";

interface StartPreviewOptions {
	org: string;
	repo: string;
	branch: string;
	githubToken?: string;
	hostname: string;
}

interface PreviewResult {
	success: boolean;
	previewUrl?: string;
	sandboxId?: string;
	error?: string;
	details?: string;
}

interface StatusResult {
	success: boolean;
	previewUrl?: string;
	sandboxId?: string;
	status: "running" | "not_running" | "not_found";
	error?: string;
}

export default class PreviewService extends WorkerEntrypoint<Env> {
	/**
	 * Start a live preview for a repository.
	 * Clones the repo, installs dependencies, and starts the dev server.
	 */
	async startPreview(options: StartPreviewOptions): Promise<PreviewResult> {
		const { org, repo, branch, githubToken, hostname } = options;

		// Create sandbox ID from org/repo/branch (lowercase for URL compatibility)
		const sandboxId = `${org}-${repo}-${branch}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

		// Get or create sandbox
		const sandbox = getSandbox(this.env.Sandbox, sandboxId);

		try {
			// Build repo URL (with token for private repos)
			const repoUrl = githubToken
				? `https://${githubToken}@github.com/${org}/${repo}.git`
				: `https://github.com/${org}/${repo}.git`;

			// Check if repo already exists
			const repoDir = `/workspace/${repo}`;
			const repoExists = await sandbox.exists(repoDir);

			if (repoExists.exists) {
				// Pull latest changes instead of cloning
				await sandbox.exec(
					`cd ${repoDir} && git fetch origin ${branch} && git reset --hard origin/${branch}`,
				);
			} else {
				// Clone the repository
				await sandbox.gitCheckout(repoUrl, {
					branch,
				});
			}

			// Install pnpm if not available
			const pnpmCheck = await sandbox.exec("which pnpm");
			if (!pnpmCheck.success) {
				console.log("Installing pnpm...");
				await sandbox.exec("npm install -g pnpm");
			}

			// Install dependencies
			const installResult = await sandbox.exec(`cd ${repoDir} && pnpm install`);
			console.log("Install result:", {
				success: installResult.success,
				exitCode: installResult.exitCode,
				stdout: installResult.stdout,
				stderr: installResult.stderr,
			});
			if (!installResult.success) {
				return {
					success: false,
					sandboxId,
					error: "Failed to install dependencies",
					details: `Exit code: ${installResult.exitCode}\nStdout: ${installResult.stdout}\nStderr: ${installResult.stderr}`,
				};
			}

			// Kill any existing processes to free up ports
			await sandbox.killAllProcesses();

			// Start the dev server as a background process
			const devServer = await sandbox.startProcess(
				`cd ${repoDir} && pnpm dev --port 5173 --host 0.0.0.0`,
				{},
			);

			console.log("Dev server process ID:", devServer.id);

			// Wait for the dev server to be ready (with timeout)
			console.log("Waiting for dev server on port 5173...");
			try {
				await devServer.waitForPort(5173, { timeout: 60000 });
				console.log("Dev server is ready!");
			} catch (waitErr) {
				// Get process logs to see what went wrong
				const logs = await sandbox.getProcessLogs(devServer.id);
				console.error("Dev server failed to start. Logs:", logs);
				throw waitErr;
			}

			// Expose the port and get the preview URL
			const exposed = await sandbox.exposePort(5173, { hostname });

			return {
				success: true,
				previewUrl: exposed.url,
				sandboxId,
			};
		} catch (err: unknown) {
			const error = err as { message?: string; code?: string };
			console.error("Sandbox error:", error);
			return {
				success: false,
				sandboxId,
				error: "Failed to start sandbox",
				details: error.message || "Unknown error",
			};
		}
	}

	/**
	 * Check the status of an existing preview sandbox.
	 */
	async getStatus(options: {
		org: string;
		repo: string;
		branch: string;
		hostname: string;
	}): Promise<StatusResult> {
		const { org, repo, branch, hostname } = options;

		// Create sandbox ID from org/repo/branch
		const sandboxId = `${org}-${repo}-${branch}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

		// Get sandbox
		const sandbox = getSandbox(this.env.Sandbox, sandboxId);

		try {
			// Check if port is already exposed
			const exposedPorts = await sandbox.getExposedPorts(hostname);
			const port5173 = exposedPorts.find((p) => p.port === 5173);

			if (port5173) {
				return {
					success: true,
					previewUrl: port5173.url,
					sandboxId,
					status: "running",
				};
			}

			// Check if there are running processes
			const processes = await sandbox.listProcesses();
			const hasDevServer = processes.some(
				(p) => p.command.includes("pnpm dev") && p.status === "running",
			);

			if (hasDevServer) {
				// Dev server running but port not exposed, try to expose it
				const exposed = await sandbox.exposePort(5173, { hostname });
				return {
					success: true,
					previewUrl: exposed.url,
					sandboxId,
					status: "running",
				};
			}

			return {
				success: false,
				sandboxId,
				status: "not_running",
			};
		} catch (err: unknown) {
			const error = err as { message?: string };
			return {
				success: false,
				sandboxId,
				status: "not_found",
				error: error.message,
			};
		}
	}

	/**
	 * Handle fetch requests - used for proxying preview URLs
	 */
	async fetch(request: Request): Promise<Response> {
		// Proxy requests to exposed sandbox ports
		const proxyResponse = await proxyToSandbox(request, this.env);
		if (proxyResponse) return proxyResponse;

		return new Response("Preview service", { status: 200 });
	}
}
