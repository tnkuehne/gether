import type { RequestHandler } from "./$types";
import { auth } from "$lib/server/auth";
import { Octokit } from "octokit";

export const GET: RequestHandler = async ({ params, platform, request, locals }) => {
	if (!locals.user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const { success } = await platform!.env.WEBSOCKET_RATE_LIMITER.limit({ key: locals.user.id });

	if (!success) {
		return new Response(`429 Failure – rate limit exceeded`, { status: 429 });
	}

	const { org, repo, rest } = params;

	// Check for WebSocket upgrade
	const upgradeHeader = request.headers.get("Upgrade");
	if (upgradeHeader !== "websocket") {
		return new Response("Expected WebSocket", { status: 426 });
	}

	// Get GitHub access token to verify repository access
	const tokenResponse = await auth.api.getAccessToken({
		body: {
			providerId: "github",
		},
		headers: request.headers,
	});

	if (!tokenResponse?.accessToken) {
		return new Response("Failed to get GitHub token", { status: 401 });
	}

	// Verify user has access to this repository
	const octokit = new Octokit({ auth: tokenResponse.accessToken });
	try {
		await octokit.rest.repos.get({
			owner: org,
			repo: repo,
		});
	} catch (err: unknown) {
		const error = err as { status?: number };
		if (error.status === 404 || error.status === 403) {
			return new Response("Repository not found or access denied", { status: 403 });
		}
		return new Response("Failed to verify repository access", { status: 500 });
	}

	// Create deterministic ID from file path
	// rest contains the full path including branch, e.g., "main/folder/file.md"
	const docId = `${org}/${repo}/${rest}`;

	// Get Durable Object for this specific document
	const id = platform!.env.COLLAB_DOCUMENT.idFromName(docId);
	const stub = platform!.env.COLLAB_DOCUMENT.get(id);

	// Forward the WebSocket upgrade to the Durable Object
	return stub.fetch(request);
};
