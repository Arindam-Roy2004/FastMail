import { db } from "../src/common/config/db.js";
import { reindexAll } from "../src/modules/email/email.search.js";

const total = await reindexAll();
console.log(`Reindexed ${total} email(s)`);
await db.$disconnect();
