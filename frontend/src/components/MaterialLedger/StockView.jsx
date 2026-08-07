import React, { useEffect, useState } from 'react';
import { stockApi } from '../../api';
import { useLanguage } from '../../context/LanguageContext.jsx';
import BackButton from '../common/BackButton.jsx';

// Per spec STOCK MANAGEMENT example: Steel Available 500, Used 85, Remaining 415.
export default function StockView() {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    stockApi
      .summary()
      .then((res) => setRows(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load stock'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('stock.title')}</h1>
        <BackButton />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="panel">
        {loading ? (
          <div className="page-loading">{t('stock.loading')}</div>
        ) : (
          <table className="data-table stack-on-mobile">
            <thead>
              <tr>
                <th>{t('stock.material')}</th>
                <th>{t('stock.category')}</th>
                <th>{t('stock.opening')}</th>
                <th>{t('stock.purchased')}</th>
                <th>{t('stock.used')}</th>
                <th>{t('stock.remaining')}</th>
                <th>{t('stock.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={m.lowStock ? 'row-low-stock' : ''}>
                  <td data-label={t('stock.material')}>{m.materialName}</td>
                  <td data-label={t('stock.category')}>{m.category}</td>
                  <td data-label={t('stock.opening')}>
                    {m.openingStock} {m.unit}
                  </td>
                  <td data-label={t('stock.purchased')}>
                    {m.quantityPurchased} {m.unit}
                  </td>
                  <td data-label={t('stock.used')}>
                    {m.quantityUsed} {m.unit}
                  </td>
                  <td className="amount-cell" data-label={t('stock.remaining')}>
                    {m.remainingStock} {m.unit}
                  </td>
                  <td data-label={t('stock.status')}>
                    {m.lowStock ? (
                      <span className="badge badge-pending">{t('stock.lowStock')}</span>
                    ) : (
                      <span className="badge badge-paid">{t('stock.ok')}</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {t('stock.noMaterials')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
