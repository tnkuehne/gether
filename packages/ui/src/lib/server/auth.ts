import { betterAuth } from "better-auth/minimal";
import { env } from "$env/dynamic/private";
import { BETTER_AUTH_URL } from "$env/static/private";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { oAuthProxy } from "better-auth/plugins";
import { getRequestEvent } from "$app/server";

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	socialProviders: {
		github: {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
			redirectURI: BETTER_AUTH_URL
				? `${BETTER_AUTH_URL}/api/auth/callback/github`
				: undefined,
		},
	},
	plugins: [
		oAuthProxy({
			productionURL: BETTER_AUTH_URL,
		}),
		sveltekitCookies(getRequestEvent),
	],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
