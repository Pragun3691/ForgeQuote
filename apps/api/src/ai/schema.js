import { z } from 'zod';

export const headerFields = ['reference','customerName','dueDate'];
export const partFields = ['partNumber','description','material','grossWeightKg','requestedAnnualQty','cycleTimeMin','setupHoursPerBatch'];
const field = z.strictObject({
  status:z.enum(['present','missing','ambiguous']),
  rawValue:z.string().min(1).max(500).nullable(),
  evidence:z.array(z.string().min(1).max(600)).max(3)
});
const fields = names => z.strictObject(Object.fromEntries(names.map(name=>[name,field])));
export const extractionSchema = z.strictObject({
  rfq:fields(headerFields),
  parts:z.array(z.strictObject({anchor:z.string().min(1).max(160),fields:fields(partFields)})).max(20)
});
export const responseJsonSchema = z.toJSONSchema(extractionSchema);
delete responseJsonSchema.$schema;

export const sourceSchema = z.strictObject({
  sourceText:z.string().min(1).max(12000),
  consent:z.literal(true),
  syntheticOnly:z.literal(true)
});
export const missingField = () => ({status:'missing',rawValue:null,evidence:[]});
