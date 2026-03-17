import { InvoiceService } from "./src/services/InvoiceService";
import { prisma } from "./src/lib/prisma";
import * as fs from "fs";
import * as path from "path";

async function generateSample() {
  try {
    const advance = await prisma.goldAdvance.findFirst();
    if (!advance) {
      console.log("No gold advance found.");
      return;
    }

    const html = await InvoiceService.generateInvoiceHtml(advance.id);
    const filePath = path.join(__dirname, "sample_invoice.html");
    fs.writeFileSync(filePath, html);
    console.log(`Invoice generated and saved to: ${filePath}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

generateSample();
