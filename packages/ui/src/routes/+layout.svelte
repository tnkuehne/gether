<script lang="ts">
	import "./layout.css";
	import { ModeWatcher } from "mode-watcher";
	import { authClient } from "$lib/auth-client";
	import { browser } from "$app/environment";
	import posthog from "posthog-js";
	import * as Tooltip from "$lib/components/ui/tooltip";

	let { children } = $props();

	const session = authClient.useSession();

	$effect(() => {
		if (browser) {
			const user = $session.data?.user;

			if (user?.id) {
				posthog.set_config({ persistence: "localStorage+cookie" });
				posthog.identify(user.email, {
					email: user.email,
					name: user.name,
				});
			}
		}
	});
</script>

<ModeWatcher />
<Tooltip.Provider>
	{@render children()}
</Tooltip.Provider>
