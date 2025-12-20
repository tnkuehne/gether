import type { RequestHandler } from "./$types";
import { auth } from "$lib/server/auth";

export const POST: RequestHandler = async ({ params, platform, request, locals, url }) => {
	if (!locals.user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const { org, repo, branch } = params;

	// Get GitHub access token for cloning private repos
	const tokenResponse = await auth.api.getAccessToken({
		body: {
			providerId: "github",
		},
		headers: request.headers,
	});

	const githubToken = tokenResponse?.accessToken;

	try {
		// Call the preview worker via RPC
		// @ts-expect-error - Service binding types not generated
		const result = await platform!.env.PREVIEW_SERVICE.startPreview({
			org,
			repo,
			branch,
			githubToken,
			hostname: url.hostname,
		});

		if (result.success) {
			return Response.json({
				success: true,
				previewUrl: result.previewUrl,
				sandboxId: result.sandboxId,
			});
		} else {
			return Response.json(
				{
					error: result.error,
					details: result.details,
				},
				{ status: 500 },
			);
		}
	} catch (err: unknown) {
		const error = err as { message?: string };
		console.error("Preview service error:", error);
		return Response.json(
			{
				error: "Failed to start preview",
				details: error.message || "Unknown error",
			},
			{ status: 500 },
		);
	}
};

export const GET: RequestHandler = async ({ params, platform, locals, url }) => {
	if (!locals.user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const { org, repo, branch } = params;

	try {
		// Call the preview worker via RPC
		// @ts-expect-error - Service binding types not generated
		const result = await platform!.env.PREVIEW_SERVICE.getStatus({
			org,
			repo,
			branch,
			hostname: url.hostname,
		});

		return Response.json(result);
	} catch (err: unknown) {
		const error = err as { message?: string };
		return Response.json({
			success: false,
			status: "not_found",
			error: error.message,
		});
	}
};
