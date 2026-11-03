export function inputError(message, code = 'INVALID_QUOTATION_INPUT') {
  return Object.assign(new Error(message), { code });
}
export function validateId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw inputError('Expected a UUID identifier.');
  return value.toLowerCase();
}
export function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000') ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw inputError('Pricing date must be a valid YYYY-MM-DD date.');
  return value;
}
function fields(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) throw inputError(`Expected fields: ${keys.join(', ')}.`);
}
function quantity(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value) || BigInt(value) > 1000000000n) throw inputError('Annual quantities must be integer strings from 1 to 1000000000.');
  return value;
}
// Canonicalize only validated, explicit business inputs. No CSRF, session,
// submission key, current master values or current GST setting enters the hash.
function canonicalPart(body) {
  fields(body.tierQuantities, ['50','100','150']);
  const margin = body.marginPercent;
  if (typeof margin !== 'string' || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(margin) || BigInt(margin.split('.')[0]) >= 100n) throw inputError('Margin must be a decimal string from 0 to below 100, with at most six decimal places.');
  const normalizedMargin = margin.includes('.') ? margin.replace(/0+$/, '').replace(/\.$/, '') : margin;
  return { partId: validateId(body.partId), routingRevisionId: validateId(body.routingRevisionId), marginPercent: normalizedMargin,
      requestedAnnualQty: quantity(body.tierQuantities['100']),
      tierQuantities: Object.fromEntries(['50','100','150'].map(scenario => [scenario, quantity(body.tierQuantities[scenario])])) };
}
export function canonicalRequest(rfqId, body) {
  const multipart = body && Object.hasOwn(body, 'parts');
  fields(body, multipart ? ['pricingDate','parts'] : ['pricingDate','partId','routingRevisionId','marginPercent','tierQuantities']);
  const supplied = multipart ? body.parts : [body];
  if (!Array.isArray(supplied) || supplied.length < 1 || supplied.length > 20) throw inputError('Supply between 1 and 20 RFQ parts.');
  const parts = supplied.map(part => {
    if (multipart) fields(part, ['partId','routingRevisionId','marginPercent','tierQuantities']);
    return canonicalPart(part);
  });
  if (new Set(parts.map(part=>part.partId)).size !== parts.length) throw inputError('Supply every RFQ part exactly once; duplicate part ID.');
  // Stable ID order makes new multipart retries independent of presentation order.
  // The one-part canonical object/property order remains byte-for-byte legacy-compatible.
  parts.sort((a,b)=>a.partId < b.partId ? -1 : a.partId > b.partId ? 1 : 0);
  return { rfqId: validateId(rfqId), pricingDate: validateDate(body.pricingDate), parts };
}
