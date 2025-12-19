<script lang="ts">
	import "./layout.css";
	import { ModeWatcher } from "mode-watcher";
	import { authClient } from "$lib/auth-client";
	import { browser } from "$app/environment";
	import posthog from "posthog-js";

	let { children } = $props();

	const session = authClient.useSession();

	$effect(() => {
		if (browser) {
			const user = $session.data?.user;

			if (user?.id) {
				posthog.set_config({ persistence: "localStorage+cookie" });
				posthog.identify(user.id, {
					email: user.email,
					name: user.name,
				});
			}
		}
	});
</script>

<ModeWatcher />
{@render children()}
