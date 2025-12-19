// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			cf: CfProperties;
			ctx: ExecutionContext;
		}
		interface Locals {
			session?: import("$lib/server/auth").Session;
			user?: import("$lib/server/auth").User;
		}
	}
}

export {};
