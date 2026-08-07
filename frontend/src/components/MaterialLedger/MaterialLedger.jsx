import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { stockApi } from '../../api';
import MaterialEntryForm from './MaterialEntryForm.jsx';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import BackButton from '../common/BackButton.jsx';

/**
 * The "manual ledger style" table (per spec MATERIAL TABLE columns:
 * S.No, Date, Material Name, Quantity, Rate, Amount, Stock Balance, Remarks).
 * One row per stock movement, chronological, running balance - same shape as
 * the handwritten purchase ledger book.
 */
export default function MaterialLedger() {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Opens showing the ledger table first (FR-08) - the entry form only
  // appears once the user explicitly taps "+ New Material Entry".
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    stockApi
      .ledger()
      .then((res) => setRows(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load material ledger'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);
  // "Only print the purchase list" - the on-screen ledger shows every stock
  // movement (purchases AND deliveries/usage) for full visibility, but the
  // printed page should read like the physical purchase ledger book: incoming
  // purchases only, nothing about where material was later used.
  const purchaseRows = rows.filter((r) => r.referenceType === 'Purchase' || r.type === 'IN');
  const purchaseTotal = purchaseRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('materials.title')}</h1>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={() => setShowForm((s) => !s)}>
            {showForm ? t('materials.hideForm') : t('materials.newEntry')}
          </button>
          <Link to="/stock" className="btn btn-ghost">
            {t('materials.stockBalances')}
          </Link>
          <button className="btn btn-primary" onClick={() => window.print()}>
            {t('materials.printPurchasesOnly')}
          </button>
          <BackButton />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {showForm && <MaterialEntryForm onSaved={load} />}

      {/* Full ledger (all movements) - visible on screen, hidden when printing */}
      <div className="panel screen-only-ledger">
        <h2 className="ledger-title">{t('materials.ledgerTitle')}</h2>
        {loading ? (
          <div className="page-loading">{t('billing.loading')}</div>
        ) : (
          <table className="data-table ledger-table stack-on-mobile">
            <thead>
              <tr>
                <th>{t('materials.sNo')}</th>
                <th>{t('materials.date')}</th>
                <th>{t('materials.materialName')}</th>
                <th>{t('materials.brand')}</th>
                <th>{t('materials.type')}</th>
                <th>{t('materials.quantity')}</th>
                <th>{t('materials.purchaseRate')}</th>
                <th>{t('deliveryForm.colAmount')}</th>
                <th>{t('voucher.paymentMode')}</th>
                <th>{t('materials.stockBalance')}</th>
                <th>{t('materials.remarks')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label={t('materials.sNo')}>{r.sNo}</td>
                  <td data-label={t('materials.date')}>{formatDate(r.date)}</td>
                  <td data-label={t('materials.materialName')}>{r.materialName}</td>
                  <td data-label={t('materials.brand')}>{r.brand || ''}</td>
                  <td className={r.type === 'IN' ? 'txn-in' : 'txn-out'} data-label={t('materials.type')}>{r.type}</td>
                  <td data-label={t('materials.quantity')}>
                    {r.quantity} {r.unit}
                  </td>
                  <td data-label={t('materials.purchaseRate')}>{formatCurrency(r.rate)}</td>
                  <td data-label={t('deliveryForm.colAmount')}>{formatCurrency(r.amount)}</td>
                  <td data-label={t('voucher.paymentMode')}>
                    {r.paymentMode
                      ? `${r.paymentMode}${r.paymentMode === 'GPay/UPI' && r.upiRefNumber ? ` (${r.upiRefNumber})` : ''}`
                      : ''}
                  </td>
                  <td data-label={t('materials.stockBalance')}>
                    {r.stockBalance} {r.unit}
                  </td>
                  <td data-label={t('materials.remarks')}>{r.remarks || r.reference}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="empty-row">
                    {t('materials.noEntries')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="total-label">
                  {t('materials.totalLabel')}
                </td>
                <td className="amount-cell total-amount">{formatCurrency(grandTotal)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Purchase-only sheet - hidden on screen, this is what actually prints */}
      <div className="panel print-only-ledger ledger-print-area">
        <h2 className="ledger-title">{t('materials.purchaseListTitle')}</h2>
        <table className="data-table ledger-table">
          <thead>
            <tr>
              <th>{t('materials.sNo')}</th>
              <th>{t('materials.date')}</th>
              <th>{t('materials.materialName')}</th>
              <th>{t('materials.brand')}</th>
              <th>{t('materials.quantity')}</th>
              <th>{t('materials.purchaseRate')}</th>
              <th>{t('deliveryForm.colAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {purchaseRows.map((r) => (
              <tr key={r.id}>
                <td>{r.sNo}</td>
                <td>{formatDate(r.date)}</td>
                <td>{r.materialName}</td>
                <td>{r.brand || ''}</td>
                <td>
                  {r.quantity} {r.unit}
                </td>
                <td>{formatCurrency(r.rate)}</td>
                <td>{formatCurrency(r.amount)}</td>
              </tr>
            ))}
            {purchaseRows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  {t('materials.noEntries')}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="total-label">
                {t('materials.totalLabel')}
              </td>
              <td className="amount-cell total-amount">{formatCurrency(purchaseTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
