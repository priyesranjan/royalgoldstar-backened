import { prisma } from "./src/lib/prisma";
import { GoldAdvanceStatus } from "@prisma/client";

async function debugUser() {
  const user = await prisma.user.findFirst({
    where: { role: 'CUSTOMER' },
    include: {
      wallet: true,
      goldAdvances: true
    }
  });
  
  if (user) {
    console.log("User:", user.name, "(id:", user.id, ")");
    console.log("Wallet GoldAdvanceAmount:", user.wallet?.goldAdvanceAmount);
    console.log("GoldAdvance Records Count:", user.goldAdvances.length);
    user.goldAdvances.forEach((adv, i) => {
      console.log(`  [${i}] ID: ${adv.id}, balance: ${adv.advanceAmount}, status: ${adv.status}`);
    });
  } else {
    console.log("No customers found.");
  }
  
  process.exit(0);
}

debugUser();
