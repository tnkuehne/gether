import { betterAuth } from "better-auth/minimal";
import { env } from "$env/dynamic/private";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { Octokit, App } from "octokit";

const GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;
const GITHUB_APP_ID = env.GITHUB_APP_ID;
const GITHUB_APP_PRIVATE_KEY = env.GITHUB_APP_PRIVATE_KEY;
const GITHUB_APP_SLUG = env.GITHUB_APP_SLUG;

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new Error("Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET");
}

if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY || !GITHUB_APP_SLUG) {
    console.warn("GitHub App credentials not configured. Private repository access will be limited.");
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  socialProviders: {
      github: {
          clientId: GITHUB_CLIENT_ID,
          clientSecret: GITHUB_CLIENT_SECRET,
      },
  },
  plugins: [sveltekitCookies(getRequestEvent)],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;

// GitHub App installation URL - user installs app to grant access to specific repos
export const GITHUB_APP_INSTALL_URL = GITHUB_APP_SLUG
  ? `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`
  : null;

/**
 * Check if user has installed the GitHub App
 * Once installed, their OAuth token will have access to the repos they selected
 */
export async function hasGitHubAppInstalled(userAccessToken: string): Promise<boolean> {
  if (!GITHUB_APP_ID) {
    return false;
  }

  try {
    const userOctokit = new Octokit({ auth: userAccessToken });
    const { data: installations } = await userOctokit.rest.apps.listInstallationsForAuthenticatedUser();

    return installations.installations.some(
      inst => inst.app_id === parseInt(GITHUB_APP_ID)
    );
  } catch (error) {
    console.error("Failed to check GitHub App installation:", error);
    return false;
  }
}
