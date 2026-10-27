# Citilodge Hotel Invoice Studio

A React and Vite app for preparing Citilodge Hotel invoices, previewing them as PDFs, and downloading the invoice with attached receipt images.

## Run locally

```sh
npm install
npm run dev
```

Edit the invoice sections and use **Save details**, **Save charges**, or **Save receipts** to apply each section to the PDF preview. Unsaved edits do not regenerate the preview. On desktop, the saved PDF is embedded in the studio; on phones, use **Open PDF preview** to view it in the device's PDF viewer. **Download saved PDF** exports the saved version. `npm run build` creates a production build, and `npm run lint` checks the source.

## Invoice features

- Edit hotel letterhead, recipient, invoice number/date, and itemized room charges.
- Automatically calculate the subtotal, whole-naira 7.5% VAT and 10% service charge, grand total, and grand total in Nigerian Naira words.
- Attach multiple images. Files are read as data URLs and resized to a maximum 1,800 px, then converted to JPEG at 84% quality in the browser to reduce PDF size while keeping receipts readable. Each file is limited to 10 MB.
- The invoice page follows the supplied **HOTEL INVOICE BILL 0927**: Citilodge letterhead, recipient and billing paragraph, bordered item table, and totals in the table.
- The supplied `OIP.webp` Citilodge logo is included in the letterhead and converted to JPEG in-browser for PDF compatibility.
- The closing includes the typed signatory name **Stella Abraham**, with optional editable signatory details in the invoice form. PDF styling uses the logo's red, black, and white palette.
- Include attachments in the **Attached Receipts & Proofs** section, with each uploaded receipt image placed on its own PDF page.

The PDF document and its styling are defined in `src/App.jsx`; the browser Buffer polyfill needed by PDF image rendering is configured in `src/main.jsx`. The invoice editor and responsive layout are styled in `src/App.css`, `src/Workflow.css`, `src/MobilePreview.css`, `src/GuestCharges.css`, and `src/index.css`.
