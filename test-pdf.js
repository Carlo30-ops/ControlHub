import fs from 'fs';
import pdfParse from 'pdf-parse';

async function parse() {
    const dataBuffer = fs.readFileSync('C:\\Users\\factu\\OneDrive\\Documentos 1\\SCRIPS\\WorSpace 2.0\\scrips\\cotu-analytics\\FACTURA DE MUESTRA\\FAC_900175697_COTU76412.pdf');
    const pdfData = await pdfParse(dataBuffer);

    // Regex for formats like "268,000.00" or "268.000,00"
    const regex = /\b(?:\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,3}(?:\.\d{3})*,\d{2})\b/g;
    const matches = pdfData.text.match(regex) || [];

    let maxAmount = 0;
    for (const match of matches) {
        let normalized = match;
        if (/\.\d{2}$/.test(match)) {
            // "268,000.00" -> 268000.00
            normalized = match.replace(/,/g, '');
        } else {
            // "268.000,00" -> 268000.00
            normalized = match.replace(/\./g, '').replace(',', '.');
        }
        const val = parseFloat(normalized);
        if (val > maxAmount) maxAmount = val;
    }

    console.log("Found amounts:", matches);
    console.log("Max Amount:", maxAmount);
}

parse();
