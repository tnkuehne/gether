import { WidgetType } from "@codemirror/view";
import type { PRCommentThread } from "$lib/github-app";

export class CommentGutterWidget extends WidgetType {
	constructor(
		public thread: PRCommentThread,
		public onClick: () => void,
	) {
		super();
	}

	toDOM() {
		const wrapper = document.createElement("div");
		wrapper.className = "comment-gutter-marker";
		wrapper.style.cssText = `
			position: relative;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			cursor: pointer;
			margin-left: 4px;
		`;

		const icon = document.createElement("div");
		icon.className = "comment-icon";
		// Use a different color for file-level comments
		const backgroundColor = this.thread.isFileLevel ? "rgb(168, 85, 247)" : "rgb(37, 99, 235)";
		icon.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: center;
			width: 18px;
			height: 18px;
			border-radius: 9px;
			background-color: ${backgroundColor};
			color: white;
			font-size: 10px;
			font-weight: 600;
			transition: all 0.2s;
		`;
		icon.textContent = String(this.thread.comments.length);
		const commentType = this.thread.isFileLevel ? "File comment" : "Line comment";
		icon.title = `${commentType}: ${this.thread.comments.length} comment${this.thread.comments.length > 1 ? "s" : ""}`;

		// Hover effect
		const shadowColor = this.thread.isFileLevel
			? "rgba(168, 85, 247, 0.4)"
			: "rgba(37, 99, 235, 0.4)";
		icon.addEventListener("mouseenter", () => {
			icon.style.transform = "scale(1.1)";
			icon.style.boxShadow = `0 2px 8px ${shadowColor}`;
		});
		icon.addEventListener("mouseleave", () => {
			icon.style.transform = "scale(1)";
			icon.style.boxShadow = "none";
		});

		icon.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.onClick();
		});

		wrapper.appendChild(icon);
		return wrapper;
	}

	eq(other: CommentGutterWidget) {
		return (
			this.thread.line === other.thread.line &&
			this.thread.comments.length === other.thread.comments.length
		);
	}

	ignoreEvent() {
		return false;
	}
}
