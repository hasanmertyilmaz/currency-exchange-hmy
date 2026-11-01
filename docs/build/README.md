# Report build

`report-content.js` is the single source of the M1 report. `build-report.js` renders it to

- `docs/M1/Group7_M1_Analysis_and_Design.docx` (editable, Word), and
- `docs/M1/Group7_M1_Analysis_and_Design.pdf` (printed with headless Google Chrome).

Diagrams are taken from `docs/M1/diagrams/png` (DOCX) and `docs/M1/diagrams/svg` (PDF).

## Requirements

- Node.js 20+, then `npm install` in this folder
- Google Chrome (path can be passed with `--chrome <path>`)
- Python 3 with `pymupdf` (optional; used to put page numbers into the PDF table of contents)
- Java 17+ and `plantuml.jar` to re-render diagrams after editing a `.puml` file

## Commands

```bash
# re-render diagrams (from docs/M1/diagrams/src)
java -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar -tpng -Sdpi=150 -o ../png *.puml
java -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar -tsvg -o ../svg *.puml

# build the report (from docs/build)
npm install
npm run build
```

When the DOCX is opened, Word asks to update fields; accept it to fill in the table of contents.
