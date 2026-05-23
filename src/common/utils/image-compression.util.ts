import { Logger } from '@nestjs/common';
import sharp from 'sharp';

const logger = new Logger('ImageCompression');

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function compressImage(
  file: Express.Multer.File,
  opts: CompressOptions = {},
): Promise<Express.Multer.File> {
  if (!file?.buffer || !IMAGE_MIMES.has(file.mimetype)) return file;

  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 80,
    format = 'webp',
  } = opts;

  try {
    const pipeline = sharp(file.buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });

    let buffer: Buffer;
    let mimetype: string;
    let ext: string;

    if (format === 'webp') {
      buffer = await pipeline.webp({ quality }).toBuffer();
      mimetype = 'image/webp';
      ext = '.webp';
    } else if (format === 'png') {
      buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      mimetype = 'image/png';
      ext = '.png';
    } else {
      buffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      mimetype = 'image/jpeg';
      ext = '.jpg';
    }

    if (buffer.length >= file.size) {
      logger.log(`Compression skipped (no gain): ${file.originalname} ${file.size}b`);
      return file;
    }

    const newName = file.originalname.replace(/\.[^/.]+$/, '') + ext;
    logger.log(
      `Compressed ${file.originalname}: ${(file.size / 1024).toFixed(0)}KB -> ${(buffer.length / 1024).toFixed(0)}KB`,
    );

    return {
      ...file,
      buffer,
      size: buffer.length,
      mimetype,
      originalname: newName,
    };
  } catch (err) {
    logger.warn(`Image compression failed, using original: ${(err as Error).message}`);
    return file;
  }
}
