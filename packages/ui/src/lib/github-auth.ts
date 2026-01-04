import { Octokit } from "octokit";
import { authClient } from "$lib/auth-client";

export interface AuthenticatedOctokit {
	octokit: Octokit;
	accessToken: string;
}

/**
 * Get an authenticated Octokit instance if the user is logged in.
 * Returns null if not authenticated.
 */
export async function getOctokit(): Promise<AuthenticatedOctokit | null> {
	try {
		const { data } = await authClient.getAccessToken({
			providerId: "github",
		});

		const accessToken = data?.accessToken;

		if (!accessToken) {
			return null;
		}

		return { octokit: new Octokit({ auth: accessToken }), accessToken };
	} catch {
		return null;
	}
}

/**
 * Get an unauthenticated Octokit instance for public API calls.
 */
export function getPublicOctokit(): Octokit {
	return new Octokit();
}

/**
 * Get an authenticated Octokit instance, throwing if not authenticated.
 * Use this for operations that require authentication.
 */
export async function requireOctokit(): Promise<AuthenticatedOctokit> {
	const auth = await getOctokit();
	if (!auth) {
		throw new Error("Not authenticated");
	}
	return auth;
}
