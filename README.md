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
