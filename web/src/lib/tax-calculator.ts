/**
 * Tax Calculator Utility
 * 
 * คำนวณภาษีหัก ณ ที่จ่ายรายเดือน ตาม logic เดียวกับ SQL function calculate_withholding_tax
 * 
 * - Section 40(1): พนักงานประจำที่มีประกันสังคม (คำนวณก้าวหน้า)
 * - Section 40(2): ฟรีแลนซ์/เหมางาน ไม่มีประกันสังคม (หักเป็น % ของรายได้)
 */

import { TaxProgressiveBracket } from '@/services/payroll-config.service';

/**
 * Tax configuration from payroll config
 */
export interface TaxConfig {
  // Section 40(1) - Regular employees
  taxApplyStandardExpense: boolean;
  taxStandardExpenseRate: number;     // decimal e.g., 0.5 for 50%
  taxStandardExpenseCap: number;      // e.g., 100000
  taxApplyPersonalAllowance: boolean;
  taxPersonalAllowanceAmount: number; // e.g., 60000
  taxProgressiveBrackets: TaxProgressiveBracket[];
  // Section 40(2) - Freelance/Contract
  withholdingTaxRateService: number;  // decimal e.g., 0.03 for 3%
}

/**
 * Employee context for tax calculation
 */
export interface EmployeeTaxContext {
  withholdTax: boolean;
  ssoContribute: boolean;
  ssoRateEmployee: number;     // decimal e.g., 0.05 for 5%
  ssoWageCap: number;          // e.g., 15000
  ssoBase: number;             // SSO declared wage or income
}

/**
 * คำนวณภาษีก้าวหน้าตาม brackets
 * 
 * @param taxableIncome - ฐานภาษีต่อปี
 * @param brackets - ขั้นบันไดภาษี [{min, max, rate}]
 * @returns ภาษีต่อปี
 */
export function calculateProgressiveTax(
  taxableIncome: number,
  brackets: TaxProgressiveBracket[]
): number {
  if (taxableIncome <= 0 || !brackets || brackets.length === 0) {
    return 0;
  }

  let totalTax = 0;

  // Sort brackets by min value
  const sortedBrackets = [...brackets].sort((a, b) => a.min - b.min);

  for (const bracket of sortedBrackets) {
    // Skip if income hasn't reached this bracket yet
    if (taxableIncome <= bracket.min) {
      continue;
    }

    // Calculate the upper limit for this bracket
    const upperLimit = bracket.max ?? taxableIncome;
    
    // Calculate taxable amount in this bracket
    const taxableInBracket = Math.min(taxableIncome, upperLimit) - bracket.min;

    if (taxableInBracket > 0) {
      totalTax += taxableInBracket * bracket.rate;
    }
  }

  return Math.round(totalTax * 100) / 100;
}

/**
 * คำนวณภาษีหัก ณ ที่จ่ายรายเดือน
 * 
 * Logic ตาม SQL function: calculate_withholding_tax
 * 
 * @param monthlyIncome - รายได้รวมต่อเดือน
 * @param context - ข้อมูลพนักงาน (withholdTax, ssoContribute, etc.)
 * @param config - ค่า config ภาษี
 * @returns ภาษีหัก ณ ที่จ่ายต่อเดือน (ปัดเศษ 2 ตำแหน่ง)
 */
export function calculateWithholdingTax(
  monthlyIncome: number,
  context: EmployeeTaxContext,
  config: TaxConfig
): number {
  // If tax withholding is disabled or no income, return 0
  if (!context.withholdTax || monthlyIncome <= 0) {
    return 0;
  }

  // Section 40(2): ฟรีแลนซ์/ไม่มีประกันสังคม - หักแบบ flat rate
  if (!context.ssoContribute) {
    return Math.round(monthlyIncome * config.withholdingTaxRateService * 100) / 100;
  }

  // Section 40(1): พนักงานประจำ - คำนวณก้าวหน้า
  
  // 1. คำนวณ SSO ต่อเดือน (ใช้เป็นค่าลดหย่อน)
  const ssoBase = Math.min(context.ssoBase, context.ssoWageCap);
  const ssoMonthly = ssoBase * context.ssoRateEmployee;

  // 2. คำนวณรายได้ต่อปี
  const annualIncome = monthlyIncome * 12;

  // 3. คำนวณค่าใช้จ่ายเหมา
  let expense = 0;
  if (config.taxApplyStandardExpense) {
    expense = annualIncome * config.taxStandardExpenseRate;
    expense = Math.min(expense, config.taxStandardExpenseCap);
  }

  // 4. คำนวณค่าลดหย่อนส่วนตัว
  let allowance = 0;
  if (config.taxApplyPersonalAllowance) {
    allowance = config.taxPersonalAllowanceAmount;
  }

  // 5. คำนวณฐานภาษี
  const ssoAnnual = ssoMonthly * 12;
  const taxableIncome = Math.max(annualIncome - expense - allowance - ssoAnnual, 0);

  // 6. คำนวณภาษีต่อปี
  const annualTax = calculateProgressiveTax(taxableIncome, config.taxProgressiveBrackets);

  // 7. แบ่งเป็นรายเดือน
  return Math.round((annualTax / 12) * 100) / 100;
}

/**
 * ตัวอย่างการใช้งาน:
 * 
 * const tax = calculateWithholdingTax(
 *   34500,  // รายได้ต่อเดือน
 *   {
 *     withholdTax: true,
 *     ssoContribute: true,
 *     ssoRateEmployee: 0.05,
 *     ssoWageCap: 15000,
 *     ssoBase: 15000,
 *   },
 *   {
 *     taxApplyStandardExpense: true,
 *     taxStandardExpenseRate: 0.5,
 *     taxStandardExpenseCap: 100000,
 *     taxApplyPersonalAllowance: true,
 *     taxPersonalAllowanceAmount: 60000,
 *     taxProgressiveBrackets: [
 *       { min: 0, max: 150000, rate: 0 },
 *       { min: 150001, max: 300000, rate: 0.05 },
 *       { min: 300001, max: 500000, rate: 0.10 },
 *       { min: 500001, max: 750000, rate: 0.15 },
 *       { min: 750001, max: 1000000, rate: 0.20 },
 *       { min: 1000001, max: 2000000, rate: 0.25 },
 *       { min: 2000001, max: 5000000, rate: 0.30 },
 *       { min: 5000001, max: null, rate: 0.35 },
 *     ],
 *     withholdingTaxRateService: 0.03,
 *   }
 * );
 * 
 * // ผลลัพธ์:
 * // รายได้ปี = 34,500 × 12 = 414,000
 * // ค่าใช้จ่ายเหมา = min(207,000, 100,000) = 100,000
 * // ค่าลดหย่อน = 60,000
 * // SSO = 750 × 12 = 9,000
 * // ฐานภาษี = 414,000 - 100,000 - 60,000 - 9,000 = 245,000
 * // ภาษีปี = 0–150,000@0% = 0 + 150,000–245,000(95,000)@5% = 4,750
 * // ภาษีเดือน = 4,750 / 12 = 395.83
 */
