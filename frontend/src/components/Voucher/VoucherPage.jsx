import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { voucherApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import BackButton from '../common/BackButton.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import LoadingState from '../common/LoadingState.jsx';

/**
 * Cash Voucher module - mirrors the paper "வவுச்சர்" pad: pay/give cash to
 * someone (Advance / Part / Full payment) for a stated purpose, they sign,
 * and it's kept as a record. Fill the form -> Save -> the voucher is created
 * with an auto number (VCH-2026-000x) -> Print opens the bilingual printable
 * slip (English + Tamil), same pattern as the Delivery Note.
 */
export default function VoucherPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receivedFrom, setReceivedFrom] = useState('Name');
  const [receivedBy, setReceivedBy] = useState('');
  const [purpose, setPurpose] = useState('');
  const [paymentType, setPaymentType] = useState('Advance');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [upiRefNumber, setUpiRefNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const load = () => {
    setLoading(true);
    setListError('');
    voucherApi
      .list()
      .then((res) => setVouchers(res.data))
      .catch((err) => setListError(err.response?.data?.message || 'Failed to load vouchers - the server may be slow to respond.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const resetForm = () => {
    setReceivedBy('');
    setPurpose('');
    setAmount('');
    setRemarks('');
    setPaymentType('Advance');
    setPaymentMode('Cash');
    setUpiRefNumber('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!receivedBy.trim()) {
      setError(t('voucher.errorReceivedBy'));
      return;
    }
    if (!purpose.trim()) {
      setError(t('voucher.errorPurpose'));
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError(t('voucher.errorAmount'));
      return;
    }
    setSaving(true);
    try {
      const res = await voucherApi.create({
        date,
        receivedFrom,
        receivedBy,
        purpose,
        paymentType,
        paymentMode,
        upiRefNumber: paymentMode === 'GPay/UPI' ? upiRefNumber : '',
        amount: Number(amount),
        remarks,
      });
      resetForm();
      load();
      // Go straight to the printable voucher, same as saving a Delivery Note.
      navigate(`/voucher/${res.data._id}/print`);
    } catch (err) {
      setError(err.response?.data?.message || t('voucher.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await voucherApi.remove(toDelete._id);
      setToDelete(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete voucher');
      setToDelete(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('voucher.title')}</h1>
        <BackButton />
      </div>

      <form className="panel form" onSubmit={handleSubmit}>
        <h2>{t('voucher.createTitle')}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>{t('voucher.date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>{t('voucher.receivedFrom')}</label>
            <input value={receivedFrom} onChange={(e) => setReceivedFrom(e.target.value)} />
          </div>
          <div className="form-field">
            <label>{t('voucher.receivedBy')}</label>
            <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} required />
          </div>
          <div className="form-field form-field-wide">
            <label>{t('voucher.purpose')}</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>{t('voucher.paymentType')}</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="Advance">{t('voucher.advance')}</option>
              <option value="Part">{t('voucher.part')}</option>
              <option value="Full">{t('voucher.full')}</option>
            </select>
          </div>
          <div className="form-field">
            <label>{t('voucher.paymentMode')}</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="GPay/UPI">GPay/UPI</option>
              <option value="IMPS">IMPS</option>
              <option value="RTGS">RTGS</option>
              <option value="NEFT">NEFT</option>
            </select>
          </div>
          {paymentMode === 'GPay/UPI' && (
            <div className="form-field">
              <label>{t('voucher.upiRefNumber')}</label>
              <input value={upiRefNumber} onChange={(e) => setUpiRefNumber(e.target.value)} />
            </div>
          )}
          <div className="form-field">
            <label>{t('voucher.amount')}</label>
            <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="form-field form-field-wide">
            <label>{t('voucher.remarks')}</label>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('voucher.saving') : t('voucher.save')}
          </button>
        </div>
      </form>

      <div className="panel">
        <h2>{t('voucher.recentVouchers')}</h2>
        <LoadingState loading={loading} error={listError} onRetry={load} />
        {!loading && !listError && (
          <table className="data-table stack-on-mobile">
            <thead>
              <tr>
                <th>{t('voucher.voucherNo')}</th>
                <th>{t('voucher.date')}</th>
                <th>{t('voucher.receivedBy')}</th>
                <th>{t('voucher.purpose')}</th>
                <th>{t('voucher.paymentType')}</th>
                <th>{t('voucher.amount')}</th>
                <th>{t('billing.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v._id}>
                  <td data-label={t('voucher.voucherNo')}>{v.voucherNumber}</td>
                  <td data-label={t('voucher.date')}>{formatDate(v.date)}</td>
                  <td data-label={t('voucher.receivedBy')}>{v.receivedBy}</td>
                  <td data-label={t('voucher.purpose')}>{v.purpose}</td>
                  <td data-label={t('voucher.paymentType')}>{t(`voucher.${v.paymentType.toLowerCase()}`)}</td>
                  <td data-label={t('voucher.amount')}>{formatCurrency(v.amount)}</td>
                  <td className="row-actions" data-label={t('billing.actions')}>
                    <button className="btn btn-sm" onClick={() => navigate(`/voucher/${v._id}/print`)}>
                      {t('billing.print')}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => setToDelete(v)}>
                      {t('billing.delete')}
                    </button>
                  </td>
                </tr>
              ))}
              {vouchers.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {t('voucher.noVouchers')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title={t('voucher.deleteTitle')}
        message={t('voucher.deleteMessage', { voucherNumber: toDelete?.voucherNumber })}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        danger
      />
    </div>
  );
}
