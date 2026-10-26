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

// Line layouts below are taken from real pilot-club (ClubMaster) slips, with
// names removed. Before these fixes the TOTAL line was unreadable on most of
// them and payment/balance lines were counted as extra purchases.

const CLUBMASTER_SLIP = [
  '** COPY VAT INVOICE Nr 1211135 **',
  'Strand Golf Club',
  'Wednesday, 02 September 2026 12:03:23',
  'Pre-Paid Senior 18 Holes 0.00',
  'Competition Fees 40.00',
  'TOTAL R40 .00',
  'Gratuity Paid 0.00',
  'Amount Tendered: R40.00',
  'ACCOUNT: R40.00',
  'Change',
  'VAT Included @ 15%',
].join('\n');

test('a total split by OCR around its decimal point is still read', () => {
  const parsed = parseReceiptText(CLUBMASTER_SLIP);
  assert.equal(parsed.grandTotal, 40);
  assert.equal(parsed.totalSource, 'total');
  assert.equal(parseReceiptText('Castle Lite 34.00\nTotal R285 . 00').grandTotal, 285);
});

test('payment, tip and balance lines are never read as items', () => {
  const descriptions = parseReceiptText(CLUBMASTER_SLIP).items.map((i) => i.description);
  assert.deepEqual(descriptions, ['Pre-Paid Senior 18 Holes', 'Competition Fees']);

  const more = parseReceiptText(
    [
      'Jameson 60.00',
      'Current Account Balance: R394.72',
      'Previous Account Balance R241.65',
      'On Account R500.75',
      'Discount Received 10.00',
      'Taxable Total R50.00',
      'Anount Tendered: R60.00',
      'Rate: 285.00',
      'Valid on: Wednesday, 02 September 2026 285.00',
    ].join('\n'),
  );
  assert.deepEqual(
    more.items.map((i) => i.description),
    ['Jameson'],
  );
});

test('a TOTAL label with its amount on the next line', () => {
  const parsed = parseReceiptText('Castle Lite 330ml 34.00\nJameson 60.00\nTOTAL:\nR94.00\nCARD: R94.00');
  assert.equal(parsed.grandTotal, 94);
  assert.equal(parsed.totalSource, 'total');
});

test('with no readable TOTAL, the total comes from what was paid', () => {
  assert.equal(parseReceiptText('Senior 18 Holes 285.00\nAmount Tendered: R300.00\nChange 15.00').grandTotal, 285);
  const card = parseReceiptText('Senior 18 Holes 285.00\nCARD: R285.00');
  assert.equal(card.grandTotal, 285);
  assert.equal(card.totalSource, 'payment');
});

test('Taxable Total and Total Tendered are not mistaken for the total', () => {
  const parsed = parseReceiptText('Water Still 18.00\nTaxable Total R15.65\nTotal Tendered R50.00\nTOTAL R18.00');
  assert.equal(parsed.grandTotal, 18);
  assert.equal(parseReceiptText('Water Still 18.00\nTaxable Total R15.65').totalSource, 'taxable');
});

test('amounts of R1000+ without a thousands separator keep their leading digit', () => {
  const parsed = parseReceiptText('Golf Day Fee R1180.00\nTotal R1280.00');
  assert.equal(parsed.grandTotal, 1280);
  assert.equal(parsed.items[0]?.price, 1180);
  assert.equal(parseReceiptText('Driver 1,779.05\nTotal 1 779.05').grandTotal, 1779.05);
});

test('OCR misreads of the TOTAL line still give the total', () => {
  assert.equal(parseReceiptText('Draught 500ml 45.00\nloti R765.00\nTable 208').grandTotal, 765);
  assert.equal(parseReceiptText('BEEF BURGER & CHIPS 95.00\nTotal R757 (0)').grandTotal, 757);
});

test('an S read for a 5 after the Rand sign is repaired', () => {
  assert.equal(parseReceiptText('Winter Classic 2026 550.00\nAmount Tendered: RS50.00').grandTotal, 550);
});

test('a payment figure below what the VAT says was taxed is not taken as the total', () => {
  const parsed = parseReceiptText('Full Member 18 Holes 300.00\nCompetition 340.00\nTendered: RE40.00\nIncluded & 15% 78.26');
  assert.equal(parsed.vat, 78.26);
  assert.notEqual(parsed.grandTotal, 40);
});
