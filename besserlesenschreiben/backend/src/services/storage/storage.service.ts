import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Env } from '../../config/env';

/**
 * Per-user object storage (SPEC §5). The real backend is Azure Blob with user-delegation SAS URLs
 * scoped to `users/{account_id}/{profile_id}/…` (that adapter lands in its milestone). Until then a
 * local-filesystem fake stands in for development — the path prefix is ALWAYS derived from the
 * authenticated ids, never from client input, so the layout matches the eventual Blob keys exactly.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('StorageService');
  private readonly localRoot: string;
  private readonly azureConfigured: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.azureConfigured = config.get('AZURE_STORAGE_ACCOUNT', { infer: true }).length > 0;
    this.localRoot = config.get('STORAGE_LOCAL_DIR', { infer: true }) || join(tmpdir(), 'blsb-dev-blob');
  }

  /** Storage key under the caller's prefix. Ids come from the JWT, never the request (security §2). */
  private keyFor(accountId: string, profileId: string, name: string): string {
    return `users/${accountId}/${profileId}/${name}`;
  }

  /**
   * Write a user file. Best-effort: a storage hiccup must never fail the request that produced the
   * content (e.g. digest is always regenerable from the DB). Logs identifiers + outcome only.
   */
  async writeUserFile(accountId: string, profileId: string, name: string, content: string): Promise<void> {
    const key = this.keyFor(accountId, profileId, name);
    if (this.azureConfigured) {
      // TODO(storage-milestone): real Azure Blob upload via @azure/storage-blob + user-delegation SAS.
      this.logger.warn({ event: 'storage.skip', name }, 'Azure storage not yet implemented — skipping write');
      return;
    }
    try {
      const path = join(this.localRoot, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf-8');
      this.logger.log({ event: 'storage.write', name }, 'user file written (dev local)');
    } catch (err) {
      this.logger.warn({ event: 'storage.write_failed', name, err: (err as Error).message }, 'storage write failed');
    }
  }

  /** Read a user file, or null if it does not exist. */
  async readUserFile(accountId: string, profileId: string, name: string): Promise<string | null> {
    if (this.azureConfigured) return null; // see TODO above
    try {
      return await readFile(join(this.localRoot, this.keyFor(accountId, profileId, name)), 'utf-8');
    } catch {
      return null;
    }
  }
}
