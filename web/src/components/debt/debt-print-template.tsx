'use client';

import { forwardRef } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { DebtTxn } from '@/services/debt.service';
import { OrgProfile } from '@/services/org-profile.service';

interface DebtPrintTemplateProps {
  debt: DebtTxn;
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

const BiLabel = ({ th: thText, en }: { th: string; en: string }) => (
  <div>
    <span>{thText}</span>
    <span style={{ color: '#6b7280', fontSize: '10px', marginLeft: '4px' }}>{en}</span>
  </div>
);

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
    pageBreakAfter: 'always' as const,
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
    width: '150px',
    color: '#374151',
    fontWeight: 500,
  },
  value: {
    flex: 1,
    fontWeight: 600,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '12px',
    marginBottom: '10px',
  },
  th: {
    border: '1px solid #d1d5db',
    padding: '8px',
    backgroundColor: '#f9fafb',
    fontWeight: 'bold',
    textAlign: 'center' as const,
  },
  td: {
    border: '1px solid #d1d5db',
    padding: '6px 8px',
  },
  signatureSection: {
    marginTop: 'auto',
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

const AgreementPage = ({ 
  debt, 
  orgProfile, 
  logoUrl, 
  isOriginal 
}: { 
  debt: DebtTxn; 
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

  const txnDate = new Date(debt.txnDate);
  const formattedDate = format(txnDate, 'd MMMM yyyy', { locale: th });

  const totalInstallmentAmount = debt.installments?.reduce((sum, inst) => sum + inst.amount, 0) || 0;

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
          <div style={styles.mainTitle}>หนังสือสัญญากู้ยืมเงิน</div>
          <div style={styles.subTitle}>LOAN AGREEMENT</div>
        </div>
      </div>

      {/* Agreement Info */}
      <div style={styles.section}>
        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
          วันที่ทำรายการ: <b>{formattedDate}</b>
        </div>
        
        <div style={styles.sectionTitle}>1. ข้อมูลผู้กู้ (Borrower)</div>
        <div style={styles.row}>
          <div style={styles.label}>ชื่อ-นามสกุล:</div>
          <div style={styles.value}>{debt.employeeName || '-'}</div>
        </div>
        <div style={styles.row}>
          <div style={styles.label}>รหัสพนักงาน:</div>
          <div style={styles.value}>{debt.employeeCode || debt.employeeId}</div>
        </div>
      </div>

      {/* Loan Details */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>2. รายละเอียดการกู้ยืม (Loan Details)</div>
        <div style={styles.row}>
          <div style={styles.label}>จำนวนเงินกู้:</div>
          <div style={styles.value}>{formatNumber(debt.amount)} บาท</div>
        </div>
        {debt.reason && (
          <div style={styles.row}>
            <div style={styles.label}>วัตถุประสงค์:</div>
            <div style={styles.value}>{debt.reason}</div>
          </div>
        )}
        {debt.otherDesc && (
            <div style={styles.row}>
            <div style={styles.label}>รายละเอียดเพิ่มเติม:</div>
            <div style={styles.value}>{debt.otherDesc}</div>
          </div>
        )}
      </div>

      {/* Repayment Plan */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>3. แผนการผ่อนชำระ (Repayment Schedule)</div>
        <div style={{ marginBottom: '10px' }}>
            ข้าพเจ้ายินยอมให้บริษัทหักเงินเดือนเพื่อชำระหนี้ตามตารางดังนี้:
        </div>
        {debt.installments && debt.installments.length > 0 ? (
          <>
            <table style={styles.table}>
                <thead>
                <tr>
                    <th style={{ ...styles.th, width: '50px' }}>งวดที่</th>
                    <th style={{ ...styles.th }}>เดือนที่หัก</th>
                    <th style={{ ...styles.th, width: '150px' }}>จำนวนเงิน (บาท)</th>
                </tr>
                </thead>
                <tbody>
                {debt.installments.map((inst, index) => (
                    <tr key={index}>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                        {inst.payrollMonthDate ? format(new Date(inst.payrollMonthDate), 'MM/yyyy') : '-'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{formatNumber(inst.amount)}</td>
                    </tr>
                ))}
                </tbody>
                <tfoot>
                    <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                        <td colSpan={2} style={{ ...styles.td, textAlign: 'center' }}>รวมทั้งหมด</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{formatNumber(totalInstallmentAmount)}</td>
                    </tr>
                </tfoot>
            </table>
            {totalInstallmentAmount !== debt.amount && (
                 <div style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>
                    * ยอดรวมผ่อนชำระไม่ตรงกับยอดเงินกู้ (ส่วนต่าง: {formatNumber(debt.amount - totalInstallmentAmount)})
                 </div>
            )}
          </>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: '4px' }}>
            ไม่มีแผนการผ่อนชำระ (ชำระเต็มจำนวนหรือชำระด้วยตนเอง)
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', lineHeight: '1.6' }}>
        <strong>เงื่อนไขเพิ่มเติม:</strong>
        <ul style={{ paddingLeft: '20px', margin: '4px 0' }}>
            <li>หากพนักงานพ้นสภาพการเป็นพนักงานก่อนชำระหนี้ครบถ้วน พนักงานยินยอมให้บริษัทหักเงินประกันการทำงาน เงินเดือน ค่าจ้าง หรือเงินอื่นใดที่บริษัทพึงจ่ายให้แก่พนักงาน เพื่อชำระหนี้คงค้างทั้งหมด</li>
            <li>หากยังคงมีหนี้ค้างชำระ พนักงานตกลงจะชำระคืนให้เสร็จสิ้นทันที</li>
        </ul>
      </div>

      {/* Signatures */}
      <div style={styles.signatureSection}>
        <div style={styles.signatureBlock}>
          <div style={styles.signatureLine}></div>
          <div>({debt.employeeName || '____________________'})</div>
          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>ผู้กู้ / Borrower</div>
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

export const DebtPrintTemplate = forwardRef<HTMLDivElement, DebtPrintTemplateProps>(
  function DebtPrintTemplate(props, ref) {
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
        {printOriginal && <AgreementPage {...otherProps} isOriginal={true} />}
        {printCopy && <AgreementPage {...otherProps} isOriginal={false} />}
      </div>
    );
  }
);
