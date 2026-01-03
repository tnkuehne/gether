import { betterAuth } from "better-auth/minimal";
import { env } from "$env/dynamic/private";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { oAuthProxy } from "better-auth/plugins";
import { getRequestEvent } from "$app/server";

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	socialProviders: {
		github: {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
			redirectURI: env.BETTER_AUTH_URL
				? `${env.BETTER_AUTH_URL}/api/auth/callback/github`
				: undefined,
		},
	},
	plugins: [
		sveltekitCookies(getRequestEvent),
		oAuthProxy({
			productionURL: env.BETTER_AUTH_URL,
		}),
	],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
