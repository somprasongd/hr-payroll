'use client';

import { forwardRef } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  PayslipDetail,
  OrgProfileSnapshot,
} from '@/services/payroll.service';

export type ReportType = 'salary' | 'tax' | 'sso' | 'pf';

interface PaymentCoverSheetTemplateProps {
  items: PayslipDetail[];
  orgProfile?: OrgProfileSnapshot;
  logoUrl?: string;
  payrollMonthDate: string;
  type: ReportType;
  isPending?: boolean;
}

// Format number with Thai locale
const formatNumber = (value: number | undefined | null): string => {
  return (value ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Bilingual label component
const BiLabel = ({ th, my }: { th: string; my: string }) => (
  <div>
    <span>{th}</span>
    {my && <span style={{ color: '#6b7280', fontSize: '10px', marginLeft: '4px' }}>{my}</span>}
  </div>
);

const styles = {
  page: {
    padding: '10mm',
    backgroundColor: 'white',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    width: '210mm',
    minHeight: '297mm',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '20px',
    borderBottom: '1px solid #d1d5db',
    paddingBottom: '12px',
  },
  logo: {
    width: '60px',
    height: '60px',
    flexShrink: 0,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontWeight: 'bold',
    fontSize: '18px',
    marginBottom: '4px',
  },
  titleBox: {
    textAlign: 'right' as const,
  },
  mainTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '4px',
  },
  subTitle: {
    fontSize: '12px',
    color: '#6b7280',
  },
  pendingWatermark: {
    position: 'absolute' as const,
    top: '35%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-45deg)',
    fontSize: '60px',
    fontWeight: 'bold',
    color: 'rgba(239, 68, 68, 0.15)', // Red with low opacity
    border: '4px solid rgba(239, 68, 68, 0.15)',
    padding: '20px 40px',
    zIndex: 0,
    pointerEvents: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: '20px',
    fontSize: '11px',
    position: 'relative' as const,
    zIndex: 1,
  },
  th: {
    border: '1px solid #d1d5db',
    padding: '8px',
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
    textAlign: 'center' as const,
  },
  td: {
    border: '1px solid #d1d5db',
    padding: '6px 8px',
    verticalAlign: 'middle',
  },
  summary: {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '40px',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  signatureSection: {
    marginTop: '60px',
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 40px',
  },
  signatureBlock: {
    textAlign: 'center' as const,
  },
  signatureLine: {
    borderBottom: '1px solid #9ca3af',
    width: '150px',
    height: '30px',
    marginBottom: '8px',
  },
};

export const PaymentCoverSheetTemplate = forwardRef<HTMLDivElement, PaymentCoverSheetTemplateProps>(
  function PaymentCoverSheetTemplate({ items, orgProfile, logoUrl, payrollMonthDate, type, isPending }, ref) {
    const payrollDate = new Date(payrollMonthDate);
    const monthYear = `${format(payrollDate, 'MMMM', { locale: th })} ${payrollDate.getFullYear() + 543}`;
    
    // Calculate total
    const totalAmount = items.reduce((sum, item) => {
      switch (type) {
        case 'salary': return sum + item.netPay;
        case 'tax': return sum + item.taxMonthAmount;
        case 'sso': return sum + item.ssoMonthAmount;
        case 'pf': return sum + item.pfMonthAmount;
        default: return sum;
      }
    }, 0);

    const getTitle = () => {
      switch (type) {
        case 'salary': return { th: 'ใบสรุปการจ่ายเงินเดือน', my: 'Salary Payment Summary' };
        case 'tax': return { th: 'ใบสรุปนำส่งภาษี', my: 'Tax Remittance Summary' };
        case 'sso': return { th: 'ใบสรุปนำส่งประกันสังคม', my: 'SSO Contribution Summary' };
        case 'pf': return { th: 'ใบสรุปนำส่งกองทุนสำรองเลี้ยงชีพ', my: 'Provident Fund Summary' };
        default: return { th: 'ใบสรุป', my: 'Summary' };
      }
    };

    const title = getTitle();
    const fullAddress = [
      orgProfile?.address_line1,
      orgProfile?.address_line2,
      orgProfile?.subdistrict,
      orgProfile?.district,
      orgProfile?.province,
      orgProfile?.postal_code,
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} style={styles.page}>
        {isPending && (
          <div style={styles.pendingWatermark}>
            รายการรออนุมัติ / PENDING
          </div>
        )}

        <div style={styles.header}>
          <div style={styles.logo}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>LOGO</div>
            )}
          </div>
          <div style={styles.companyInfo}>
            <div style={styles.companyName}>{orgProfile?.company_name || 'บริษัท ไม่ระบุชื่อ'}</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{fullAddress}</div>
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
              {orgProfile?.phone_main && <span>โทร. {orgProfile.phone_main}</span>}
              {orgProfile?.phone_alt && <span> / {orgProfile.phone_alt}</span>}
            </div>
            {orgProfile?.email && <div style={{ color: '#6b7280', fontSize: '11px' }}>{orgProfile.email}</div>}
            {orgProfile?.tax_id && <div style={{ color: '#6b7280', fontSize: '11px' }}>เลขประจำตัวผู้เสียภาษี {orgProfile.tax_id}</div>}
          </div>
          <div style={styles.titleBox}>
            <div style={styles.mainTitle}><BiLabel th={title.th} my={title.my} /></div>
            <div style={styles.subTitle}>เดือน {monthYear}</div>
            {isPending && <div style={{ color: '#ef4444', fontWeight: 'bold' }}>* รอการอนุมัติ</div>}
          </div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '50px' }}>ลำดับ<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>No.</span></th>
              <th style={{ ...styles.th, textAlign: 'left' }}>พนักงาน<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Employee</span></th>
              <th style={{ ...styles.th, textAlign: 'left' }}>แผนก<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Department</span></th>
              
              {type === 'salary' && (
                <>
                  <th style={{ ...styles.th }}>ธนาคาร<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Bank</span></th>
                  <th style={{ ...styles.th }}>เลขที่บัญชี<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Account No.</span></th>
                </>
              )}
              
              <th style={{ ...styles.th, textAlign: 'right', width: '120px' }}>จำนวนเงิน<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Amount</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td style={{ ...styles.td, textAlign: 'center' }}>{index + 1}</td>
                <td style={styles.td}>
                  <div>{item.employeeName}</div>
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>{item.employeeNumber}</div>
                </td>
                <td style={styles.td}>{item.departmentName || '-'}</td>
                
                {type === 'salary' && (
                  <>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{item.bankName || '-'}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{item.bankAccount || '-'}</td>
                  </>
                )}

                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {formatNumber(
                    type === 'salary' ? item.netPay :
                    type === 'tax' ? item.taxMonthAmount :
                    type === 'sso' ? item.ssoMonthAmount :
                    type === 'pf' ? item.pfMonthAmount : 0
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={styles.summary}>
          <div>จำนวนพนักงาน: <span style={{ color: '#111827' }}>{items.length}</span> คน</div>
          <div>รวมเป็นเงิน: <span style={{ color: '#111827' }}>{formatNumber(totalAmount)}</span> บาท</div>
        </div>

        <div style={styles.signatureSection}>
          <div style={styles.signatureBlock}>
            <div style={styles.signatureLine}></div>
            <div>ผู้จัดทำ / Prepared By</div>
            <div style={{ marginTop: '20px' }}>วันที่ ____/____/________</div>
          </div>
          <div style={styles.signatureBlock}>
            <div style={styles.signatureLine}></div>
            <div>ผู้อนุมัติ / Approved By</div>
            <div style={{ marginTop: '20px' }}>วันที่ ____/____/________</div>
          </div>
        </div>
      </div>
    );
  }
);
