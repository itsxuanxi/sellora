/**
 * Seeds the local demo workspace so the product is explorable on first run.
 * Safe to re-run: it wipes and recreates only the demo organization.
 *
 * The dataset itself lives in `lib/sample-data.ts` and is shared with the
 * public sandbox at /demo and with onboarding's "Load sample data" — this
 * script only owns the org and user it hangs off.
 */
import { PrismaClient } from "@prisma/client";
import { SAMPLE_ORG, seedSampleData } from "@/lib/sample-data";

const db = new PrismaClient();

const DEMO_CLERK_ID = "demo_user";

async function main() {
  // Reset the demo org only.
  const existing = await db.user.findUnique({ where: { clerkId: DEMO_CLERK_ID } });
  if (existing) {
    await db.organization.delete({ where: { id: existing.orgId } });
  }

  const org = await db.organization.create({
    data: {
      name: SAMPLE_ORG.name,
      website: SAMPLE_ORG.website,
      industry: SAMPLE_ORG.industry,
      description: SAMPLE_ORG.description,
      senderName: SAMPLE_ORG.senderName,
      senderEmail: SAMPLE_ORG.senderEmail,
      settings: { create: { emailSignature: SAMPLE_ORG.emailSignature } },
      users: {
        create: {
          clerkId: DEMO_CLERK_ID,
          email: SAMPLE_ORG.senderEmail,
          name: SAMPLE_ORG.senderName,
          role: "owner",
        },
      },
    },
  });

  const counts = await seedSampleData(db, org.id);

  console.log(
    `Seeded “${org.name}” — ${counts.prospects} contacts, ${counts.opportunities} opportunities, ` +
      `${counts.recommendations} recommendations, ${counts.actions} actions, ${counts.responses} responses.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
