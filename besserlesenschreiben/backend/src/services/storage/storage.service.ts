import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { BlobServiceClient, ContainerClient, UserDelegationKey } from '@azure/storage-blob';
import type { Env } from '../../config/env';

/**
 * Per-user object storage (SPEC §5). Two backends, chosen by whether AZURE_STORAGE_ACCOUNT is set:
 *   - Azure Blob (prod): authenticated via Managed Identity (DefaultAzureCredential) — no keys in env.
 *     Keys are ALWAYS `users/{account_id}/{profile_id}/…`, derived from the JWT ids, never client input,
 *     so the layout matches the eventual user-delegation SAS scope exactly (security §2).
 *   - Local filesystem (dev): a fake under STORAGE_LOCAL_DIR using the same key layout.
 *
 * Failures are NOT silently swallowed here (the previous "Azure configured → skip write" no-op hid data
 * loss). Storage is honest; callers that can tolerate a miss (e.g. the regenerable digest) wrap the call.
 *
 * NOTE: user-delegation SAS URL minting for homework photos lands with the homework milestone (Phase 2),
 * where it is actually wired and testable.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('StorageService');
  private readonly account: string;
  private readonly container: string;
  private readonly localRoot: string;
  private readonly useAzure: boolean;
  // Filesystem-store image serving (dev / no-Azure): sign short-lived capability tokens for the
  // homework-image endpoint, and know our own public base to build the URL the reviewer's <img> loads.
  private readonly imageSecret: string;
  private readonly publicApiBase: string;
  private blobServicePromise: Promise<BlobServiceClient> | null = null;
  // A user-delegation key is valid for days and signs many SAS tokens — cache it instead of fetching one
  // per blob (the review queue signs up to 50 URLs per page load).
  private udkCache: { value: UserDelegationKey; expiresOn: Date } | null = null;

  constructor(config: ConfigService<Env, true>) {
    this.account = config.get('AZURE_STORAGE_ACCOUNT', { infer: true });
    this.container = config.get('AZURE_STORAGE_CONTAINER', { infer: true });
    this.useAzure = this.account.length > 0;
    this.localRoot = config.get('STORAGE_LOCAL_DIR', { infer: true }) || join(tmpdir(), 'blsb-dev-blob');
    this.imageSecret = config.get('STAFF_JWT_SECRET', { infer: true });
    this.publicApiBase =
      config.get('PUBLIC_API_URL', { infer: true }) ||
      `http://localhost:${config.get('PORT', { infer: true })}/api/v1`;

    if (this.useAzure && !this.container) {
      throw new Error('AZURE_STORAGE_ACCOUNT is set but AZURE_STORAGE_CONTAINER is missing.');
    }
  }

  /** Storage key under the caller's prefix. Ids come from the JWT, never the request (security §2). */
  private keyFor(accountId: string, profileId: string, name: string): string {
    return `users/${accountId}/${profileId}/${name}`;
  }

  /** Lazily build the Azure Blob service client (Managed Identity). Built once; reused across calls. */
  private blobService(): Promise<BlobServiceClient> {
    // `??=` narrows away the null; the cast bridges the package's dual ESM/CJS type declarations
    // (the runtime `await import()` resolves the ESM client, the field uses the CJS one).
    return (this.blobServicePromise ??= (async () => {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const { DefaultAzureCredential } = await import('@azure/identity');
      return new BlobServiceClient(
        `https://${this.account}.blob.core.windows.net`,
        new DefaultAzureCredential(),
      ) as unknown as BlobServiceClient;
    })());
  }

  /** The container client (cheap to derive — no network) off the cached service client. */
  private async azureContainer(): Promise<ContainerClient> {
    const service = await this.blobService();
    return service.getContainerClient(this.container);
  }

  /** A cached user-delegation key valid past `neededUntil`; refetched (with skew) only when stale. */
  private async userDelegationKey(neededUntil: Date): Promise<UserDelegationKey> {
    const SKEW_MS = 5 * 60 * 1000;
    const WINDOW_MS = 6 * 60 * 60 * 1000; // reuse one key for ~6h of signing
    if (this.udkCache && this.udkCache.expiresOn.getTime() - SKEW_MS > neededUntil.getTime()) {
      return this.udkCache.value;
    }
    const now = Date.now();
    const service = await this.blobService();
    const expiresOn = new Date(Math.max(neededUntil.getTime(), now + WINDOW_MS));
    const value = await service.getUserDelegationKey(new Date(now - 60_000), expiresOn);
    this.udkCache = { value, expiresOn };
    return value;
  }

  /** Write a user file. Throws on failure (callers that can tolerate a miss must catch). */
  async writeUserFile(accountId: string, profileId: string, name: string, content: string): Promise<void> {
    const key = this.keyFor(accountId, profileId, name);
    if (this.useAzure) {
      const container = await this.azureContainer();
      const blob = container.getBlockBlobClient(key);
      await blob.upload(content, Buffer.byteLength(content), {
        blobHTTPHeaders: { blobContentType: 'text/markdown; charset=utf-8' },
      });
      this.logger.log({ event: 'storage.write', name }, 'user file written (azure)');
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
    if (this.useAzure) {
      const container = await this.azureContainer();
      await container.getBlockBlobClient(key).upload(content, content.byteLength, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
    } else {
      const path = join(this.localRoot, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }
    this.logger.log({ event: 'storage.write_binary', name }, 'user binary written');
    return key;
  }

  /**
   * Erase every object under an account's prefix (`users/{accountId}/…`) — the blob half of account
   * deletion (SPEC §6; security rule 8: delete removes DB rows AND blobs). The accountId comes from the
   * deleted row, never client input. Idempotent: a missing prefix is a no-op.
   */
  async deleteUserPrefix(accountId: string): Promise<void> {
    const prefix = `users/${accountId}/`;
    if (this.useAzure) {
      const container = await this.azureContainer();
      let deleted = 0;
      for await (const blob of container.listBlobsFlat({ prefix })) {
        await container.getBlockBlobClient(blob.name).deleteIfExists();
        deleted += 1;
      }
      this.logger.log({ event: 'storage.delete_prefix', count: deleted }, 'account blobs erased (azure)');
      return;
    }
    await rm(join(this.localRoot, 'users', accountId), { recursive: true, force: true });
    this.logger.log({ event: 'storage.delete_prefix' }, 'account blobs erased (dev local)');
  }

  /** Read binary content by full key (e.g. for vision analysis), or null if missing. */
  async readBinary(key: string): Promise<Buffer | null> {
    if (this.useAzure) {
      const container = await this.azureContainer();
      try {
        return await container.getBlockBlobClient(key).downloadToBuffer();
      } catch (err) {
        if ((err as { statusCode?: number }).statusCode === 404) return null;
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
    if (this.useAzure) {
      const container = await this.azureContainer();
      const blob = container.getBlockBlobClient(key);
      try {
        const buf = await blob.downloadToBuffer();
        return buf.toString('utf-8');
      } catch (err) {
        if ((err as { statusCode?: number }).statusCode === 404) return null;
        throw err;
      }
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
   * to staff (SPEC §6/§10). In Azure this is a **user-delegation SAS** scoped to that single blob (never a
   * container key, never another child's prefix — security §2). `key` is the full stored key
   * (`users/{account}/{profile}/homework/…`), taken from `homework_upload.image_key`, never client input.
   */
  async signedHomeworkReadUrl(key: string, ttlSeconds: number): Promise<string> {
    if (this.useAzure) {
      const { generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol } =
        await import('@azure/storage-blob');
      const now = new Date();
      const expiresOn = new Date(now.getTime() + ttlSeconds * 1000);
      // User-delegation key is signed by Entra ID (no account key in the app) — the per-blob SAS rule.
      // Cached + reused across the many URLs a queue page signs.
      const udk = await this.userDelegationKey(expiresOn);
      const sas = generateBlobSASQueryParameters(
        {
          containerName: this.container,
          blobName: key,
          permissions: BlobSASPermissions.parse('r'),
          startsOn: new Date(now.getTime() - 60_000),
          expiresOn,
          protocol: SASProtocol.Https,
        },
        udk,
        this.account,
      ).toString();
      return `https://${this.account}.blob.core.windows.net/${this.container}/${encodeURI(key)}?${sas}`;
    }
    // Filesystem store (no Azure): serve the bytes over HTTP from our own signed endpoint. The token is a
    // short-lived capability (SAS-equivalent) so a cross-origin <img> on the reviewer needs no cookie; the
    // bytes come from readBinary(key) on the local blob fake. See StorageController.
    const exp = Date.now() + ttlSeconds * 1000;
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
