import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { extname, join, relative, resolve, sep } from 'path';
import { randomUUID } from 'crypto';
import {
  IMAGE_EXTENSION_BY_MIME,
  IMAGE_MIME_BY_EXTENSION,
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MIME_PATTERN,
} from '../constants/upload-dirs.constant';

@Injectable()
export class ImageStorageService {
  private readonly publicRoot = resolve(process.cwd(), 'public');

  async save(
    file: Express.Multer.File,
    relativeDir: string,
  ): Promise<string> {
    const normalizedDir = relativeDir.replace(/^\/+|\/+$/g, '');
    const absoluteDir = this.resolveInsidePublic(normalizedDir);

    await mkdir(absoluteDir, { recursive: true });

    const extension = this.resolveExtension(file);
    const filename = `${randomUUID()}${extension}`;
    const absolutePath = join(absoluteDir, filename);

    await writeFile(absolutePath, file.buffer);

    return `${normalizedDir}/${filename}`.replace(/\\/g, '/');
  }

  async deleteIfExists(relativePath: string | null | undefined): Promise<void> {
    if (!relativePath) {
      return;
    }

    let absolutePath: string;

    try {
      absolutePath = this.resolveInsidePublic(relativePath);
    } catch {
      return;
    }

    try {
      await unlink(absolutePath);
    } catch {
      // Ignore missing files to avoid blocking domain updates.
    }
  }

  resolvePublicPath(relativePath: string): string {
    return this.resolveInsidePublic(relativePath);
  }

  assertUploadedImage(file: Express.Multer.File, field: string): void {
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
      throw new BadRequestException(`${field} exceeds the 5MB limit`);
    }

    if (!IMAGE_UPLOAD_MIME_PATTERN.test(file.mimetype)) {
      throw new BadRequestException(
        `${field} must be a jpeg, png, webp, or gif image`,
      );
    }
  }

  async readPublicFileAsDataUrl(
    relativePath: string,
  ): Promise<string | null> {
    let absolutePath: string;

    try {
      absolutePath = this.resolveInsidePublic(relativePath);
    } catch {
      return null;
    }

    try {
      const buffer = await readFile(absolutePath);
      const mimeType =
        this.mimeFromExtension(extname(absolutePath)) ??
        this.detectImageMime(buffer);

      return this.toDataUrl(mimeType, buffer);
    } catch {
      return null;
    }
  }

  bytesToDataUrl(
    bytes: Uint8Array | Buffer | null | undefined,
  ): string | null {
    if (!bytes || bytes.length === 0) {
      return null;
    }

    const buffer = Buffer.from(bytes);
    return this.toDataUrl(this.detectImageMime(buffer), buffer);
  }

  mimeFromExtension(extension: string): string | null {
    return IMAGE_MIME_BY_EXTENSION[extension.toLowerCase()] ?? null;
  }

  detectImageMime(buffer: Buffer): string {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return 'image/jpeg';
    }

    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }

    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }

    if (buffer.length >= 6 && buffer.toString('ascii', 0, 6).startsWith('GIF')) {
      return 'image/gif';
    }

    return 'image/png';
  }

  toDataUrl(mimeType: string, buffer: Buffer): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  private resolveInsidePublic(relativePath: string): string {
    const normalized = relativePath.replace(/^[/\\]+/, '');
    const absolutePath = resolve(this.publicRoot, normalized);
    const relativeToRoot = relative(this.publicRoot, absolutePath);

    if (
      relativeToRoot.length === 0 ||
      relativeToRoot.startsWith(`..${sep}`) ||
      relativeToRoot === '..' ||
      relativeToRoot.includes(`..${sep}`)
    ) {
      throw new BadRequestException('Invalid storage path');
    }

    return absolutePath;
  }

  private resolveExtension(file: Express.Multer.File): string {
    const fromOriginal = extname(file.originalname).toLowerCase();

    if (fromOriginal) {
      return fromOriginal;
    }

    return IMAGE_EXTENSION_BY_MIME[file.mimetype] ?? '.jpg';
  }
}
