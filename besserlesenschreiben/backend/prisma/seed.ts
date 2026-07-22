/**
 * prisma/seed.ts — idempotent seed. Content loading (item_bank/lexeme) was dropped along with the
 * Vokaltraining content set; this now only bootstraps the staff admin(s) and local dev accounts.
 *
 * Wire up in package.json:
 *   "prisma": { "seed": "tsx prisma/seed.ts" }
 * then run:  npm run seed   (or: npx prisma db seed)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  // Admin bootstrap (ARCHITECTURE §1b): there is no staff self-signup, so the first admin reviewer must
  // be provisioned here. STAFF_ADMIN_EMAILS (comma-separated) are upserted as active admins, giving the
  // owner an account that can approve/deactivate/delete families. Idempotent; never downgrades an admin.
  const adminEmails = (process.env.STAFF_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const email of adminEmails) {
    await prisma.reviewer.upsert({
      where: { email },
      update: { role: "admin", status: "active" },
      create: { email, name: email.split("@")[0], role: "admin", status: "active" },
    });
  }
  if (adminEmails.length) console.log(`staff admins ensured: ${adminEmails.length}`);

  // ── Local dev convenience accounts (NEVER in production) ─────────────────────────────────────────
  // Seeded ACTIVE so you can log straight into the family app / reviewer portal without the
  // pending→staff-approval flow. Login stays passwordless — request a code, read it from the console.
  // Double-gated: an EXPLICIT SEED_DEV_ACCOUNTS=true opt-in AND NODE_ENV != production. NODE_ENV alone
  // isn't enough — its default is 'development', so a prod seed job that forgets NODE_ENV=production plus
  // a stray DEV_* var could otherwise silently provision a passwordless active account.
  if (process.env.SEED_DEV_ACCOUNTS === "true" && process.env.NODE_ENV !== "production") {
    const devFamily = (process.env.DEV_FAMILY_EMAIL ?? "").trim().toLowerCase();
    if (devFamily) {
      const acct = await prisma.account.upsert({
        where: { email: devFamily },
        update: { status: "active" },
        create: { email: devFamily, status: "active" },
      });
      console.log(`dev family account ensured (active): ${devFamily}`);
      // Ready-made student profile so login lands straight in /app/lernen (skips onboarding). Only when
      // the account has no profile yet — never duplicate on reseed or clobber one you created by hand.
      if ((await prisma.profile.count({ where: { accountId: acct.id } })) === 0) {
        await prisma.profile.create({ data: { accountId: acct.id, name: "Testschüler", buddy: "nepo" } });
        console.log(`  ↳ student profile created: Testschüler`);
      }
    }
    // Seeded as ADMIN so the whole reviewer portal (review queue + user admin) is testable.
    const devReviewer = (process.env.DEV_REVIEWER_EMAIL ?? "").trim().toLowerCase();
    if (devReviewer) {
      await prisma.reviewer.upsert({
        where: { email: devReviewer },
        update: { role: "admin", status: "active" },
        create: { email: devReviewer, name: devReviewer.split("@")[0], role: "admin", status: "active" },
      });
      console.log(`dev reviewer ensured (active admin): ${devReviewer}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
