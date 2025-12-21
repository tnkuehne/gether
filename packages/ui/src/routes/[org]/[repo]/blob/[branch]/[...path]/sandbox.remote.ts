import * as v from "valibot";
import { error } from "@sveltejs/kit";
import { command, query, getRequestEvent } from "$app/server";
import { auth } from "$lib/server/auth";

const sandboxParams = v.object({
	org: v.string(),
	repo: v.string(),
	branch: v.string(),
});

export const startPreview = command(sandboxParams, async ({ org, repo, branch }) => {
	const event = getRequestEvent();

	if (!event.locals.user) {
		error(401, "Unauthorized");
	}

	// Get GitHub access token for cloning private repos
	const tokenResponse = await auth.api.getAccessToken({
		body: {
			providerId: "github",
		},
		headers: event.request.headers,
	});

	const githubToken = tokenResponse?.accessToken;

	try {
		// Call the preview worker via RPC
		// @ts-expect-error - Service binding types not generated
		const result = await event.platform!.env.PREVIEW_SERVICE.startPreview({
			org,
			repo,
			branch,
			githubToken,
			hostname: event.url.hostname,
		});

		if (result.success) {
			return {
				success: true as const,
				previewUrl: result.previewUrl as string,
				sandboxId: result.sandboxId as string,
			};
		} else {
			return {
				success: false as const,
				error: result.error as string,
				details: result.details as string | undefined,
			};
		}
	} catch (err: unknown) {
		const e = err as { message?: string };
		console.error("Preview service error:", e);
		return {
			success: false as const,
			error: "Failed to start preview",
			details: e.message || "Unknown error",
		};
	}
});

export const getSandboxStatus = query(sandboxParams, async ({ org, repo, branch }) => {
	const event = getRequestEvent();

	if (!event.locals.user) {
		error(401, "Unauthorized");
	}

	try {
		// Call the preview worker via RPC
		// @ts-expect-error - Service binding types not generated
		const result = await event.platform!.env.PREVIEW_SERVICE.getStatus({
			org,
			repo,
			branch,
			hostname: event.url.hostname,
		});

		return result as {
			success: boolean;
			status?: string;
			previewUrl?: string;
			error?: string;
		};
	} catch (err: unknown) {
		const e = err as { message?: string };
		return {
			success: false,
			status: "not_found",
			error: e.message,
		};
	}
});
