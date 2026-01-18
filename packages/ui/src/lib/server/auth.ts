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
			redirectURI: `${BETTER_AUTH_URL}/api/auth/callback/github`,
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // Refresh session expiration daily
		cookieCache: {
			enabled: true,
			maxAge: 60 * 60 * 24 * 7, // 7 day cache
			refreshCache: true, // Auto-refresh when 80% of maxAge is reached
		},
	},
	account: {
		storeStateStrategy: "cookie", // Store OAuth state in cookie for stateless auth
		storeAccountCookie: true, // Store account info in cookie for stateless auth
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
