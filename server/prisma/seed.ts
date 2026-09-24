import { getPrisma } from "../src/prisma.js";
import {
  CATEGORY_NAMES,
  LAB3_ATTACHMENT_FIXTURE,
  LAB3_MESSAGE_FIXTURES,
  LAB3_TICKET_FIXTURES,
  RELATED_SYSTEM_NAMES,
  REQUESTERS,
  seedReferenceData,
} from "./seed-data.js";

async function main() {
  const prisma = getPrisma();
  await seedReferenceData(prisma);

  console.log(
    `Seeded ${CATEGORY_NAMES.length} categories, ${RELATED_SYSTEM_NAMES.length} related systems, ${REQUESTERS.length} requesters, ${LAB3_TICKET_FIXTURES.length} demo Tickets, ${LAB3_MESSAGE_FIXTURES.length} demo messages, and ${LAB3_ATTACHMENT_FIXTURE.originalName}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
