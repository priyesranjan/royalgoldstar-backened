import { prisma } from "../lib/prisma";
import * as fs from 'fs';
import * as path from 'path';

export class InvoiceService {
  /**
   * Generates the HTML for a GST Tax Invoice based on a Gold Advance record.
   */
  static async generateGoldAdvanceInvoiceHtml(advanceId: string) {
    console.log(`📄 [InvoiceService] Generating Gold Advance invoice for ID: ${advanceId}`);
    const advance = await prisma.goldAdvance.findUnique({
      where: { id: advanceId },
      include: { user: true }
    });

    if (!advance) {
      console.error(`❌ [InvoiceService] Gold Advance not found for ID: ${advanceId}`);
      throw new Error("Gold Advance not found");
    }

    return await this.generateCommonHtml({
      id: advanceId,
      type: "DEPOSIT RECEIPT",
      date: advance.createdAt,
      user: advance.user,
      amount: Number(advance.advanceAmount),
      description: "Gold Advance Deposit (NotePro GS8000V)",
      hsn: "847290",
      refLabel: "Advance ID",
      isTaxable: true
    });
  }

  /**
   * Generates the HTML for a Withdrawal Payment Voucher.
   */
  static async generateWithdrawalInvoiceHtml(withdrawalId: string) {
    console.log(`📄 [InvoiceService] Generating Withdrawal voucher for ID: ${withdrawalId}`);
    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true }
    });

    if (!withdrawal) {
      console.error(`❌ [InvoiceService] Withdrawal not found for ID: ${withdrawalId}`);
      throw new Error("Withdrawal not found");
    }

    return await this.generateCommonHtml({
      id: withdrawalId,
      type: "WITHDRAWAL VOUCHER",
      date: withdrawal.createdAt,
      user: withdrawal.user,
      amount: Number(withdrawal.amount),
      description: `Withdrawal Payout (Source: ${withdrawal.source})`,
      hsn: "NIL",
      refLabel: "Withdrawal ID",
      isTaxable: false
    });
  }

  /**
   * Legacy method for compatibility
   */
  static async generateInvoiceHtml(id: string) {
    return this.generateGoldAdvanceInvoiceHtml(id);
  }

  private static async generateCommonHtml(data: {
    id: string;
    type: string;
    date: Date;
    user: any;
    amount: number;
    description: string;
    hsn: string;
    refLabel: string;
    isTaxable: boolean;
  }) {
    // ── Fetch Global Settings ────────────────────────────────────────────────
    let settings = await prisma.systemSetting.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = { id: "default", showGST: true, gstPercentage: 18.0 } as any;
    }

    const showGST = settings!.showGST;
    const gstPercent = Number(settings!.gstPercentage); // e.g. 18
    const gstRate = gstPercent / 100;
    const halfGst = gstPercent / 2; // CGST = SGST = half of total
    
    const totalAmount = data.amount;
    
    // For non-taxable (withdrawals) OR if GST is disabled by admin, tax is 0
    const applyTax = data.isTaxable && showGST;

    const taxableAmt = applyTax ? Number((totalAmount / (1 + gstRate)).toFixed(2)) : totalAmount;
    const cgstAmt = applyTax ? Number((taxableAmt * (gstRate / 2)).toFixed(2)) : 0;
    const sgstAmt = applyTax ? Number((taxableAmt * (gstRate / 2)).toFixed(2)) : 0;
    const totalTax = Number((cgstAmt + sgstAmt).toFixed(2));
    
    // Adjust for rounding
    const finalTotal = taxableAmt + cgstAmt + sgstAmt;
    const diff = Number((totalAmount - finalTotal).toFixed(2));
    const adjustedTaxable = taxableAmt + diff;

    const amountInWords = this.numberToWords(totalAmount);

    const dateStr = new Date(data.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).replace(/\//g, "-");

    const timeStr = new Date(data.date).toLocaleTimeString("en-IN", {
      hour: '2-digit',
      minute: '2-digit'
    });

    // ── Load Logo ───────────────────────────────────────────────────────────
    let logoBase64 = "";
    try {
      // Path to the SVG logo in the frontend public folder
      const logoPath = path.join(__dirname, "../../../royalgoldtraders/public/RoyalGoldTrader-Logo.svg");
      const logoData = fs.readFileSync(logoPath);
      logoBase64 = logoData.toString('base64');
    } catch (error) {
      console.error("❌ [InvoiceService] Error loading logo:", error);
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.type} - ${data.id}</title>
    <style>
        @page { size: A4; margin: 8mm; }
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; font-size: 10.5pt; line-height: 1.35; }
        .invoice-box { max-width: 210mm; margin: auto; padding: 0; border: 1.5px solid #000; box-sizing: border-box; }
        
        /* Layout Sections */
        .section { display: flex; border-bottom: 1px solid #000; }
        .col { flex: 1; padding: 10px; }
        .col-border { border-right: 1px solid #000; }
        
        /* Header */
        .header { align-items: stretch; background: #fff; }
        .logo-container { width: 140px; padding: 15px; display: flex; align-items: center; justify-content: center; border-right: 1px solid #000; }
        .logo-img { width: 100%; height: auto; object-fit: contain; }
        .header-title { flex: 2; padding: 15px; display: flex; flex-direction: column; justify-content: center; }
        .seller-info h1 { margin: 0; font-size: 22pt; font-weight: 800; letter-spacing: 1px; color: #000; text-transform: uppercase; }
        .seller-info p { margin: 2px 0; font-size: 8.5pt; color: #333; font-weight: 500; }

        /* Tables */
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; overflow: hidden; }
        th { background: #f0f0f0; font-weight: bold; font-size: 9pt; text-transform: uppercase; }
        
        .items-table th:nth-child(1) { width: 35px; }
        .items-table th:nth-child(3) { width: 80px; }
        .items-table th:nth-child(4) { width: 45px; }
        .items-table th:nth-child(5) { width: 55px; }
        .items-table th:nth-child(6) { width: 95px; }
        .items-table th:nth-child(7) { width: 110px; }
        
        /* Totals */
        .totals-section { display: flex; border-bottom: 1px solid #000; }
        .totals-left { flex: 1.8; padding: 12px; }
        .totals-right { flex: 1.2; border-left: 1px solid #000; }
        .totals-right table td { border: none; border-bottom: 1px solid #f0f0f0; padding: 7px 15px; font-size: 9.5pt; }
        .totals-right table tr:last-child { border-top: 2px solid #000; font-weight: bold; background: #fdfdfd; }
        .totals-right table tr:last-child td { border-bottom: none; font-size: 13pt; padding: 10px 15px; }

        /* Footer */
        .footer-cols { display: flex; min-height: 110px; }
        .qr-area { width: 100px; padding: 10px; display: flex; flex-direction: column; align-items: center; }
        .qr-placeholder { width: 80px; height: 80px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 7pt; text-align: center; background: #fff; margin-bottom: 5px; }
        
        .bold { font-weight: bold; }
        .center { text-align: center; }
        .right { text-align: right; }
        .uppercase { text-transform: uppercase; }
        
        @media print {
            body { margin: 0; -webkit-print-color-adjust: exact; }
            .invoice-box { border: 1.5px solid #000; width: 100%; height: auto; }
        }
    </style>
</head>
<body>
    <div class="invoice-box">
        <!-- HEADER -->
        <div class="section header">
            <div class="logo-container">
                <img class="logo-img" src="data:image/svg+xml;base64,${logoBase64}" alt="Royal Gold Traders Official Logo">
            </div>
            <div class="header-title">
                <div class="seller-info">
                    <h1>ROYAL GOLD TRADERS</h1>
                    <p>B-19 Behind Lohiya Park, 2nd Floor, Pritichhaya, Road Number 1, Kankarbagh, Patna, Bihar – 800020</p>
                    <p><span class="bold">GSTIN:</span> 10AAHFA3196L1ZI | <span class="bold">Email:</span> support@royalgoldtraders.com</p>
                </div>
            </div>
            <div style="flex: 0.9; text-align: right; padding: 15px; border-left: 1.5px solid #000; background: #f9f9f9; display: flex; flex-direction: column; justify-content: center;">
                <h2 style="margin: 0; color: #000; font-size: 14pt; font-weight: 800; text-transform: uppercase;">${data.type}</h2>
                <div style="margin-top: 6px; border-top: 1px solid #ddd; padding-top: 6px;">
                    <p style="margin: 0; font-size: 8.5pt; font-weight: bold; color: #555;">REF NO: <span style="color: #000; font-size: 10.5pt;">${data.id.slice(-10).toUpperCase()}</span></p>
                </div>
            </div>
        </div>

        <!-- DETAILS -->
        <div class="section" style="background: #fafafa; font-size: 10pt;">
            <div class="col col-border">
                <p><strong>Transaction ID:</strong> <span style="font-family: monospace; font-size: 9pt;">${data.id}</span></p>
                <p><strong>Date:</strong> ${dateStr} &nbsp;|&nbsp; <strong>Time:</strong> ${timeStr}</p>
                <p><strong>Place:</strong> Patna, Bihar (10)</p>
            </div>
            <div class="col" style="flex: 0.7;">
                <p><strong>Status:</strong> <span style="color: #058c42;">SUCCESS</span></p>
                <p><strong>Category:</strong> ${data.isTaxable ? 'DEPOSIT / ADVANCE' : 'WITHDRAWAL / PAYOUT'}</p>
                <p><strong>Payment Mode:</strong> DIGITAL WALLET</p>
            </div>
        </div>

        <!-- PARTY DETAILS -->
        <div class="section" style="border-bottom: 2px solid #000;">
            <div class="col" style="padding: 15px;">
                <p class="bold" style="text-decoration: underline; margin-bottom: 8px; font-size: 9pt; color: #666; letter-spacing: 0.5px;">BENEFICIARY / CUSTOMER DETAILS:</p>
                <p class="bold" style="font-size: 13pt; margin: 0; color: #000;">${data.user.name}</p>
                <p style="font-size: 10pt; margin: 5px 0; color: #444;">${data.user.address || "Address Not Available In System Records"}</p>
                <div style="margin-top: 10px; display: flex; gap: 20px; font-size: 9.5pt;">
                    <span><strong>Email:</strong> ${data.user.email}</span>
                    <span><strong>Mobile:</strong> +91 ${data.user.contactNo || data.user.mobile || "N/A"}</span>
                </div>
            </div>
        </div>

        <!-- ITEMS TABLE -->
        <table class="items-table">
            <thead>
                <tr>
                    <th class="center">#</th>
                    <th>Description of Service / Transaction</th>
                    <th>HSN/SAC</th>
                    <th class="center">Qty</th>
                    <th class="center">Unit</th>
                    <th class="right">Base Rate</th>
                    <th class="right">Total ₹</th>
                </tr>
            </thead>
            <tbody>
                <tr style="height: 200px; vertical-align: top;">
                    <td class="center" style="padding-top: 15px;">1</td>
                    <td style="padding-top: 15px;">
                        <p class="bold" style="font-size: 11.5pt; color: #000; margin-bottom: 5px;">${data.description}</p>
                        <p style="font-size: 9pt; color: #666; margin-top: 12px; border-left: 2px solid #d4af37; padding-left: 8px;">
                            ${data.refLabel}: ${data.id}<br>
                            Purpose: Electronic Fund Management
                        </p>
                        <p style="font-size: 8.5pt; color: #888; margin-top: 15px; font-style: italic;">
                            Note: This transaction is processed securely through Royal Gold Traders ecosystem.
                        </p>
                    </td>
                    <td class="center" style="padding-top: 15px;">${data.hsn}</td>
                    <td class="center" style="padding-top: 15px;">1.00</td>
                    <td class="center" style="padding-top: 15px;">UNIT</td>
                    <td class="right" style="padding-top: 15px;">${adjustedTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td class="right" style="padding-top: 15px;">${adjustedTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>

        <!-- TOTALS AREA -->
        <div class="totals-section">
            <div class="totals-left">
                <p class="bold" style="font-size: 9pt; color: #666; margin-bottom: 4px;">AMOUNT IN WORDS:</p>
                <p style="margin: 0; font-size: 11pt; font-weight: 700; color: #1a1a1a;">${amountInWords} Only</p>
                
                <div style="margin-top: 25px; padding: 10px; background: #fcfcfc; border: 1px dashed #ccc; border-radius: 4px;">
                    <p style="margin: 0; font-size: 8.5pt; color: #555;">
                        <strong>Declaration:</strong> We declare that this document shows the actual price of the services described and that all particulars are true and correct.
                    </p>
                </div>
            </div>
            <div class="totals-right">
                <table style="width: 100%; border: none;">
                    <tr>
                        <td>Taxable Amount</td>
                        <td class="right">₹${adjustedTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    ${applyTax ? `
                    <tr>
                        <td>CGST Output (${halfGst}%)</td>
                        <td class="right">₹${cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                        <td>SGST Output (${halfGst}%)</td>
                        <td class="right">₹${sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    ` : `
                    <tr>
                        <td>Exempted Value</td>
                        <td class="right">₹0.00</td>
                    </tr>
                    `}
                    <tr>
                        <td>Round Off</td>
                        <td class="right">₹0.00</td>
                    </tr>
                    <tr style="border-top: 2px solid #000;">
                        <td><span class="bold">NET PAYABLE</span></td>
                        <td class="right bold" style="font-size: 14pt;">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- FOOTER -->
        <div class="footer-cols">
            <div class="qr-area" style="border-right: 1px solid #000;">
                <div class="qr-placeholder">E-SIGN<br>VERIFIED</div>
                <p style="font-size: 6pt; color: #999; margin: 0;">Digital ID: RG-${data.id.slice(-6)}</p>
            </div>
            <div style="flex: 2; padding: 10px; display: flex; flex-direction: column; justify-content: center;">
                <p style="margin: 0; font-size: 7.5pt; color: #666; line-height: 1.4;">
                    * This is a computer generated document and does not require a physical signature.<br>
                    * For any discrepancies, please contact us at support@royalgoldtraders.com within 24 hours.<br>
                    * Terms & Conditions apply as per the system user agreement.
                </p>
            </div>
            <div style="flex: 1.2; padding: 10px; text-align: center; display: flex; flex-direction: column; justify-content: center; border-left: 1px solid #000; background: #fafafa;">
                <div style="margin-bottom: 40px;">
                    <p style="margin: 0; font-size: 8pt; color: #333;">For ROYAL GOLD TRADERS</p>
                </div>
                <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #000; text-transform: uppercase;">Authorized Signatory</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  private static numberToWords(num: number): string {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
    };

    return inWords(Math.floor(num)) + 'Rupees';
  }
}
