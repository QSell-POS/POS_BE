import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/guards/auth.guard';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get(':saleId')
  getOrGenerate(
    @Param('saleId') saleId: string,
    @CurrentUser() user: any,
  ) {
    return this.invoiceService.getOrGenerate(saleId, user.shopId);
  }
}
