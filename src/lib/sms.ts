import axios from "axios";

const SMS_API_KEY = process.env.SMS_API_KEY || "a4f42790-1574-11f1-bcb0-0200cd936042";
const BASE_URL = `https://2factor.in/API/V1/${SMS_API_KEY}`;

export class SMSService {
  /**
   * Sends an OTP to the given mobile number.
   * Returns the Session ID from 2Factor.
   */
  static async sendOTP(mobile: string): Promise<string> {
    try {
      // 2Factor expects 10-digit mobile or with country code.
      // We'll clean it to ensure it's just numbers.
      const cleanMobile = mobile.replace(/\D/g, "");
      const url = `${BASE_URL}/SMS/${cleanMobile}/AUTOGEN/RGT_OTP`;
      
      const response = await axios.get(url);
      if (response.data.Status === "Success") {
        return response.data.Details; // This is the SessionID
      } else {
        throw new Error(response.data.Details || "Failed to send OTP");
      }
    } catch (error: any) {
      console.error("SMS SEND ERROR:", error.response?.data || error.message);
      throw new Error("Could not send OTP. Please try again.");
    }
  }

  /**
   * Verifies the OTP using the Session ID.
   */
  static async verifyOTP(sessionId: string, otp: string): Promise<boolean> {
    try {
      const url = `${BASE_URL}/SMS/VERIFY/${sessionId}/${otp}`;
      const response = await axios.get(url);
      
      return response.data.Status === "Success" && response.data.Details === "OTP Matched";
    } catch (error: any) {
      console.error("SMS VERIFY ERROR:", error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Sends a transactional SMS alert.
   * Note: Template must be approved on 2Factor panel first.
   */
  static async sendAlert(mobile: string, template: string, values: string[]): Promise<void> {
    // 2Factor Transactional API (POST)
    // Values are comma separated for template variables {VAR1}, {VAR2}...
    try {
      const cleanMobile = mobile.replace(/\D/g, "");
      const url = `${BASE_URL}/ADDON_SERVICES/SEND/TSMS`;
      
      const payload = {
        From: "RGTIND",
        To: cleanMobile,
        TemplateName: template,
        Msg: values.join(",")
      };

      await axios.post(url, payload);
      console.log(`SMS Alert [${template}] sent to ${cleanMobile}`);
    } catch (error: any) {
      console.error("SMS ALERT ERROR:", error.response?.data || error.message);
    }
  }
}
