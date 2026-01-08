'use client';

import { forwardRef } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { OrgProfileSnapshot } from '@/services/payroll.service';
import { BonusItem } from '@/services/bonus-service';
import { formatTenure } from '@/lib/format-tenure'; // You might need to adjust import path or copy utility if not exported

interface BonusPrintTemplateProps {
  items: BonusItem[];
  orgProfile?: OrgProfileSnapshot;
  logoUrl?: string;
  periodStartDate: string;
  periodEndDate: string;
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
    marginBottom: '12px',
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
    fontSize: '11px',
  },
  companyName: {
    fontWeight: 'bold',
    fontSize: '16px',
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

export const BonusPrintTemplate = forwardRef<HTMLDivElement, BonusPrintTemplateProps>(
  function BonusPrintTemplate({ items, orgProfile, logoUrl, periodStartDate, periodEndDate }, ref) {
    const startDate = new Date(periodStartDate);
    const endDate = new Date(periodEndDate);
    const dateRange = `${format(startDate, 'd MMM yyyy', { locale: th })} - ${format(endDate, 'd MMM yyyy', { locale: th })}`;
    
    // Calculate totals
    const totalCurrentSalary = items.reduce((sum, item) => sum + item.currentSalary, 0);
    const totalBonusAmount = items.reduce((sum, item) => sum + item.bonusAmount, 0);

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
            <div style={{ color: '#6b7280' }}>{fullAddress}</div>
            <div style={{ color: '#6b7280' }}>
              {orgProfile?.phone_main && <span>โทร. {orgProfile.phone_main}</span>}
              {orgProfile?.phone_alt && <span> / {orgProfile.phone_alt}</span>}
            </div>
            {orgProfile?.email && <div style={{ color: '#6b7280' }}>{orgProfile.email}</div>}
            {orgProfile?.tax_id && <div style={{ color: '#6b7280' }}>เลขประจำตัวผู้เสียภาษี {orgProfile.tax_id}</div>}
          </div>
          <div style={styles.titleBox}>
            <div style={styles.mainTitle}><BiLabel th="สรุปการจ่ายโบนัส" my="Bonus Payment Summary" /></div>
            <div style={styles.subTitle}>รอบ: {dateRange}</div>
          </div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '40px' }}>ลำดับ<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>No.</span></th>
              <th style={{ ...styles.th, textAlign: 'left' }}>พนักงาน<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Employee</span></th>
              <th style={{ ...styles.th, textAlign: 'center' }}>อายุงาน<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Tenure</span></th>
              <th style={{ ...styles.th, textAlign: 'right' }}>เงินเดือน<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Salary</span></th>
              <th style={{ ...styles.th, textAlign: 'center' }}>จำนวนเดือน<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Months</span></th>
              <th style={{ ...styles.th, textAlign: 'right' }}>ยอดโบนัส<br/><span style={{fontSize: '9px', fontWeight: 'normal'}}>Amount</span></th>
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
                <td style={{ ...styles.td, textAlign: 'center' }}>
                    {/* Simplified tenure display since formatTenure requires t function, maybe just days or a helper if available. 
                        Let's try to calculate Years/Months/Days if possible or just show days for now. 
                        Wait, formatTenure IS available in lib/format-tenure.ts but it needs a t function.
                        Let's just show Days for consistency with API or simple calculation.
                        Actually, let's just show Days if formatTenure is hard to use here without passing t.
                        Or better, let's implement a simple logic here.
                    */}
                    {Math.floor(item.tenureDays / 365)}Y {Math.floor((item.tenureDays % 365) / 30)}M
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{formatNumber(item.currentSalary)}</td>
                <td style={{ ...styles.td, textAlign: 'center' }}>{item.bonusMonths}</td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold' }}>{formatNumber(item.bonusAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
             <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                <td colSpan={3} style={{ ...styles.td, textAlign: 'right' }}>รวมทั้งหมด / Total</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{formatNumber(totalCurrentSalary)}</td>
                <td style={styles.td}></td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{formatNumber(totalBonusAmount)}</td>
             </tr>
          </tfoot>
        </table>

        <div style={styles.summary}>
          <div>จำนวนพนักงาน: <span style={{ color: '#111827' }}>{items.length}</span> คน</div>
        </div>

        <div style={styles.signatureSection}>
          <div style={styles.signatureBlock}>
            <div style={styles.signatureLine}></div>
            <div>ผู้จัดทำ / Prepared By</div>
            <div style={{ marginTop: '20px' }}>วันที่ ______/______/___________</div>
          </div>
          <div style={styles.signatureBlock}>
            <div style={styles.signatureLine}></div>
            <div>ผู้อนุมัติ / Approved By</div>
            <div style={{ marginTop: '20px' }}>วันที่ ______/______/___________</div>
          </div>
        </div>
      </div>
    );
  }
);
