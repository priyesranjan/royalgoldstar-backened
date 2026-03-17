import { InvoiceService } from "./src/services/InvoiceService";
import { prisma } from "./src/lib/prisma";

async function verifyInvoice() {
  try {
    const advance = await prisma.goldAdvance.findFirst();
    if (!advance) {
      console.log("No gold advance found to verify.");
      return;
    }

    console.log(`Generating invoice for Gold Advance ID: ${advance.id}`);
    const html = await InvoiceService.generateInvoiceHtml(advance.id);
    
    // Check for key elements in the HTML
    const sellers = ["AGARWAL AGENCIES", "10AAHFA3196L1ZI", "S P Verma Road"];
    const buyers = ["Royal Gold Traders", "10ADJPI8137N1ZE", "Kankarbagh"];
    const items = ["Global – NotePro – GS8000V", "847290"];

    let allFound = true;
    for (const s of sellers) {
      if (!html.includes(s)) {
        console.error(`Missing Seller info: ${s}`);
        allFound = false;
      }
    }
    for (const b of buyers) {
      if (!html.includes(b)) {
        console.error(`Missing Buyer info: ${b}`);
        allFound = false;
      }
    }
    for (const i of items) {
      if (!html.includes(i)) {
        console.error(`Missing Item info: ${i}`);
        allFound = false;
      }
    }

    if (allFound) {
      console.log("Invoice verification successful! All key details found in HTML.");
    } else {
      console.log("Invoice verification failed. some details are missing.");
    }
  } catch (error) {
    console.error("Verification error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyInvoice();
