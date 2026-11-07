import { clone, shapeOf, toGeneric, fromGeneric } from "./tree.js";
import { validateReferenceModel } from "./model.js";

function collectPatches(template, actual, path, patches) {
  if (template.type === "element") {
    for (const [name, value] of Object.entries(actual.attributes)) {
      if (template.attributes[name] !== value) patches.push({ p: [...path, "a", name], v: value });
    }
    for (let i = 0; i < template.children.length; i += 1) {
      collectPatches(template.children[i], actual.children[i], [...path, i], patches);
    }
  } else if (template.type === "pi") {
    if (template.body !== actual.body) patches.push({ p: [...path, "b"], v: actual.body });
  } else if (template.value !== actual.value) {
    patches.push({ p: [...path, "v"], v: actual.value });
  }
}

function applyPatch(root, patch) {
  const path = patch.p;
  let current = root;
  let index = 0;

  while (index < path.length) {
    const part = path[index];
    if (part === "a") {
      current.attributes[path[index + 1]] = patch.v;
      return;
    }
    if (part === "v") {
      current.value = patch.v;
      return;
    }
    if (part === "b") {
      current.body = patch.v;
      return;
    }
    current = current.children[part];
    index += 1;
  }
  throw new Error("Invalid patch path");
}

/** Encode a parsed XML document with a shared reference model. */
export function encodeDocument(document, model) {
  validateReferenceModel(model);

  const byShape = new Map();
  for (const template of model.templates) {
    const key = JSON.stringify(template.shape);
    const previous = byShape.get(key);
    if (!previous || template.nodeCount > previous.nodeCount) byShape.set(key, template);
  }

  function encodeNode(node) {
    if (node.type === "element") {
      const template = byShape.get(JSON.stringify(shapeOf(node)));
      if (template) {
        const base = fromGeneric(template.tree);
        const patches = [];
        collectPatches(base, node, [], patches);
        return ["r", template.id, patches];
      }
      return ["e", node.name, { ...node.attributes }, node.children.map(encodeNode)];
    }
    return toGeneric(node);
  }

  return {
    format: "xml-reference-data",
    version: 1,
    model: model.fingerprint,
    declaration: document.declaration ? { ...document.declaration } : null,
    nodes: document.children.map(encodeNode)
  };
}

/** Decode an encoded document using the exact shared reference model. */
export function decodeDocument(encoded, model) {
  validateReferenceModel(model);
  if (!encoded || encoded.format !== "xml-reference-data" || encoded.version !== 1) {
    throw new Error("Unsupported or invalid encoded XML document");
  }
  if (encoded.model !== model.fingerprint) throw new Error("Encoded document requires a different reference model");

  function decodeNode(value) {
    if (value[0] === "r") {
      const template = model.templates.find((item) => item.id === value[1]);
      if (!template) throw new Error(`Unknown template ID: ${value[1]}`);
      const node = fromGeneric(clone(template.tree));
      for (const patch of value[2]) applyPatch(node, patch);
      return node;
    }
    if (value[0] === "e") {
      return { type: "element", name: value[1], attributes: { ...value[2] }, children: value[3].map(decodeNode) };
    }
    return fromGeneric(value);
  }

  return {
    declaration: encoded.declaration ? { ...encoded.declaration } : null,
    children: encoded.nodes.map(decodeNode)
  };
}
