import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { voucherApi } from '../../api';
import { formatDate } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import logoImg from '../../logo/logoo2.png';
import DefaultSignature from '../common/DefaultSignature.jsx';

/**
 * Reproduction of the physical blue "வவுச்சர்" (Voucher) slip - No./Date,
 * Received From, Received By, Purpose, the Advance/Part/Full payment-type
 * line, the boxed amount, and the two signature lines. Prints entirely in
 * whichever language (English or Tamil) is currently selected in the app's
 * language toggle. Use the browser's Print / Save-as-PDF (Ctrl+P).
 */
export default function VoucherPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [voucher, setVoucher] = useState(null);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const sheetRef = useRef(null);

  useEffect(() => {
    voucherApi
      .get(id)
      .then((res) => setVoucher(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load voucher'));
  }, [id]);

  const generatePdfBlob = async () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const canvas = await html2canvas(sheetRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, Math.min(imgHeight, pageHeight));
    return pdf.output('blob');
  };

  const handleShareWhatsApp = async () => {
    setError('');
    setSharing(true);
    try {
      const blob = await generatePdfBlob();
      const fileName = `Voucher-${voucher.voucherNumber}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const message =
        `Name - Voucher ${voucher.voucherNumber}\n` +
        `Date: ${formatDate(voucher.date)}\n` +
        `Received By: ${voucher.receivedBy}\n` +
        `Amount: Rs.${Number(voucher.amount).toFixed(2)} (${voucher.paymentType})\n` +
        `Payment Mode: ${voucher.paymentMode || 'Cash'}${voucher.upiRefNumber ? ` (Ref: ${voucher.upiRefNumber})` : ''}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Voucher ${voucher.voucherNumber}`,
          text: message,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      window.open(
        `https://wa.me/?text=${encodeURIComponent(message + '\n\n(PDF downloaded - please attach it here)')}`,
        '_blank'
      );
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError('Could not prepare the PDF to share. Please try Print instead.');
      }
    } finally {
      setSharing(false);
    }
  };

  if (error && !voucher) return <div className="alert alert-error">{error}</div>;
  if (!voucher) return <div className="page-loading">Loading...</div>;

  const paymentTypeLabel = { Advance: t('voucher.advance'), Part: t('voucher.part'), Full: t('voucher.full') }[
    voucher.paymentType
  ];

  return (
    <div className="print-page-wrapper">
      <div className="print-toolbar no-print">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← {t('print.back')}
        </button>
        <div className="print-toolbar-actions">
          <button className="btn btn-ghost" onClick={handleShareWhatsApp} disabled={sharing}>
            {sharing ? 'Preparing PDF...' : 'Share via WhatsApp'}
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            {t('print.print')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error no-print">{error}</div>}

      <div className="voucher-sheet" ref={sheetRef}>
        <div className="voucher-box">
          <img src={logoImg} alt="" aria-hidden="true" className="voucher-watermark" />
          <div className="voucher-box-header">
            <div className="voucher-no">
              {t('print.voucherNo')} <span className="voucher-underline">{voucher.voucherNumber}</span>
            </div>
            <div className="voucher-title-badge">{t('print.voucherTitle')}</div>
            <div className="voucher-date">
              {t('print.dateLabel')} <span className="voucher-underline">{formatDate(voucher.date)}</span>
            </div>
          </div>

          <div className="voucher-line">
            <span className="voucher-underline voucher-line-value">{voucher.receivedFrom}</span>
            <span className="voucher-line-label">{t('print.receivedFrom')}</span>
          </div>

          <div className="voucher-line">
            <span className="voucher-line-label voucher-line-label-fixed">{t('print.receivedByPrefix')}</span>
            <span className="voucher-underline voucher-line-value">{voucher.receivedBy}</span>
            <span className="voucher-line-label voucher-line-label-end">{t('print.receivedBySuffix')}</span>
          </div>

          <div className="voucher-line">
            <span className="voucher-underline voucher-line-value">{voucher.purpose}</span>
            <span className="voucher-line-label">{t('print.forPurpose')}</span>
          </div>

          <div className="voucher-line">
            <span className="voucher-line-label voucher-line-label-fixed">
              {t('print.advance')}/{t('print.part')}/{t('print.full')}
              {' - '}
              <strong>{paymentTypeLabel}</strong>
            </span>
            <span className="voucher-line-label voucher-line-label-end">{t('print.rupees')}</span>
          </div>

          <div className="voucher-received-only">{t('print.receivedOnly')}</div>

          {voucher.remarks && (
            <div className="voucher-remarks">
              {t('voucher.remarks')}: {voucher.remarks}
            </div>
          )}

          <div className="voucher-remarks">
            {t('voucher.paymentMode')}: {voucher.paymentMode || 'Cash'}
            {voucher.paymentMode === 'GPay/UPI' && voucher.upiRefNumber ? ` (${t('voucher.upiRefNumber')}: ${voucher.upiRefNumber})` : ''}
          </div>

          <div className="voucher-footer-row">
            <div className="voucher-amount-box">
              <span className="voucher-amount-label">{t('print.rsLabel')}</span>
              <span className="voucher-amount-value">{Number(voucher.amount).toFixed(2)}</span>
            </div>
            <div className="voucher-signature-block">
              {voucher.paymentMode && voucher.paymentMode !== 'Cash' ? (
                <div className="voucher-signature-line-label">{voucher.paymentMode}</div>
              ) : (
                <DefaultSignature className="voucher-signature-image" />
              )}
              <div className="voucher-signature-line" />
              <div>{t('print.receiverSignature')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
