import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../../config/env';

/**
 * Per-user object storage (SPEC §5). Two backends, chosen by whether AWS_S3_BUCKET is set:
 *   - S3 (prod): authenticated via the default AWS credential chain (IAM role on the instance) — no keys
 *     in env. Keys are ALWAYS `users/{account_id}/{profile_id}/…`, derived from the JWT ids, never client
 *     input, so the layout matches the presigned-URL scope exactly (security §2).
 *   - Local filesystem (dev): a fake under STORAGE_LOCAL_DIR using the same key layout.
 *
 * Failures are NOT silently swallowed here (a "storage configured → skip write" no-op hides data loss).
 * Storage is honest; callers that can tolerate a miss (e.g. the regenerable digest) wrap the call.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('StorageService');
  private readonly bucket: string;
  private readonly region: string;
  private readonly localRoot: string;
  private readonly useS3: boolean;
  // Filesystem-store image serving (dev / no-S3): sign short-lived capability tokens for the
  // homework-image endpoint, and know our own public base to build the URL the reviewer's <img> loads.
  private readonly imageSecret: string;
  private readonly publicApiBase: string;
  private s3ClientPromise: Promise<S3Client> | null = null;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get('AWS_S3_BUCKET', { infer: true });
    this.region = config.get('AWS_REGION', { infer: true });
    this.useS3 = this.bucket.length > 0;
    this.localRoot = config.get('STORAGE_LOCAL_DIR', { infer: true }) || join(tmpdir(), 'blsb-dev-blob');
    this.imageSecret = config.get('STAFF_JWT_SECRET', { infer: true });
    this.publicApiBase =
      config.get('PUBLIC_API_URL', { infer: true }) ||
      `http://localhost:${config.get('PORT', { infer: true })}/api/v1`;
  }

  /** Storage key under the caller's prefix. Ids come from the JWT, never the request (security §2). */
  private keyFor(accountId: string, profileId: string, name: string): string {
    return `users/${accountId}/${profileId}/${name}`;
  }

  /** Lazily build the S3 client (default credential chain — IAM role in prod). Built once; reused. */
  private s3(): Promise<S3Client> {
    return (this.s3ClientPromise ??= (async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      return new S3Client({ region: this.region });
    })());
  }

  /** Write a user file. Throws on failure (callers that can tolerate a miss must catch). */
  async writeUserFile(accountId: string, profileId: string, name: string, content: string): Promise<void> {
    const key = this.keyFor(accountId, profileId, name);
    if (this.useS3) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await (await this.s3()).send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: content,
          ContentType: 'text/markdown; charset=utf-8',
        }),
      );
      this.logger.log({ event: 'storage.write', name }, 'user file written (s3)');
      return;
    }
    const path = join(this.localRoot, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf-8');
    this.logger.log({ event: 'storage.write', name }, 'user file written (dev local)');
  }

  /**
   * Write binary content (e.g. a transcoded homework WebP) under the caller's prefix and return the full
   * storage key (stored on the row; never the raw path/URL). Ids come from the JWT (security §2).
   */
  async writeUserBinary(
    accountId: string,
    profileId: string,
    name: string,
    content: Buffer,
    contentType: string,
  ): Promise<string> {
    const key = this.keyFor(accountId, profileId, name);
    if (this.useS3) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await (await this.s3()).send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content, ContentType: contentType }),
      );
    } else {
      const path = join(this.localRoot, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }
    this.logger.log({ event: 'storage.write_binary', name }, 'user binary written');
    return key;
  }

  /**
   * Erase every object under an account's prefix (`users/{accountId}/…`) — the object-storage half of
   * account deletion (SPEC §6; security rule 8: delete removes DB rows AND stored objects). The accountId
   * comes from the deleted row, never client input. Idempotent: a missing prefix is a no-op.
   */
  async deleteUserPrefix(accountId: string): Promise<void> {
    const count = await this.deletePrefix(`users/${accountId}/`);
    this.logger.log({ event: 'storage.delete_prefix', count }, 'account objects erased');
  }

  /**
   * Erase one child's homework photos (`users/{accountId}/{profileId}/homework/`) — the object-storage
   * half of the parent "delete chat" action (a full chat wipe removes the uploaded images too). Ids come
   * from the caller (JWT + ownership check), never client input; the profile's other objects (e.g.
   * digest.md, which reflects preserved learning progress) are left intact. Idempotent.
   */
  async deleteProfileHomework(accountId: string, profileId: string): Promise<void> {
    const count = await this.deletePrefix(`users/${accountId}/${profileId}/homework/`);
    this.logger.log({ event: 'storage.delete_homework', count }, 'profile homework objects erased');
  }

  /** Delete every object under a key prefix (S3 paginated / local recursive). Idempotent; returns the S3 count. */
  private async deletePrefix(prefix: string): Promise<number> {
    if (this.useS3) {
      const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
      const s3 = await this.s3();
      let deleted = 0;
      let continuationToken: string | undefined;
      do {
        const page = await s3.send(
          new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken }),
        );
        const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (keys.length > 0) {
          await s3.send(
            new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }),
          );
          deleted += keys.length;
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);
      return deleted;
    }
    await rm(join(this.localRoot, prefix), { recursive: true, force: true });
    return 0;
  }

  /** Read binary content by full key (e.g. for vision analysis), or null if missing. */
  async readBinary(key: string): Promise<Buffer | null> {
    if (this.useS3) {
      const { GetObjectCommand, NoSuchKey } = await import('@aws-sdk/client-s3');
      try {
        const res = await (await this.s3()).send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        const bytes = await res.Body?.transformToByteArray();
        return bytes ? Buffer.from(bytes) : null;
      } catch (err) {
        if (err instanceof NoSuchKey || (err as { name?: string }).name === 'NoSuchKey') return null;
        throw err;
      }
    }
    try {
      return await readFile(join(this.localRoot, key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /** Read a user file, or null if it does not exist. Other errors propagate. */
  async readUserFile(accountId: string, profileId: string, name: string): Promise<string | null> {
    const key = this.keyFor(accountId, profileId, name);
    if (this.useS3) {
      const buf = await this.readBinary(key);
      return buf ? buf.toString('utf-8') : null;
    }
    try {
      return await readFile(join(this.localRoot, key), 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * A short-lived, read-only URL for one stored object (a homework photo) — what the reviewer queue hands
   * to staff (SPEC §6/§10). On S3 this is a **presigned GET** scoped to that single object key (never a
   * bucket credential, never another child's prefix — security §2). `key` is the full stored key
   * (`users/{account}/{profile}/homework/…`), taken from `homework_upload.image_key`, never client input.
   */
  async signedHomeworkReadUrl(key: string, ttlSeconds: number, opts?: { stable?: boolean }): Promise<string> {
    // `stable`: align the signing date/expiry to a fixed `ttlSeconds` grid so repeated calls return an
    // IDENTICAL URL within the window — the browser can then cache the image instead of re-downloading it
    // every render (the family chat re-fetches history often). Effective TTL is up to 2× the window; fine
    // for a caller's own image, so the reviewer queue leaves it off (short, per-request URLs).
    const windowMs = ttlSeconds * 1000;
    const nowMs = Date.now();
    const startMs = (opts?.stable ? Math.floor(nowMs / windowMs) * windowMs : nowMs) - 60_000;
    const expMs = opts?.stable ? Math.ceil((nowMs + windowMs) / windowMs) * windowMs : nowMs + windowMs;
    if (this.useS3) {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      // A fixed signingDate + expiresIn makes the presigned URL deterministic within the stable window.
      return getSignedUrl(await this.s3(), new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
        signingDate: new Date(startMs),
        expiresIn: Math.ceil((expMs - startMs) / 1000),
      });
    }
    // Filesystem store (no S3): serve the bytes over HTTP from our own signed endpoint. The token is a
    // short-lived capability (presigned-URL equivalent) so a cross-origin <img> on the reviewer needs no
    // cookie; the bytes come from readBinary(key) on the local store. See StorageController.
    const exp = expMs;
    const payload = Buffer.from(JSON.stringify({ k: key, e: exp })).toString('base64url');
    const token = `${payload}.${this.signImageToken(payload)}`;
    return `${this.publicApiBase}/storage/homework-image?token=${encodeURIComponent(token)}`;
  }

  private signImageToken(payload: string): string {
    return createHmac('sha256', this.imageSecret).update(payload).digest('base64url');
  }

  /**
   * Verify a homework-image capability token → the stored key it authorises, or null if the signature is
   * wrong or it has expired. Used by StorageController to gate filesystem-store image reads.
   */
  verifyHomeworkImageToken(token: string): string | null {
    const dot = token.indexOf('.');
    if (dot < 0) return null;
    const payload = token.slice(0, dot);
    const sig = Buffer.from(token.slice(dot + 1));
    const expected = Buffer.from(this.signImageToken(payload));
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
    try {
      const { k, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
        k: unknown;
        e: unknown;
      };
      if (typeof k !== 'string' || typeof e !== 'number' || Date.now() > e) return null;
      return k;
    } catch {
      return null;
    }
  }
}
