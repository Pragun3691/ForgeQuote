// Read failures have no uncertain submission to replay. Preserve actionable
// domain errors (for example a missing RFQ), but contextualize transport/503s.
export function readError(error,subject) {
  return !error.status || error.status===503 ? `Unable to load ${subject}. Please retry.` : error.message;
}
