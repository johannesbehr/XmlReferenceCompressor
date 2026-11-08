# EXIficient benchmark

This Java benchmark compares:

- GZIP (Java `GZIPOutputStream`)
- EXI schema-less, BIT_PACKED
- EXI schema-less, COMPRESSION
- EXI schema-informed, COMPRESSION (when an XSD is supplied)

It reads every `.sng` file from a ZIP archive, writes encoded EXI files, records encode/decode times, and checks that decoding reproduces the original XML tree.

## Requirements

- JDK 17 or newer
- Apache Maven 3.8 or newer
- Internet access on the first Maven build, so Maven can download EXIficient and build plugins

EXIficient 1.0.7 is used under its MIT license.

## Build on Windows (PowerShell)

From the repository root:

~~~powershell
mvn -f benchmark/exi/pom.xml package dependency:copy-dependencies
~~~

## Run with the JJazzLab schema

From the repository root, run:

~~~powershell
java -cp "benchmark/exi/target/classes;benchmark/exi/target/dependency/*" org.jjazzlab.exibench.ExiBenchmark ".\test.zip" "benchmark/exi/results" "benchmark/exi/schema/jjazzlab-sng.xsd"
~~~

Adjust the ZIP path if your test archive is stored elsewhere.

The third argument is optional. Without it, the benchmark runs only the two schema-less EXI modes, as before.

## Output

The output directory contains:

- `results.csv` – sizes, encode/decode times and round-trip status
- `*.bit-packed.exi` – schema-less BIT_PACKED streams
- `*.compression.exi` – schema-less COMPRESSION streams
- `*.schema-compression.exi` – schema-informed COMPRESSION streams

The CSV keeps the previous columns and appends:

- `exi_schema_compression_bytes`
- `schema_compression_encode_ms`
- `schema_compression_decode_ms`
- `schema_compression_roundtrip`

## Interpretation notes

- The schema-informed run uses `benchmark/exi/schema/jjazzlab-sng.xsd` for both encoding and decoding.
- The XSD is **not** included in the EXI byte count. This models a receiver that already has the same schema installed. For a real deployment, the schema distribution/versioning cost and compatibility need to be considered separately.
- The current XSD is deliberately permissive for nested JJazzLab model objects. It is an initial schema-informed EXI experiment, not a complete semantic validation schema for every JJazzLab release.
- The EXI stream includes EXI options. The decoder also receives the same schema out-of-band.
- The round-trip check compares parsed XML trees, not byte-for-byte serialization. XML declaration formatting, quote style and attribute order are not significant to that comparison.
- EXI COMPRESSION already applies its own DEFLATE compression; do not gzip the EXI output again when comparing these numbers.
- Timings are single-run measurements and should be treated as indicative only.
