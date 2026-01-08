'use client';

import { forwardRef } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { SalaryAdvance } from '@/services/salary-advance-service';
import { OrgProfile } from '@/services/org-profile.service';

interface SalaryAdvancePrintTemplateProps {
  salaryAdvance: SalaryAdvance;
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

const styles = {
  page: {
    padding: '15mm 15mm',
    backgroundColor: 'white',
    fontSize: '14px',
    fontFamily: 'Sarabun, Arial, sans-serif',
    width: '210mm',
    minHeight: '297mm',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    // pageBreakAfter: 'always' as const,
  },
  header: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    borderBottom: '1px solid #d1d5db',
    paddingBottom: '15px',
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
    flex: 1,
    fontSize: '12px',
    lineHeight: '1.4',
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
    marginBottom: '4px',
  },
  subTitle: {
    fontSize: '12px',
    color: '#6b7280',
  },
  section: {
    marginBottom: '15px',
  },
  sectionTitle: {
    fontWeight: 'bold',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '4px',
    marginBottom: '8px',
    fontSize: '14px',
  },
  row: {
    display: 'flex',
    marginBottom: '8px',
  },
  label: {
    width: '180px',
    color: '#374151',
    fontWeight: 500,
  },
  value: {
    flex: 1,
    fontWeight: 600,
  },
  signatureSection: {
    marginTop: 'auto', // Push to bottom if content is short, or just margin top
    paddingTop: '30px',
    display: 'flex',
    justifyContent: 'space-between',
    paddingLeft: '20px',
    paddingRight: '20px',
  },
  signatureBlock: {
    textAlign: 'center' as const,
    width: '200px',
  },
  signatureLine: {
    borderBottom: '1px solid #000',
    marginTop: '40px',
    marginBottom: '8px',
    height: '1px',
  },
  watermark: {
    position: 'absolute' as const,
    top: '5mm',
    right: '15mm',
    border: '1px solid #000',
    padding: '4px 8px',
    fontSize: '10px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
  }
};

const AdvancePage = ({ 
  salaryAdvance, 
  orgProfile, 
  logoUrl, 
  isOriginal 
}: { 
  salaryAdvance: SalaryAdvance; 
  orgProfile?: OrgProfile | null; 
  logoUrl?: string; 
  isOriginal: boolean;
}) => {
  const fullAddress = [
    orgProfile?.addressLine1,
    orgProfile?.addressLine2,
    orgProfile?.subdistrict,
    orgProfile?.district,
    orgProfile?.province,
    orgProfile?.postalCode,
  ].filter(Boolean).join(' ');

  const formattedDate = format(new Date(salaryAdvance.advanceDate), 'd MMMM yyyy', { locale: th });
  const payrollMonth = format(new Date(salaryAdvance.payrollMonthDate), 'MMMM yyyy', { locale: th });

  return (
    <div style={{ ...styles.page, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} className="print-page">
      {/* Watermark */}
      <div style={styles.watermark}>
        {isOriginal ? 'ต้นฉบับ / ORIGINAL' : 'สำเนา / COPY'}
      </div>

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
          <div style={styles.companyName}>{orgProfile?.companyName || 'บริษัท ไม่ระบุชื่อ'}</div>
          <div style={{ color: '#6b7280' }}>{fullAddress}</div>
          <div style={{ color: '#6b7280' }}>
            {orgProfile?.phoneMain && <span>โทร. {orgProfile.phoneMain}</span>}
            {orgProfile?.phoneAlt && <span> / {orgProfile.phoneAlt}</span>}
          </div>
          {orgProfile?.email && <div style={{ color: '#6b7280' }}>{orgProfile.email}</div>}
          {orgProfile?.taxId && <div style={{ color: '#6b7280' }}>เลขประจำตัวผู้เสียภาษี {orgProfile.taxId}</div>}
        </div>
        <div style={styles.titleBox}>
          <div style={styles.mainTitle}>ใบเบิกเงินล่วงหน้า</div>
          <div style={styles.subTitle}>SALARY ADVANCE REQUEST</div>
        </div>
      </div>

      {/* Request Info */}
      <div style={styles.section}>
        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
          วันที่ทำรายการ: <b>{formattedDate}</b>
        </div>
        
        <div style={styles.sectionTitle}>1. ข้อมูลพนักงาน (Employee Information)</div>
        <div style={styles.row}>
          <div style={styles.label}>ชื่อ-นามสกุล (Name):</div>
          <div style={styles.value}>{salaryAdvance.employeeName || '-'}</div>
        </div>
        <div style={styles.row}>
          <div style={styles.label}>รหัสพนักงาน (Employee Code):</div>
          <div style={styles.value}>{salaryAdvance.employeeCode || salaryAdvance.employeeId}</div>
        </div>
      </div>

      {/* Advance Details */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>2. รายละเอียดการเบิกเงิน (Request Details)</div>
        <div style={styles.row}>
          <div style={styles.label}>จำนวนเงินที่เบิก (Amount):</div>
          <div style={styles.value}>{formatNumber(salaryAdvance.amount)} บาท</div>
        </div>
        <div style={styles.row}>
          <div style={styles.label}>หักคืนในเดือน (Deduction Month):</div>
          <div style={styles.value}>{payrollMonth}</div>
        </div>
      </div>

      {/* Terms */}
      <div style={{ marginTop: '20px', fontSize: '12px', lineHeight: '1.6' }}>
        <strong>เงื่อนไขและการยินยอม (Terms & Consent):</strong>
        <div style={{ paddingLeft: '20px', margin: '4px 0' }}>
            ข้าพเจ้ายินยอมให้บริษัทหักเงินเดือนเพื่อชำระคืนเงินเบิกล่วงหน้าเต็มจำนวนในงวดบัญชีเงินเดือนที่ระบุข้างต้น
            <br/>
            I hereby authorize the company to deduct the full amount of this salary advance from my salary in the payroll month specified above.
        </div>
      </div>

      {/* Signatures */}
      <div style={styles.signatureSection}>
        <div style={styles.signatureBlock}>
          <div style={styles.signatureLine}></div>
          <div>({salaryAdvance.employeeName || '____________________'})</div>
          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>ผู้ขอเบิก / Requestor</div>
          <div style={{ marginTop: '10px', fontSize: '12px' }}>วันที่ ______/______/___________</div>
        </div>
        <div style={styles.signatureBlock}>
          <div style={styles.signatureLine}></div>
          <div>(____________________)</div>
          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>ผู้มีอำนาจอนุมัติ / Approved By</div>
          <div style={{ marginTop: '10px', fontSize: '12px' }}>วันที่ ______/______/___________</div>
        </div>
      </div>
    </div>
  );
};

export const SalaryAdvancePrintTemplate = forwardRef<HTMLDivElement, SalaryAdvancePrintTemplateProps>(
  function SalaryAdvancePrintTemplate(props, ref) {
    const { printOriginal = true, printCopy = true, ...otherProps } = props;

    return (
      <div 
        ref={ref}
        style={{
          width: '210mm',
          padding: '0',
          boxSizing: 'border-box',
          backgroundColor: '#525659',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px', // Visual gap between pages in preview
          paddingTop: '20px',
          paddingBottom: '20px',
        }}
        className="print-container"
      >
        <style type="text/css" media="print">
          {`
            @page { size: auto; margin: 0; }
            .print-page { margin-bottom: 0 !important; box-shadow: none !important; }
            .print-container { 
              background-color: white !important; 
              gap: 0 !important; 
              padding: 0 !important; 
              display: block !important; 
            }
          `}
        </style>
        {printOriginal && <AdvancePage {...otherProps} isOriginal={true} />}
        {printCopy && <AdvancePage {...otherProps} isOriginal={false} />}
      </div>
    );
  }
);
