'use client';

import { forwardRef } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { PayoutPt, PayoutPtItem } from '@/services/payout-pt.service';
import { OrgProfile } from '@/services/org-profile.service';
import { Employee } from '@/services/employee.service';

interface PtPayoutPrintTemplateProps {
  payout: PayoutPt;
  employee?: Employee | null;
  orgProfile?: OrgProfile | null;
  logoUrl?: string;
  printOriginal?: boolean;
  printCopy?: boolean;
}

// Format number with Thai locale
const formatNumber = (value: number | undefined | null): string => {
  return (value ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Bilingual label component (Thai + Burmese) - same line
const BiLabel = ({ th: thText, my }: { th: string; my: string }) => (
  <div>
    <span>{thText}</span>
    {my && <span style={{ color: '#6b7280', fontSize: '7px', marginLeft: '2px' }}>{my}</span>}
  </div>
);

// Inline styles for print compatibility
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
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
    borderBottom: '1px solid #d1d5db',
    paddingBottom: '12px',
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    width: '60px',
    height: '60px',
    objectFit: 'contain' as const,
  },
  logoPlaceholder: {
    width: '60px',
    height: '60px',
    border: '1px dashed #d1d5db',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: '#9ca3af',
  },
  companyInfo: {
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
    border: '2px solid #f97316',
    color: '#f97316',
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
    gridTemplateColumns: '1fr 2fr 1fr 1fr',
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
    fontSize: '11px',
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
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '8px',
    fontSize: '10px',
    fontWeight: 500,
    color: '#6b7280',
    marginBottom: '6px',
    paddingBottom: '4px',
    borderBottom: '1px solid #e5e7eb',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '8px',
    fontSize: '11px',
    marginBottom: '4px',
    lineHeight: '1.4',
  },
  textRight: {
    textAlign: 'right' as const,
  },
  totalsSection: {
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '2px solid #9ca3af',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 'bold',
    fontSize: '12px',
    marginBottom: '8px',
  },
  netPayRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    color: '#f97316',
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
  gray: { color: '#6b7280' },
};

// Single slip page (original or copy)
const SlipPage = ({
  payout,
  employee,
  orgProfile,
  logoUrl,
  isOriginal,
}: PtPayoutPrintTemplateProps & { isOriginal: boolean }) => {
  const titleName = employee?.titleName || '';
  const firstName = employee?.firstName || employee?.FirstName || '';
  const lastName = employee?.lastName || employee?.LastName || '';
  const employeeName = `${titleName} ${firstName} ${lastName}`.trim() || '-';
  const employeeNumber = employee?.employeeNumber || employee?.EmployeeNumber || '-';
  const paidDate = payout.paidAt ? new Date(payout.paidAt) : new Date();

  return (
    <div style={styles.slipPage}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoSection}>
          {logoUrl ? (
            <img src={logoUrl} alt="Company Logo" style={styles.logo} />
          ) : (
            <div style={styles.logoPlaceholder}>LOGO</div>
          )}
          <div style={styles.companyInfo}>
            <div style={styles.companyName}>{orgProfile?.companyName || 'บริษัท'}</div>
            <div>{orgProfile?.addressLine1 || ''}</div>
            <div>โทร. {orgProfile?.phoneMain || '-'}</div>
            <div>{orgProfile?.email || ''}</div>
            {orgProfile?.taxId && <div>เลขประจำตัวผู้เสียภาษี {orgProfile.taxId}</div>}
          </div>
        </div>
        <div style={styles.slipTitle}>
          <div style={styles.slipTitleBox}>
            <div>ใบจ่ายล่วงหน้า</div>
            <div style={{ fontSize: '10px' }}>ADVANCE PAYMENT SLIP</div>
          </div>
          <div style={styles.slipType}>{isOriginal ? 'ต้นฉบับ မူရင်း' : 'สำเนา မိတ္တူ'}</div>
        </div>
      </div>

      {/* Employee Info */}
      <div style={styles.infoRow}>
        <div>
          <div style={styles.label}><BiLabel th="รหัสพนักงาน" my="ဝန်ထမ်းနံပါတ်" /></div>
          <div style={styles.value}>{employeeNumber}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="ชื่อ-นามสกุล" my="သာမည်" /></div>
          <div style={styles.value}>{employeeName}</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="ประเภทพนักงาน" my="ဝန်ထမ်းအမျိုးအစား" /></div>
          <div style={styles.value}>พาร์ทไทม์</div>
        </div>
        <div>
          <div style={styles.label}><BiLabel th="วันที่จ่าย" my="ထုတ်ပေးသည့်ရက်" /></div>
          <div style={styles.value}>{format(paidDate, 'd MMMM yyyy', { locale: th })}</div>
        </div>
      </div>

      {/* Main Content - Work Items Table */}
      <div style={styles.mainContent}>
        <div style={styles.sectionHeader}>
          รายการทำงาน <span style={{ color: '#6b7280', fontSize: '10px' }}>အလုပ်လုပ်ချက်စာရင်း</span>
        </div>
        <div style={styles.tableHeader}>
          <div>วันที่ทำงาน <span style={{ color: '#6b7280', fontSize: '7px' }}>အလုပ်လုပ်သည့်ရက်</span></div>
          <div style={styles.textRight}>ชั่วโมง <span style={{ color: '#6b7280', fontSize: '7px' }}>နာရီ</span></div>
        </div>
        {payout.items?.map((item, index) => (
          <div key={item.worklogId || index} style={styles.tableRow}>
            <div>{format(new Date(item.workDate), 'dd/MM/yyyy')}</div>
            <div style={styles.textRight}>{formatNumber(item.totalHours)}</div>
          </div>
        ))}
      </div>

      {/* Totals Section */}
      <div style={styles.totalsSection}>
        <div style={styles.totalRow}>
          <span>อัตราค่าจ้าง/ชม. <span style={{ color: '#6b7280', fontSize: '8px' }}>တစ်နာရီလုပ်ခ</span></span>
          <span>{formatNumber(payout.hourlyRate)} บาท</span>
        </div>
        <div style={styles.totalRow}>
          <span>ชั่วโมงรวม <span style={{ color: '#6b7280', fontSize: '8px' }}>နာရီပေါင်း</span></span>
          <span>{formatNumber(payout.totalHours)} ชม.</span>
        </div>
      </div>

      {/* Net Pay and Signature */}
      <div style={styles.netPayRow}>
        <div>
          <span style={styles.netPayLabel}>ยอดเงินรวม <span style={{ color: '#6b7280', fontSize: '9px' }}>ထုတ်ငွေစုစုပေါင်း</span> </span>
          <span style={styles.netPayValue}>{formatNumber(payout.amount)}</span>
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}> บาท</span>
        </div>
        <div style={styles.signatureBox}>
          <div style={styles.signatureLine}></div>
          <div style={styles.signatureLabel}>ลายเซ็น <span style={{ fontSize: '8px' }}>လက်မှတ်</span></div>
        </div>
      </div>
    </div>
  );
};

// Main component
export const PtPayoutPrintTemplate = forwardRef<HTMLDivElement, PtPayoutPrintTemplateProps>(
  function PtPayoutPrintTemplate(props, ref) {
    const { printOriginal = true, printCopy = true, ...otherProps } = props;
    
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
        {printOriginal && <SlipPage {...otherProps} isOriginal={true} />}
        
        {/* Copy - Full Page */}
        {printCopy && <SlipPage {...otherProps} isOriginal={false} />}
      </div>
    );
  }
);

export default PtPayoutPrintTemplate;
