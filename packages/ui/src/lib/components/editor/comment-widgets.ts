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
		icon.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: center;
			width: 18px;
			height: 18px;
			border-radius: 9px;
			background-color: rgb(37, 99, 235);
			color: white;
			font-size: 10px;
			font-weight: 600;
			transition: all 0.2s;
		`;
		icon.textContent = String(this.thread.comments.length);
		icon.title = `${this.thread.comments.length} comment${this.thread.comments.length > 1 ? "s" : ""}`;

		// Hover effect
		icon.addEventListener("mouseenter", () => {
			icon.style.transform = "scale(1.1)";
			icon.style.boxShadow = "0 2px 8px rgba(37, 99, 235, 0.4)";
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
