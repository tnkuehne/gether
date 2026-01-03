import type { ForkInfo, PullRequestInfo } from "$lib/github-app";

export interface ContributionState {
	// Repository info
	org: string;
	repo: string;
	branch: string;
	path: string;

	// Permission state
	canEdit: boolean;
	isProtected: boolean;
	defaultBranch: string | null;

	// User state
	currentUser: string | null;
	existingFork: ForkInfo | null;
	existingPR: PullRequestInfo | null;

	// UI state
	justCommitted: boolean;
	isLoaded: boolean;

	// Actions
	onCreateBranch: (branchName: string) => Promise<void>;
	onFork: () => Promise<ForkInfo>;
	onCreatePR: (params: { title: string; body: string; draft: boolean }) => Promise<PullRequestInfo>;
}

const defaultActions = {
	onCreateBranch: async () => {},
	onFork: async (): Promise<ForkInfo> => {
		throw new Error("Not initialized");
	},
	onCreatePR: async (): Promise<PullRequestInfo> => {
		throw new Error("Not initialized");
	},
};

// Shared reactive state using Svelte 5 runes
export const contributionState = $state<ContributionState>({
	org: "",
	repo: "",
	branch: "",
	path: "",
	canEdit: false,
	isProtected: false,
	defaultBranch: null,
	currentUser: null,
	existingFork: null,
	existingPR: null,
	justCommitted: false,
	isLoaded: false,
	...defaultActions,
});

export function updateContributionState(updates: Partial<ContributionState>) {
	Object.assign(contributionState, updates);
}

export function resetContributionState() {
	Object.assign(contributionState, {
		org: "",
		repo: "",
		branch: "",
		path: "",
		canEdit: false,
		isProtected: false,
		defaultBranch: null,
		currentUser: null,
		existingFork: null,
		existingPR: null,
		justCommitted: false,
		isLoaded: false,
		...defaultActions,
	});
}
