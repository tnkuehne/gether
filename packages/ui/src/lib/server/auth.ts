import { betterAuth } from "better-auth/minimal";
import { env } from "$env/dynamic/private";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  socialProviders: {
      github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
      },
  },
  plugins: [sveltekitCookies(getRequestEvent)],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
