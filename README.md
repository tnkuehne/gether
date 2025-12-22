# Gether

## Features

- [x] Live collaboration
- [x] Rendered Markdown Preview
- [x] Live Content Preview
- [x] Just use exisitng Github Auth
- [ ] File navigation
- [ ] (Automatic) Branching and Forking
- [ ] Opening draft pull requests
- [ ] Media upload
- [ ] Collections for easier content navigation

## Live Preview

> [!NOTE]
> This feature is currently in private beta (send me a DM) until I find out how to limit the costs. It uses cloudflare sandboxes under the hood which can get expensive

Add config File `gether.jsonc`

```json
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
	"port": 5173
}
```

## Credits

Heavily inspired by

- Lee Robinson article about [Coding Agents & Complexity Budgets](https://leerob.com/agents)
- Knut Melvær's answer to Lee Robinsons [“You should never build a CMS”](https://www.sanity.io/blog/you-should-never-build-a-cms)
