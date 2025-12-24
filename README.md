# Gether

A collaborative content editor for markdown or static site generators without lock-in

## Features

- [x] Live collaboration (Cloudflare Durable Objects)
- [x] Rendered Markdown Preview
- [x] Live Content Preview (Cloudflare Sandboxes)
- [x] Just use exisitng Github Auth
- [x] File navigation
- [ ] (Automatic) Branching and Forking
- [ ] Opening draft pull requests
- [ ] Showing and writing comments on pull requests in UI
- [ ] Media upload
- [ ] Collections for easier content navigation
- [ ] UI for frontmatter

## Live Preview

> [!NOTE]
> This feature is currently in private beta (send me a DM) until I find out how to limit the costs. It uses Cloudflare sandboxes under the hood which can get expensive

Add config File `gether.jsonc`

```jsonc
{
	// Package manager: "npm", "pnpm", "yarn", or "bun"
	"packageManager": "pnpm",

	// Working directory relative to repo root
	"root": ".",

	// Command to install dependencies
	"install": "pnpm install",

	// Command to start dev server
	"dev": "pnpm dev",

	// Port the dev server listens on
	"port": 5173,
}
```

## Deploy your own

1. Create a [GitHub App](https://docs.github.com/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps) with repository contents `read & write` and account email `read`.
2. Each service in `packages` needs to be deployed to Cloudflare workers.
3. For the UI worker the following secrets/variables need to be set: [`BETTER_AUTH_SECRET`](https://www.better-auth.com/docs/installation#set-environment-variables), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `PUBLIC_GITHUB_APP_ID` and `PUBLIC_GITHUB_APP_SLUG`.
4. The preview worker needs `PREVIEW_HOST` as a variable set to the host of the preview worker and a wild card route configured, see Cloudflares [guide](https://developers.cloudflare.com/sandbox/guides/production-deployment/)

## Credits

Heavily inspired by

- Lee Robinson article about [Coding Agents & Complexity Budgets](https://leerob.com/agents)
- Knut Melvær's answer to Lee Robinsons [“You should never build a CMS”](https://www.sanity.io/blog/you-should-never-build-a-cms)
