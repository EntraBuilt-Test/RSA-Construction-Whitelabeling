import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { reportApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import BackButton from '../common/BackButton.jsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function downloadWorkbook(sheets, filename) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, filename);
}

export default function Reports() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [yearly, setYearly] = useState(null);
  const [error, setError] = useState('');

  const loadDaily = async () => {
    setError('');
    try {
      const [billing, movement] = await Promise.all([
        reportApi.dailyBilling(date),
        reportApi.dailyMaterialMovement(date),
      ]);
      setDaily({ billing: billing.data, movement: movement.data });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load daily report');
    }
  };

  const loadMonthly = async () => {
    setError('');
    try {
      const [revenue, cost] = await Promise.all([
        reportApi.monthlyRevenue(year, month),
        reportApi.monthlyMaterialCost(year, month),
      ]);
      setMonthly({ revenue: revenue.data, cost: cost.data });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load monthly report');
    }
  };

  const loadYearly = async () => {
    setError('');
    try {
      const res = await reportApi.yearlySummary(year);
      setYearly(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load yearly report');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('reports.title')}</h1>
        <BackButton />
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="report-tabs">
        <button className={`tab-link${tab === 'daily' ? ' active' : ''}`} onClick={() => setTab('daily')}>
          {t('reports.daily')}
        </button>
        <button className={`tab-link${tab === 'monthly' ? ' active' : ''}`} onClick={() => setTab('monthly')}>
          {t('reports.monthly')}
        </button>
        <button className={`tab-link${tab === 'yearly' ? ' active' : ''}`} onClick={() => setTab('yearly')}>
          {t('reports.yearly')}
        </button>
      </div>

      {tab === 'daily' && (
        <div className="panel">
          <div className="toolbar">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn btn-primary" onClick={loadDaily}>
              {t('reports.runDaily')}
            </button>
            {daily && (
              <button
                className="btn btn-ghost"
                onClick={() =>
                  downloadWorkbook(
                    [
                      {
                        name: 'Billing',
                        rows: daily.billing.notes.map((n) => ({
                          NoteNo: n.noteNumber,
                          Customer: n.customerNameSnapshot,
                          Total: n.totalAmount,
                          Status: n.paymentStatus,
                        })),
                      },
                      {
                        name: 'Material Movement',
                        rows: daily.movement.transactions.map((tr) => ({
                          Material: tr.materialId?.materialName,
                          Type: tr.type,
                          Quantity: tr.quantity,
                          Reference: tr.reference,
                        })),
                      },
                    ],
                    `daily-report-${date}.xlsx`
                  )
                }
              >
                {t('reports.exportExcel')}
              </button>
            )}
          </div>
          {daily && (
            <>
              <h2>
                {t('reports.billingReport')} - {formatDate(daily.billing.date)}
              </h2>
              <p>
                {daily.billing.count} delivery notes, total {formatCurrency(daily.billing.total)}
              </p>
              <h2>{t('reports.materialMovement')}</h2>
              <p>{daily.movement.count} stock transactions</p>
            </>
          )}
        </div>
      )}

      {tab === 'monthly' && (
        <div className="panel">
          <div className="toolbar">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100 }} />
            <button className="btn btn-primary" onClick={loadMonthly}>
              {t('reports.runMonthly')}
            </button>
            {monthly && (
              <button
                className="btn btn-ghost"
                onClick={() =>
                  downloadWorkbook(
                    [
                      {
                        name: 'Revenue',
                        rows: [
                          { Metric: 'Total', Value: monthly.revenue.total },
                          { Metric: 'Paid', Value: monthly.revenue.paid },
                          { Metric: 'Pending', Value: monthly.revenue.pending },
                        ],
                      },
                      {
                        name: 'Material Cost',
                        rows: Object.entries(monthly.cost.byMaterial).map(([k, v]) => ({ Material: k, Cost: v })),
                      },
                    ],
                    `monthly-report-${year}-${month}.xlsx`
                  )
                }
              >
                {t('reports.exportExcel')}
              </button>
            )}
          </div>
          {monthly && (
            <>
              <h2>
                {t('reports.revenueReport')} - {MONTH_NAMES[month - 1]} {year}
              </h2>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">{t('reports.totalRevenue')}</div>
                  <div className="stat-value">{formatCurrency(monthly.revenue.total)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t('reports.paid')}</div>
                  <div className="stat-value">{formatCurrency(monthly.revenue.paid)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t('reports.pendingAmt')}</div>
                  <div className="stat-value">{formatCurrency(monthly.revenue.pending)}</div>
                </div>
              </div>
              <h2>{t('reports.materialCostReport')}</h2>
              <table className="data-table stack-on-mobile">
                <thead>
                  <tr>
                    <th>{t('reports.material')}</th>
                    <th>{t('reports.cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(monthly.cost.byMaterial).map(([name, cost]) => (
                    <tr key={name}>
                      <td data-label={t('reports.material')}>{name}</td>
                      <td data-label={t('reports.cost')}>{formatCurrency(cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tab === 'yearly' && (
        <div className="panel">
          <div className="toolbar">
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100 }} />
            <button className="btn btn-primary" onClick={loadYearly}>
              {t('reports.runYearly')}
            </button>
            {yearly && (
              <button
                className="btn btn-ghost"
                onClick={() =>
                  downloadWorkbook(
                    [
                      {
                        name: 'Yearly Summary',
                        rows: MONTH_NAMES.map((m, idx) => ({ Month: m, Revenue: yearly.byMonth[idx] })),
                      },
                    ],
                    `yearly-summary-${year}.xlsx`
                  )
                }
              >
                {t('reports.exportExcel')}
              </button>
            )}
          </div>
          {yearly && (
            <>
              <h2>
                {t('reports.businessSummary')} - {yearly.year}
              </h2>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">{t('reports.totalRevenue')}</div>
                  <div className="stat-value">{formatCurrency(yearly.totalRevenue)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t('reports.deliveryNotes')}</div>
                  <div className="stat-value">{yearly.totalDeliveryNotes}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t('reports.materialSpend')}</div>
                  <div className="stat-value">{formatCurrency(yearly.materialSpend)}</div>
                </div>
              </div>
              <table className="data-table stack-on-mobile">
                <thead>
                  <tr>
                    <th>{t('reports.month')}</th>
                    <th>{t('reports.revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTH_NAMES.map((m, idx) => (
                    <tr key={m}>
                      <td data-label={t('reports.month')}>{m}</td>
                      <td data-label={t('reports.revenue')}>{formatCurrency(yearly.byMonth[idx])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
