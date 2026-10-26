'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
const ORDER = ['inventory_aset', 'antrian_umum', 'antrian_ptsp', 'mitra_pks', 'app_mobile', 'monitoring_server', 'monitoring_blangko'];
const ICONS = {
  inventory_aset: '◈',
  antrian_umum: '◎',
  antrian_ptsp: '◉',
  mitra_pks: '◇',
  app_mobile: '▣',
  monitoring_server: '▤',
  monitoring_blangko: '▧',
};
const DESCRIPTIONS = {
  inventory_aset: 'Total Aset',
  antrian_umum: 'Antrian Umum Hari Ini',
  antrian_ptsp: 'Antrian PTSP Hari Ini',
  mitra_pks: 'Mitra Aktif',
  app_mobile: 'Pengguna Mobile Terdaftar',
  monitoring_server: 'Status Server',
  monitoring_blangko: 'Stok Blangko',
};

function timeLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date) + ' WIB';
}

function statusLabel(card) {
  if (card.mode === 'DEMO') return { text: 'DEMO · belum terhubung', tone: 'demo' };
  if (card.connection === 'not_configured') return { text: 'Belum terhubung', tone: 'muted' };
  if (card.serviceStatus === 'normal') return { text: 'Layanan normal', tone: 'good' };
  if (card.serviceStatus === 'gangguan') return { text: 'Gangguan layanan', tone: 'warning' };
  if (card.serviceStatus === 'offline') return { text: 'Layanan offline', tone: 'danger' };
  return { text: 'Status belum diketahui', tone: 'muted' };
}

function dataLabel(card) {
  if (card.mode === 'DEMO') return null;
  if (card.freshness === 'stale') return { text: 'Data terlambat', tone: 'warning' };
  if (card.connection === 'error') return { text: 'Pembacaan gagal', tone: 'warning' };
  if (card.freshness === 'fresh') return { text: 'Data terkini', tone: 'info' };
  return { text: 'Belum ada data', tone: 'muted' };
}

function MetricCard({ card, index }) {
  const status = statusLabel(card);
  const freshness = dataLabel(card);
  const displayValue = card.value === null || card.value === undefined
    ? '—' : new Intl.NumberFormat('id-ID').format(card.value);
  return (
    <article className={`metric-card ${card.mode === 'DEMO' ? 'is-demo' : ''}`}>
      <div className="card-top">
        <div className="card-icon" aria-hidden="true">{ICONS[card.source] || '◈'}</div>
        <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="card-body">
        <p className="card-eyebrow">{card.mode === 'DEMO' ? 'SUMBER BELUM TERSEDIA' : 'DATA AGREGAT APLIKASI'}</p>
        <h2>{DESCRIPTIONS[card.source] || card.label}</h2>
        <div className="card-value-row">
          <span className={`card-value ${displayValue === '—' ? 'is-empty' : ''}`}>
            {displayValue}
          </span>
          {card.mode !== 'DEMO' && displayValue !== '—' && <span className="card-unit">{card.source.startsWith('antrian_') ? 'tiket' : card.source === 'inventory_aset' ? 'aset' : 'akun'}</span>}
        </div>
        {card.mode === 'DEMO'
          ? <p className="card-message">{card.message}</p>
          : displayValue === '—' && <p className="card-message">{card.message || 'Belum ada data dari sumber'}</p>}
      </div>
      <div className="card-bottom">
        <div className="card-statuses">
          <span className={`status-pill ${status.tone}`}><span className="status-dot" />{status.text}</span>
          {freshness && <span className={`status-pill ${freshness.tone}`}><span className="status-dot" />{freshness.text}</span>}
        </div>
        <span className="card-time">{card.mode === 'DEMO' ? 'Tidak ada data nyata' : `Diperbarui ${timeLabel(card.lastSuccessAt)}`}</span>
      </div>
    </article>
  );
}

export default function Page() {
  const [dashboard, setDashboard] = useState(null);
  const [connection, setConnection] = useState('Menghubungkan');
  const [clock, setClock] = useState(null);

  useEffect(() => {
    setClock(new Date());
    const clockTimer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    let active = true;
    let socket;
    let reconnectTimer;
    const base = API_URL.replace(/\/$/, '');
    const wsUrl = base.replace(/^http/, 'ws') + '/ws';

    async function refresh() {
      try {
        const response = await fetch(`${base}/api/v1/dashboard`, { cache: 'no-store' });
        if (!response.ok) throw new Error('API tidak tersedia');
        const data = await response.json();
        if (active) setDashboard(data);
      } catch {
        if (active) setConnection('Koneksi terputus');
      }
    }

    function connect() {
      if (!active) return;
      try {
        socket = new WebSocket(wsUrl);
        socket.onopen = () => { if (active) { setConnection('Terhubung'); void refresh(); } };
        socket.onmessage = (event) => {
          try { if (active) setDashboard(JSON.parse(event.data)); } catch { /* ignore malformed event */ }
        };
        socket.onclose = () => {
          if (!active) return;
          setConnection('Menghubungkan ulang');
          reconnectTimer = setTimeout(connect, 3000);
        };
        socket.onerror = () => socket.close();
      } catch {
        if (active) reconnectTimer = setTimeout(connect, 3000);
      }
    }

    void refresh();
    connect();
    const refreshTimer = setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      clearInterval(refreshTimer);
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const cards = useMemo(() => {
    const bySource = new Map((dashboard?.cards || []).map((card) => [card.source, card]));
    return ORDER.map((source) => bySource.get(source) || {
      source, label: DESCRIPTIONS[source], value: null,
      mode: source.startsWith('monitoring_') ? 'DEMO' : 'REAL',
      connection: 'not_configured', freshness: 'no_data',
      serviceStatus: 'unknown', message: 'Belum terhubung', lastSuccessAt: null,
    });
  }, [dashboard]);
  const realCards = cards.filter((card) => card.mode === 'REAL');
  const connectedSources = realCards.filter((card) => card.connection === 'connected').length;
  const latestUpdate = dashboard?.generatedAt;

  return (
    <main className="app-shell">
      <div className="topline"><span>DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL</span><span>MONITORING LAYANAN · MODE DEV</span></div>
      <header className="hero">
        <div className="hero-copy">
          <div className="brand-mark"><span /> <span /> <span /></div>
          <div>
            <p className="overline">DASHBOARD PIMPINAN</p>
            <h1>Monitoring <em>Kadis</em></h1>
            <p className="hero-subtitle">Ringkasan aplikasi dan layanan dalam satu layar. Angka ditampilkan hanya dari API sumber yang benar-benar terhubung.</p>
          </div>
        </div>
        <div className="hero-side">
          <div className={`live-badge ${connection === 'Terhubung' ? 'online' : 'disconnected'}`}><span className="pulse" />{connection}</div>
          <div className="clock-time">{clock ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(clock) : '--:--'}<small>WIB</small></div>
          <div className="clock-date">{clock ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(clock) : '—'}</div>
        </div>
      </header>

      <section className="overview" aria-label="Ringkasan koneksi">
        <div><span className="overview-label">SUMBER DATA NYATA</span><strong>{connectedSources}<span> / {realCards.length}</span></strong><small>API terbaca pada pemeriksaan terakhir</small></div>
        <div><span className="overview-label">ENTRI MONITORING</span><strong>{cards.length.toString().padStart(2, '0')}</strong><small>5 sumber nyata · 2 belum tersedia</small></div>
        <div><span className="overview-label">RESPONS DASHBOARD</span><strong className="overview-time">{timeLabel(latestUpdate)}</strong><small>Waktu respons API monitoring</small></div>
        <div className="overview-note"><span className="note-icon">i</span><p><strong>Hanya tampilan agregat.</strong><br />Tanpa data pribadi, kredensial, atau detail transaksi.</p></div>
      </section>

      <div className="section-heading"><div><span className="section-kicker">01 / LIVE SOURCES</span><h2>Status & angka layanan</h2></div><p>Setiap aplikasi dipantau terpisah · waktu menggunakan WIB</p></div>
      <section className="card-grid" aria-label="Kartu monitoring">
        {cards.map((card, index) => <MetricCard key={card.source} card={card} index={index} />)}
      </section>

      <section className="bottom-row">
        <div className="history-panel"><span className="section-kicker">02 / HISTORI</span><h2>Grafik menunggu data nyata</h2><p>Tren akan tersedia setelah Monitoring Kadis mengumpulkan histori snapshot dari aplikasi sumber. Tidak ada angka simulasi yang ditampilkan sebagai laporan.</p><div className="empty-chart"><span className="chart-line" /><span>Belum ada histori terverifikasi</span></div></div>
        <div className="info-panel"><span className="section-kicker">CATATAN DATA</span><h2>Jelas sumbernya,<br />jelas statusnya.</h2><ul><li>Antrian Umum dan PTSP tidak digabung.</li><li>Angka nol hanya muncul jika API berhasil mengirim nol.</li><li>Server dan Blangko tetap berlabel DEMO.</li><li>Data lama ditandai, tidak disebut live.</li></ul></div>
      </section>
      <footer><span>MONITORING KADIS · DUKCAPIL</span><span>Versi pengembangan · belum untuk keputusan operasional production</span></footer>
    </main>
  );
}
