import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth, hasGitHubAppInstalled, GITHUB_APP_INSTALL_URL } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request }) => {
	// Get session from request
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Get GitHub OAuth access token
	const accessTokenResponse = await auth.api.getAccessToken({
		headers: request.headers,
		body: {
			providerId: 'github'
		}
	});

	const githubToken = accessTokenResponse?.accessToken;

	if (!githubToken) {
		return json({ error: 'No GitHub token found' }, { status: 401 });
	}

	// Check if GitHub App is installed
	const isInstalled = await hasGitHubAppInstalled(githubToken);

	return json({
		installed: isInstalled,
		installUrl: GITHUB_APP_INSTALL_URL
	});
};
