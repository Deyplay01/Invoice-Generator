import { memo, useEffect, useMemo, useState } from 'react'
import { Document, Image, Page, pdf as renderPdf, StyleSheet, Text, View } from '@react-pdf/renderer'
import { CalendarDays, ChevronDown, Download, ExternalLink, FileImage, FilePlus2, Hotel, Plus, Trash2 } from 'lucide-react'
import citilodgeLogo from './assets/OIP.webp'
import './App.css'
import './Workflow.css'
import './MobilePreview.css'
import './GuestCharges.css'

const sampleDate = '2025-07-16'
const initialItems = [
  { id: 1, name: 'NASIRU M SANI', room: '101', arrival: '2025-07-14', departure: '2025-07-16', amount: '136500' },
]

const formatNaira = (amount) => `N${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function amountToCents(amount) {
  const value = String(amount ?? '').trim()
  const match = value.match(/^(\d*)(?:\.(\d*))?$/)

  if (!match || (!match[1] && !match[2])) {
    const numericValue = Number(value)
    const cents = Math.round((numericValue + Number.EPSILON) * 100)
    return Number.isFinite(numericValue) && numericValue > 0 && Number.isSafeInteger(cents) ? cents : 0
  }

  const whole = Number(match[1] || 0)
  if (!Number.isSafeInteger(whole * 100)) return 0

  const fraction = (match[2] || '').padEnd(3, '0')
  return whole * 100 + Number(fraction.slice(0, 2)) + (Number(fraction[2]) >= 5 ? 1 : 0)
}

function chunkToWords(value) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const words = []

  if (value >= 100) {
    const remainder = value % 100
    words.push(`${ones[Math.floor(value / 100)]} Hundred${remainder ? ' and' : ''}`)
    value = remainder
  }
  if (value >= 20) {
    const units = value % 10
    words.push(`${tens[Math.floor(value / 10)]}${units ? `-${ones[units].toLowerCase()}` : ''}`)
    value = 0
  } else if (value >= 10) {
    words.push(teens[value - 10])
    value = 0
  }
  if (value > 0) words.push(ones[value])
  return words.join(' ')
}

function amountInWords(amount) {
  const cents = amountToCents(amount)
  const naira = Math.floor(cents / 100)
  const kobo = cents % 100
  if (naira >= 1_000_000_000_000) return 'Amount exceeds the supported word range'

  const scales = ['', 'Thousand', 'Million', 'Billion']
  const groups = []
  let remaining = naira
  let scaleIndex = 0
  while (remaining > 0) {
    const group = remaining % 1000
    if (group) groups.unshift(`${chunkToWords(group)}${scales[scaleIndex] ? ` ${scales[scaleIndex]}` : ''}`)
    remaining = Math.floor(remaining / 1000)
    scaleIndex += 1
  }

  const nairaWords = groups.join(', ') || 'Zero'
  const koboWords = kobo ? ` and ${chunkToWords(kobo)} Kobo` : ''
  return `${nairaWords} Naira${koboWords} Only`
}

function formatTableDate(value) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '—'
}

function formatInvoiceDate(value) {
  const date = new Date(`${value}T00:00:00`)
  if (!value || Number.isNaN(date.getTime())) return value || ''
  const day = date.getDate()
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return `${day}${suffix} ${date.toLocaleString('en-GB', { month: 'long' })}, ${date.getFullYear()}`
}

const pdfStyles = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 48, paddingBottom: 46, fontFamily: 'Helvetica', color: '#211e1d', fontSize: 8 },
  hotelHeader: { alignItems: 'flex-end', marginBottom: 16 },
  logo: { width: 118, height: 78, objectFit: 'contain', marginBottom: 6 },
  hotelDetails: { textAlign: 'right', fontSize: 6.5, lineHeight: 1.35, color: '#3f3a38' },
  invoiceMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 19, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: '#d8cecb', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ad202c' },
  recipient: { lineHeight: 1.35, marginBottom: 14 },
  salutation: { marginBottom: 6 },
  billTitle: { fontFamily: 'Helvetica-Bold', color: '#ad202c', marginBottom: 6 },
  billingCopy: { lineHeight: 1.5, marginBottom: 14 },
  table: { width: '100%', borderWidth: 0.8, borderColor: '#302b29' },
  tableRow: { flexDirection: 'row', minHeight: 19, borderBottomWidth: 0.5, borderBottomColor: '#8c817d', alignItems: 'stretch' },
  tableHead: { minHeight: 22, fontFamily: 'Helvetica-Bold', backgroundColor: '#292524', color: '#ffffff' },
  tableCell: { justifyContent: 'center', paddingVertical: 3, paddingHorizontal: 4, borderRightWidth: 0.5, borderRightColor: '#cfc6c2', fontSize: 7, color: '#211e1d' },
  tableHeadCell: { color: '#ffffff', borderRightColor: '#665e5b' },
  serial: { width: '6%', textAlign: 'center' },
  name: { width: '24%' },
  room: { width: '12%', textAlign: 'center' },
  date: { width: '17%', textAlign: 'center' },
  amount: { width: '24%', textAlign: 'right', borderRightWidth: 0 },
  summaryLabel: { width: '76%', paddingVertical: 3, paddingHorizontal: 5, fontSize: 7, fontFamily: 'Helvetica-Bold' },
  summaryAmount: { width: '24%', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'right', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  grandTotal: { fontFamily: 'Helvetica-Bold', backgroundColor: '#f5e9e8', color: '#a51d2a' },
  closing: { marginTop: 12, lineHeight: 1.5 },
  signatory: { marginTop: 27, alignSelf: 'flex-end', width: 175, textAlign: 'center' },
  signatoryRule: { borderTopWidth: 0.7, borderTopColor: '#a99b96', marginBottom: 5 },
  signatoryName: { color: '#a51d2a', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  signatoryRole: { color: '#514947', fontSize: 7, marginTop: 2 },
  attachmentPage: { paddingTop: 38, paddingHorizontal: 42, paddingBottom: 42, fontFamily: 'Helvetica', color: '#211e1d' },
  attachmentTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 5, color: '#a51d2a' },
  attachmentSub: { fontSize: 8, color: '#625a57', marginBottom: 22 },
  receiptCard: { width: '100%', borderWidth: 0.7, borderColor: '#c9bbb7', padding: 8 },
  receiptImage: { width: '100%', height: 650, objectFit: 'contain' },
  receiptCaption: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 8 },
})

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('The file could not be read as an image.'))
    }
    reader.onerror = () => reject(reader.error || new Error('The file could not be read.'))
    reader.onabort = () => reject(new Error('The file read was cancelled.'))
    reader.readAsDataURL(file)
  })
}

function convertImageToJpeg(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight))
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')

        if (!context) {
          reject(new Error('This image could not be prepared for the PDF.'))
          return
        }

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.84))
      } catch (error) {
        reject(error instanceof Error ? error : new Error('This image could not be prepared for the PDF.'))
      }
    }
    image.onerror = () => reject(new Error('This image format could not be prepared for the PDF.'))
    image.src = dataUrl
  })
}

async function readReceiptImage(file) {
  const dataUrl = await readFileAsDataUrl(file)
  return convertImageToJpeg(dataUrl)
}

function InvoiceDocument({ invoice, items, totals, receipts, logoData }) {
  return (
    <Document title={`${invoice.number} - ${invoice.hotel}`} author={invoice.hotel}>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.hotelHeader}>
          {logoData && <Image src={logoData} style={pdfStyles.logo} />}
          <Text style={pdfStyles.hotelDetails}>{invoice.address}</Text>
          {invoice.contact && <Text style={pdfStyles.hotelDetails}>{invoice.contact}</Text>}
        </View>

        <View style={pdfStyles.invoiceMeta}>
          <Text>INVOICE {invoice.number}</Text>
          <Text>{formatInvoiceDate(invoice.date)}</Text>
        </View>

        <Text style={pdfStyles.recipient}>{invoice.recipient}</Text>
        <Text style={pdfStyles.salutation}>Dear Sir,</Text>
        <Text style={pdfStyles.billTitle}>HOTEL BILL</Text>
        <Text style={pdfStyles.billingCopy}>
          We hereby forward for settlement our bill in sum of {amountInWords(totals.grandTotal)} ({formatNaira(totals.grandTotal)}), being the cost of accommodation for the staff of {invoice.organization || 'the organization named above'}.
        </Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHead]}>
            <Text style={[pdfStyles.tableCell, pdfStyles.tableHeadCell, pdfStyles.serial]}>S/N</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.tableHeadCell, pdfStyles.name]}>NAMES</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.tableHeadCell, pdfStyles.room]}>ROOM NO</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.tableHeadCell, pdfStyles.date]}>ARR/DATE</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.tableHeadCell, pdfStyles.date]}>DEPT/DATE</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.tableHeadCell, pdfStyles.amount]}>AMOUNT</Text>
          </View>
          {items.map((item, index) => (
            <View style={pdfStyles.tableRow} key={item.id}>
              <Text style={[pdfStyles.tableCell, pdfStyles.serial]}>{index + 1}</Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.name]}>{item.name || '—'}</Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.room]}>{item.room || '—'}</Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.date]}>{formatTableDate(item.arrival)}</Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.date]}>{formatTableDate(item.departure)}</Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.amount]}>{formatNaira(item.amount)}</Text>
            </View>
          ))}
          {[
            ['TOTAL', totals.subtotal],
            ['VAT 7.5%', totals.vat],
            ['SERVICE CHARGE 10%', totals.service],
            ['GRAND TOTAL', totals.grandTotal],
          ].map(([label, amount]) => (
            <View style={[pdfStyles.tableRow, label === 'GRAND TOTAL' && pdfStyles.grandTotal]} key={label}>
              <Text style={pdfStyles.summaryLabel}>{label}</Text>
              <Text style={pdfStyles.summaryAmount}>{formatNaira(amount)}</Text>
            </View>
          ))}
        </View>

        <Text style={pdfStyles.closing}>Attached herein is signed bill for your consideration.</Text>
        <Text style={pdfStyles.closing}>Thank you for giving us the opportunity to serve you.</Text>
        <View style={pdfStyles.signatory} wrap={false}>
          <View style={pdfStyles.signatoryRule} />
          <Text style={pdfStyles.signatoryName}>{invoice.signatory}</Text>
          {invoice.signatoryRole && <Text style={pdfStyles.signatoryRole}>{invoice.signatoryRole}</Text>}
        </View>
      </Page>

      {receipts.map((receipt, index) => (
        <Page key={receipt.id} size="A4" style={pdfStyles.attachmentPage}>
          <Text style={pdfStyles.attachmentTitle}>Attached Receipts &amp; Proofs</Text>
          <Text style={pdfStyles.attachmentSub}>INVOICE {invoice.number}  ·  Attachment {index + 1} of {receipts.length}</Text>
          <View style={pdfStyles.receiptCard} wrap={false}>
            <Image src={receipt.data} style={pdfStyles.receiptImage} />
            <Text style={pdfStyles.receiptCaption}>{receipt.name}</Text>
          </View>
        </Page>
      ))}
    </Document>
  )
}

function FormField({ label, value, onChange, type = 'text', placeholder, multiline = false }) {
  return (
    <label className="field-wrap">
      <span className="field-label">{label}</span>
      {multiline
        ? <textarea className="field-input min-h-20 resize-y py-2" rows={3} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        : <input className="field-input" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
    </label>
  )
}

const InvoicePreview = memo(function InvoicePreview({ pdfUrl, pdfError, fileName }) {
  return (
    <>
      <div className="mobile-preview-actions">
        {pdfUrl
          ? <a className="mobile-preview-button" href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open PDF preview</a>
          : <button className="mobile-preview-button" type="button" disabled>{pdfError ? 'Preview unavailable' : 'Preparing preview…'}</button>}
        {pdfUrl && <a className="mobile-download-link" href={pdfUrl} download={fileName}><Download size={14} /> Download PDF</a>}
        <p>Opens the saved invoice in your phone’s PDF viewer.</p>
        {pdfError && <p className="mobile-preview-error" role="alert">{pdfError}</p>}
      </div>
      <div className="pdf-frame">
        {pdfUrl
          ? <iframe src={pdfUrl} title="Saved Citilodge invoice PDF preview" className="pdf-viewer" />
          : <p className="preview-placeholder" role={pdfError ? 'alert' : 'status'}>{pdfError || 'Preparing saved PDF preview…'}</p>}
      </div>
    </>
  )
})

function App() {
  const [invoice, setInvoice] = useState({
    hotel: 'Citilodge Hotel',
    address: 'Plot 509, Durumi Road Area 1,\nBy Federal Secretariat, Abuja.',
    contact: '',
    number: '0927',
    date: sampleDate,
    recipient: 'The Sales Office\nManager (SOM)\nNigerian Breweries Plc\nAbuja.',
    organization: 'Nigerian Breweries Plc',
    signatory: 'Stella Abraham',
    signatoryRole: '',
  })
  const [items, setItems] = useState(initialItems)
  const [receipts, setReceipts] = useState([])
  const [invoiceDirty, setInvoiceDirty] = useState(false)
  const [itemsDirty, setItemsDirty] = useState(false)
  const [receiptsDirty, setReceiptsDirty] = useState(false)
  const [receiptError, setReceiptError] = useState('')
  const [logoData, setLogoData] = useState('')
  const [logoError, setLogoError] = useState('')

  const totals = useMemo(() => {
    const subtotalCents = items.reduce((sum, item) => sum + amountToCents(item.amount), 0)
    const vatCents = Math.round(subtotalCents * 75 / 100_000) * 100
    const serviceCents = Math.round(subtotalCents / 1_000) * 100
    return {
      subtotal: subtotalCents / 100,
      vat: vatCents / 100,
      service: serviceCents / 100,
      grandTotal: (subtotalCents + vatCents + serviceCents) / 100,
    }
  }, [items])
  const [pdfData, setPdfData] = useState(() => ({ invoice, items, totals, receipts, logoData }))
  const hasUnsavedChanges = invoiceDirty || itemsDirty || receiptsDirty
  const [generatedPdf, setGeneratedPdf] = useState(null)
  const [pdfError, setPdfError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadLogo = async () => {
      try {
        const response = await fetch(citilodgeLogo)
        if (!response.ok) throw new Error(`Logo request failed (${response.status}).`)
        const logo = await readFileAsDataUrl(await response.blob())
        const convertedLogo = await convertImageToJpeg(logo)
        if (!cancelled) {
          setLogoData(convertedLogo)
          setPdfData((current) => ({ ...current, logoData: convertedLogo }))
        }
      } catch (error) {
        if (!cancelled) {
          setLogoError(error instanceof Error ? error.message : 'The Citilodge logo could not be loaded.')
        }
      }
    }

    void loadLogo()
    return () => { cancelled = true }
  }, [])

  const pdf = useMemo(() => <InvoiceDocument {...pdfData} />, [pdfData])

  useEffect(() => {
    let cancelled = false
    let objectUrl

    renderPdf(pdf).toBlob().then((blob) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setGeneratedPdf({ document: pdf, url: objectUrl })
      setPdfError(null)
    }).catch((error) => {
      if (!cancelled) {
        setPdfError({
          document: pdf,
          message: error instanceof Error ? error.message : 'The invoice PDF could not be generated.',
        })
      }
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [pdf])

  const setInvoiceField = (field, value) => {
    setInvoice((current) => ({ ...current, [field]: value }))
    setInvoiceDirty(true)
  }
  const updateItem = (id, field, value) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item))
    setItemsDirty(true)
  }
  const addItem = () => {
    setItems((current) => [...current, { id: Date.now(), name: '', room: '', arrival: '', departure: '', amount: '' }])
    setItemsDirty(true)
  }
  const removeItem = (id) => {
    setItems((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current)
    setItemsDirty(true)
  }
  const saveInvoice = () => {
    setPdfData((current) => ({ ...current, invoice }))
    setInvoiceDirty(false)
  }
  const saveItems = () => {
    setPdfData((current) => ({ ...current, items, totals }))
    setItemsDirty(false)
  }
  const saveReceipts = () => {
    setPdfData((current) => ({ ...current, receipts }))
    setReceiptsDirty(false)
  }

  const addReceipts = async (event) => {
    const input = event.currentTarget
    const files = Array.from(input.files || [])
    input.value = ''
    setReceiptError('')

    const nonImages = files.filter((file) => !file.type.startsWith('image/'))
    const oversized = files.filter((file) => file.size > 10 * 1024 * 1024)
    const eligible = files.filter((file) => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024)
    const results = await Promise.allSettled(eligible.map(async (file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      name: file.name,
      data: await readReceiptImage(file),
    })))
    const loaded = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
    const failed = results.filter((result) => result.status === 'rejected')
    const errors = []

    if (loaded.length) {
      setReceipts((current) => [...current, ...loaded])
      setReceiptsDirty(true)
    }
    if (nonImages.length) errors.push(`${nonImages.length} non-image file${nonImages.length === 1 ? '' : 's'} skipped.`)
    if (oversized.length) errors.push(`${oversized.length} file${oversized.length === 1 ? '' : 's'} exceed the 10 MB limit.`)
    if (failed.length) errors.push(`${failed.length} image${failed.length === 1 ? '' : 's'} could not be read or converted.`)
    setReceiptError(errors.join(' '))
  }

  const currentPdfUrl = generatedPdf?.document === pdf ? generatedPdf.url : ''
  const currentPdfError = pdfError?.document === pdf ? pdfError.message : ''
  const pdfFileName = `invoice-${pdfData.invoice.number || 'draft'}.pdf`

  return (
    <div className="min-h-screen bg-[#edf1ed] text-[#1f3029]">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Citilodge billing home"><span className="brand-mark"><Hotel size={19} /></span><span>CITILODGE<span className="brand-light"> / BILLING</span></span></a>
        <div className="topbar-status"><span className="status-dot" /> {hasUnsavedChanges ? 'Unsaved edits' : 'Saved preview'} <span className="status-divider">/</span> NGN</div>
      </header>

      <main id="top" className="mx-auto max-w-360 px-5 pb-14 pt-8 sm:px-8 lg:px-10">
        <section className="page-heading">
          <div>
            <p className="eyebrow">FRONT DESK · FINANCE</p>
            <h1 className="page-title">Hotel invoice studio</h1>
            <p className="page-subtitle">Prepare a guest bill, attach proof, and export a ready-to-send PDF.</p>
          </div>
          <a
            href={currentPdfUrl || undefined}
            download={pdfFileName}
            className={`download-button${currentPdfUrl ? '' : ' pointer-events-none opacity-60'}`}
            aria-disabled={!currentPdfUrl}
          >
            <Download size={16} />{currentPdfUrl ? 'Download saved PDF' : currentPdfError ? 'PDF unavailable' : 'Preparing PDF…'}
          </a>
        </section>

        <div className="studio-grid">
          <section className="editor-column" aria-label="Invoice details">
            <div className="section-topline"><span className="step-number">01</span><div><h2 className="section-heading">Invoice details</h2><p className="section-caption">Hotel, guest and billing reference</p></div></div>
            <div className="form-panel">
              <div className="field-grid">
                <FormField label="Hotel name" value={invoice.hotel} onChange={(value) => setInvoiceField('hotel', value)} />
                <FormField label="Invoice number" value={invoice.number} onChange={(value) => setInvoiceField('number', value)} />
                <FormField label="Invoice date" type="date" value={invoice.date} onChange={(value) => setInvoiceField('date', value)} />
                <FormField label="Hotel address" value={invoice.address} onChange={(value) => setInvoiceField('address', value)} multiline />
                <FormField label="Hotel phone / email / website" value={invoice.contact} onChange={(value) => setInvoiceField('contact', value)} multiline placeholder="Enter the contact details shown on your hotel letterhead" />
                <FormField label="Billed to" value={invoice.recipient} onChange={(value) => setInvoiceField('recipient', value)} multiline />
                <FormField label="Organization in billing paragraph" value={invoice.organization} onChange={(value) => setInvoiceField('organization', value)} />
                <FormField label="Authorized signatory" value={invoice.signatory} onChange={(value) => setInvoiceField('signatory', value)} />
                <FormField label="Signatory title (optional)" value={invoice.signatoryRole} onChange={(value) => setInvoiceField('signatoryRole', value)} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edf0ed] pt-3">
                <span className="text-[10px] text-[#829087]" role="status">{invoiceDirty ? 'Details have unsaved changes.' : 'Details saved to preview.'}</span>
                <button type="button" className="save-section-button" onClick={saveInvoice} disabled={!invoiceDirty}>Save details</button>
              </div>
            </div>

            <div className="section-topline table-heading"><span className="step-number">02</span><div><h2 className="section-heading">Guest charges</h2><p className="section-caption">Enter each room or service charge</p></div><button type="button" className="quiet-button add-row-button" onClick={addItem}><Plus size={15} /> Add line</button><button type="button" className="save-section-button" onClick={saveItems} disabled={!itemsDirty}>Save charges</button></div>
            <div className="table-panel">
              <div className="line-items-header"><span>GUEST NAME</span><span>ROOM NO.</span><span>ARRIVAL DATE</span><span>DEPARTURE DATE</span><span>AMOUNT · NGN</span><span /></div>
              {items.map((item, index) => (
                <div className="line-item" key={item.id}>
                  <div className="guest-cell">
                    <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
                    <label className="charge-input-field guest-name-field"><span>Guest name</span><input aria-label={`Guest name ${index + 1}`} value={item.name} onChange={(event) => updateItem(item.id, 'name', event.target.value)} placeholder="Guest name" /></label>
                  </div>
                  <label className="charge-input-field room-cell"><span>Room number</span><input aria-label={`Room number ${index + 1}`} value={item.room} onChange={(event) => updateItem(item.id, 'room', event.target.value)} placeholder="Room no." /></label>
                  <label className="charge-date-field arrival-field"><span>Arrival date</span><input aria-label={`Arrival date ${index + 1}`} className="table-input date-input" type="date" value={item.arrival} onChange={(event) => updateItem(item.id, 'arrival', event.target.value)} /></label>
                  <label className="charge-date-field departure-field"><span>Departure date</span><input aria-label={`Departure date ${index + 1}`} className="table-input date-input" type="date" value={item.departure} onChange={(event) => updateItem(item.id, 'departure', event.target.value)} /></label>
                  <label className="amount-input-wrap"><span className="amount-prefix">N</span><span className="amount-field-label">Amount (NGN)</span><input aria-label={`Amount ${index + 1}`} className="table-input amount-input" type="number" min="0" step="0.01" value={item.amount} onChange={(event) => updateItem(item.id, 'amount', event.target.value)} placeholder="0.00" /></label>
                  <button type="button" className="icon-button remove-button" aria-label={`Remove line ${index + 1}`} title="Remove line" onClick={() => removeItem(item.id)} disabled={items.length === 1}><Trash2 size={15} /></button>
                </div>
              ))}
              <div className="table-footer"><span>{items.length} charge line{items.length === 1 ? '' : 's'} · {itemsDirty ? 'unsaved' : 'saved'}</span><button type="button" className="quiet-button mobile-add" onClick={addItem}><Plus size={15} /> Add line</button></div>
            </div>

            <div className="section-topline receipt-heading"><span className="step-number">03</span><div><h2 className="section-heading">Receipts &amp; proofs</h2><p className="section-caption">Attach guest order slips or payment evidence</p></div></div>
            <label className="upload-panel">
              <span className="upload-icon"><FilePlus2 size={19} /></span><span className="upload-copy"><strong>Add image attachments</strong><small>JPG, PNG, WebP &amp; more · multiple files supported</small></span><span className="upload-action">Browse files <ChevronDown size={14} /></span>
              <input type="file" accept="image/*" multiple onChange={addReceipts} />
            </label>
            {logoError && <p className="mt-2 text-xs text-red-700" role="alert">Citilodge logo could not be prepared for the PDF. {logoError}</p>}
            {receiptError && <p className="mt-2 text-xs text-red-700" role="alert">{receiptError}</p>}
            {receipts.length > 0 && <div className="attachment-list">{receipts.map((receipt) => <div className="attachment-item" key={receipt.id}><img src={receipt.data} alt="" /><span><FileImage size={14} />{receipt.name}</span><button type="button" className="icon-button" aria-label={`Remove ${receipt.name}`} onClick={() => { setReceipts((current) => current.filter((item) => item.id !== receipt.id)); setReceiptsDirty(true) }}><Trash2 size={14} /></button></div>)}</div>}
            <p className="attachment-note">Images are resized to a maximum of 1,800 px and compressed as JPEGs to reduce PDF size. Each upload must be 10 MB or less.</p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#edf0ed] pt-3">
              <span className="text-[10px] text-[#829087]" role="status">{receiptsDirty ? 'Attachments have unsaved changes.' : 'Attachments saved to preview.'}</span>
              <button type="button" className="save-section-button" onClick={saveReceipts} disabled={!receiptsDirty}>Save receipts</button>
            </div>
          </section>

          <aside className="preview-column" aria-label="Invoice preview and totals">
            <div className="preview-toolbar"><div className="preview-label"><span className="live-dot" /> {hasUnsavedChanges ? 'SAVED PREVIEW · DRAFTS PENDING' : 'SAVED PDF PREVIEW'}</div><span className="paper-size">A4 <span>·</span> PDF</span></div>
            <InvoicePreview pdfUrl={currentPdfUrl} pdfError={currentPdfError} fileName={pdfFileName} />
            <div className="summary-panel">
              <div className="summary-heading"><div><span className="eyebrow">BILLING SUMMARY</span><h2>Amount due</h2></div><CalendarDays size={18} /></div>
              <div className="summary-row"><span>Subtotal</span><strong>{formatNaira(pdfData.totals.subtotal)}</strong></div>
              <div className="summary-row"><span>VAT <small>7.5%</small></span><strong>{formatNaira(pdfData.totals.vat)}</strong></div>
              <div className="summary-row"><span>Service charge <small>10%</small></span><strong>{formatNaira(pdfData.totals.service)}</strong></div>
              <div className="summary-total"><span>Grand total</span><strong>{formatNaira(pdfData.totals.grandTotal)}</strong></div>
              <p className="total-words">{amountInWords(pdfData.totals.grandTotal)}</p>
            </div>
          </aside>
        </div>
        <footer className="app-footer"><span>CITILODGE HOTEL · FINANCE OFFICE</span><span>All totals calculated in Nigerian Naira</span></footer>
      </main>
    </div>
  )
}

export default App
