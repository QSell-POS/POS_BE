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

    // Return cached URL if already generated
    if (sale.invoicePdfUrl) return { url: sale.invoicePdfUrl };

    // Check plan permission
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

    const { url } = await this.storage.upload(fakeFile, 'invoices', shopId);

    // Fallback URL if R2 not configured (dev mode)
    const finalUrl = url || `local://${key}`;

    await this.saleRepo.update(saleId, { invoicePdfUrl: finalUrl });
    return { url: finalUrl };
  }

  private generatePdf(sale: any, shop: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc    = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data',  chunk => chunks.push(chunk));
      doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const currency = shop?.currencySymbol ?? 'Rs.';
      const fmt      = (n: any) => `${currency} ${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      // ── Header ───────────────────────────────────────────────────────────────
      doc.fontSize(20).font('Helvetica-Bold').text(shop?.name ?? 'Invoice', { align: 'center' });
      if (shop?.address) doc.fontSize(9).font('Helvetica').text(shop.address, { align: 'center' });
      if (shop?.phone)   doc.fontSize(9).text(`Phone: ${shop.phone}`, { align: 'center' });
      if (shop?.email)   doc.fontSize(9).text(`Email: ${shop.email}`, { align: 'center' });
      if (shop?.pan)     doc.fontSize(9).font('Helvetica-Bold').text(`PAN: ${shop.pan}`, { align: 'center' });

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // ── Invoice meta ─────────────────────────────────────────────────────────
      const leftX  = 50;
      const rightX = 350;
      const metaY  = doc.y;

      doc.fontSize(9).font('Helvetica-Bold').text('INVOICE', leftX, metaY);
      doc.fontSize(9).font('Helvetica')
        .text(`Invoice #: ${sale.invoiceNumber}`, leftX, metaY + 14)
        .text(`Date: ${new Date(sale.saleDate ?? sale.createdAt).toLocaleDateString('en-IN')}`, leftX, metaY + 26)
        .text(`Cashier: ${sale.servedByUser ? `${sale.servedByUser.firstName ?? ''} ${sale.servedByUser.lastName ?? ''}`.trim() : '—'}`, leftX, metaY + 38);

      if (sale.customer) {
        doc.fontSize(9).font('Helvetica-Bold').text('BILL TO', rightX, metaY);
        doc.fontSize(9).font('Helvetica')
          .text(sale.customer.name, rightX, metaY + 14);
        if (sale.customer.phone) doc.text(`Phone: ${sale.customer.phone}`, rightX, metaY + 26);
        if (sale.customer.address) doc.text(sale.customer.address, rightX, metaY + 38);
      }

      doc.moveDown(4);

      // ── Items table header ────────────────────────────────────────────────────
      const tableTop = doc.y + 10;
      const cols     = { item: 50, sku: 230, qty: 310, price: 370, total: 460 };

      doc.rect(50, tableTop, 495, 18).fill('#f3f4f6');
      doc.fillColor('#000').fontSize(8).font('Helvetica-Bold')
        .text('Product',    cols.item,  tableTop + 5)
        .text('SKU',        cols.sku,   tableTop + 5)
        .text('Qty',        cols.qty,   tableTop + 5)
        .text('Unit Price', cols.price, tableTop + 5)
        .text('Total',      cols.total, tableTop + 5);

      // ── Items rows ────────────────────────────────────────────────────────────
      let rowY = tableTop + 20;
      const items = sale.items ?? [];

      for (let i = 0; i < items.length; i++) {
        const item       = items[i];
        const name       = item.productName ?? item.product?.name ?? '—';
        const sku        = item.productSku  ?? item.variant?.sku  ?? '—';
        const qty        = Number(item.quantity);
        const unitPrice  = Number(item.unitPrice);
        const lineTotal  = Number(item.subtotal ?? qty * unitPrice);

        if (i % 2 === 0) doc.rect(50, rowY - 3, 495, 16).fill('#fafafa');
        doc.fillColor('#000').fontSize(8).font('Helvetica')
          .text(name.slice(0, 30),        cols.item,  rowY, { width: 175 })
          .text(sku,                      cols.sku,   rowY)
          .text(qty.toString(),           cols.qty,   rowY)
          .text(fmt(unitPrice),           cols.price, rowY)
          .text(fmt(lineTotal),           cols.total, rowY);

        rowY += 18;
      }

      doc.moveTo(50, rowY).lineTo(545, rowY).stroke();
      rowY += 10;

      // ── Totals ────────────────────────────────────────────────────────────────
      const totalsX = 370;
      const addRow  = (label: string, value: string, bold = false) => {
        doc.fontSize(9)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(label, totalsX, rowY)
          .text(value, cols.total, rowY);
        rowY += 16;
      };

      const nonTaxable = Number(sale.nonTaxableSubtotal ?? 0);
      const taxableSub = Number(sale.taxableSubtotal ?? 0);
      const exciseDuty = Number(sale.exciseDutyAmount ?? 0);
      const vatAmt     = Number(sale.vatAmount ?? 0);

      if (nonTaxable > 0 || taxableSub > 0) {
        if (nonTaxable > 0) addRow('Non-Taxable Amount:', fmt(nonTaxable));
        if (taxableSub > 0) addRow('Taxable Amount:', fmt(taxableSub));
        if (exciseDuty > 0) addRow('Excise Duty:', fmt(exciseDuty));
        if (taxableSub > 0 || exciseDuty > 0) addRow('Total Taxable (Excl. VAT):', fmt(taxableSub + exciseDuty));
        if (vatAmt > 0) addRow('VAT (13%):', fmt(vatAmt));
      } else {
        addRow('Subtotal:', fmt(sale.subtotal));
        if (Number(sale.taxAmount) > 0) addRow('Tax:', fmt(sale.taxAmount));
      }

      if (Number(sale.discountAmount) > 0) addRow('Discount:', `-${fmt(sale.discountAmount)}`);
      addRow('Grand Total:', fmt(sale.grandTotal), true);
      if (Number(sale.creditAmount) > 0) addRow('Credit (due):', fmt(sale.creditAmount));
      addRow('Payment Method:', (sale.paymentMethod ?? '').toUpperCase());

      if (shop?.pan) {
        rowY += 4;
        doc.fontSize(8).font('Helvetica').text(`Seller PAN: ${shop.pan}`, totalsX, rowY);
        rowY += 14;
      }
      if (sale.customer?.pan) {
        doc.fontSize(8).font('Helvetica').text(`Buyer PAN: ${sale.customer.pan}`, totalsX, rowY);
        rowY += 14;
      }

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // ── Footer ────────────────────────────────────────────────────────────────
      doc.fontSize(8).font('Helvetica').fillColor('#888')
        .text('Thank you for your purchase!', { align: 'center' });

      doc.end();
    });
  }
}
