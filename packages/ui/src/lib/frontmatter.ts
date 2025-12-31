/**
 * Frontmatter parsing and serialization utilities
 * Handles YAML frontmatter in markdown files
 */

export interface FrontmatterField {
	key: string;
	value: string;
	type: "string" | "number" | "boolean" | "array" | "date";
}

export interface ParsedDocument {
	frontmatter: FrontmatterField[];
	content: string;
	hasFrontmatter: boolean;
}

/**
 * Detects if content has frontmatter (starts with ---)
 */
export function hasFrontmatter(content: string): boolean {
	return content.trimStart().startsWith("---");
}

/**
 * Parses frontmatter from markdown content
 * Returns the parsed fields and the content without frontmatter
 */
export function parseFrontmatter(content: string): ParsedDocument {
	const trimmed = content.trimStart();

	if (!trimmed.startsWith("---")) {
		return {
			frontmatter: [],
			content: content,
			hasFrontmatter: false,
		};
	}

	// Find the closing ---
	const endMatch = trimmed.substring(3).match(/\r?\n---(\r?\n|$)/);

	if (!endMatch || endMatch.index === undefined) {
		// No closing ---, treat as no frontmatter
		return {
			frontmatter: [],
			content: content,
			hasFrontmatter: false,
		};
	}

	const frontmatterBlock = trimmed.substring(3, endMatch.index + 3);
	const contentStart = 3 + endMatch.index + endMatch[0].length;
	const bodyContent = trimmed.substring(contentStart);

	const fields = parseYamlFields(frontmatterBlock);

	return {
		frontmatter: fields,
		content: bodyContent,
		hasFrontmatter: true,
	};
}

/**
 * Parses simple YAML fields (key: value format)
 * Supports strings, numbers, booleans, dates, and simple arrays
 */
function parseYamlFields(yaml: string): FrontmatterField[] {
	const fields: FrontmatterField[] = [];
	const lines = yaml.split(/\r?\n/);

	let currentKey: string | null = null;
	let isCollectingArray = false;
	let arrayValues: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmedLine = line.trim();

		// Skip empty lines
		if (!trimmedLine) continue;

		// Check if this is an array item (starts with -)
		if (isCollectingArray && trimmedLine.startsWith("-")) {
			const arrayValue = trimmedLine.substring(1).trim();
			// Remove quotes if present
			const unquoted = unquoteString(arrayValue);
			arrayValues.push(unquoted);
			continue;
		}

		// If we were collecting an array and hit a non-array line, save the array
		if (isCollectingArray && currentKey) {
			fields.push({
				key: currentKey,
				value: JSON.stringify(arrayValues),
				type: "array",
			});
			isCollectingArray = false;
			arrayValues = [];
			currentKey = null;
		}

		// Check for key: value pattern
		const colonIndex = trimmedLine.indexOf(":");
		if (colonIndex > 0) {
			const key = trimmedLine.substring(0, colonIndex).trim();
			const rawValue = trimmedLine.substring(colonIndex + 1).trim();

			// Check if this is the start of an array (empty value or followed by array items)
			if (rawValue === "" || rawValue === "[]") {
				// Look ahead to see if next lines are array items
				const nextLine = lines[i + 1]?.trim();
				if (nextLine?.startsWith("-")) {
					currentKey = key;
					isCollectingArray = true;
					continue;
				}
				// Empty value, treat as empty string
				if (rawValue === "[]") {
					fields.push({
						key,
						value: "[]",
						type: "array",
					});
				} else {
					fields.push({
						key,
						value: "",
						type: "string",
					});
				}
				continue;
			}

			// Check for inline array [item1, item2]
			if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
				fields.push({
					key,
					value: rawValue,
					type: "array",
				});
				continue;
			}

			// Determine the type and parse the value
			const { value, type } = parseValue(rawValue);

			fields.push({
				key,
				value,
				type,
			});
		}
	}

	// Handle case where file ends while collecting array
	if (isCollectingArray && currentKey) {
		fields.push({
			key: currentKey,
			value: JSON.stringify(arrayValues),
			type: "array",
		});
	}

	return fields;
}

/**
 * Parses a YAML value and determines its type
 */
function parseValue(rawValue: string): { value: string; type: FrontmatterField["type"] } {
	// Boolean
	if (rawValue === "true" || rawValue === "false") {
		return { value: rawValue, type: "boolean" };
	}

	// Number (integer or float)
	if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
		return { value: rawValue, type: "number" };
	}

	// Date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
	if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(rawValue)) {
		return { value: rawValue, type: "date" };
	}

	// String (remove quotes if present)
	const unquoted = unquoteString(rawValue);
	return { value: unquoted, type: "string" };
}

/**
 * Removes surrounding quotes from a string
 */
function unquoteString(str: string): string {
	if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
		return str.slice(1, -1);
	}
	return str;
}

/**
 * Serializes frontmatter fields back to YAML format
 */
export function serializeFrontmatter(fields: FrontmatterField[]): string {
	if (fields.length === 0) {
		return "";
	}

	const lines: string[] = ["---"];

	for (const field of fields) {
		const serializedValue = serializeValue(field);
		lines.push(`${field.key}: ${serializedValue}`);
	}

	lines.push("---");
	lines.push("");

	return lines.join("\n");
}

/**
 * Serializes a single frontmatter value
 */
function serializeValue(field: FrontmatterField): string {
	switch (field.type) {
		case "boolean":
		case "number":
		case "date":
			return field.value;

		case "array":
			// Return as-is if already formatted
			if (field.value.startsWith("[")) {
				return field.value;
			}
			// Parse JSON array and format inline
			try {
				const arr = JSON.parse(field.value);
				if (Array.isArray(arr)) {
					return "[" + arr.map((v) => quoteIfNeeded(String(v))).join(", ") + "]";
				}
			} catch {
				// If parsing fails, return as-is
			}
			return field.value;

		case "string":
		default:
			return quoteIfNeeded(field.value);
	}
}

/**
 * Quotes a string value if it contains special characters
 */
function quoteIfNeeded(value: string): string {
	// Empty string needs quotes
	if (value === "") {
		return '""';
	}

	// Check if value needs quoting (contains special chars, starts with special chars, etc.)
	const needsQuotes =
		/[:#[\]{}|>*&!%@`]/.test(value) ||
		value.startsWith(" ") ||
		value.endsWith(" ") ||
		value.includes("\n") ||
		/^['"]/.test(value) ||
		/^(true|false|null|yes|no|on|off)$/i.test(value) ||
		/^-?\d+(\.\d+)?$/.test(value);

	if (needsQuotes) {
		// Escape internal quotes and wrap in double quotes
		return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
	}

	return value;
}

/**
 * Combines frontmatter and content into a full document
 */
export function combineDocument(frontmatter: FrontmatterField[], content: string): string {
	const frontmatterStr = serializeFrontmatter(frontmatter);
	return frontmatterStr + content;
}

/**
 * Updates a single field in the frontmatter
 */
export function updateFrontmatterField(
	fields: FrontmatterField[],
	key: string,
	value: string,
): FrontmatterField[] {
	return fields.map((field) => {
		if (field.key === key) {
			return { ...field, value };
		}
		return field;
	});
}

/**
 * Adds a new field to the frontmatter
 */
export function addFrontmatterField(
	fields: FrontmatterField[],
	key: string,
	value: string,
	type: FrontmatterField["type"] = "string",
): FrontmatterField[] {
	return [...fields, { key, value, type }];
}

/**
 * Removes a field from the frontmatter
 */
export function removeFrontmatterField(
	fields: FrontmatterField[],
	key: string,
): FrontmatterField[] {
	return fields.filter((field) => field.key !== key);
}
