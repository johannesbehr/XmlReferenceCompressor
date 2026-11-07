import { createHash } from "node:crypto";
import { shapeOf, toGeneric, nodeSize } from "./tree.js";

const FORMAT_VERSION = 1;

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashModelContent(content) {
  return createHash("sha256").update(stableStringify(content)).digest("hex");
}

function walk(node, visit) {
  visit(node);
  if (node.type === "element") node.children.forEach((child) => walk(child, visit));
}

/** Build a shared reference model from parseXml() document objects. */
export function generateReferenceModel(documents, options = {}) {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new TypeError("At least one parsed reference document is required");
  }

  const minOccurrences = options.minOccurrences ?? 2;
  const candidates = new Map();

  for (const document of documents) {
    for (const root of document.children) {
      walk(root, (node) => {
        if (node.type !== "element") return;
        const shape = shapeOf(node);
        const key = stableStringify(shape);
        const entry = candidates.get(key) ?? { shape, count: 0, sample: node, size: nodeSize(node) };
        entry.count += 1;
        candidates.set(key, entry);
      });
    }
  }

  const selected = [...candidates.entries()]
    .filter(([, entry]) => entry.count >= minOccurrences && entry.size > 1)
    .sort((a, b) => b[1].size - a[1].size || b[1].count - a[1].count || a[0].localeCompare(b[0]));

  const templates = selected.map(([key, entry], id) => ({
    id, shape: entry.shape, tree: toGeneric(entry.sample),
    occurrences: entry.count, nodeCount: entry.size
  }));

  const content = { format: "xml-reference-model", version: FORMAT_VERSION, templates };
  return { ...content, fingerprint: hashModelContent(content) };
}

export function validateReferenceModel(model) {
  if (!model || model.format !== "xml-reference-model" || model.version !== FORMAT_VERSION) {
    throw new Error("Unsupported or invalid reference model");
  }
  const { fingerprint, ...content } = model;
  if (fingerprint !== hashModelContent(content)) throw new Error("Reference model fingerprint is invalid");
  return model;
}

export { FORMAT_VERSION };
