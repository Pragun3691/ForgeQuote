export const pdfVersionId='26110500-0000-4000-8000-000000000001';
export function customerPdfFixture() {
 return {
  versionId:pdfVersionId,versionNumber:'1',quotationNumber:`FQ-${pdfVersionId}`,
  issuedAt:'2026-11-04T20:00:00.000Z',pricingDate:'2026-11-02',customerName:'Synthetic Demo Customer',rfqReference:'RFQ-2611-014',gstPercent:'18.000000',
  scenarios:[
   {scenario:'50',lines:[{partNumber:'SPINDLE-DEMO',description:'Rear-wheel spindle',quantity:'90000',unitPrice:'150.55',lineTotal:'13549500.00'}],subtotal:'13549500.00',gstAmount:'2438910.00',total:'15988410.00'},
   {scenario:'100',lines:[{partNumber:'SPINDLE-DEMO',description:'Rear-wheel spindle',quantity:'180000',unitPrice:'149.70',lineTotal:'26946000.00'}],subtotal:'26946000.00',gstAmount:'4850280.00',total:'31796280.00'},
   {scenario:'150',lines:[{partNumber:'SPINDLE-DEMO',description:'Rear-wheel spindle',quantity:'270000',unitPrice:'149.41',lineTotal:'40340700.00'}],subtotal:'40340700.00',gstAmount:'7261326.00',total:'47602026.00'}
  ]
 };
}
