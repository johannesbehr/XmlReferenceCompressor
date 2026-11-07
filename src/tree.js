export function clone(value) {
  return structuredClone(value);
}

export function shapeOf(node) {
  if (node.type === "element") {
    return ["e", node.name, Object.keys(node.attributes).sort(), node.children.map(shapeOf)];
  }
  if (node.type === "pi") return ["p", node.target];
  return [node.type];
}

export function nodeSize(node) {
  if (node.type !== "element") return 1;
  return 1 + node.children.reduce((sum, child) => sum + nodeSize(child), 0);
}

export function toGeneric(node) {
  switch (node.type) {
    case "element": return ["e", node.name, { ...node.attributes }, node.children.map(toGeneric)];
    case "text": return ["t", node.value];
    case "cdata": return ["c", node.value];
    case "comment": return ["m", node.value];
    case "pi": return ["p", node.target, node.body];
    case "doctype": return ["d", node.value];
    default: throw new Error(`Unsupported node type: ${node.type}`);
  }
}

export function fromGeneric(value) {
  switch (value[0]) {
    case "e": return { type: "element", name: value[1], attributes: { ...value[2] }, children: value[3].map(fromGeneric) };
    case "t": return { type: "text", value: value[1] };
    case "c": return { type: "cdata", value: value[1] };
    case "m": return { type: "comment", value: value[1] };
    case "p": return { type: "pi", target: value[1], body: value[2] };
    case "d": return { type: "doctype", value: value[1] };
    default: throw new Error(`Unknown generic node tag: ${value[0]}`);
  }
}
