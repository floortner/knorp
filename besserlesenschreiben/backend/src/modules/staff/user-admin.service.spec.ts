import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserAdminService } from './user-admin.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EmailService } from '../../services/email/email.service';
import type { StorageService } from '../../services/storage/storage.service';
import { ApiException } from '../../common/exceptions/api-exception';

function setup(account: { id: string; email: string; status: string } | null) {
  const prisma = {
    account: {
      findUnique: vi.fn(async () => account),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
    },
    loginCode: { create: vi.fn(async () => ({ id: 'lc' })) },
  } as unknown as PrismaService;
  const email = { sendLoginCode: vi.fn(async () => undefined) } as unknown as EmailService;
  const storage = { deleteUserPrefix: vi.fn(async () => undefined) } as unknown as StorageService;
  return { svc: new UserAdminService(prisma, email, storage), prisma, email, storage };
}

describe('UserAdminService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approve flips status to active and releases a login code by email', async () => {
    const { svc, prisma, email } = setup({ id: 'a1', email: 'p@x.de', status: 'pending' });
    const res = await svc.approve('a1');
    expect(res).toEqual({ accountId: 'a1', status: 'active' });
    expect((prisma.account.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data).toEqual({ status: 'active' });
    expect(prisma.loginCode.create).toHaveBeenCalledOnce();
    expect(email.sendLoginCode).toHaveBeenCalledOnce();
  });

  it('approve on an already-active account skips the status write but still releases a code', async () => {
    const { svc, prisma, email } = setup({ id: 'a1', email: 'p@x.de', status: 'active' });
    await svc.approve('a1');
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(email.sendLoginCode).toHaveBeenCalledOnce();
  });

  it('deactivate blocks login (status only), no email', async () => {
    const { svc, prisma, email } = setup({ id: 'a1', email: 'p@x.de', status: 'active' });
    const res = await svc.deactivate('a1');
    expect(res).toEqual({ accountId: 'a1', status: 'deactivated' });
    expect((prisma.account.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data).toEqual({ status: 'deactivated' });
    expect(email.sendLoginCode).not.toHaveBeenCalled();
  });

  it('remove erases blobs BEFORE deleting the DB row', async () => {
    const { svc, prisma, storage } = setup({ id: 'a1', email: 'p@x.de', status: 'active' });
    const order: string[] = [];
    (storage.deleteUserPrefix as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push('blob');
    });
    (prisma.account.delete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push('db');
      return {};
    });
    await svc.remove('a1');
    expect(storage.deleteUserPrefix).toHaveBeenCalledWith('a1');
    expect(order).toEqual(['blob', 'db']);
  });

  it('throws 404 for an unknown account', async () => {
    const { svc } = setup(null);
    await expect(svc.approve('missing')).rejects.toBeInstanceOf(ApiException);
    await expect(svc.deactivate('missing')).rejects.toBeInstanceOf(ApiException);
    await expect(svc.remove('missing')).rejects.toBeInstanceOf(ApiException);
  });
});
