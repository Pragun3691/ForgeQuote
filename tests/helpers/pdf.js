import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function inspectPdf(buffer) {
  const task=getDocument({data:new Uint8Array(buffer),useSystemFonts:false,isEvalSupported:false});
  const pdf=await task.promise;
  try {
    const pages=[];
    for(let i=1;i<=pdf.numPages;i++) {
      const page=await pdf.getPage(i),content=await page.getTextContent();
      pages.push({width:page.view[2],height:page.view[3],items:content.items.filter(item=>'str' in item),text:content.items.map(item=>item.str || '').join(' ')});
    }
    return {pages,text:pages.map(p=>p.text).join('\n'),metadata:await pdf.getMetadata(),attachments:await pdf.getAttachments()};
  } finally {await task.destroy();}
}
