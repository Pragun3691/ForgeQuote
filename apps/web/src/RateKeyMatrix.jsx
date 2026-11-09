import React from 'react';
import ScrollTable from './ScrollTable.jsx';

const categories=['material','machine','scrap','overhead','packaging','freight'];
export default function RateKeyMatrix({parts,rateKeys,asOf,onChange,partIds,fieldProps}) {
  return <section className="rate-assignment" aria-label="Multi-part rate-key assignment"><h3 id="rate-assignment-title" tabIndex={-1}>Rate-key assignment</h3><p className="muted">Select all six internal keys for every part. Assignments require your final review; rates resolve at the quotation pricing date.</p>
    <ScrollTable label="Rate-key assignment"><table aria-label="Rate-key assignment"><thead><tr><th>RFQ part</th>{categories.map(category=><th key={category}>{category[0].toUpperCase()+category.slice(1)}</th>)}</tr></thead><tbody>
      {parts.map((part,index)=><tr key={partIds?.[index]||index} aria-label={`Rate keys for part ${index+1}`}><th scope="row">Part {index+1}<span className="subtext">{part.partNumber || 'Unnamed'}</span></th>{categories.map(category=>{
        const options=rateKeys.filter(k=>k.category===category),selected=options.find(k=>k.id===part.rateKeys[category]);
        const warningId=`rate-warning-${index}-${category}`;
        const warning=part.rateKeys[category]&&!selected?'Selected key is unavailable or belongs to a different category. Select a valid key.':!options.length?`No internal ${category} keys available. Contact maintenance.`:selected?.currentVersion===null?`No effective ${category} rate on ${asOf}. Inspect history and select a supported pricing date before costing.`:'';
        const {error,...props}=fieldProps?.(`parts.${index}.rateKeys.${category}`)||{};
        return <td key={category} data-label={category}><select {...props} required aria-label={`${category[0].toUpperCase()+category.slice(1)} rate key`} title={selected?`${selected.code} (${selected.unit})`:`Select ${category}`} aria-describedby={[props['aria-describedby'],warning?warningId:''].filter(Boolean).join(' ')||undefined} value={part.rateKeys[category]} onChange={e=>onChange(index,'rateKeys',{...part.rateKeys,[category]:e.target.value})}>
          <option value="">Select {category}</option>{options.map(k=><option key={k.id} value={k.id}>{k.code} ({k.unit})</option>)}
        </select>{error&&<span id={props['aria-describedby']} className="field-error">{error}</span>}{warning && <span id={warningId} className="field-warning">{warning}</span>}</td>;
      })}</tr>)}
    </tbody></table></ScrollTable>
  </section>;
}
