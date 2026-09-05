import { getPrisma } from "../src/prisma.js";
import {
  CATEGORY_NAMES,
  RELATED_SYSTEM_NAMES,
  REQUESTERS,
  seedReferenceData,
} from "./seed-data.js";

async function main() {
  const prisma = getPrisma();
  await seedReferenceData(prisma);

  console.log(
    `Seeded ${CATEGORY_NAMES.length} categories, ${RELATED_SYSTEM_NAMES.length} related systems, and ${REQUESTERS.length} requesters.`,
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
