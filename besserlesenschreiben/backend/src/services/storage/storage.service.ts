import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ContainerClient } from '@azure/storage-blob';
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
  private containerClientPromise: Promise<ContainerClient> | null = null;

  constructor(config: ConfigService<Env, true>) {
    this.account = config.get('AZURE_STORAGE_ACCOUNT', { infer: true });
    this.container = config.get('AZURE_STORAGE_CONTAINER', { infer: true });
    this.useAzure = this.account.length > 0;
    this.localRoot = config.get('STORAGE_LOCAL_DIR', { infer: true }) || join(tmpdir(), 'blsb-dev-blob');

    if (this.useAzure && !this.container) {
      throw new Error('AZURE_STORAGE_ACCOUNT is set but AZURE_STORAGE_CONTAINER is missing.');
    }
  }

  /** Storage key under the caller's prefix. Ids come from the JWT, never the request (security §2). */
  private keyFor(accountId: string, profileId: string, name: string): string {
    return `users/${accountId}/${profileId}/${name}`;
  }

  /** Lazily build the Azure container client (Managed Identity). Built once; reused across calls. */
  private azureContainer(): Promise<ContainerClient> {
    // `??=` narrows away the null; the cast bridges the package's dual ESM/CJS type declarations
    // (the runtime `await import()` resolves the ESM ContainerClient, the field uses the CJS one).
    return (this.containerClientPromise ??= (async () => {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const { DefaultAzureCredential } = await import('@azure/identity');
      const service = new BlobServiceClient(
        `https://${this.account}.blob.core.windows.net`,
        new DefaultAzureCredential(),
      );
      return service.getContainerClient(this.container) as unknown as ContainerClient;
    })());
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
      const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol } =
        await import('@azure/storage-blob');
      const { DefaultAzureCredential } = await import('@azure/identity');
      const service = new BlobServiceClient(
        `https://${this.account}.blob.core.windows.net`,
        new DefaultAzureCredential(),
      );
      const now = new Date();
      const expiresOn = new Date(now.getTime() + ttlSeconds * 1000);
      // User-delegation key is signed by Entra ID (no account key in the app) — the per-blob SAS rule.
      const udk = await service.getUserDelegationKey(new Date(now.getTime() - 60_000), expiresOn);
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
    // Dev (no Blob): there is no real object store and no homework-upload pipeline yet, so the queue is
    // empty in practice. Return a stable dev placeholder URL; local image serving lands with the homework
    // upload milestone (Phase 2, SPEC §10).
    return `${this.localRoot}/${key}`;
  }
}
