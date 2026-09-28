import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptText } from './receiptParser';

test('a bare TAX INVOICE header is not read as the receipt number', () => {
  const parsed = parseReceiptText('STRAND GOLF CLUB\nTAX INVOICE\nInvoice No: INV-20931\nTOTAL 250.00');
  assert.equal(parsed.receiptNumber, 'INV-20931');
});

test('invoice number on the header line itself still parses', () => {
  assert.equal(parseReceiptText('Tax Invoice Nr 000123\nTOTAL 250.00').receiptNumber, '000123');
  assert.equal(parseReceiptText('RECEIPT # A1234\nTOTAL 250.00').receiptNumber, 'A1234');
});

test('a label with no number on its line gives no receipt number', () => {
  assert.equal(parseReceiptText('TAX INVOICE\nCastle Lager 32.50\nTOTAL 32.50').receiptNumber, null);
});

test('transaction number needs a digit', () => {
  assert.equal(parseReceiptText('TRANSACTION APPROVED\nTOTAL 32.50').transactionNumber, null);
  assert.equal(parseReceiptText('Trans No: 88412\nTOTAL 32.50').transactionNumber, '88412');
});

test('VAT printed with its rate before the amount', () => {
  assert.equal(parseReceiptText('SUBTOTAL 2,080.50\nVAT 15% 271.37\nTOTAL 2,080.50').vat, 271.37);
  assert.equal(parseReceiptText('VAT @ 15.00%   271.37').vat, 271.37);
  assert.equal(parseReceiptText('VAT (15%) R 271,37').vat, 271.37);
});

test('VAT without a rate still parses, and a VAT registration number is ignored', () => {
  assert.equal(parseReceiptText('VAT 271.37').vat, 271.37);
  assert.equal(parseReceiptText('VAT NO 4123456789\nTOTAL 250.00').vat, null);
});
