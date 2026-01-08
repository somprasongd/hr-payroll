'use client';

import { forwardRef } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { DebtTxn } from '@/services/debt.service';
import { OrgProfile } from '@/services/org-profile.service';

interface RepaymentReceiptPrintTemplateProps {
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

const styles = {
  page: {
    padding: '15mm 15mm',
    backgroundColor: 'white',
    fontSize: '14px',
    fontFamily: 'Sarabun, Arial, sans-serif',
    width: '210mm',
    minHeight: '297mm', // A4 height
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
  watermark: {
    position: 'absolute' as const,
    top: '5mm',
    right: '15mm',
    border: '1px solid #000',
    padding: '4px 8px',
    fontSize: '10px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
  },
  content: {
    flex: 1,
  },
  row: {
    display: 'flex',
    marginBottom: '10px',
    alignItems: 'baseline',
  },
  label: {
    width: '150px',
    fontWeight: 'bold',
    color: '#374151',
  },
  value: {
    flex: 1,
    borderBottom: '1px dotted #9ca3af',
    paddingBottom: '2px',
  },
  paymentBox: {
    marginTop: '20px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    padding: '15px',
    marginBottom: '20px',
    backgroundColor: '#f9fafb',
  },
  signatureSection: {
    marginTop: 'auto',
    paddingTop: '30px',
    display: 'flex',
    justifyContent: 'space-between',
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingBottom: '50px', // Add some bottom padding
  },
  signatureBlock: {
    textAlign: 'center' as const,
    width: '220px',
  },
  signatureLine: {
    borderBottom: '1px solid #000',
    marginTop: '40px',
    marginBottom: '8px',
    height: '1px',
  },
};

const ReceiptsPage = ({
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

  // Payment Method Label
  const getPaymentMethodLabel = () => {
    if (debt.paymentMethod === 'bank_transfer') {
      return `โอนเงินเข้าบัญชี (Bank Transfer) - ${debt.bankName || ''} ${debt.bankAccountNumber || ''} ${debt.transferTime ? `เวลา ${debt.transferTime}` : ''}`;
    }
    if (debt.paymentMethod === 'cash') {
      return 'เงินสด (Cash)';
    }
    return debt.paymentMethod || '-';
  };

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
          <div style={styles.mainTitle}>ใบเสร็จรับเงิน</div>
          <div style={styles.subTitle}>RECEIPT</div>
        </div>
      </div>

      <div style={styles.content}>
        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
             วันที่ (Date): <b>{formattedDate}</b>
        </div>
        
        <div style={styles.row}>
          <div style={styles.label}>ได้รับเงินจาก (Received From):</div>
          <div style={styles.value}>{debt.employeeName} {debt.employeeCode ? `(${debt.employeeCode})` : ''}</div>
        </div>

        <div style={styles.row}>
           <div style={styles.label}>จำนวนเงิน (Amount):</div>
           <div style={{ ...styles.value, fontSize: '16px', fontWeight: 'bold' }}>{formatNumber(debt.amount)} บาท</div>
        </div>

        <div style={styles.row}>
           <div style={styles.label}>ชำระค่า (For):</div>
           <div style={styles.value}>ชำระคืนหนี้สิน / Debt Repayment {debt.reason ? `(${debt.reason})` : ''}</div>
        </div>

         <div style={styles.paymentBox}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #d1d5db', paddingBottom: '5px' }}>
                รายละเอียดการชำระเงิน (Payment Detail)
            </div>
            <div style={styles.row}>
                <div style={{ width: '150px', color: '#6b7280' }}>ช่องทางชำระ:</div>
                <div style={{ fontWeight: 500 }}>{getPaymentMethodLabel()}</div>
            </div>
            {debt.otherDesc && (
                 <div style={styles.row}>
                    <div style={{ width: '150px', color: '#6b7280' }}>หมายเหตุ:</div>
                    <div>{debt.otherDesc}</div>
                </div>
            )}
         </div>
      </div>

       {/* Signatures */}
       <div style={styles.signatureSection}>
        <div style={styles.signatureBlock}>
          <div style={styles.signatureLine}></div>
          <div>({debt.employeeName || '....................'})</div>
          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>ผู้ชำระเงิน / Payer</div>
          <div style={{ marginTop: '5px', fontSize: '10px', color: '#6b7280' }}>พนักงาน (Employee)</div>
        </div>

        <div style={styles.signatureBlock}>
          <div style={styles.signatureLine}></div>
          <div>(........................................)</div>
          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>ผู้รับเงิน / Receiver</div>
          <div style={{ marginTop: '5px', fontSize: '10px', color: '#6b7280' }}>ตัวแทนบริษัท (Company Representative)</div>
        </div>
      </div>

    </div>
  );
};

export const RepaymentReceiptPrintTemplate = forwardRef<HTMLDivElement, RepaymentReceiptPrintTemplateProps>(
  function RepaymentReceiptPrintTemplate(props, ref) {
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
          gap: '20px', 
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
        {printOriginal && <ReceiptsPage {...otherProps} isOriginal={true} />}
        {printCopy && <ReceiptsPage {...otherProps} isOriginal={false} />}
      </div>
    );
  }
);
