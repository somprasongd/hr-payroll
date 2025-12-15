'use client';

import { forwardRef } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  PayslipDetail,
  OrgProfileSnapshot,
} from '@/services/payroll.service';

interface PayslipPrintTemplateProps {
  payslip: PayslipDetail;
  orgProfile?: OrgProfileSnapshot;
  logoUrl?: string;
  bonusYear?: number | null;
  payrollMonthDate: string;
  periodStartDate: string;
}

// Format number with Thai locale
const formatNumber = (value: number | undefined | null): string => {
  return (value ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Inline styles for print compatibility (Tailwind arbitrary values don't work with CDN)
const styles = {
  slipPage: {
    border: '1px solid #9ca3af',
    padding: '10mm',
    fontSize: '11px',
    minHeight: '270mm',
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
    pageBreakAfter: 'always' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
    borderBottom: '1px solid #d1d5db',
    paddingBottom: '12px',
  },
  logo: {
    width: '60px',
    height: '60px',
    flexShrink: 0,
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '10px',
  },
  companyInfo: {
    flex: 1,
    fontSize: '11px',
  },
  companyName: {
    fontWeight: 'bold',
    fontSize: '16px',
    marginBottom: '4px',
  },
  slipTitle: {
    textAlign: 'right' as const,
  },
  slipTitleBox: {
    border: '2px solid #ef4444',
    color: '#ef4444',
    padding: '6px 16px',
    fontWeight: 'bold',
    fontSize: '16px',
  },
  slipType: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#2563eb',
    marginTop: '6px',
  },
  infoRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 1fr 1fr 1.5fr',
    gap: '12px',
    fontSize: '11px',
    marginBottom: '12px',
    borderBottom: '1px solid #d1d5db',
    paddingBottom: '12px',
  },
  infoRow2: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 2fr 1fr 0.5fr 0.5fr',
    gap: '12px',
    fontSize: '11px',
    marginBottom: '12px',
    borderBottom: '1px solid #d1d5db',
    paddingBottom: '12px',
  },
  label: {
    color: '#6b7280',
    fontSize: '10px',
    marginBottom: '2px',
  },
  value: {
    fontWeight: 500,
    fontSize: '11px',
  },
  mainContent: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    fontSize: '11px',
  },
  incomeCol: {
    borderRight: '1px solid #d1d5db',
    paddingRight: '24px',
  },
  sectionHeader: {
    fontWeight: 'bold',
    textAlign: 'center' as const,
    backgroundColor: '#f3f4f6',
    padding: '8px',
    marginBottom: '8px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
  },
  gridHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    gap: '8px',
    fontSize: '10px',
    fontWeight: 500,
    color: '#6b7280',
    marginBottom: '6px',
    paddingBottom: '4px',
    borderBottom: '1px solid #e5e7eb',
  },
  gridRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    gap: '8px',
    fontSize: '11px',
    marginBottom: '4px',
    lineHeight: '1.4',
  },
  textCenter: {
    textAlign: 'center' as const,
  },
  textRight: {
    textAlign: 'right' as const,
  },
  footnotes: {
    fontSize: '10px',
    color: '#6b7280',
    marginTop: '12px',
    borderTop: '1px solid #d1d5db',
    paddingTop: '8px',
  },
  totalsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    fontSize: '12px',
    marginTop: '12px',
    borderTop: '1px solid #d1d5db',
    paddingTop: '12px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  accumRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '12px',
    fontSize: '10px',
    marginTop: '12px',
    backgroundColor: '#f9fafb',
    padding: '12px',
    border: '1px solid #e5e7eb',
  },
  netPayRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '2px solid #9ca3af',
  },
  netPayLabel: {
    fontWeight: 'bold',
    fontSize: '14px',
  },
  netPayValue: {
    fontWeight: 'bold',
    fontSize: '18px',
    color: '#16a34a',
  },
  signatureBox: {
    textAlign: 'center' as const,
    marginTop: '30px',
  },
  signatureLine: {
    borderBottom: '1px solid #9ca3af',
    width: '120px',
    marginBottom: '6px',
  },
  signatureLabel: {
    fontSize: '11px',
    color: '#6b7280',
  },
  green: { color: '#16a34a' },
  red: { color: '#dc2626' },
  gray: { color: '#6b7280' },
};

// Single slip half (original or copy)
const SlipHalf = ({
  payslip,
  orgProfile,
  logoUrl,
  bonusYear,
  payrollMonthDate,
  periodStartDate,
  isOriginal,
}: PayslipPrintTemplateProps & { isOriginal: boolean }) => {
  const payrollDate = new Date(payrollMonthDate);
  const periodStart = new Date(periodStartDate);
  const daysInMonth = getDaysInMonth(periodStart);

  // Calculate totals
  const othersIncomeTotal = payslip.othersIncome?.reduce((sum, item) => sum + (item.value || 0), 0) || 0;
  const othersDeductionTotal = payslip.othersDeduction?.reduce((sum, item) => sum + (item.value || 0), 0) || 0;
  const loanRepaymentTotal = payslip.loanRepayments?.reduce((sum, item) => sum + (item.value || 0), 0) || 0;

  // Full address
  const fullAddress = [
    orgProfile?.address_line1,
    orgProfile?.address_line2,
    orgProfile?.subdistrict,
    orgProfile?.district,
    orgProfile?.province,
    orgProfile?.postal_code,
  ].filter(Boolean).join(' ');

  return (
    <div style={styles.slipPage}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <div style={styles.logoPlaceholder}>LOGO</div>
          )}
        </div>
        <div style={styles.companyInfo}>
          <div style={styles.companyName}>{orgProfile?.company_name || 'บริษัท ไม่ระบุชื่อ'}</div>
          {fullAddress && <div style={styles.gray}>{fullAddress}</div>}
          <div style={styles.gray}>
            {orgProfile?.phone_main && <span>โทร. {orgProfile.phone_main}</span>}
            {orgProfile?.phone_alt && <span> / {orgProfile.phone_alt}</span>}
          </div>
          {orgProfile?.email && <div style={styles.gray}>{orgProfile.email}</div>}
          {orgProfile?.tax_id && <div style={styles.gray}>เลขประจำตัวผู้เสียภาษี {orgProfile.tax_id}</div>}
        </div>
        <div style={styles.slipTitle}>
          <div style={styles.slipTitleBox}>ใบจ่ายเงินเดือน</div>
          <div style={{ fontSize: '10px', ...styles.gray }}>PAY SLIP</div>
          <div style={styles.slipType}>{isOriginal ? 'ต้นฉบับ' : 'สำเนา'}</div>
        </div>
      </div>

      {/* Employee Info Row 1 */}
      <div style={styles.infoRow}>
        <div>
          <div style={styles.label}>รหัสพนักงาน</div>
          <div style={styles.value}>{payslip.employeeNumber}</div>
        </div>
        <div>
          <div style={styles.label}>ชื่อ-นามสกุล</div>
          <div style={styles.value}>{payslip.employeeName}</div>
        </div>
        <div>
          <div style={styles.label}>แผนก</div>
          <div style={styles.value}>{payslip.departmentName || '-'}</div>
        </div>
        <div>
          <div style={styles.label}>ตำแหน่ง</div>
          <div style={styles.value}>{payslip.positionName || '-'}</div>
        </div>
        <div>
          <div style={styles.label}>เดือน</div>
          <div style={styles.value}>{format(payrollDate, 'MMMM', { locale: th })} {payrollDate.getFullYear() + 543}</div>
        </div>
      </div>

      {/* Employee Info Row 2 */}
      <div style={styles.infoRow2}>
        <div>
          <div style={styles.label}>โอนเข้าบัญชี ธนาคาร</div>
          <div style={styles.value}>{payslip.bankName || '-'}</div>
        </div>
        <div>
          <div style={styles.label}>เลขที่บัญชี</div>
          <div style={styles.value}>{payslip.bankAccount || '-'}</div>
        </div>
        <div>
          <div style={styles.label}>ประเภทพนักงาน</div>
          <div style={styles.value}>{payslip.employeeTypeName || (payslip.employeeTypeCode === 'full_time' ? 'ประจำ' : 'ชั่วคราว')}</div>
        </div>
        <div>
          <div style={styles.label}>วันที่</div>
          <div style={styles.value}>{format(periodStart, 'd', { locale: th })}</div>
        </div>
        <div>
          <div style={styles.label}>ถึงวันที่</div>
          <div style={styles.value}>{daysInMonth}</div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Income Column */}
        <div style={styles.incomeCol}>
          <div style={styles.sectionHeader}>รายการได้</div>
          <div style={styles.gridHeader}>
            <div></div>
            <div style={styles.textCenter}>วัน</div>
            <div style={styles.textCenter}>ชม./นาที</div>
            <div style={styles.textRight}>บาท</div>
          </div>
          <div style={styles.gridRow}><div>มาทำงาน</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>{payslip.ptHoursWorked > 0 ? formatNumber(payslip.ptHoursWorked) : '-'}</div><div style={styles.textRight}>-</div></div>
          <div style={styles.gridRow}><div>เงินเดือน</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.salaryAmount)}</div></div>
          <div style={styles.gridRow}><div>ค่าล่วงเวลา</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>{payslip.otHours > 0 ? formatNumber(payslip.otHours) : '-'}</div><div style={styles.textRight}>{formatNumber(payslip.otAmount)}</div></div>
          <div style={styles.gridRow}><div>ค่าห้องพัก</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.housingAllowance)}</div></div>
          <div style={styles.gridRow}><div>เบี้ยขยัน (ไม่สาย)</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.attendanceBonusNoLate)}</div></div>
          <div style={styles.gridRow}><div>เบี้ยขยัน (ไม่ลา)</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.attendanceBonusNoLeave)}</div></div>
          <div style={styles.gridRow}><div>ชดเชยวันลา *</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.leaveCompensationAmount)}</div></div>
          <div style={styles.gridRow}><div>อื่นๆ **</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(othersIncomeTotal)}</div></div>
          <div style={styles.gridRow}><div>โบนัส ***</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.bonusAmount)}</div></div>
          <div style={styles.gridRow}><div>ค่าธรรมเนียมแพทย์</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.doctorFee)}</div></div>
        </div>

        {/* Deduction Column */}
        <div>
          <div style={styles.sectionHeader}>รายการหัก</div>
          <div style={styles.gridHeader}>
            <div></div>
            <div style={styles.textCenter}>วัน</div>
            <div style={styles.textCenter}>ชม./นาที</div>
            <div style={styles.textRight}>บาท</div>
          </div>
          <div style={styles.gridRow}><div>ขาดงาน</div><div style={styles.textCenter}>{payslip.leaveDaysQty > 0 ? payslip.leaveDaysQty : '-'}</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.leaveDaysDeduction)}</div></div>
          <div style={styles.gridRow}><div>หักลาหยุด</div><div style={styles.textCenter}>{payslip.leaveDaysQty > 0 ? payslip.leaveDaysQty : '-'}</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.leaveDaysDeduction)}</div></div>
          <div style={styles.gridRow}><div>หักลาหยุด 2</div><div style={styles.textCenter}>{payslip.leaveDoubleQty > 0 ? payslip.leaveDoubleQty : '-'}</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.leaveDoubleDeduction)}</div></div>
          <div style={styles.gridRow}><div>ลาชั่วโมง</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>{payslip.leaveHoursQty > 0 ? payslip.leaveHoursQty : '-'}</div><div style={styles.textRight}>{formatNumber(payslip.leaveHoursDeduction)}</div></div>
          <div style={styles.gridRow}><div>มาสาย</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>{payslip.lateMinutesQty > 0 ? payslip.lateMinutesQty : '-'}</div><div style={styles.textRight}>{formatNumber(payslip.lateMinutesDeduction)}</div></div>
          <div style={styles.gridRow}><div>ภาษี</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.taxMonthAmount)}</div></div>
          <div style={styles.gridRow}><div>ประกันสังคม</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.ssoMonthAmount)}</div></div>
          <div style={styles.gridRow}><div>กองทุนสำรอง</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.pfMonthAmount)}</div></div>
          <div style={styles.gridRow}><div>ค่าไฟ</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.electricAmount)}</div></div>
          <div style={styles.gridRow}><div>ค่าน้ำ</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.waterAmount)}</div></div>
          <div style={styles.gridRow}><div>ค่าอินเทอร์เน็ต</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.internetAmount)}</div></div>
          <div style={styles.gridRow}><div>เบิกล่วงหน้า</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.advanceRepayAmount)}</div></div>
          <div style={styles.gridRow}><div>กู้ยืม</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(loanRepaymentTotal)}</div></div>
          <div style={styles.gridRow}><div>อื่นๆ ****</div><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(othersDeductionTotal)}</div></div>
        </div>
      </div>

      {/* Footnotes */}
      <div style={styles.footnotes}>
        <span>* ชดเชยวันลา 14 วัน (ประจำปี)</span>
        {bonusYear && <span style={{ marginLeft: '8px' }}>*** ประจำปี {bonusYear + 543}</span>}
      </div>

      {/* Totals */}
      <div style={styles.totalsGrid}>
        <div style={styles.totalRow}>
          <span>รวมรายได้ทั้งหมด</span>
          <span style={styles.green}>{formatNumber(payslip.incomeTotal)} บาท</span>
        </div>
        <div style={styles.totalRow}>
          <span>รวมรายจ่ายทั้งหมด</span>
          <span style={styles.red}>{formatNumber(payslip.deductionTotal)} บาท</span>
        </div>
      </div>

      {/* Accumulation */}
      <div style={styles.accumRow}>
        <div><div style={styles.gray}>เงินได้สะสม</div><div style={styles.value}>{formatNumber(payslip.incomeAccumTotal)}</div></div>
        <div><div style={styles.gray}>ภาษีสะสม</div><div style={styles.value}>{formatNumber(payslip.taxAccumTotal)}</div></div>
        <div><div style={styles.gray}>ประกันสังคมสะสม</div><div style={styles.value}>{formatNumber(payslip.ssoAccumTotal)}</div></div>
        <div><div style={styles.gray}>กองทุนสำรองสะสม</div><div style={styles.value}>{formatNumber(payslip.pfAccumTotal)}</div></div>
        <div><div style={styles.gray}>หนี้คงเหลือ</div><div style={styles.value}>{formatNumber(payslip.loanOutstandingTotal)}</div></div>
      </div>

      {/* Net Pay and Signature */}
      <div style={styles.netPayRow}>
        <div>
          <span style={styles.netPayLabel}>รวมรายได้สุทธิ </span>
          <span style={styles.netPayValue}>{formatNumber(payslip.netPay)} บาท</span>
        </div>
        <div style={styles.signatureBox}>
          <div style={styles.signatureLine}></div>
          <div style={styles.signatureLabel}>ลายเซ็น</div>
        </div>
      </div>
    </div>
  );
};

// Main component
export const PayslipPrintTemplate = forwardRef<HTMLDivElement, PayslipPrintTemplateProps>(
  function PayslipPrintTemplate(props, ref) {
    return (
      <div
        ref={ref}
        style={{
          width: '210mm',
          padding: '0',
          boxSizing: 'border-box',
          backgroundColor: 'white',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {/* Original - Full Page */}
        <SlipHalf {...props} isOriginal={true} />
        
        {/* Copy - Full Page */}
        <SlipHalf {...props} isOriginal={false} />
      </div>
    );
  }
);

// Print styles for @media print
export const payslipPrintStyles = `
@media print {
  @page {
    size: A4 portrait;
    margin: 3mm;
  }
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

export default PayslipPrintTemplate;
