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

	// Disable pinch-to-zoom on iOS Safari
	$effect(() => {
		if (!browser) return;

		// Prevent pinch zoom via gesture events (Safari)
		const preventGesture = (e: Event) => e.preventDefault();
		document.addEventListener("gesturestart", preventGesture);
		document.addEventListener("gesturechange", preventGesture);

		// Prevent pinch zoom via touch events (2+ fingers)
		const preventPinchZoom = (e: TouchEvent) => {
			if (e.touches.length > 1) {
				e.preventDefault();
			}
		};
		document.addEventListener("touchmove", preventPinchZoom, { passive: false });

		return () => {
			document.removeEventListener("gesturestart", preventGesture);
			document.removeEventListener("gesturechange", preventGesture);
			document.removeEventListener("touchmove", preventPinchZoom);
		};
	});
</script>

<ModeWatcher />
<Tooltip.Provider>
	{@render children()}
</Tooltip.Provider>
