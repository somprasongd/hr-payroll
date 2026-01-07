/**
 * Detail pages that should redirect to their list page when branch is switched
 * Pattern: regex to match the path, listPath: the path to redirect to
 */
export const DETAIL_PAGE_PATTERNS = [
  { pattern: /^\/employees\/[^/]+$/, listPath: "/employees" },
  { pattern: /^\/bonuses\/[^/]+$/, listPath: "/bonuses" },
  { pattern: /^\/salary-raise\/[^/]+$/, listPath: "/salary-raise" },
  { pattern: /^\/debt\/[^/]+$/, listPath: "/debt" },
  { pattern: /^\/payroll\/[^/]+$/, listPath: "/payroll" },
  { pattern: /^\/payouts\/pt\/[^/]+$/, listPath: "/payouts/pt" },
];
