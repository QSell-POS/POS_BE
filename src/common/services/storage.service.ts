import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Shop } from 'src/modules/shops/entities/shop.entity';

export type StorageFolder =
  | 'products'
  | 'avatars'
  | 'invoices'
  | 'attachments'
  | 'imports';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly configured: boolean;
  private readonly slugCache = new Map<string, { slug: string; expiresAt: number }>();
  private readonly SLUG_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private config: ConfigService,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
  ) {
    const accountId       = config.get<string>('storage.accountId');
    const accessKeyId     = config.get<string>('storage.accessKeyId');
    const secretAccessKey = config.get<string>('storage.secretAccessKey');
    this.bucket           = config.get<string>('storage.bucket') || '';
    this.publicUrl        = config.get<string>('storage.publicUrl') || '';

    this.configured = !!(accountId && accessKeyId && secretAccessKey && this.bucket);

    if (this.configured) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn('R2 storage not configured — uploads will be skipped');
    }
  }

  // ── Upload a file buffer ───────────────────────────────────────────────────

  async upload(
    file: Express.Multer.File,
    folder: StorageFolder,
    shopId?: string,
  ): Promise<{ key: string; url: string }> {
    const ext = extname(file.originalname).toLowerCase();
    const shopSlug = await this.resolveShopSlug(shopId);
    const key = this.buildKey(folder, file.originalname, ext, shopSlug);

    if (!this.configured) {
      this.logger.log(`[STORAGE SKIPPED] Would upload: ${key}`);
      return { key, url: '' };
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    return { key, url: this.getPublicUrl(key) };
  }

  // ── Delete a file by key ───────────────────────────────────────────────────

  async delete(key: string): Promise<void> {
    if (!this.configured || !key) return;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  // ── Generate a pre-signed URL (for private files like invoices) ───────────

  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (!this.configured) return '';
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  // ── Public URL (for public buckets / CDN) ─────────────────────────────────

  getPublicUrl(key: string): string {
    if (!this.publicUrl || !key) return '';
    const base = this.publicUrl.replace(/\/$/, '');
    const withScheme = base.startsWith('http') ? base : `https://${base}`;
    return `${withScheme}/${key}`;
  }

  // ── Resolve a stored path/key to a full URL ───────────────────────────────
  // Accepts a storage key (path) OR a legacy full URL.
  // Always returns a fully-qualified https:// URL, or null if empty.
  resolveUrl(pathOrUrl: string | null | undefined): string | null {
    if (!pathOrUrl) return null;
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
    if (!pathOrUrl.startsWith('/') && pathOrUrl.includes('.') && pathOrUrl.indexOf('/') > 0) {
      return `${process.env.R2_PUBLIC_URL}/${pathOrUrl}`;
    }
    return this.getPublicUrl(pathOrUrl);
  }

  // ── Key builder ───────────────────────────────────────────────────────────

  private buildKey(folder: StorageFolder, originalName: string, ext = '', shopSlug?: string): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', 'T').slice(0, 15);
    const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const prefix = shopSlug ? `${shopSlug}/${folder}` : folder;
    return `${prefix}/${timestamp}-${baseName}${ext}`;
  }

  private async resolveShopSlug(shopId?: string): Promise<string | undefined> {
    if (!shopId) return undefined;
    const cached = this.slugCache.get(shopId);
    if (cached && cached.expiresAt > Date.now()) return cached.slug;
    try {
      const shop = await this.shops.findOne({ where: { id: shopId }, select: ['id', 'slug'] });
      if (shop?.slug) {
        this.slugCache.set(shopId, { slug: shop.slug, expiresAt: Date.now() + this.SLUG_CACHE_TTL_MS });
        return shop.slug;
      }
    } catch (err) {
      this.logger.warn(`Failed to resolve shop slug for ${shopId}: ${(err as Error).message}`);
    }
    return shopId;
  }
}
