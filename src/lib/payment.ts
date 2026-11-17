// Where residents send money. Set these in .env; the fallbacks are placeholders only.
export const PAYEE = {
  name: process.env.PAYEE_NAME ?? "Rental Owner",
  upiId: process.env.PAYEE_UPI_ID ?? "owner@upi",
  bankName: process.env.PAYEE_BANK_NAME ?? "Your Bank",
  accountName: process.env.PAYEE_ACCOUNT_NAME ?? "Rental Owner",
  accountNumber: process.env.PAYEE_ACCOUNT_NUMBER ?? "0000000000",
  ifsc: process.env.PAYEE_IFSC ?? "ABCD0000000",
};

// PLACEHOLDER: replace with the approved text.
export const RENT_TERMS = [
  "Rent is due on or before the due date shown on this invoice.",
  "Delayed payments may attract a late fee as agreed in your rental agreement.",
  "The security deposit is refundable on checkout, subject to deductions for damages or dues.",
  "Please keep the payment reference/UTR for your records.",
];
export const BILL_TERMS = [
  "Utility charges are shared as per usage and the split agreed with the property owner.",
  "Bills must be paid by the due date shown on this invoice.",
  "Delayed payments may attract a late fee as agreed in your rental agreement.",
  "Please keep the payment reference/UTR for your records.",
];
