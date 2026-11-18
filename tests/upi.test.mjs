import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpiUri, getUpiPaymentIssue, isValidUpiId, paymentLabel } from '../src/lib/upi.ts';

test('QR request preserves each shop recipient, exact paise and unique reference', () => {
  for (const [upiId, name, amount, reference] of [['first.shop@bank','First & Sons',32.4,'a123'],['second-shop@upi','Second Shop',115.2,'b456']]) {
    const uri = buildUpiUri({upiId,payeeName:name,amount,reference});
    const parsed = new URL(uri);
    assert.equal(parsed.protocol,'upi:'); assert.equal(parsed.host,'pay');
    assert.equal(parsed.searchParams.get('pa'),upiId); assert.equal(parsed.searchParams.get('pn'),name);
    assert.equal(parsed.searchParams.get('am'),amount.toFixed(2)); assert.equal(parsed.searchParams.get('cu'),'INR');
    assert.equal(parsed.searchParams.get('tr'),reference); assert.ok(!uri.includes('+'));
  }
});
test('rejects malformed addresses, amounts and reference injection', () => {
  for (const address of ['','merchant','merchant@','x @upi','shop@upi&am=1']) assert.equal(isValidUpiId(address),false);
  for (const amount of [0,0.001,-1,NaN,Infinity]) assert.throws(()=>buildUpiUri({upiId:'shop@upi',payeeName:'Shop',amount}));
  assert.throws(()=>buildUpiUri({upiId:'shop@upi',payeeName:'Shop',reference:'a&am=1'}));
});
test('settings QR has no preset amount; checkout QR requires a positive amount', () => {
  assert.equal(new URL(buildUpiUri({upiId:'shop@upi',payeeName:'Shop'})).searchParams.has('am'),false);
});
const order={status:'new',paymentMode:'online',paymentStatus:'pending',config:{subtotal:32.4},upiPayment:{upiId:'shop@upi',payeeName:'Shop',amount:32.4,reference:'a123'}};
test('UTR submission is pending, never proof of receipt', () => {
  const submitted={...order,upiPayment:{...order.upiPayment,utr:'123456789012'}};
  assert.equal(paymentLabel(submitted),'UPI — awaiting verification'); assert.equal(getUpiPaymentIssue(submitted),null);
});
test('blocks cancelled, already paid, missing and revised payment requests', () => {
  assert.ok(getUpiPaymentIssue({...order,status:'cancelled'}));
  assert.ok(getUpiPaymentIssue({...order,paymentStatus:'paid'}));
  assert.ok(getUpiPaymentIssue({...order,upiPayment:undefined}));
  assert.ok(getUpiPaymentIssue({...order,config:{subtotal:32.4,revisedAmount:40}}));
  assert.ok(getUpiPaymentIssue({...order,config:{subtotal:32.4,revisedAmount:0}}));
});

test('counts compressed PDF page trees rather than estimating the payment from bytes', async () => {
  const { PDFDocument } = await import('pdf-lib');
  const { countPdfPages } = await import('../src/lib/pdfPages.ts');
  for (const pages of [1, 2, 5, 17]) {
    const pdf = await PDFDocument.create();
    for (let n = 0; n < pages; n++) pdf.addPage();
    const bytes = await pdf.save({useObjectStreams:true});
    assert.equal(await countPdfPages(bytes), pages);
  }
  await assert.rejects(countPdfPages(new TextEncoder().encode('not a PDF')));
});
