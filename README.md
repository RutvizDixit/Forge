# FORGE

## Industrial Product Intelligence

FORGE turns scattered product information into structured, evidence-backed product intelligence.

It is designed to work with the information teams already have:

- Product catalogues
- Spreadsheets
- Technical documents
- Specification sheets
- Structured data
- Archives
- Manufacturer and product websites

FORGE can:

- Ingest multiple product information sources
- Identify and organize source content
- Normalize product identities and technical values
- Extract structured specifications
- Enrich incomplete product records
- Validate information against available evidence
- Distinguish supported, uncertain and conflicting information
- Retain source evidence for important decisions
- Interpret product requirements written in natural language
- Find suitable products
- Check whether a product satisfies a requirement
- Compare candidate products
- Identify records that need human review
- Evaluate generated records against a known reference
- Produce structured delivery files

## Supported Sources

FORGE supports:

- CSV
- XLSX
- XLS
- PDF
- DOCX
- TXT
- JSON
- XML
- ZIP archives
- Manufacturer or product website URLs

Multiple sources can be combined within the same workflow.

## Core Principle

FORGE does not treat an extracted value as automatically true.

A product value should be supported by available evidence, validated against applicable rules, or clearly marked as uncertain.

The system therefore separates:

- Supported
- Uncertain
- Not Supported

This keeps uncertainty visible instead of presenting assumptions as facts.

## Main Workspaces

### Enrich

Turn source product information into structured product records.

### Evidence

Attach and inspect documents, spreadsheets and web sources that support product information.

### Check

Determine whether a product satisfies a stated requirement.

### Match

Describe what is needed and find the products that best fit the requirement.

### Compare

Place candidate products side by side and surface important differences.

### Insights

Identify incomplete, conflicting and low-confidence product information that may require review.

### Evaluation

Measure generated output against a known reference.

### Results

Inspect and download the structured output produced by FORGE.

## Team FORGE

**Rutviz Dixit & Kushi G Gowda**

*Building FORGE to turn complex product information into clear, evidence-backed intelligence for better decisions.*

> Build with clarity. Verify with evidence. Decide with confidence.

## Connect With Us

- dattataryadixit50@gmail.com
- kushiggowda84@gmail.com

## Local Setup

Create a Python virtual environment:

    python -m venv .venv

Windows:

    .venv\Scripts\activate

Install dependencies:

    pip install -r requirements.txt

Create a local `.env` file using `.env.example` as the starting point.

An OpenAI API key is optional. Without one, FORGE can use its deterministic processing and validation layers.

Start the application:

    python app/app.py

Windows users can also use:

    run.bat

## Project Structure

    FORGE/
    ├── README.md
    ├── requirements.txt
    ├── .env.example
    ├── run.bat
    ├── setup_ai.bat
    ├── data/
    ├── output/
    └── app/
        ├── app.py
        ├── config.py
        ├── routes/
        ├── services/
        ├── core/
        ├── templates/
        └── static/

## Product Identity

FORGE is the product identity.

Product and engineering attribution is retained within the application and project metadata.

© 2026 Rutviz Dixit & Kushi G Gowda
