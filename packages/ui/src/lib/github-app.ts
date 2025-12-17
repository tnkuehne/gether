import { Octokit } from 'octokit';
import { PUBLIC_GITHUB_APP_ID, PUBLIC_GITHUB_APP_SLUG } from '$env/static/public';

// GitHub App installation URL - user installs app to grant access to specific repos
export const GITHUB_APP_INSTALL_URL = PUBLIC_GITHUB_APP_SLUG
	? `https://github.com/apps/${PUBLIC_GITHUB_APP_SLUG}/installations/new`
	: null;

/**
 * Check if user has installed the GitHub App
 * Once installed, their OAuth token will have access to the repos they selected
 */
export async function hasGitHubAppInstalled(userAccessToken: string): Promise<boolean> {
	if (!PUBLIC_GITHUB_APP_ID) {
		return false;
	}

	try {
		const userOctokit = new Octokit({ auth: userAccessToken });
		const { data: installations } =
			await userOctokit.rest.apps.listInstallationsForAuthenticatedUser();

		return installations.installations.some(
			(inst) => inst.app_id === parseInt(PUBLIC_GITHUB_APP_ID)
		);
	} catch (error) {
		console.error('Failed to check GitHub App installation:', error);
		return false;
	}
}
