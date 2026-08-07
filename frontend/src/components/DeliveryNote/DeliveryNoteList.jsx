import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deliveryNoteApi } from '../../api';
import StatusBadge from '../common/StatusBadge.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import BackButton from '../common/BackButton.jsx';

export default function DeliveryNoteList() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState('');
  const [editingAdvanceId, setEditingAdvanceId] = useState(null);
  const [advanceInput, setAdvanceInput] = useState('');
  const [savingAdvance, setSavingAdvance] = useState(false);

  const load = () => {
    setLoading(true);
    deliveryNoteApi
      .list({ search: search || undefined, status: status || undefined })
      .then((res) => setNotes(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load delivery notes'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [search, status]);

  const handleDelete = async () => {
    try {
      await deliveryNoteApi.remove(toDelete._id);
      setToDelete(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete delivery note');
      setToDelete(null);
    }
  };

  const togglePayment = async (note) => {
    const next = note.paymentStatus === 'Paid' ? 'Pending' : 'Paid';
    await deliveryNoteApi.setPaymentStatus(note._id, next);
    load();
  };

  const startEditAdvance = (note) => {
    setEditingAdvanceId(note._id);
    setAdvanceInput(String(note.advanceReceived || 0));
  };

  const saveAdvance = async (note) => {
    setSavingAdvance(true);
    try {
      await deliveryNoteApi.recordAdvance(note._id, Number(advanceInput) || 0);
      setEditingAdvanceId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record advance');
    } finally {
      setSavingAdvance(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('billing.title')}</h1>
        <div className="row-actions">
          <Link to="/billing/new" className="btn btn-primary">
            {t('billing.createButton')}
          </Link>
          <BackButton />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input placeholder={t('billing.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" className="btn btn-sm" onClick={load}>
          Search
        </button>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('billing.allStatus')}</option>
          <option value="Paid">{t('billing.paid')}</option>
          <option value="Pending">{t('billing.pending')}</option>
        </select>
      </div>

      <div className="panel">
        {loading ? (
          <div className="page-loading">{t('billing.loading')}</div>
        ) : (
          <table className="data-table stack-on-mobile">
            <thead>
              <tr>
                <th>{t('billing.noteNo')}</th>
                <th>{t('billing.date')}</th>
                <th>{t('billing.customer')}</th>
                <th>Address</th>
                <th>{t('billing.vehicleNo')}</th>
                <th>Advance / Balance</th>
                <th>{t('billing.status')}</th>
                <th>{t('billing.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n._id}>
                  <td data-label={t('billing.noteNo')}>{n.noteNumber}</td>
                  <td data-label={t('billing.date')}>{formatDate(n.date)}</td>
                  <td data-label={t('billing.customer')}>{n.customerNameSnapshot}</td>
                  <td data-label="Address">{n.customerAddressSnapshot || '-'}</td>
                  <td data-label={t('billing.vehicleNo')}>{n.vehicleNumber || '-'}</td>
                  <td data-label="Advance / Balance">
                    {editingAdvanceId === n._id ? (
                      <span className="row-actions">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={advanceInput}
                          onChange={(e) => setAdvanceInput(e.target.value)}
                          style={{ width: 90 }}
                          autoFocus
                        />
                        <button className="btn btn-sm btn-primary" disabled={savingAdvance} onClick={() => saveAdvance(n)}>
                          Save
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setEditingAdvanceId(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button className="badge-btn" onClick={() => startEditAdvance(n)} title="Click to record advance">
                        {formatCurrency(n.advanceReceived || 0)} received / {formatCurrency(n.totalAmount - (n.advanceReceived || 0))} due
                      </button>
                    )}
                  </td>
                  <td data-label={t('billing.status')}>
                    <button className="badge-btn" onClick={() => togglePayment(n)} title="Click to toggle">
                      <StatusBadge status={n.paymentStatus} />
                    </button>
                  </td>
                  <td className="row-actions" data-label={t('billing.actions')}>
                    <button className="btn btn-sm" onClick={() => navigate(`/billing/${n._id}/print`)}>
                      {t('billing.print')}
                    </button>
                    <button className="btn btn-sm" onClick={() => navigate(`/billing/${n._id}/edit`)}>
                      {t('billing.edit')}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => setToDelete(n)}>
                      {t('billing.delete')}
                    </button>
                  </td>
                </tr>
              ))}
              {notes.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {t('billing.noNotes')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title={t('billing.deleteTitle')}
        message={t('billing.deleteMessage', { noteNumber: toDelete?.noteNumber })}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        danger
      />
    </div>
  );
}
