import {
  Controller, Post, Delete, Param,
  UseInterceptors, UploadedFile,
  BadRequestException, UseGuards, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard, RolesGuard, CurrentUser, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { StorageService } from 'src/common/services/storage.service';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_ALL_MIMES   = [...ALLOWED_IMAGE_MIMES, 'application/pdf'];

const multerOptions = (allowedMimes: string[], maxMb = 10) => ({
  storage: memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new BadRequestException(`File type not allowed. Allowed: ${allowedMimes.join(', ')}`), false);
    }
    cb(null, true);
  },
});

@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly storage: StorageService) {}

  // ── Product image ─────────────────────────────────────────────────────────

  @Post('product-image')
  @Permissions(Permission.PRODUCTS_CREATE, Permission.PRODUCTS_UPDATE)
  @ApiOperation({ summary: 'Upload a product image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', multerOptions(ALLOWED_IMAGE_MIMES)))
  async uploadProductImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const result = await this.storage.upload(file, 'products');
    return { data: result, message: 'Product image uploaded' };
  }

  // ── Avatar (staff / customer / supplier / user profile) ──────────────────

  @Post('avatar')
  @ApiOperation({ summary: 'Upload a profile picture (staff, customer, supplier, user)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', multerOptions(ALLOWED_IMAGE_MIMES, 5)))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const result = await this.storage.upload(file, 'avatars');
    return { data: result, message: 'Avatar uploaded' };
  }

  // ── Invoice / PDF ─────────────────────────────────────────────────────────

  @Post('invoice')
  @Permissions(Permission.SALES_VIEW)
  @ApiOperation({ summary: 'Upload an invoice PDF — returns a 1-hour pre-signed URL' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', multerOptions(['application/pdf'])))
  async uploadInvoice(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const result = await this.storage.upload(file, 'invoices');
    const url = await this.storage.getPresignedUrl(result.key, 3600);
    return { data: { ...result, url }, message: 'Invoice uploaded' };
  }

  // ── General attachment (purchase bills, expense receipts) ─────────────────

  @Post('attachment')
  @Permissions(Permission.PURCHASES_CREATE, Permission.EXPENSES_CREATE)
  @ApiOperation({ summary: 'Upload a document attachment (bill, receipt, etc.)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', multerOptions(ALLOWED_ALL_MIMES)))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const result = await this.storage.upload(file, 'attachments');
    return { data: result, message: 'Attachment uploaded' };
  }

  // ── Delete by key ─────────────────────────────────────────────────────────

  @Delete()
  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Delete a file from R2 by its storage key' })
  @ApiQuery({ name: 'key', description: 'Storage key returned on upload' })
  async deleteFile(@Query('key') key: string) {
    if (!key) throw new BadRequestException('key is required');
    await this.storage.delete(key);
    return { message: 'File deleted' };
  }
}
