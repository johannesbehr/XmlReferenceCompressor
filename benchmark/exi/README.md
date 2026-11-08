# EXIficient benchmark

This small Java benchmark runs schema-less EXI against .sng files in a ZIP archive.

It measures original XML size, GZIP size, EXI bit-packed size, EXI compression-mode size, encode/decode times, and XML-tree round-trip verification.

The benchmark enables preservation of comments, processing instructions, namespace prefixes and lexical values. The supplied six-song sample contains none of those optional constructs, but keeping the options enabled makes the test configuration less specific to the current sample.

## Requirements

- JDK 17 or newer
- Apache Maven 3.8 or newer
- Internet access on the first Maven build, so Maven can download EXIficient and build plugins

EXIficient 1.0.7 is used under its MIT license.

## Run on Windows (PowerShell)

From the repository root:

~~~powershell
mvn -f benchmark/exi/pom.xml package dependency:copy-dependencies

java -cp "benchmark/exi/target/classes;benchmark/exi/target/dependency/*" org.jjazzlab.exibench.ExiBenchmark "C:\path\to\test.zip" "benchmark/exi/results"
~~~

The output directory contains results.csv and one .exi file per song and coding mode.

The benchmark does not modify the input ZIP or the original .sng files.

## Important interpretation notes

- Both EXI modes are schema-less. No XSD is supplied.
- The EXI stream includes its encoding options. This adds a small header cost but avoids relying on out-of-band knowledge of the chosen coding mode.
- The round-trip check compares parsed XML trees, not byte-for-byte serialization. XML declaration formatting, quote style and attribute order are not significant to that comparison.
- GZIP is measured separately from EXI. EXI COMPRESSION already applies its own DEFLATE compression.
- Schema-informed EXI is a separate experiment and should only be compared after we have a shared XSD and account for how that XSD is distributed.
