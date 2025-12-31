import { describe, expect, it } from "vitest";
import {
	hasFrontmatter,
	parseFrontmatter,
	serializeFrontmatter,
	combineDocument,
	updateFrontmatterField,
	addFrontmatterField,
	removeFrontmatterField,
	type FrontmatterField,
} from "../frontmatter";

describe("frontmatter", () => {
	describe("hasFrontmatter", () => {
		it("should return true for content starting with ---", () => {
			const content = `---
title: Hello
---
# Content`;
			expect(hasFrontmatter(content)).toBe(true);
		});

		it("should return true with leading whitespace", () => {
			const content = `  ---
title: Hello
---
# Content`;
			expect(hasFrontmatter(content)).toBe(true);
		});

		it("should return false for content without frontmatter", () => {
			const content = `# Hello World
This is regular content.`;
			expect(hasFrontmatter(content)).toBe(false);
		});

		it("should return false for empty content", () => {
			expect(hasFrontmatter("")).toBe(false);
		});
	});

	describe("parseFrontmatter", () => {
		it("should parse simple string fields", () => {
			const content = `---
title: Hello World
author: John Doe
---
# Content`;
			const result = parseFrontmatter(content);

			expect(result.hasFrontmatter).toBe(true);
			expect(result.frontmatter).toHaveLength(2);
			expect(result.frontmatter[0]).toEqual({
				key: "title",
				value: "Hello World",
				type: "string",
			});
			expect(result.frontmatter[1]).toEqual({
				key: "author",
				value: "John Doe",
				type: "string",
			});
			expect(result.content).toBe("# Content");
		});

		it("should parse boolean fields", () => {
			const content = `---
draft: true
published: false
---
Content`;
			const result = parseFrontmatter(content);

			expect(result.frontmatter[0]).toEqual({
				key: "draft",
				value: "true",
				type: "boolean",
			});
			expect(result.frontmatter[1]).toEqual({
				key: "published",
				value: "false",
				type: "boolean",
			});
		});

		it("should parse number fields", () => {
			const content = `---
count: 42
price: 19.99
---
Content`;
			const result = parseFrontmatter(content);

			expect(result.frontmatter[0]).toEqual({
				key: "count",
				value: "42",
				type: "number",
			});
			expect(result.frontmatter[1]).toEqual({
				key: "price",
				value: "19.99",
				type: "number",
			});
		});

		it("should parse date fields", () => {
			const content = `---
date: 2024-01-15
datetime: 2024-01-15T10:30
---
Content`;
			const result = parseFrontmatter(content);

			expect(result.frontmatter[0]).toEqual({
				key: "date",
				value: "2024-01-15",
				type: "date",
			});
			expect(result.frontmatter[1]).toEqual({
				key: "datetime",
				value: "2024-01-15T10:30",
				type: "date",
			});
		});

		it("should parse inline array fields", () => {
			const content = `---
tags: [javascript, typescript, svelte]
---
Content`;
			const result = parseFrontmatter(content);

			expect(result.frontmatter[0]).toEqual({
				key: "tags",
				value: "[javascript, typescript, svelte]",
				type: "array",
			});
		});

		it("should parse multiline array fields", () => {
			const content = `---
tags:
  - javascript
  - typescript
  - svelte
---
Content`;
			const result = parseFrontmatter(content);

			expect(result.frontmatter[0].key).toBe("tags");
			expect(result.frontmatter[0].type).toBe("array");
			expect(JSON.parse(result.frontmatter[0].value)).toEqual([
				"javascript",
				"typescript",
				"svelte",
			]);
		});

		it("should handle quoted strings", () => {
			const content = `---
title: "Hello: World"
quote: 'Single quoted'
---
Content`;
			const result = parseFrontmatter(content);

			expect(result.frontmatter[0]).toEqual({
				key: "title",
				value: "Hello: World",
				type: "string",
			});
			expect(result.frontmatter[1]).toEqual({
				key: "quote",
				value: "Single quoted",
				type: "string",
			});
		});

		it("should return content as-is when no frontmatter", () => {
			const content = `# Hello World
This is regular markdown.`;
			const result = parseFrontmatter(content);

			expect(result.hasFrontmatter).toBe(false);
			expect(result.frontmatter).toHaveLength(0);
			expect(result.content).toBe(content);
		});

		it("should handle unclosed frontmatter", () => {
			const content = `---
title: Hello
This is not closed properly`;
			const result = parseFrontmatter(content);

			// Should treat as no frontmatter since it's not properly closed
			expect(result.hasFrontmatter).toBe(false);
			expect(result.content).toBe(content);
		});

		it("should handle empty frontmatter", () => {
			const content = `---
---
Content here`;
			const result = parseFrontmatter(content);

			expect(result.hasFrontmatter).toBe(true);
			expect(result.frontmatter).toHaveLength(0);
			expect(result.content).toBe("Content here");
		});
	});

	describe("serializeFrontmatter", () => {
		it("should serialize string fields", () => {
			const fields: FrontmatterField[] = [
				{ key: "title", value: "Hello World", type: "string" },
				{ key: "author", value: "John Doe", type: "string" },
			];

			const result = serializeFrontmatter(fields);
			expect(result).toBe(`---
title: Hello World
author: John Doe
---
`);
		});

		it("should serialize boolean fields", () => {
			const fields: FrontmatterField[] = [{ key: "draft", value: "true", type: "boolean" }];

			const result = serializeFrontmatter(fields);
			expect(result).toBe(`---
draft: true
---
`);
		});

		it("should serialize number fields", () => {
			const fields: FrontmatterField[] = [{ key: "count", value: "42", type: "number" }];

			const result = serializeFrontmatter(fields);
			expect(result).toBe(`---
count: 42
---
`);
		});

		it("should serialize array fields from JSON", () => {
			const fields: FrontmatterField[] = [{ key: "tags", value: '["one", "two"]', type: "array" }];

			const result = serializeFrontmatter(fields);
			expect(result).toContain("tags: [");
			expect(result).toContain("one");
			expect(result).toContain("two");
		});

		it("should quote strings with special characters", () => {
			const fields: FrontmatterField[] = [{ key: "title", value: "Hello: World", type: "string" }];

			const result = serializeFrontmatter(fields);
			expect(result).toContain('"Hello: World"');
		});

		it("should return empty string for empty fields", () => {
			expect(serializeFrontmatter([])).toBe("");
		});
	});

	describe("combineDocument", () => {
		it("should combine frontmatter and content", () => {
			const fields: FrontmatterField[] = [{ key: "title", value: "Hello", type: "string" }];
			const content = "# Main Content";

			const result = combineDocument(fields, content);
			expect(result).toBe(`---
title: Hello
---
# Main Content`);
		});

		it("should handle empty frontmatter", () => {
			const result = combineDocument([], "# Content");
			expect(result).toBe("# Content");
		});
	});

	describe("updateFrontmatterField", () => {
		it("should update an existing field", () => {
			const fields: FrontmatterField[] = [
				{ key: "title", value: "Old Title", type: "string" },
				{ key: "author", value: "John", type: "string" },
			];

			const result = updateFrontmatterField(fields, "title", "New Title");

			expect(result[0].value).toBe("New Title");
			expect(result[1].value).toBe("John");
		});

		it("should not modify fields that don't match", () => {
			const fields: FrontmatterField[] = [{ key: "title", value: "Title", type: "string" }];

			const result = updateFrontmatterField(fields, "nonexistent", "value");

			expect(result).toEqual(fields);
		});
	});

	describe("addFrontmatterField", () => {
		it("should add a new field", () => {
			const fields: FrontmatterField[] = [{ key: "title", value: "Title", type: "string" }];

			const result = addFrontmatterField(fields, "author", "John", "string");

			expect(result).toHaveLength(2);
			expect(result[1]).toEqual({
				key: "author",
				value: "John",
				type: "string",
			});
		});

		it("should default to string type", () => {
			const result = addFrontmatterField([], "key", "value");
			expect(result[0].type).toBe("string");
		});
	});

	describe("removeFrontmatterField", () => {
		it("should remove an existing field", () => {
			const fields: FrontmatterField[] = [
				{ key: "title", value: "Title", type: "string" },
				{ key: "author", value: "John", type: "string" },
			];

			const result = removeFrontmatterField(fields, "title");

			expect(result).toHaveLength(1);
			expect(result[0].key).toBe("author");
		});

		it("should not modify array if key not found", () => {
			const fields: FrontmatterField[] = [{ key: "title", value: "Title", type: "string" }];

			const result = removeFrontmatterField(fields, "nonexistent");

			expect(result).toEqual(fields);
		});
	});

	describe("round-trip parsing and serialization", () => {
		it("should preserve content after parse and combine", () => {
			const original = `---
title: Hello World
count: 42
draft: true
tags: [one, two, three]
---
# Main Heading

Some paragraph text.`;

			const parsed = parseFrontmatter(original);
			const combined = combineDocument(parsed.frontmatter, parsed.content);

			// Re-parse to verify structure
			const reparsed = parseFrontmatter(combined);

			expect(reparsed.hasFrontmatter).toBe(true);
			expect(reparsed.frontmatter).toHaveLength(parsed.frontmatter.length);
			expect(reparsed.content).toBe(parsed.content);
		});
	});
});
