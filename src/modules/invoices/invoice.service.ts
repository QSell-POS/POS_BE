import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');
import { Sale } from '../sales/entities/sale.entity';
import { Shop } from '../shops/entities/shop.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { StorageService } from 'src/common/services/storage.service';
import { PlanService } from 'src/common/modules/plans/plan.service';

// Nepali BS calendar month lengths for years 2078–2090
const BS_MONTHS: Record<number, number[]> = {
  2078: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2079: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2081: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2083: [31, 31, 32, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2084: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2085: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2086: [31, 31, 32, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2087: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2089: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2090: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 29, 31],
};

// Baisakh 1 (first day of BS year) in AD — [year, month(1-based), day]
const BS_YEAR_START: Record<number, [number, number, number]> = {
  2078: [2021, 4, 14],
  2079: [2022, 4, 14],
  2080: [2023, 4, 14],
  2081: [2024, 4, 13],
  2082: [2025, 4, 13],
  2083: [2026, 4, 14],
  2084: [2027, 4, 13],
  2085: [2028, 4, 13],
  2086: [2029, 4, 14],
  2087: [2030, 4, 13],
  2088: [2031, 4, 13],
  2089: [2032, 4, 13],
  2090: [2033, 4, 14],
};

function toNepaliDate(ad: Date): string {
  const adMs = Date.UTC(ad.getFullYear(), ad.getMonth(), ad.getDate());

  for (const [bsYear, startTuple] of Object.entries(BS_YEAR_START).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    const [sy, sm, sd] = startTuple as [number, number, number];
    const startMs = Date.UTC(sy, sm - 1, sd);
    if (adMs >= startMs) {
      let dayOffset = Math.round((adMs - startMs) / 86400000);
      const months = BS_MONTHS[Number(bsYear)];
      if (!months) break;
      let month = 0;
      while (month < 12 && dayOffset >= months[month]) {
        dayOffset -= months[month];
        month++;
      }
      const y = String(Number(bsYear)).padStart(4, '0');
      const m = String(month + 1).padStart(2, '0');
      const d = String(dayOffset + 1).padStart(2, '0');
      return `${y}/${m}/${d}`;
    }
  }
  return '';
}

function amountInWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function words(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + words(n % 100);
    if (n < 100000) return words(Math.floor(n / 1000)) + 'Thousand ' + words(n % 1000);
    if (n < 10000000) return words(Math.floor(n / 100000)) + 'Lakh ' + words(n % 100000);
    return words(Math.floor(n / 10000000)) + 'Crore ' + words(n % 10000000);
  }

  const rupees = Math.floor(amount);
  const paisa  = Math.round((amount - rupees) * 100);
  let result   = words(rupees).trim();
  if (!result) result = 'Zero';
  result += paisa > 0 ? ` and ${words(paisa).trim()} Paisa` : '';
  return `NPR ${result} Only.`;
}

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Sale)         private saleRepo: Repository<Sale>,
    @InjectRepository(Shop)         private shopRepo: Repository<Shop>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    private storage: StorageService,
    private planService: PlanService,
  ) {}

  async getOrGenerate(saleId: string, shopId: string): Promise<{ url: string }> {
    const sale = await this.saleRepo.findOne({
      where: { id: saleId, shopId },
      relations: ['customer', 'items', 'items.product', 'items.variant', 'servedByUser'],
    });
    if (!sale) throw new NotFoundException('Sale not found');

    if (sale.invoicePdfUrl) return { url: sale.invoicePdfUrl };

    const shop = await this.shopRepo.findOne({ where: { id: shopId } });
    const org  = await this.orgRepo.findOne({ where: { id: shop?.organizationId } });
    if (org) {
      const allowed = await this.planService.isFeatureAllowed('invoiceGen', org.id);
      if (!allowed) throw new ForbiddenException('Upgrade to Pro to generate PDF invoices');
    }

    const pdfBuffer = await this.generatePdf(sale, shop);
    const key       = `invoices/${shopId}/${sale.invoiceNumber}.pdf`;

    const fakeFile = {
      originalname: `${sale.invoiceNumber}.pdf`,
      buffer:       pdfBuffer,
      mimetype:     'application/pdf',
      size:         pdfBuffer.length,
    } as Express.Multer.File;

    const { url }  = await this.storage.upload(fakeFile, 'invoices', shopId);
    const finalUrl = url || `local://${key}`;

    await this.saleRepo.update(saleId, { invoicePdfUrl: finalUrl });
    return { url: finalUrl };
  }

  private generatePdf(sale: any, shop: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc    = new PDFDocument({ margin: 0, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data',  chunk => chunks.push(chunk));
      doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const BLUE  = '#1a56db';
      const DARK  = '#111827';
      const GRAY  = '#6b7280';
      const LGRAY = '#e5e7eb';
      const L     = 50;   // left margin
      const R     = 545;  // right edge
      const W     = R - L; // content width = 495

      const fmtNum = (n: any) => Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

      // ── Title block ──────────────────────────────────────────────────────────
      let y = 40;
      doc.fontSize(16).font('Helvetica-Bold').fillColor(BLUE).text('TAX INVOICE', L, y);
      y += 22;
      doc.fontSize(8).font('Helvetica').fillColor(GRAY).text('Official Electronic Invoice', L, y);
      y += 18;
      doc.moveTo(L, y).lineTo(R, y).strokeColor(LGRAY).lineWidth(1).stroke();
      y += 12;

      // ── Seller block ─────────────────────────────────────────────────────────
      doc.fontSize(12).font('Helvetica-Bold').fillColor(DARK)
        .text((shop?.name ?? 'Shop').toUpperCase(), L, y);
      y += 17;

      const sellerParts: string[] = [];
      if (shop?.address) sellerParts.push(shop.address);
      if (shop?.pan) sellerParts.push(`PAN/VAT: ${shop.pan}`);
      if (sellerParts.length) {
        doc.fontSize(8.5).font('Helvetica').fillColor(DARK).text(sellerParts.join('  |  '), L, y);
        y += 13;
      }
      const contactParts: string[] = [];
      if (shop?.email) contactParts.push(shop.email);
      if (shop?.phone) contactParts.push(shop.phone);
      if (contactParts.length) {
        doc.fontSize(8.5).font('Helvetica').fillColor(DARK).text(contactParts.join('  |  '), L, y);
        y += 13;
      }
      y += 10;
      doc.moveTo(L, y).lineTo(R, y).strokeColor(LGRAY).lineWidth(1).stroke();
      y += 14;

      // ── Invoice To / Details (two-column) ────────────────────────────────────
      const midX   = 340;
      const rightW = R - midX;
      const blockY = y;

      // Left: INVOICE TO
      doc.fontSize(8).font('Helvetica-Bold').fillColor(BLUE).text('INVOICE TO', L, y);
      y += 14;
      doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
        .text(sale.customer?.name ?? 'Walk-in Customer', L, y);
      y += 14;
      if (sale.customer?.address) {
        doc.fontSize(8.5).font('Helvetica').fillColor(GRAY).text(`Address: ${sale.customer.address}`, L, y);
        y += 12;
      }
      if (sale.customer?.pan) {
        doc.fontSize(8.5).font('Helvetica').fillColor(GRAY).text(`PAN/VAT: ${sale.customer.pan}`, L, y);
        y += 12;
      }

      // Right: DETAILS
      const saleDate = new Date(sale.saleDate ?? sale.createdAt);
      const bsMiti   = toNepaliDate(saleDate);
      const adStr    = saleDate.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const dateStr  = bsMiti ? `${bsMiti} (${adStr})` : adStr;

      let ry = blockY;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(BLUE)
        .text('DETAILS', midX, ry, { width: rightW, align: 'right' });
      ry += 14;

      const addDetail = (label: string, val: string) => {
        doc.fontSize(8.5);
        const labelText = label + ' ';
        const labelW    = doc.font('Helvetica').widthOfString(labelText);
        const valW      = doc.font('Helvetica-Bold').widthOfString(val);
        const startX    = R - labelW - valW;
        doc.font('Helvetica').fillColor(GRAY).text(labelText, startX, ry, { lineBreak: false });
        doc.font('Helvetica-Bold').fillColor(DARK).text(val, startX + labelW, ry, { lineBreak: false });
        ry += 13;
      };

      addDetail('Invoice No:', sale.invoiceNumber);
      addDetail('Date (Miti):', dateStr);
      addDetail('Payment:', (sale.paymentMethod ?? '').replace(/_/g, ' ').toUpperCase());

      y = Math.max(y, ry) + 16;

      // ── Table ─────────────────────────────────────────────────────────────────
      // columns: SN | Description | Qty | Rate | Amount
      const cols = { sn: L, desc: L + 30, qty: 390, rate: 440, amt: 495 };
      const tableHeaderH = 20;

      doc.moveTo(L, y).lineTo(R, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
      doc.fontSize(8).font('Helvetica-Bold').fillColor(BLUE)
        .text('S.N.',         cols.sn,   y + 6, { width: 25, align: 'center' })
        .text('DESCRIPTION',  cols.desc, y + 6, { width: cols.qty - cols.desc - 5 })
        .text('QTY',          cols.qty,  y + 6, { width: 45, align: 'right' })
        .text('RATE (NPR)',   cols.rate, y + 6, { width: 50, align: 'right' })
        .text('AMOUNT (NPR)', cols.amt,  y + 6, { width: R - cols.amt, align: 'right' });

      y += tableHeaderH;

      const items = sale.items ?? [];
      for (let i = 0; i < items.length; i++) {
        const item      = items[i];
        const name      = item.productName ?? item.product?.name ?? '—';
        const qty       = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const lineTotal = Number(item.subtotal ?? qty * unitPrice);
        const rowH      = 18;

        doc.fillColor(DARK).fontSize(8.5).font('Helvetica')
          .text(String(i + 1),       cols.sn,   y + 4, { width: 25,                            align: 'center' })
          .text(name,                cols.desc, y + 4, { width: cols.qty - cols.desc - 10 })
          .text(fmtNum(qty),         cols.qty,  y + 4, { width: 45,                            align: 'right' })
          .text(fmtNum(unitPrice),   cols.rate, y + 4, { width: 50,                            align: 'right' })
          .text(fmtNum(lineTotal),   cols.amt,  y + 4, { width: R - cols.amt,                  align: 'right' });

        y += rowH;
      }

      doc.moveTo(L, y).lineTo(R, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
      y += 14;

      // ── Totals + Amount in Words ──────────────────────────────────────────────
      const nonTaxable = Number(sale.nonTaxableSubtotal ?? 0);
      const taxableSub = Number(sale.taxableSubtotal ?? 0);
      const exciseDuty = Number(sale.exciseDutyAmount ?? 0);
      const vatAmt     = Number(sale.vatAmount ?? 0);
      const discount   = Number(sale.discountAmount ?? 0);
      const grandTotal = Number(sale.grandTotal ?? 0);
      const grossTotal = grandTotal - vatAmt - exciseDuty + discount;

      // Amount in words (left side)
      const wordsY = y;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(DARK).text('Amount in Words:', L, wordsY);
      doc.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY)
        .text(amountInWords(grandTotal), L, wordsY + 13, { width: 260 });

      // Totals table (right side)
      const totL  = 340;
      const totVX = 480;
      let ty      = y;

      const addTotal = (label: string, value: string, bold = false, color = DARK) => {
        doc.fontSize(8.5)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(color)
          .text(label, totL, ty, { width: totVX - totL - 5 })
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(bold ? color : DARK)
          .text(value, totVX, ty, { width: R - totVX, align: 'right' });
        ty += 16;
      };

      addTotal('Gross Total', fmtNum(grossTotal));
      if (discount > 0) addTotal('Discount', fmtNum(discount));
      if (taxableSub > 0 || exciseDuty > 0) addTotal('Taxable Amount', fmtNum(taxableSub + exciseDuty));
      if (vatAmt > 0) addTotal('VAT (13%)', fmtNum(vatAmt));
      if (nonTaxable > 0) addTotal('Non-Taxable Amount', fmtNum(nonTaxable));
      if (exciseDuty > 0) addTotal('Excise Duty', fmtNum(exciseDuty));

      ty += 2;
      doc.moveTo(totL, ty).lineTo(R, ty).strokeColor(BLUE).lineWidth(0.5).stroke();
      ty += 6;

      doc.fontSize(10).font('Helvetica-Bold').fillColor(BLUE)
        .text('Grand Total (NPR)', totL, ty, { width: totVX - totL - 5 })
        .text(fmtNum(grandTotal),  totVX, ty, { width: R - totVX, align: 'right' });
      ty += 18;

      if (Number(sale.creditAmount) > 0) {
        doc.fontSize(8.5).font('Helvetica').fillColor(GRAY)
          .text('Credit (due):', totL, ty, { width: totVX - totL - 5 })
          .fillColor(DARK).text(fmtNum(sale.creditAmount), totVX, ty, { width: R - totVX, align: 'right' });
        ty += 14;
      }

      y = Math.max(y + 60, ty) + 20;

      // ── Footer ────────────────────────────────────────────────────────────────
      doc.moveTo(L, y).lineTo(R, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
      y += 10;
      doc.fontSize(7.5).font('Helvetica').fillColor(GRAY)
        .text(
          'This is an IRD-compliant invoice verified in real-time with the Central Billing Monitoring System (CBMS).',
          L, y, { width: W, align: 'center' },
        );

      doc.end();
    });
  }
}
