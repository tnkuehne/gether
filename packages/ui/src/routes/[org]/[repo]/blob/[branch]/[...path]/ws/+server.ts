import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform, request }) => {
	const { org, repo, branch } = params;
	const path = params.path;

	// Check for WebSocket upgrade
	const upgradeHeader = request.headers.get('Upgrade');
	if (upgradeHeader !== 'websocket') {
		return new Response('Expected WebSocket', { status: 426 });
	}

	// Create deterministic ID from file path
	const docId = `${org}/${repo}/${branch}/${path}`;

	// Get Durable Object for this specific document
	const id = platform!.env.COLLAB_DOCUMENT.idFromName(docId);
	const stub = platform!.env.COLLAB_DOCUMENT.get(id);

	// Forward the WebSocket upgrade to the Durable Object
	return stub.fetch(request);
};
