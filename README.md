# XML Reference Compressor

A generic, lossless XML structure compressor based on a shared reference model.

The project learns reusable XML subtree templates from a collection of reference documents. An encoder uses those templates to encode matching input subtrees as compact template references plus deltas. Unknown or structurally different XML remains representable through a generic fallback.

The reference model is shared by encoder and decoder; it is not embedded into every compressed document.

## Status

Initial project setup. The first implementation will target a readable JSON container format, with binary encoding and outer compression (for example gzip) evaluated separately.

## Goals

- Work with arbitrary well-formed XML, not a JJazzLab-specific schema.
- Preserve element order, attributes, text, comments, CDATA, processing instructions, and other supported XML node types.
- Reconstruct the original XML information set without losing unknown elements or attributes.
- Learn templates from a set of reference XML documents.
- Encode deviations from templates rather than requiring exact document matches.
- Include a generic fallback whenever a template cannot be applied.
- Version and fingerprint reference models so encoder and decoder can verify compatibility.

## Development

Requirements: Node.js 20 or newer.

```sh
npm install
npm test
```

## Design

See [docs/design.md](docs/design.md) for the initial format and implementation notes.
