// Helper function to get full image URL
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // Get backend origin - extract only protocol://host:port (no API paths)
  const rawBaseURL = import.meta.env.VITE_BASE_URL || (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");

  let baseURL;
  try {
    // Try to parse as URL and extract origin (protocol://host:port)
    const url = new URL(rawBaseURL);
    baseURL = `${url.protocol}//${url.host}`; // Gets protocol://host:port
  } catch {
    // If parsing fails, extract origin manually
    const match = rawBaseURL.match(/^(https?:\/\/[^/]+)/i);
    baseURL = match ? match[1] : (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");
  }

  // If imagePath already starts with http, return as is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Ensure imagePath starts with /
  const cleanImagePath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  const fullUrl = `${baseURL}${cleanImagePath}`;

  return fullUrl;
};

// Get demand summary for a member
export const getDemandSummary = (memberId, recoveries, demandSummaries) => {
  const recovery = recoveries.find((r) => r.memberId === memberId);

  // Priority 1: Use demandDetails from recovery if available (calculated by backend when saving)
  if (recovery?.demandDetails) {
    const dd = recovery.demandDetails;

    return {
      saving: {
        // Use nullish coalescing (??) instead of || to preserve 0 values for numeric fields
        prev: dd.saving?.prevDemand ?? 0,
        curr: dd.saving?.currDemand ?? 0,
        total: dd.saving?.totalDemand ?? 0,
        actual: dd.saving?.actualPaid ?? 0,
        unpaid: dd.saving?.unpaidDemand ?? 0,
        opening: dd.saving?.openingBalance ?? 0,
        closing: dd.saving?.closingBalance ?? 0,
      },
      loan: {
        // Use nullish coalescing (??) instead of || to preserve 0 values for numeric fields
        prev: dd.loan?.prevDemand ?? 0,
        curr: dd.loan?.currDemand ?? 0,
        total: dd.loan?.totalDemand ?? 0,
        actual: dd.loan?.actualPaid ?? 0,
        unpaid: dd.loan?.unpaidDemand ?? 0,
        opening: dd.loan?.openingBalance ?? 0,
        closing: dd.loan?.closingBalance ?? 0,
      },
      interest: {
        // Use nullish coalescing (??) instead of || to preserve 0 values for numeric fields
        prev: dd.interest?.prevDemand ?? 0,
        curr: dd.interest?.currDemand ?? 0,
        total: dd.interest?.totalDemand ?? 0,
        actual: dd.interest?.actualPaid ?? 0,
        unpaid: dd.interest?.unpaidDemand ?? 0,
        opening: dd.interest?.openingBalance ?? 0,
        closing: dd.interest?.closingBalance ?? 0,
        previousUnpaidInterestLabel: dd.interest?.previousUnpaidInterestLabel ?? "Previous unpaid interest",
        previousUnpaidInterest: dd.interest?.previousUnpaidInterest ?? 0,
      },
      fd: {
        prev: 0,
        curr: 0,
        total: 0,
        // Use nullish coalescing (??) instead of || to preserve 0 values for numeric fields
        actual: dd.fd?.actualPaid ?? 0,
        unpaid: 0,
        opening: dd.fd?.openingBalance ?? 0,
        closing: dd.fd?.closingBalance ?? 0,
      },
      yogdan: {
        // Use nullish coalescing (??) instead of || to preserve 0 values for numeric fields
        prev: dd.yogdan?.prevDemand ?? 0,
        curr: dd.yogdan?.currDemand ?? 0,
        total: dd.yogdan?.totalDemand ?? 0,
        actual: dd.yogdan?.actualPaid ?? 0,
        unpaid: dd.yogdan?.unpaidDemand ?? 0,
        opening: dd.yogdan?.openingBalance ?? 0,
        closing: dd.yogdan?.closingBalance ?? 0,
      },
      memFeesSHG: {
        // Use nullish coalescing (??) instead of || to preserve 0 values for numeric fields
        prev: dd.memFeesSHG?.prevDemand ?? 0,
        curr: dd.memFeesSHG?.currDemand ?? 0,
        total: dd.memFeesSHG?.totalDemand ?? 0,
        actual: dd.memFeesSHG?.actualPaid ?? 0,
        unpaid: dd.memFeesSHG?.unpaidDemand ?? 0,
        opening: 0,
        closing: 0,
      },
      memFeesSamiti: {
        prev: 0,
        curr: 0,
        // Use nullish coalescing (??) instead of || to preserve 0 values for numeric fields
        total: recovery?.amounts?.memFeesSamiti ?? 0,
        actual: recovery?.amounts?.memFeesSamiti ?? 0,
        unpaid: 0,
        opening: 0,
        closing: 0,
      },
      memFeesGroup: {
        // Use nullish coalescing (??) instead of || to preserve 0 values for numeric fields
        prev: dd.memFeesGroup?.prevDemand ?? 0,
        curr: dd.memFeesGroup?.currDemand ?? 0,
        total: dd.memFeesGroup?.totalDemand ?? 0,
        actual: dd.memFeesGroup?.actualPaid ?? 0,
        unpaid: dd.memFeesGroup?.unpaidDemand ?? 0,
        opening: 0,
        closing: 0,
      },
      penalty: {
        prev: dd.penalty?.prevDemand ?? 0,
        curr: dd.penalty?.currDemand ?? 0,
        total: dd.penalty?.totalDemand ?? 0,
        actual: dd.penalty?.actualPaid ?? 0,
        unpaid: dd.penalty?.unpaidDemand ?? 0,
        opening: 0,
        closing: 0,
      },
      other: {
        prev: 0,
        curr: 0,
        total: (recovery?.amounts?.other1 ?? 0) + (recovery?.amounts?.other2 ?? 0) + (recovery?.amounts?.other ?? 0),
        actual: (recovery?.amounts?.other1 ?? 0) + (recovery?.amounts?.other2 ?? 0) + (recovery?.amounts?.other ?? 0),
        unpaid: 0,
        opening: 0,
        closing: 0,
      },
      charges: {
        prev: 0,
        curr: 0,
        // Use nullish coalescing (??) instead of || to preserve 0 values for numeric fields
        total: dd.charges?.chargesTotalDemand ?? 0,
        actual: dd.charges?.actualPaidTotal ?? 0,
        unpaid: dd.charges?.unpaidDemandTotal ?? 0,
        opening: 0,
        closing: 0,
        chargesDue: dd.charges?.chargesDue ?? {},
        actualCharges: dd.charges?.actualPaid ?? {},
      },
      interestDayDetails: dd._debugInterestDays ?? null,
    };
  }

  // Priority 2: Use demandDetails fetched from backend API (for display before saving)
  const backendDemandDetails = demandSummaries[memberId];
  if (backendDemandDetails) {
    const dd = backendDemandDetails;

    return {
      saving: {
        prev: dd.saving?.prevDemand ?? 0,
        curr: dd.saving?.currDemand ?? 0,
        total: dd.saving?.totalDemand ?? 0,
        actual: dd.saving?.actualPaid ?? 0,
        unpaid: dd.saving?.unpaidDemand ?? 0,
        opening: dd.saving?.openingBalance ?? 0,
        closing: dd.saving?.closingBalance ?? 0,
      },
      loan: {
        prev: dd.loan?.prevDemand ?? 0,
        curr: dd.loan?.currDemand ?? 0,
        total: dd.loan?.totalDemand ?? 0,
        actual: dd.loan?.actualPaid ?? 0,
        unpaid: dd.loan?.unpaidDemand ?? 0,
        opening: dd.loan?.openingBalance ?? 0,
        closing: dd.loan?.closingBalance ?? 0,
      },
      interest: {
        prev: dd.interest?.prevDemand ?? 0,
        curr: dd.interest?.currDemand ?? 0,
        total: dd.interest?.totalDemand ?? 0,
        actual: dd.interest?.actualPaid ?? 0,
        unpaid: dd.interest?.unpaidDemand ?? 0,
        opening: dd.interest?.openingBalance ?? 0,
        closing: dd.interest?.closingBalance ?? 0,
        previousUnpaidInterestLabel: dd.interest?.previousUnpaidInterestLabel ?? "Previous unpaid interest",
        previousUnpaidInterest: dd.interest?.previousUnpaidInterest ?? 0,
      },
      fd: {
        prev: 0,
        curr: 0,
        total: 0,
        actual: dd.fd?.actualPaid ?? 0,
        unpaid: 0,
        opening: dd.fd?.openingBalance ?? 0,
        closing: dd.fd?.closingBalance ?? 0,
      },
      yogdan: {
        prev: dd.yogdan?.prevDemand ?? 0,
        curr: dd.yogdan?.currDemand ?? 0,
        total: dd.yogdan?.totalDemand ?? 0,
        actual: dd.yogdan?.actualPaid ?? 0,
        unpaid: dd.yogdan?.unpaidDemand ?? 0,
        opening: dd.yogdan?.openingBalance ?? 0,
        closing: dd.yogdan?.closingBalance ?? 0,
      },
      memFeesSHG: {
        prev: dd.memFeesSHG?.prevDemand ?? 0,
        curr: dd.memFeesSHG?.currDemand ?? 0,
        total: dd.memFeesSHG?.totalDemand ?? 0,
        actual: dd.memFeesSHG?.actualPaid ?? 0,
        unpaid: dd.memFeesSHG?.unpaidDemand ?? 0,
        opening: 0,
        closing: 0,
      },
      memFeesSamiti: {
        prev: 0,
        curr: 0,
        total: recovery?.amounts?.memFeesSamiti ?? 0,
        actual: recovery?.amounts?.memFeesSamiti ?? 0,
        unpaid: 0,
        opening: 0,
        closing: 0,
      },
      memFeesGroup: {
        prev: dd.memFeesGroup?.prevDemand ?? 0,
        curr: dd.memFeesGroup?.currDemand ?? 0,
        total: dd.memFeesGroup?.totalDemand ?? 0,
        actual: dd.memFeesGroup?.actualPaid ?? 0,
        unpaid: dd.memFeesGroup?.unpaidDemand ?? 0,
        opening: 0,
        closing: 0,
      },
      penalty: {
        prev: dd.penalty?.prevDemand ?? 0,
        curr: dd.penalty?.currDemand ?? 0,
        total: dd.penalty?.totalDemand ?? 0,
        actual: dd.penalty?.actualPaid ?? 0,
        unpaid: dd.penalty?.unpaidDemand ?? 0,
        opening: 0,
        closing: 0,
      },
      other: {
        prev: 0,
        curr: 0,
        total: (recovery?.amounts?.other1 ?? 0) + (recovery?.amounts?.other2 ?? 0) + (recovery?.amounts?.other ?? 0),
        actual: (recovery?.amounts?.other1 ?? 0) + (recovery?.amounts?.other2 ?? 0) + (recovery?.amounts?.other ?? 0),
        unpaid: 0,
        opening: 0,
        closing: 0,
      },
      charges: {
        prev: 0,
        curr: 0,
        total: dd.charges?.chargesTotalDemand ?? 0,
        actual: Object.values(recovery?.amounts?.charges ?? {}).reduce((sum, amount) => sum + (amount ?? 0), 0),
        unpaid: dd.charges?.unpaidDemandTotal ?? 0,
        opening: 0,
        closing: 0,
        chargesDue: dd.charges?.chargesDue ?? {},
        actualCharges: recovery?.amounts?.charges ?? {},
      },
      interestDayDetails: dd._debugInterestDays ?? null,
    };
  }

  // Fallback: Return empty structure if no demand details available
  return {
    saving: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 },
    loan: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 },
    interest: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 },
    fd: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 },
    yogdan: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 },
    memFeesSHG: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 },
    memFeesSamiti: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 },
    memFeesGroup: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 },
    penalty: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 },
    charges: { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0, chargesDue: {}, actualCharges: {} },
    interestDayDetails: null,
  };
};

// Calculate totals from recoveries
export const calculateTotals = (recoveries) => {
  let totalCash = 0;
  let totalOnline = 0;
  let totalAmount = 0;

  recoveries.forEach((recovery) => {
    // Only count if member is present or absent with recovery by other
    if (recovery.attendance === "present" || (recovery.attendance === "absent" && recovery.recoveryByOther)) {
      // Use nullish coalescing (??) instead of || to preserve 0 values for numeric payment fields
      const saving = parseFloat(recovery.amounts?.saving ?? 0) || 0;
      const loan = parseFloat(recovery.amounts?.loan ?? 0) || 0;
      const fd = parseFloat(recovery.amounts?.fd ?? 0) || 0;
      const interest = parseFloat(recovery.amounts?.interest ?? 0) || 0;
      const yogdan = parseFloat(recovery.amounts?.yogdan ?? 0) || 0;
      const memFeesSHG = parseFloat(recovery.amounts?.memFeesSHG ?? 0) || 0;
      const memFeesSamiti = parseFloat(recovery.amounts?.memFeesSamiti ?? 0) || 0;
      const memFeesGroup = parseFloat(recovery.amounts?.memFeesGroup ?? 0) || 0;
      const penalty = parseFloat(recovery.amounts?.penalty ?? 0) || 0;
      const other = (parseFloat(recovery.amounts?.other1 ?? 0) || 0) +
        (parseFloat(recovery.amounts?.other2 ?? 0) || 0) +
        (parseFloat(recovery.amounts?.other ?? 0) || 0);
      // Use nullish coalescing (??) to preserve 0 values in charge amounts
      const chargesTotal = recovery.amounts?.charges ?
        Object.values(recovery.amounts.charges).reduce((sum, amount) => sum + (parseFloat(amount ?? 0) || 0), 0) : 0;
      const memberTotal = saving + loan + fd + interest + yogdan + memFeesSHG + memFeesSamiti + memFeesGroup + penalty + other + chargesTotal;

      totalAmount += memberTotal;

      if (recovery.paymentMode?.cash) {
        totalCash += memberTotal;
      }
      if (recovery.paymentMode?.online) {
        totalOnline += memberTotal;
      }
    }
  });

  return { totalCash, totalOnline, totalAmount };
};

// Format recovery amount for display
export const formatRecoveryAmount = (amount) => {
  if (!amount && amount !== 0) return "—";
  return `₹${Math.round(amount).toLocaleString()}`;
};
