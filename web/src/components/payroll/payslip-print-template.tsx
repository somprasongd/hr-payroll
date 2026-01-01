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
  printOriginal?: boolean;
  printCopy?: boolean;
  isPending?: boolean;
}

// Format number with Thai locale
const formatNumber = (value: number | undefined | null): string => {
  return (value ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Bilingual label component (Thai + Burmese) - same line
const BiLabel = ({ th, my }: { th: string; my: string }) => (
  <div>
    <span>{th}</span>
    {my && <span style={{ color: '#6b7280', fontSize: '7px', marginLeft: '2px' }}>{my}</span>}
  </div>
);

// Row label with bilingual text - same line
const RowLabel = ({ th, my }: { th: string; my: string }) => (
  <div>
    <span>{th}</span>
    {my && <span style={{ color: '#6b7280', fontSize: '6px', marginLeft: '2px' }}>{my}</span>}
  </div>
);

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
    gridTemplateColumns: '1fr 2fr 1fr 1fr 1.5fr',
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
  isPending,
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
          <div style={styles.slipType}>{isPending ? 'รายการรออนุมัติ' : (isOriginal ? 'ต้นฉบับ မူရင်း' : 'สำเนา မိတ္တူ')}</div>
        </div>
      </div>

      {/* Employee Info Row 1 */}
      <div style={styles.infoRow}>
        <div>
          <div style={styles.label}><BiLabel th="รหัสพนักงาน" my="ဝန်ထမ်းနံပါတ်" /></div>
          <div style={styles.value}>{payslip.employeeNumber}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="ชื่อ-นามสกุล" my="သာမည်" /></div>
          <div style={styles.value}>{payslip.employeeName}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="แผนก" my="ငှင်း" /></div>
          <div style={styles.value}>{payslip.departmentName || '-'}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="ตำแหน่ง" my="ရာထူး" /></div>
          <div style={styles.value}>{payslip.positionName || '-'}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="เดือน" my="လ" /></div>
          <div style={styles.value}>{format(payrollDate, 'MMMM', { locale: th })} {payrollDate.getFullYear() + 543}</div>
        </div>
      </div>

      {/* Employee Info Row 2 */}
      <div style={styles.infoRow2}>
        <div>
          <div style={styles.label}><BiLabel th="โอนเข้าบัญชี ธนาคาร" my="ဘဏ်" /></div>
          <div style={styles.value}>{payslip.bankName || '-'}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="เลขที่บัญชี" my="ဘဏ်ယ်ငွေစာရင်း" /></div>
          <div style={styles.value}>{payslip.bankAccount || '-'}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="ประเภทพนักงาน" my="ဝန်ထမ်းအမျိုးအစား" /></div>
          <div style={styles.value}>{payslip.employeeTypeName || (payslip.employeeTypeCode === 'full_time' ? 'ประจำ' : 'ชั่วคราว')}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="วันที่" my="ရက်စွဲ" /></div>
          <div style={styles.value}>{format(periodStart, 'd', { locale: th })}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="ถึงวันที่" my="ရက်စွဲ" /></div>
          <div style={styles.value}>{daysInMonth}</div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Income Column */}
        <div style={styles.incomeCol}>
          <div style={styles.sectionHeader}>รายการได้ <span style={{ color: '#6b7280', fontSize: '10px' }}>ဝင်ငွေစာရင်း</span></div>
          <div style={styles.gridHeader}>
            <div></div>
            <div style={styles.textCenter}>วัน <span style={{ color: '#6b7280', fontSize: '7px' }}>ရက်</span></div>
            <div style={styles.textCenter}>ชม./นาที <span style={{ color: '#6b7280', fontSize: '7px' }}>နာရီ/မိနစ်</span></div>
            <div style={styles.textRight}>บาท <span style={{ color: '#6b7280', fontSize: '7px' }}>ဘတ်</span></div>
          </div>
          <div style={styles.gridRow}><RowLabel th="มาทำงาน" my="အလုပ်လုပ်ချက်" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>{payslip.ptHoursWorked > 0 ? formatNumber(payslip.ptHoursWorked) : '-'}</div><div style={styles.textRight}>-</div></div>
          <div style={styles.gridRow}><RowLabel th="เงินเดือน" my="လစာ" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.salaryAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ค่าล่วงเวลา" my="အချိန်ပိုကျ" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>{payslip.otHours > 0 ? formatNumber(payslip.otHours) : '-'}</div><div style={styles.textRight}>{formatNumber(payslip.otAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ค่าห้องพัก" my="အခန်းခ" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.housingAllowance)}</div></div>
          <div style={styles.gridRow}><RowLabel th="เบี้ยขยัน (ไม่สาย)" my="အလုပ်မနောက်ကျမှု" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.attendanceBonusNoLate)}</div></div>
          <div style={styles.gridRow}><RowLabel th="เบี้ยขยัน (ไม่ลา)" my="အလုပ်မများကျမှု" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.attendanceBonusNoLeave)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ชดเชยวันลา *" my="ခွင်ှပိတ်ရက်ငွေ" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.leaveCompensationAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="อื่นๆ **" my="အခြား" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(othersIncomeTotal)}</div></div>
          <div style={styles.gridRow}><RowLabel th="โบนัส ***" my="ဘိုးနစ်စ်" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.bonusAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ค่าธรรมเนียมแพทย์" my="ဆရားကုန်" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.doctorFee)}</div></div>
        </div>

        {/* Deduction Column */}
        <div>
          <div style={styles.sectionHeader}>รายการหัก <span style={{ color: '#6b7280', fontSize: '10px' }}>နှုတ်ခွေစာရင်း</span></div>
          <div style={styles.gridHeader}>
            <div></div>
            <div style={styles.textCenter}>วัน <span style={{ color: '#6b7280', fontSize: '7px' }}>ရက်</span></div>
            <div style={styles.textCenter}>ชม./นาที <span style={{ color: '#6b7280', fontSize: '7px' }}>နာရီ/မိနစ်</span></div>
            <div style={styles.textRight}>บาท <span style={{ color: '#6b7280', fontSize: '7px' }}>ဘတ်</span></div>
          </div>
          <div style={styles.gridRow}><RowLabel th="ขาดงาน" my="အလုပ်ပျက်" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>0.00</div></div>
          <div style={styles.gridRow}><RowLabel th="หักลาหยุด" my="လုပ်ခချိန်ခွဲခြင်း" /><div style={styles.textCenter}>{payslip.leaveDaysQty > 0 ? payslip.leaveDaysQty : '-'}</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.leaveDaysDeduction)}</div></div>
          <div style={styles.gridRow}><RowLabel th="หักลาหยุด 2" my="လစ်ဒိတ်ဝေခွေခြင်း" /><div style={styles.textCenter}>{payslip.leaveDoubleQty > 0 ? payslip.leaveDoubleQty : '-'}</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.leaveDoubleDeduction)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ลาชั่วโมง" my="နှုတ်ခိုင်းနာရီခြင်း" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>{payslip.leaveHoursQty > 0 ? payslip.leaveHoursQty : '-'}</div><div style={styles.textRight}>{formatNumber(payslip.leaveHoursDeduction)}</div></div>
          <div style={styles.gridRow}><RowLabel th="มาสาย" my="အလုပ်နောက်ကျကျ" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>{payslip.lateMinutesQty > 0 ? payslip.lateMinutesQty : '-'}</div><div style={styles.textRight}>{formatNumber(payslip.lateMinutesDeduction)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ออกก่อนเวลา" my="အပိုင်းဝါဒ်ထွက်ခြင်း" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>0.00</div></div>
          <div style={styles.gridRow}><RowLabel th="ภาษี" my="အခွန်" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.taxMonthAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ประกันสังคม" my="ဘတ်ချို့နို့ချိုပ်" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.ssoMonthAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="กองทุนสำรอง" my="အမှု" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.pfMonthAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ค่าไฟ" my="မီးခဲ" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.electricAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ค่าน้ำ" my="ရေခဲ" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.waterAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="ค่าอินเทอร์เน็ต" my="အင်တာနက်ချို့နို့ချိုပ်" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.internetAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="เบิกล่วงหน้า" my="ကြိုတင်ငွေထုတ်ခြင်း" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(payslip.advanceRepayAmount)}</div></div>
          <div style={styles.gridRow}><RowLabel th="กู้ยืม" my="ချေးငှား" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(loanRepaymentTotal)}</div></div>
          <div style={styles.gridRow}><RowLabel th="อื่นๆ ****" my="အခြား" /><div style={styles.textCenter}>-</div><div style={styles.textCenter}>-</div><div style={styles.textRight}>{formatNumber(othersDeductionTotal)}</div></div>
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
          <span>รวมรายได้ทั้งหมด <span style={{ color: '#6b7280', fontSize: '8px' }}>ဝင်ငွေပေါင်းခြင်း</span></span>
          <span style={styles.green}>{formatNumber(payslip.incomeTotal)} บาท</span>
        </div>
        <div style={styles.totalRow}>
          <span>รวมรายจ่ายทั้งหมด <span style={{ color: '#6b7280', fontSize: '8px' }}>ထုတ်ငွေပေါင်းခြင်း</span></span>
          <span style={styles.red}>{formatNumber(payslip.deductionTotal)} บาท</span>
        </div>
      </div>

      {/* Accumulation */}
      <div style={styles.accumRow}>
        <div><div style={styles.gray}>เงินได้สะสม <span style={{ fontSize: '6px' }}>ရင်သားငွေ</span></div><div style={styles.value}>{formatNumber(payslip.incomeAccumTotal)}</div></div>
        <div><div style={styles.gray}>ภาษีสะสม <span style={{ fontSize: '6px' }}>အခွန်ရင်သားငွေ</span></div><div style={styles.value}>{formatNumber(payslip.taxAccumTotal)}</div></div>
        <div><div style={styles.gray}>ประกันสังคมสะสม <span style={{ fontSize: '6px' }}>ဘတ်ချို့နို့ချိုပ်ရင်သားငွေ</span></div><div style={styles.value}>{formatNumber(payslip.ssoAccumTotal)}</div></div>
        <div><div style={styles.gray}>กองทุนสำรองสะสม <span style={{ fontSize: '6px' }}>အမှုစုစောင်း</span></div><div style={styles.value}>{formatNumber(payslip.pfAccumTotal)}</div></div>
        <div><div style={styles.gray}>กู้ยืมแลหนี้(คงเหลือ) <span style={{ fontSize: '6px' }}>ချေးငွေ(ကျန်ရှိ%ကျော)</span></div><div style={styles.value}>{formatNumber(payslip.loanOutstandingTotal)}</div></div>
      </div>

      {/* Net Pay and Signature */}
      <div style={styles.netPayRow}>
        <div>
          <span style={styles.netPayLabel}>รวมรายได้สุทธิ <span style={{ color: '#6b7280', fontSize: '9px' }}>ထုတ်ငွေသန့်ခမ်း</span> </span>
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
    const { printOriginal = true, printCopy = true, isPending = false, ...otherProps } = props;
    
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
        {/* For pending status, print only one page with pending label */}
        {isPending ? (
          <SlipHalf {...otherProps} isOriginal={true} isPending={true} />
        ) : (
          <>
            {/* Original - Full Page */}
            {printOriginal && <SlipHalf {...otherProps} isOriginal={true} isPending={false} />}
            
            {/* Copy - Full Page */}
            {printCopy && <SlipHalf {...otherProps} isOriginal={false} isPending={false} />}
          </>
        )}
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
