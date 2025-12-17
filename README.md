# Gether

This is a monorepo for Gether, containing multiple Cloudflare Workers and applications.

## Structure

```
gether/
├── packages/
│   ├── ui/              # SvelteKit UI (Cloudflare Worker)
│   └── ...              # Additional workers can be added here
├── package.json         # Root package.json for shared tooling
├── pnpm-workspace.yaml  # PNPM workspace configuration
└── ...                  # Shared configuration files (ESLint, Prettier, etc.)
```

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- pnpm (v8 or later)

### Installation

```bash
pnpm install
```

This will install all dependencies for all packages in the monorepo.

## Development

### Run the UI package

```bash
pnpm dev
```

Or run a specific package:

```bash
pnpm --filter @gether/ui dev
```

### Build all packages

```bash
pnpm build
```

### Format code

```bash
pnpm format
```

### Lint code

```bash
pnpm lint
```

## Adding a New Worker

To add a new Cloudflare Worker to the monorepo:

1. Create a new directory in `packages/`:

```bash
mkdir packages/your-worker-name
```

2. Initialize the package with a `package.json`:

```json
{
  "name": "@gether/your-worker-name",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run",
    "deploy": "wrangler deploy",
    "cf-typegen": "wrangler types"
  },
  "devDependencies": {
    "@types/node": "^24",
    "typescript": "^5.9.3",
    "wrangler": "^4.54.0"
  }
}
```

3. Create a `wrangler.jsonc` configuration file:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "your-worker-name",
  "main": "src/index.ts",
  "compatibility_date": "2025-12-13",
  "compatibility_flags": ["nodejs_als"],
  "observability": {
    "enabled": true
  }
}
```

4. Create your worker source files in `packages/your-worker-name/src/`

5. Install dependencies from the root:

```bash
pnpm install
```

## Deployment

### Deploy UI

```bash
pnpm deploy:ui
```

### Deploy a specific worker

```bash
pnpm --filter @gether/your-worker-name deploy
```

## Workspace Commands

Run commands in all packages:

```bash
pnpm -r <command>
```

Run commands in a specific package:

```bash
pnpm --filter @gether/package-name <command>
```

## Technologies

- **PNPM Workspaces**: Monorepo management
- **SvelteKit**: UI framework
- **Cloudflare Workers**: Serverless platform
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Wrangler**: Cloudflare development and deployment
