/* =========================================================
   Tagihan Papan Bunga
   Mencatat pesanan, pembayaran, dan menagih lewat WhatsApp.
   Pesan dibuka lewat link wa.me, lalu dikirim manual (aman).
   Semua data disimpan di localStorage browser.
   ========================================================= */
'use strict';

// ---------- Konstanta ----------
const KUNCI_DATA = 'tagihanPapanBunga_v1';
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const JENIS_ACARA = ['Pernikahan', 'Duka Cita', 'Selamat', 'Grand Opening', 'Ulang Tahun', 'Lainnya'];
const JENIS_PELANGGAN = ['Perorangan', 'Perusahaan', 'Langganan'];
const STATUS_KERJA = ['Dipesan', 'Dikerjakan', 'Dikirim', 'Selesai'];
const METODE_BAYAR = ['Tunai', 'Transfer', 'QRIS'];
const TIGA_HARI_MS = 3 * 24 * 60 * 60 * 1000;

// Daftar template: [kunci, judul]
const DAFTAR_TEMPLATE = [
  ['konfirmasi', 'a. Konfirmasi pesanan + info DP'],
  ['kirim', 'b. Papan sudah dikirim + info pelunasan'],
  ['ramah', 'c. Pengingat ramah (sebelum jatuh tempo)'],
  ['hariH', 'd. Pengingat jatuh tempo (hari H)'],
  ['telat', 'e. Pengingat tegas tapi sopan (sudah telat)'],
  ['lunas', 'f. Terima kasih sudah lunas']
];

// Template bawaan untuk acara umum
const TEMPLATE_BAWAAN = {
  konfirmasi: 'Halo Bapak/Ibu {nama}, terima kasih sudah memesan papan bunga di {nama_toko}.\n\nNo. pesanan: {no_pesanan}\nAcara: {acara}\nTanggal: {tanggal_acara}\nTotal: {total}\n\nUntuk memproses pesanan, mohon kirim DP ke rekening berikut:\n{rekening}\n\nTerima kasih.',
  kirim: 'Halo Bapak/Ibu {nama}, papan bunga untuk pesanan {no_pesanan} ({acara}) sudah kami kirim.\n\nTotal: {total}\nSisa pembayaran: {sisa}\nJatuh tempo: {jatuh_tempo}\n\nPelunasan bisa ke rekening:\n{rekening}\n\nTerima kasih atas kepercayaannya.\n{nama_toko}',
  ramah: 'Halo Bapak/Ibu {nama}, semoga sehat selalu. Kami ingin mengingatkan pembayaran pesanan {no_pesanan} sebesar {sisa} yang jatuh tempo pada {jatuh_tempo}.\n\nRekening:\n{rekening}\n\nJika sudah transfer, mohon abaikan pesan ini. Terima kasih.\n{nama_toko}',
  hariH: 'Halo Bapak/Ibu {nama}, hari ini ({jatuh_tempo}) adalah batas pembayaran pesanan {no_pesanan} sebesar {sisa}.\n\nRekening:\n{rekening}\n\nMohon kirimkan bukti transfer jika sudah dibayar. Terima kasih.\n{nama_toko}',
  telat: 'Halo Bapak/Ibu {nama}, kami mencatat pembayaran pesanan {no_pesanan} sebesar {sisa} sudah lewat {hari_telat} hari dari jatuh tempo ({jatuh_tempo}).\n\nMohon segera diselesaikan ke rekening:\n{rekening}\n\nJika ada kendala, silakan kabari kami agar bisa dibicarakan bersama. Terima kasih.\n{nama_toko}',
  lunas: 'Halo Bapak/Ibu {nama}, pembayaran pesanan {no_pesanan} sudah kami terima dan dinyatakan LUNAS.\n\nTerima kasih atas kepercayaannya kepada {nama_toko}. Semoga kita bisa bekerja sama lagi.'
};

// Template khusus Duka Cita: nada lebih halus dan berempati
const TEMPLATE_DUKA = {
  konfirmasi: 'Bapak/Ibu {nama}, kami turut berduka cita yang sedalam-dalamnya. Terima kasih telah mempercayakan papan bunga kepada {nama_toko}.\n\nNo. pesanan: {no_pesanan}\nTotal: {total}\n\nBila berkenan, DP dapat dikirim ke rekening berikut:\n{rekening}\n\nKami akan menyiapkan papan dengan sebaik-baiknya.',
  kirim: 'Bapak/Ibu {nama}, papan bunga untuk pesanan {no_pesanan} sudah kami antarkan. Semoga keluarga yang ditinggalkan diberi ketabahan.\n\nSisa pembayaran: {sisa}\nRekening:\n{rekening}\n\nMohon maaf mengganggu di masa duka. Terima kasih.\n{nama_toko}',
  ramah: 'Bapak/Ibu {nama}, mohon maaf mengganggu. Dengan hormat kami mengingatkan pembayaran pesanan {no_pesanan} sebesar {sisa}, jatuh tempo {jatuh_tempo}.\n\nRekening:\n{rekening}\n\nKami memahami kondisi keluarga, tidak perlu terburu-buru. Terima kasih.\n{nama_toko}',
  hariH: 'Bapak/Ibu {nama}, mohon maaf mengganggu. Dengan hormat kami sampaikan bahwa hari ini ({jatuh_tempo}) adalah jatuh tempo pesanan {no_pesanan} sebesar {sisa}.\n\nRekening:\n{rekening}\n\nBila ada kendala, silakan kabari kami. Terima kasih.\n{nama_toko}',
  telat: 'Bapak/Ibu {nama}, mohon maaf mengganggu. Kami izin mengingatkan kembali pembayaran pesanan {no_pesanan} sebesar {sisa} yang sudah lewat {hari_telat} hari dari jatuh tempo.\n\nRekening:\n{rekening}\n\nJika ada kendala, kami terbuka untuk membicarakannya. Terima kasih atas pengertiannya.\n{nama_toko}',
  lunas: 'Bapak/Ibu {nama}, pembayaran pesanan {no_pesanan} sudah kami terima dan lunas. Terima kasih atas kepercayaannya. Semoga keluarga senantiasa diberi kekuatan dan ketabahan.\n\n{nama_toko}'
};

// ---------- Alat bantu kecil ----------
const $ = s => document.querySelector(s);
const salin = o => JSON.parse(JSON.stringify(o));
const buatId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Mencegah teks dianggap kode HTML
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Ambil angka saja dari isian (contoh "450.000" jadi 450000)
const angka = v => Number(String(v ?? '').replace(/[^0-9]/g, '')) || 0;

// Format Rupiah, contoh Rp450.000
const rupiah = n => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');

// Buat pilihan <option> untuk <select>
const opsi = (daftar, terpilih) =>
  daftar.map(x => `<option ${x === terpilih ? 'selected' : ''}>${esc(x)}</option>`).join('');

const kosong = teks => `<p class="kosong">${teks}</p>`;

// ---------- Tanggal (format YYYY-MM-DD) ----------
function tglStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
const hariIni = () => tglStr(new Date());

function tambahHari(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  return tglStr(new Date(y, m - 1, d + n));
}

// Selisih hari: b dikurangi a
function selisihHari(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

function tglIndo(s) {
  if (!s) return '-';
  const [y, m, d] = s.split('-').map(Number);
  return d + ' ' + NAMA_BULAN[m - 1] + ' ' + y;
}

function waktuIndo(iso) {
  const d = new Date(iso);
  return tglIndo(tglStr(d)) + ' jam ' + String(d.getHours()).padStart(2, '0') + '.' +
    String(d.getMinutes()).padStart(2, '0');
}

function labelBulan(ym) {
  const [y, m] = ym.split('-').map(Number);
  return NAMA_BULAN[m - 1] + ' ' + y;
}

// ---------- Nomor WhatsApp ----------
// Ubah 08xxx menjadi 628xxx, dan buang spasi/tanda strip
function rapikanWA(n) {
  let x = String(n || '').replace(/[^0-9]/g, '');
  if (x.startsWith('0')) x = '62' + x.slice(1);
  else if (x.startsWith('8')) x = '62' + x;
  return x;
}
const waValid = x => /^62[0-9]{8,13}$/.test(x);

// ---------- Penyimpanan data ----------
function dataAwal() {
  return {
    pelanggan: [],
    pesanan: [],
    pengaturan: {
      namaToko: '', alamatToko: '', waToko: '', rekening: '',
      tempo: { Perorangan: 0, Perusahaan: 14, Langganan: 7 },
      template: salin(TEMPLATE_BAWAAN),
      templateDuka: salin(TEMPLATE_DUKA)
    }
  };
}

// Melengkapi data lama atau hasil impor supaya semua bagian ada
function lengkapi(d) {
  const awal = dataAwal();
  d = d || {};
  const s = d.pengaturan || {};
  return {
    pelanggan: Array.isArray(d.pelanggan) ? d.pelanggan : [],
    pesanan: Array.isArray(d.pesanan)
      ? d.pesanan.map(p => Object.assign({ bayar: [], riwayatTagih: [], terakhirTagih: '' }, p))
      : [],
    pengaturan: {
      namaToko: s.namaToko || '',
      alamatToko: s.alamatToko || '',
      waToko: s.waToko || '',
      rekening: s.rekening || '',
      tempo: Object.assign(awal.pengaturan.tempo, s.tempo || {}),
      template: Object.assign(awal.pengaturan.template, s.template || {}),
      templateDuka: Object.assign(awal.pengaturan.templateDuka, s.templateDuka || {})
    }
  };
}

function muat() {
  try {
    const teks = localStorage.getItem(KUNCI_DATA);
    return teks ? lengkapi(JSON.parse(teks)) : dataAwal();
  } catch (e) {
    return dataAwal();
  }
}

function simpan() {
  try {
    localStorage.setItem(KUNCI_DATA, JSON.stringify(DB));
    return true;
  } catch (e) {
    alert('Gagal menyimpan. Memori browser mungkin penuh. Hapus beberapa foto, lalu ekspor data sebagai cadangan.');
    return false;
  }
}

let DB = muat();
let antrean = null;            // Antrean "Tagih Semua": { daftar: [id], posisi: 0 }
let daftarTelatSekarang = [];  // Pesanan telat yang tampil di dashboard

// ---------- Mencari data ----------
const cariPelanggan = id => DB.pelanggan.find(c => c.id === id);
const cariPesanan = id => DB.pesanan.find(p => p.id === id);
const pesananPelanggan = id => DB.pesanan.filter(p => p.pelangganId === id);

// ---------- Hitungan pesanan ----------
function totalPesanan(p) {
  return Math.max(0, angka(p.jumlah) * angka(p.harga) + angka(p.ongkir) - angka(p.diskon));
}
const sudahBayar = p => (p.bayar || []).reduce((s, b) => s + angka(b.jumlah), 0);
const sisa = p => Math.max(0, totalPesanan(p) - sudahBayar(p));

function statusBayar(p) {
  const t = totalPesanan(p), b = sudahBayar(p);
  if (t > 0 && b >= t) return 'Lunas';
  if (b > 0) return 'DP';
  return 'Belum Bayar';
}
const kelasStatus = s => s === 'Lunas' ? 'lunas' : s === 'DP' ? 'dp' : 'belum';

// Jatuh tempo = tanggal acara/kirim + jumlah hari tempo
const jatuhTempo = p => p.tglAcara ? tambahHari(p.tglAcara, angka(p.tempo)) : '';

function hariTelat(p) {
  const jt = jatuhTempo(p);
  if (!jt || sisa(p) <= 0) return 0;
  return Math.max(0, selisihHari(jt, hariIni()));
}

const adalahTelat = p => hariTelat(p) > 0;

function adalahDekat(p) {
  const jt = jatuhTempo(p);
  if (!jt || sisa(p) <= 0) return false;
  const d = selisihHari(hariIni(), jt);
  return d >= 0 && d <= 3;
}

const warnaPesanan = p => adalahTelat(p) ? 'merah' : adalahDekat(p) ? 'kuning' : '';
const urutBaru = (a, b) =>
  (b.tglPesan || '').localeCompare(a.tglPesan || '') || (b.no || '').localeCompare(a.no || '');

// Nomor pesanan otomatis, contoh PB-2026-001
function nomorBaru(tgl) {
  const awalan = 'PB-' + (tgl || hariIni()).slice(0, 4) + '-';
  let maks = 0;
  DB.pesanan.forEach(p => {
    if (p.no && p.no.startsWith(awalan)) {
      const n = parseInt(p.no.slice(awalan.length), 10);
      if (n > maks) maks = n;
    }
  });
  return awalan + String(maks + 1).padStart(3, '0');
}

// Waktu terakhir pelanggan ini ditagih (dari semua pesanannya)
function terakhirTagihPelanggan(cid) {
  return pesananPelanggan(cid).map(p => p.terakhirTagih || '').sort().pop() || '';
}

// Hanya izinkan foto dari HP atau link http/https
function fotoAman(src) {
  src = String(src || '');
  return (src.startsWith('data:image/') || /^https?:\/\//i.test(src)) ? src : '';
}

// ---------- Template pesan ----------
function ambilTemplate(kunci, p) {
  const s = DB.pengaturan;
  return (p.acara === 'Duka Cita' ? s.templateDuka : s.template)[kunci] || '';
}

// Mengganti {nama}, {sisa}, dan lainnya dengan data asli
function isiTemplate(teks, p) {
  const c = cariPelanggan(p.pelangganId) || {};
  const s = DB.pengaturan;
  const jt = jatuhTempo(p);
  const nilai = {
    nama: c.nama || '',
    no_pesanan: p.no,
    acara: p.acara,
    tanggal_acara: tglIndo(p.tglAcara),
    total: rupiah(totalPesanan(p)),
    sisa: rupiah(sisa(p)),
    jatuh_tempo: jt ? tglIndo(jt) : '-',
    hari_telat: String(hariTelat(p)),
    rekening: s.rekening || '-',
    nama_toko: s.namaToko || ''
  };
  return teks.replace(/\{(\w+)\}/g, (asli, k) => (k in nilai ? nilai[k] : asli));
}

// Memilih template yang paling cocok secara otomatis
function templateOtomatis(p) {
  if (statusBayar(p) === 'Lunas') return 'lunas';
  if (p.statusKerja === 'Dipesan' || p.statusKerja === 'Dikerjakan') return 'konfirmasi';
  const jt = jatuhTempo(p);
  if (!jt) return 'kirim';
  const d = selisihHari(hariIni(), jt);
  if (d < 0) return 'telat';
  if (d === 0) return 'hariH';
  if (d <= 3) return 'ramah';
  return 'kirim';
}

// ---------- Pop-up ----------
function bukaModal(html) {
  $('#modal-badan').innerHTML = html;
  $('#modal').hidden = false;
  $('#modal').scrollTop = 0;
  document.body.classList.add('kunci');
}

function tutupModal() {
  $('#modal').hidden = true;
  $('#modal-badan').innerHTML = '';
  document.body.classList.remove('kunci');
  antrean = null;
}

// ---------- Tampilan kartu pesanan ----------
function kartuPesanan(p) {
  const c = cariPelanggan(p.pelangganId) || { nama: '(pelanggan dihapus)' };
  const sb = statusBayar(p);
  const jt = jatuhTempo(p);
  const telat = hariTelat(p);
  const tagih = p.terakhirTagih ? 'Terakhir ditagih: ' + waktuIndo(p.terakhirTagih) : 'Belum pernah ditagih';
  return `
  <div class="kartu ${warnaPesanan(p)}">
    <div class="kartu-judul">
      <strong>${esc(p.no)}</strong>
      <span class="label ${kelasStatus(sb)}">${sb}</span>
      <span class="label">${esc(p.statusKerja)}</span>
    </div>
    <div>${esc(c.nama)}${c.perusahaan ? ' - ' + esc(c.perusahaan) : ''}</div>
    <div class="kecil">${esc(p.acara)} | ${tglIndo(p.tglAcara)} | ${angka(p.jumlah)} papan</div>
    <div class="angka-baris"><span>Total ${rupiah(totalPesanan(p))}</span><span>Sisa <b>${rupiah(sisa(p))}</b></span></div>
    <div class="kecil">Jatuh tempo: ${jt ? tglIndo(jt) : '-'}${telat > 0 ? ` <b class="teks-merah">(telat ${telat} hari)</b>` : ''}</div>
    <div class="kecil">${tagih}</div>
    <div class="aksi">
      <button type="button" class="btn wa" data-aksi="tagih" data-id="${p.id}">${sb === 'Lunas' ? 'Kirim Terima Kasih' : 'Tagih'}</button>
      <button type="button" class="btn" data-aksi="bayar" data-id="${p.id}">Pembayaran</button>
      <button type="button" class="btn" data-aksi="invoice" data-id="${p.id}">Buat Invoice</button>
      ${fotoAman(p.foto) ? `<button type="button" class="btn" data-aksi="foto" data-id="${p.id}">Lihat Foto</button>` : ''}
      <button type="button" class="btn" data-aksi="edit-pesanan" data-id="${p.id}">Edit</button>
      <button type="button" class="btn bahaya" data-aksi="hapus-pesanan" data-id="${p.id}">Hapus</button>
    </div>
  </div>`;
}

// ---------- Dashboard ----------
function renderDashboard() {
  const bulan = $('#f-bulan').value;
  const status = $('#f-status').value;
  const jenis = $('#f-jenis').value;

  // Filter status bayar dan jenis pelanggan
  const sesuai = DB.pesanan.filter(p => {
    if (status && statusBayar(p) !== status) return false;
    if (jenis) {
      const c = cariPelanggan(p.pelangganId);
      if (!c || c.jenis !== jenis) return false;
    }
    return true;
  });
  // Filter bulan (berdasarkan tanggal pesan)
  const perBulan = bulan ? sesuai.filter(p => (p.tglPesan || '').slice(0, 7) === bulan) : sesuai;

  // Pendapatan = uang yang masuk di bulan itu (default bulan ini)
  const bulanUang = bulan || hariIni().slice(0, 7);
  const pendapatan = sesuai.reduce((s, p) =>
    s + (p.bayar || []).filter(b => (b.tgl || '').slice(0, 7) === bulanUang)
      .reduce((a, b) => a + angka(b.jumlah), 0), 0);
  const piutang = perBulan.reduce((s, p) => s + sisa(p), 0);
  const belumLunas = perBulan.filter(p => statusBayar(p) !== 'Lunas').length;

  $('#info-toko').hidden = !!(DB.pengaturan.namaToko && DB.pengaturan.rekening);
  $('#statistik').innerHTML = `
    <div class="angka"><span>Total piutang</span><b>${rupiah(piutang)}</b></div>
    <div class="angka"><span>Pendapatan ${bulan ? labelBulan(bulan) : 'bulan ini'}</span><b>${rupiah(pendapatan)}</b></div>
    <div class="angka"><span>Pesanan belum lunas</span><b>${belumLunas}</b></div>`;

  const telat = perBulan.filter(adalahTelat).sort((a, b) => hariTelat(b) - hariTelat(a));
  const dekat = perBulan.filter(adalahDekat).sort((a, b) => jatuhTempo(a).localeCompare(jatuhTempo(b)));
  daftarTelatSekarang = telat.map(p => p.id);

  $('#list-telat').innerHTML = telat.length ? telat.map(kartuPesanan).join('') : kosong('Tidak ada tagihan yang telat.');
  $('#list-dekat').innerHTML = dekat.length ? dekat.map(kartuPesanan).join('') : kosong('Tidak ada.');
  $('#list-filter').innerHTML = perBulan.length
    ? perBulan.slice().sort(urutBaru).map(kartuPesanan).join('')
    : kosong('Belum ada pesanan.');
}

// ---------- Daftar pesanan ----------
function renderPesanan() {
  const q = $('#cari-pesanan').value.toLowerCase().trim();
  const kerja = $('#f-kerja').value;
  const list = DB.pesanan.filter(p => {
    if (kerja && p.statusKerja !== kerja) return false;
    if (!q) return true;
    const c = cariPelanggan(p.pelangganId) || {};
    return [p.no, c.nama, c.perusahaan, p.ucapan, p.pengirim].join(' ').toLowerCase().includes(q);
  }).sort(urutBaru);
  $('#list-pesanan').innerHTML = list.length ? list.map(kartuPesanan).join('') : kosong('Belum ada pesanan.');
}

// ---------- Daftar pelanggan ----------
function renderPelanggan() {
  const q = $('#cari-pelanggan').value.toLowerCase().trim();
  const list = DB.pelanggan
    .filter(c => !q || (c.nama + ' ' + (c.perusahaan || '')).toLowerCase().includes(q))
    .sort((a, b) => a.nama.localeCompare(b.nama));
  $('#list-pelanggan').innerHTML = list.length ? list.map(c => {
    const ps = pesananPelanggan(c.id);
    const tunggakan = ps.reduce((s, p) => s + sisa(p), 0);
    return `
    <div class="kartu">
      <div class="kartu-judul"><strong>${esc(c.nama)}</strong> <span class="label">${esc(c.jenis)}</span></div>
      ${c.perusahaan ? `<div>${esc(c.perusahaan)}</div>` : ''}
      <div class="kecil">WA: ${esc(c.wa)} | ${ps.length} pesanan</div>
      <div class="angka-baris"><span>Tunggakan</span><b class="${tunggakan > 0 ? 'teks-merah' : ''}">${rupiah(tunggakan)}</b></div>
      ${c.catatan ? `<div class="kecil">Catatan: ${esc(c.catatan)}</div>` : ''}
      <div class="aksi">
        <button type="button" class="btn" data-aksi="riwayat" data-id="${c.id}">Riwayat</button>
        <button type="button" class="btn" data-aksi="edit-pelanggan" data-id="${c.id}">Edit</button>
        <button type="button" class="btn bahaya" data-aksi="hapus-pelanggan" data-id="${c.id}">Hapus</button>
      </div>
    </div>`;
  }).join('') : kosong('Belum ada pelanggan.');
}

function renderSemua() {
  renderDashboard();
  renderPesanan();
  renderPelanggan();
}

// ---------- Pengaturan ----------
function bagianTemplate(kelompok, judul) {
  return `<h3>${judul}</h3>` + DAFTAR_TEMPLATE.map(([k, j]) => `
    <label>${esc(j)}
      <textarea rows="7" data-kelompok="${kelompok}" data-kunci="${k}">${esc(DB.pengaturan[kelompok][k])}</textarea>
    </label>`).join('');
}

function renderPengaturan() {
  const s = DB.pengaturan;
  $('#s-nama').value = s.namaToko;
  $('#s-alamat').value = s.alamatToko;
  $('#s-wa').value = s.waToko;
  $('#s-rekening').value = s.rekening;
  JENIS_PELANGGAN.forEach(j => { $('#s-tempo-' + j).value = s.tempo[j] ?? 0; });
  $('#area-template').innerHTML =
    bagianTemplate('template', 'Template umum') +
    bagianTemplate('templateDuka', 'Template khusus Duka Cita');
}

// ---------- Pindah menu ----------
function pindahTab(nama) {
  document.querySelectorAll('.tab button').forEach(b => b.classList.toggle('aktif', b.dataset.tab === nama));
  document.querySelectorAll('.halaman').forEach(h => h.classList.toggle('aktif', h.id === 'tab-' + nama));
  if (nama === 'pengaturan') renderPengaturan();
  else renderSemua();
  window.scrollTo(0, 0);
}

// ---------- Form pelanggan ----------
function bukaFormPelanggan(cid, lanjut) {
  const c = cid ? cariPelanggan(cid) : { nama: '', perusahaan: '', wa: '', jenis: 'Perorangan', catatan: '' };
  bukaModal(`
    <h2>${cid ? 'Edit' : 'Tambah'} Pelanggan</h2>
    <form id="form-pelanggan">
      <label>Nama <input name="nama" required value="${esc(c.nama)}"></label>
      <label>Nama perusahaan (opsional) <input name="perusahaan" value="${esc(c.perusahaan)}"></label>
      <label>Nomor WhatsApp <input name="wa" required inputmode="tel" placeholder="08xxx" value="${esc(c.wa)}"></label>
      <p class="kecil">Nomor 08xxx otomatis diubah menjadi 628xxx.</p>
      <label>Jenis pelanggan <select name="jenis">${opsi(JENIS_PELANGGAN, c.jenis)}</select></label>
      <label>Catatan <textarea name="catatan" rows="3">${esc(c.catatan)}</textarea></label>
      <div class="baris-tombol">
        <button type="submit" class="btn utama">Simpan</button>
        <button type="button" class="btn" data-aksi="tutup">Batal</button>
      </div>
    </form>`);

  const f = $('#form-pelanggan');
  const el = n => f.elements[n];
  // Rapikan nomor saat selesai mengetik
  el('wa').addEventListener('blur', () => { if (el('wa').value.trim()) el('wa').value = rapikanWA(el('wa').value); });

  f.addEventListener('submit', e => {
    e.preventDefault();
    const wa = rapikanWA(el('wa').value);
    if (!waValid(wa)) { alert('Nomor WhatsApp belum benar. Contoh: 081234567890'); return; }
    const data = {
      nama: el('nama').value.trim(),
      perusahaan: el('perusahaan').value.trim(),
      wa,
      jenis: el('jenis').value,
      catatan: el('catatan').value.trim()
    };
    if (!data.nama) { alert('Nama wajib diisi.'); return; }
    let hasil;
    if (cid) { Object.assign(c, data); hasil = c; }
    else { hasil = Object.assign({ id: buatId() }, data); DB.pelanggan.push(hasil); }
    simpan();
    tutupModal();
    renderSemua();
    if (lanjut) lanjut(hasil);
  });
}

// ---------- Form pesanan ----------
function bukaFormPesanan(pid, pelangganAwal) {
  if (!DB.pelanggan.length) {
    alert('Belum ada pelanggan. Tambahkan pelanggan dulu.');
    bukaFormPelanggan(null, c => bukaFormPesanan(null, c.id));
    return;
  }
  const baru = !pid;
  const p = baru ? {
    pelangganId: pelangganAwal || '', tglPesan: hariIni(), tglAcara: '', acara: 'Pernikahan',
    ukuran: '', ucapan: '', pengirim: '', alamat: '', jumlah: 1, harga: '', ongkir: '', diskon: '',
    tempo: '', statusKerja: 'Dipesan', foto: ''
  } : cariPesanan(pid);

  let foto = p.foto || '';
  const pilihanPelanggan = DB.pelanggan.slice().sort((a, b) => a.nama.localeCompare(b.nama))
    .map(c => `<option value="${c.id}" ${c.id === p.pelangganId ? 'selected' : ''}>${esc(c.nama)}${c.perusahaan ? ' - ' + esc(c.perusahaan) : ''}</option>`)
    .join('');

  bukaModal(`
    <h2>${baru ? 'Tambah Pesanan' : 'Edit Pesanan ' + esc(p.no)}</h2>
    <form id="form-pesanan">
      <label>Pelanggan <select name="pelanggan" required>${pilihanPelanggan}</select></label>
      <div class="grid2">
        <label>Tanggal pesan <input type="date" name="tglPesan" required value="${esc(p.tglPesan)}"></label>
        <label>Tanggal acara / kirim <input type="date" name="tglAcara" required value="${esc(p.tglAcara)}"></label>
      </div>
      <div class="grid2">
        <label>Jenis acara <select name="acara">${opsi(JENIS_ACARA, p.acara)}</select></label>
        <label>Ukuran papan <input name="ukuran" placeholder="contoh: 2 x 1,25 m" value="${esc(p.ukuran)}"></label>
      </div>
      <label>Teks ucapan <textarea name="ucapan" rows="3">${esc(p.ucapan)}</textarea></label>
      <label>Nama pengirim di papan <input name="pengirim" value="${esc(p.pengirim)}"></label>
      <label>Alamat kirim <textarea name="alamat" rows="2">${esc(p.alamat)}</textarea></label>
      <div class="grid2">
        <label>Jumlah papan <input type="number" name="jumlah" min="1" inputmode="numeric" value="${esc(p.jumlah)}"></label>
        <label>Harga per papan (Rp) <input type="number" name="harga" min="0" inputmode="numeric" value="${esc(p.harga)}"></label>
      </div>
      <div class="grid2">
        <label>Ongkir (Rp) <input type="number" name="ongkir" min="0" inputmode="numeric" value="${esc(p.ongkir)}"></label>
        <label>Diskon (Rp) <input type="number" name="diskon" min="0" inputmode="numeric" value="${esc(p.diskon)}"></label>
      </div>
      <p>Total: <span id="p-total" class="total-besar">Rp0</span></p>
      <div class="grid2">
        <label>Jatuh tempo (hari setelah kirim) <input type="number" name="tempo" min="0" inputmode="numeric" value="${esc(p.tempo)}"></label>
        <label>Status pengerjaan <select name="statusKerja">${opsi(STATUS_KERJA, p.statusKerja)}</select></label>
      </div>
      ${baru ? `
      <div class="grid2">
        <label>DP sekarang (opsional, Rp) <input type="number" name="dpJumlah" min="0" inputmode="numeric"></label>
        <label>Metode DP <select name="dpMetode">${opsi(METODE_BAYAR, 'Transfer')}</select></label>
      </div>` : ''}
      <h3>Foto hasil papan (opsional)</h3>
      <label>Tempel link foto <input name="fotoLink" placeholder="https://..." value="${foto.startsWith('data:') ? '' : esc(foto)}"></label>
      <label>Atau pilih foto dari HP <input type="file" name="fotoFile" accept="image/*"></label>
      <div id="p-foto-lihat"></div>
      <button type="button" class="btn kecil bahaya" id="p-foto-hapus" hidden>Hapus foto</button>
      <div class="baris-tombol">
        <button type="submit" class="btn utama">Simpan Pesanan</button>
        <button type="button" class="btn" data-aksi="tutup">Batal</button>
      </div>
    </form>`);

  const f = $('#form-pesanan');
  const el = n => f.elements[n];

  // Hitung total secara langsung saat mengetik
  function hitung() {
    $('#p-total').textContent = rupiah(totalPesanan({
      jumlah: el('jumlah').value, harga: el('harga').value,
      ongkir: el('ongkir').value, diskon: el('diskon').value
    }));
  }
  ['jumlah', 'harga', 'ongkir', 'diskon'].forEach(n => el(n).addEventListener('input', hitung));
  hitung();

  // Pesanan baru: jatuh tempo mengikuti jenis pelanggan
  function aturTempo() {
    const c = cariPelanggan(el('pelanggan').value);
    if (c) el('tempo').value = DB.pengaturan.tempo[c.jenis] ?? 0;
  }
  if (baru) {
    aturTempo();
    el('pelanggan').addEventListener('change', aturTempo);
  }

  // Pratinjau foto
  function lihatFoto() {
    const src = fotoAman(foto);
    $('#p-foto-lihat').innerHTML = src ? `<img src="${esc(src)}" alt="Foto papan bunga">` : '';
    $('#p-foto-hapus').hidden = !foto;
  }
  lihatFoto();
  el('fotoLink').addEventListener('input', () => { foto = el('fotoLink').value.trim(); lihatFoto(); });
  el('fotoFile').addEventListener('change', async () => {
    const file = el('fotoFile').files[0];
    if (!file) return;
    try {
      foto = await kecilkanFoto(file);
      el('fotoLink').value = '';
      lihatFoto();
    } catch (e) {
      alert('Foto gagal dibaca. Coba foto lain.');
    }
  });
  $('#p-foto-hapus').addEventListener('click', () => {
    foto = '';
    el('fotoLink').value = '';
    el('fotoFile').value = '';
    lihatFoto();
  });

  f.addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      pelangganId: el('pelanggan').value,
      tglPesan: el('tglPesan').value || hariIni(),
      tglAcara: el('tglAcara').value,
      acara: el('acara').value,
      ukuran: el('ukuran').value.trim(),
      ucapan: el('ucapan').value.trim(),
      pengirim: el('pengirim').value.trim(),
      alamat: el('alamat').value.trim(),
      jumlah: angka(el('jumlah').value) || 1,
      harga: angka(el('harga').value),
      ongkir: angka(el('ongkir').value),
      diskon: angka(el('diskon').value),
      tempo: angka(el('tempo').value),
      statusKerja: el('statusKerja').value,
      foto: fotoAman(foto)
    };
    if (!data.tglAcara) { alert('Tanggal acara / kirim wajib diisi.'); return; }

    if (baru) {
      const pesananBaru = Object.assign(
        { id: buatId(), no: nomorBaru(data.tglPesan), bayar: [], riwayatTagih: [], terakhirTagih: '' }, data);
      const dp = angka(el('dpJumlah').value);
      if (dp > 0) pesananBaru.bayar.push({ id: buatId(), tgl: hariIni(), jumlah: dp, metode: el('dpMetode').value });
      DB.pesanan.push(pesananBaru);
    } else {
      Object.assign(p, data);
    }
    simpan();
    tutupModal();
    renderSemua();
  });
}

// Perkecil foto supaya tidak memenuhi penyimpanan browser
function kecilkanFoto(file) {
  return new Promise((berhasil, gagal) => {
    const baca = new FileReader();
    baca.onerror = gagal;
    baca.onload = () => {
      const img = new Image();
      img.onerror = gagal;
      img.onload = () => {
        const maks = 800;
        let w = img.width, h = img.height;
        if (w > maks || h > maks) {
          const skala = maks / Math.max(w, h);
          w = Math.round(w * skala);
          h = Math.round(h * skala);
        }
        const kanvas = document.createElement('canvas');
        kanvas.width = w;
        kanvas.height = h;
        kanvas.getContext('2d').drawImage(img, 0, 0, w, h);
        berhasil(kanvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = baca.result;
    };
    baca.readAsDataURL(file);
  });
}

// ---------- Pembayaran ----------
function bukaPembayaran(pid) {
  const p = cariPesanan(pid);
  const c = cariPelanggan(p.pelangganId) || {};
  const baris = p.bayar.length
    ? p.bayar.slice().sort((a, b) => (a.tgl || '').localeCompare(b.tgl || '')).map(b => `
      <tr>
        <td>${tglIndo(b.tgl)}</td>
        <td>${esc(b.metode)}</td>
        <td class="kanan">${rupiah(b.jumlah)}</td>
        <td><button type="button" class="btn kecil bahaya" data-aksi="hapus-bayar" data-id="${p.id}" data-bayar="${b.id}">Hapus</button></td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="kosong">Belum ada pembayaran.</td></tr>';

  bukaModal(`
    <h2>Pembayaran ${esc(p.no)}</h2>
    <p>${esc(c.nama || '')}</p>
    <div class="ringkas">
      <div>Total<b>${rupiah(totalPesanan(p))}</b></div>
      <div>Sudah bayar<b>${rupiah(sudahBayar(p))}</b></div>
      <div>Sisa<b>${rupiah(sisa(p))}</b></div>
      <div>Status<b>${statusBayar(p)}</b></div>
    </div>
    <div class="tabel-wrap">
      <table class="tabel">
        <thead><tr><th>Tanggal</th><th>Metode</th><th class="kanan">Jumlah</th><th></th></tr></thead>
        <tbody>${baris}</tbody>
      </table>
    </div>
    ${sisa(p) > 0 ? `
    <form id="form-bayar">
      <h3>Catat pembayaran (DP atau pelunasan)</h3>
      <div class="grid2">
        <label>Tanggal <input type="date" name="tgl" required value="${hariIni()}"></label>
        <label>Metode <select name="metode">${opsi(METODE_BAYAR, 'Transfer')}</select></label>
      </div>
      <label>Jumlah (Rp) <input type="number" name="jumlah" min="1" inputmode="numeric" required value="${sisa(p)}"></label>
      <button type="submit" class="btn utama">Simpan Pembayaran</button>
    </form>` : '<p class="sukses">Pesanan ini sudah lunas.</p>'}
    <div class="baris-tombol"><button type="button" class="btn" data-aksi="tutup">Tutup</button></div>`);

  const f = $('#form-bayar');
  if (!f) return;
  f.addEventListener('submit', e => {
    e.preventDefault();
    const jumlah = angka(f.elements.jumlah.value);
    if (jumlah <= 0) { alert('Jumlah harus lebih dari 0.'); return; }
    if (jumlah > sisa(p) && !confirm('Jumlah lebih besar dari sisa tagihan. Tetap simpan?')) return;
    p.bayar.push({ id: buatId(), tgl: f.elements.tgl.value || hariIni(), jumlah, metode: f.elements.metode.value });
    simpan();
    renderSemua();
    if (statusBayar(p) === 'Lunas' && confirm('Pesanan sudah lunas. Kirim ucapan terima kasih lewat WhatsApp?')) {
      antrean = null;
      bukaTagih(p.id);
    } else {
      bukaPembayaran(p.id);
    }
  });
}

// ---------- Tagih lewat WhatsApp ----------
function bukaTagih(pid) {
  const p = cariPesanan(pid);
  if (!p) return;
  const c = cariPelanggan(p.pelangganId);
  if (!c || !waValid(c.wa)) {
    alert('Nomor WhatsApp pelanggan pesanan ' + p.no + ' belum benar. Perbaiki di menu Pelanggan.');
    if (antrean) lanjutAntrean();
    return;
  }

  const kunciAwal = templateOtomatis(p);
  const terakhir = terakhirTagihPelanggan(c.id);
  const baruDitagih = terakhir && (Date.now() - Date.parse(terakhir) < TIGA_HARI_MS);

  bukaModal(`
    <h2>Kirim WhatsApp</h2>
    ${antrean ? `<p class="kecil">Antrean ${antrean.posisi + 1} dari ${antrean.daftar.length}</p>` : ''}
    <p><b>${esc(c.nama)}</b> (${esc(c.wa)})<br>${esc(p.no)} - Sisa ${rupiah(sisa(p))}</p>
    ${baruDitagih ? `<div class="peringatan">Pelanggan ini sudah ditagih pada ${waktuIndo(terakhir)}. Belum lewat 3 hari. Sebaiknya tunggu dulu.</div>` : ''}
    <label>Pilih template
      <select id="t-pilih">${DAFTAR_TEMPLATE.map(([k, j]) =>
        `<option value="${k}" ${k === kunciAwal ? 'selected' : ''}>${esc(j)}</option>`).join('')}</select>
    </label>
    ${p.acara === 'Duka Cita' ? '<p class="kecil">Memakai template khusus Duka Cita.</p>' : ''}
    <label>Pesan (boleh diubah sebelum dikirim)
      <textarea id="t-pesan" rows="10"></textarea>
    </label>
    <div class="baris-tombol">
      <button type="button" class="btn wa" id="t-kirim">${antrean ? 'Buka WhatsApp dan Lanjut' : 'Buka WhatsApp'}</button>
      ${antrean ? '<button type="button" class="btn" id="t-lewati">Lewati</button>' : ''}
      <button type="button" class="btn" data-aksi="tutup">Batal</button>
    </div>`);

  const isiPesan = () => { $('#t-pesan').value = isiTemplate(ambilTemplate($('#t-pilih').value, p), p); };
  isiPesan();
  $('#t-pilih').addEventListener('change', isiPesan);

  $('#t-kirim').addEventListener('click', () => {
    const pesan = $('#t-pesan').value.trim();
    if (!pesan) { alert('Pesan masih kosong.'); return; }
    // Buka WhatsApp dengan pesan yang sudah terisi. Tombol kirim ditekan sendiri.
    window.open('https://wa.me/' + c.wa + '?text=' + encodeURIComponent(pesan), '_blank');
    // Simpan riwayat penagihan
    const waktu = new Date().toISOString();
    p.riwayatTagih = p.riwayatTagih || [];
    p.riwayatTagih.push({ waktu, template: $('#t-pilih').value });
    p.terakhirTagih = waktu;
    simpan();
    renderSemua();
    if (antrean) lanjutAntrean();
    else tutupModal();
  });

  const lewati = $('#t-lewati');
  if (lewati) lewati.addEventListener('click', lanjutAntrean);
}

// Pindah ke pesanan berikutnya di antrean
function lanjutAntrean() {
  antrean.posisi++;
  if (antrean.posisi >= antrean.daftar.length) {
    tutupModal();
    alert('Antrean tagihan selesai.');
    return;
  }
  bukaTagih(antrean.daftar[antrean.posisi]);
}

function tagihSemuaTelat() {
  const daftar = daftarTelatSekarang.filter(id => { const p = cariPesanan(id); return p && adalahTelat(p); });
  if (!daftar.length) { alert('Tidak ada tagihan yang telat.'); return; }
  antrean = { daftar, posisi: 0 };
  bukaTagih(daftar[0]);
}

// ---------- Riwayat pelanggan ----------
function bukaRiwayat(cid) {
  const c = cariPelanggan(cid);
  const ps = pesananPelanggan(cid).sort(urutBaru);
  const tunggakan = ps.reduce((s, p) => s + sisa(p), 0);
  bukaModal(`
    <h2>Riwayat ${esc(c.nama)}</h2>
    <div class="ringkas">
      <div>Jumlah pesanan<b>${ps.length}</b></div>
      <div>Total tunggakan<b class="${tunggakan > 0 ? 'teks-merah' : ''}">${rupiah(tunggakan)}</b></div>
    </div>
    <div class="tabel-wrap">
      <table class="tabel">
        <thead><tr><th>No</th><th>Acara</th><th>Tanggal</th><th class="kanan">Total</th><th class="kanan">Sisa</th><th>Status</th></tr></thead>
        <tbody>${ps.map(p => `
          <tr>
            <td>${esc(p.no)}</td><td>${esc(p.acara)}</td><td>${tglIndo(p.tglAcara)}</td>
            <td class="kanan">${rupiah(totalPesanan(p))}</td><td class="kanan">${rupiah(sisa(p))}</td>
            <td>${statusBayar(p)}</td>
          </tr>`).join('') || '<tr><td colspan="6" class="kosong">Belum ada pesanan.</td></tr>'}
        </tbody>
      </table>
    </div>
    <div class="baris-tombol">
      <button type="button" class="btn utama" data-aksi="pesanan-untuk" data-id="${c.id}">Tambah Pesanan untuk Pelanggan Ini</button>
      <button type="button" class="btn" data-aksi="tutup">Tutup</button>
    </div>`);
}

// ---------- Invoice ----------
function htmlInvoice(p) {
  const s = DB.pengaturan;
  const c = cariPelanggan(p.pelangganId) || {};
  const jt = jatuhTempo(p);
  const baris = t => esc(t).replace(/\n/g, '<br>');
  return `
  <div class="invoice">
    <div class="inv-atas">
      <div>
        <div class="inv-toko">${esc(s.namaToko || 'Nama Toko')}</div>
        <div>${baris(s.alamatToko)}</div>
        ${s.waToko ? `<div>WA: ${esc(s.waToko)}</div>` : ''}
      </div>
      <div class="inv-judul">INVOICE
        <div class="kecil">${esc(p.no)}</div>
        <div class="kecil">Tanggal: ${tglIndo(p.tglPesan)}</div>
      </div>
    </div>
    <div class="inv-kepada"><b>Kepada:</b><br>${esc(c.nama || '-')}${c.perusahaan ? '<br>' + esc(c.perusahaan) : ''}${c.wa ? '<br>' + esc(c.wa) : ''}</div>
    <table class="tabel">
      <tr><th>Keterangan</th><th class="kanan">Jumlah</th></tr>
      <tr>
        <td>Papan bunga ${esc(p.acara)}${p.ukuran ? ', ukuran ' + esc(p.ukuran) : ''}<br>
          <span class="kecil">Ucapan: ${baris(p.ucapan) || '-'}<br>
          Dari: ${esc(p.pengirim) || '-'}<br>
          Kirim ke: ${baris(p.alamat) || '-'}<br>
          Tanggal acara: ${tglIndo(p.tglAcara)}</span><br>
          ${angka(p.jumlah)} x ${rupiah(p.harga)}</td>
        <td class="kanan">${rupiah(angka(p.jumlah) * angka(p.harga))}</td>
      </tr>
      <tr><td>Ongkos kirim</td><td class="kanan">${rupiah(p.ongkir)}</td></tr>
      ${angka(p.diskon) > 0 ? `<tr><td>Diskon</td><td class="kanan">-${rupiah(p.diskon)}</td></tr>` : ''}
      <tr class="tebal"><td>Total</td><td class="kanan">${rupiah(totalPesanan(p))}</td></tr>
      <tr><td>Sudah dibayar (DP)</td><td class="kanan">${rupiah(sudahBayar(p))}</td></tr>
      <tr class="tebal"><td>Sisa tagihan</td><td class="kanan">${rupiah(sisa(p))}</td></tr>
    </table>
    <p>Status: <b>${statusBayar(p)}</b>${jt && sisa(p) > 0 ? ' | Jatuh tempo: <b>' + tglIndo(jt) + '</b>' : ''}</p>
    <p><b>Pembayaran ke:</b><br>${baris(s.rekening || '-')}</p>
    <p class="kecil">Terima kasih atas kepercayaan Anda.</p>
  </div>`;
}

function bukaInvoice(pid) {
  const html = htmlInvoice(cariPesanan(pid));
  bukaModal(`
    ${html}
    <div class="baris-tombol">
      <button type="button" class="btn utama" id="btn-cetak">Cetak / Simpan PDF</button>
      <button type="button" class="btn" data-aksi="tutup">Tutup</button>
    </div>`);
  $('#btn-cetak').addEventListener('click', () => {
    $('#cetak').innerHTML = html;
    window.print();
  });
}

// ---------- Cadangan data ----------
function unduh(namaFile, isi, tipe) {
  const url = URL.createObjectURL(new Blob([isi], { type: tipe }));
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function eksporJSON() {
  const isi = Object.assign({ aplikasi: 'Tagihan Papan Bunga', diekspor: new Date().toISOString() }, DB);
  unduh('tagihan-papan-bunga-' + hariIni() + '.json', JSON.stringify(isi, null, 2), 'application/json');
}

function eksporCSV() {
  const sel = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const kolom = ['No Pesanan', 'Tanggal Pesan', 'Tanggal Acara', 'Pelanggan', 'Perusahaan', 'Jenis Pelanggan',
    'WhatsApp', 'Acara', 'Ukuran', 'Ucapan', 'Pengirim', 'Alamat Kirim', 'Jumlah Papan', 'Harga per Papan',
    'Ongkir', 'Diskon', 'Total', 'Sudah Bayar', 'Sisa', 'Status Bayar', 'Status Pengerjaan', 'Jatuh Tempo',
    'Terakhir Ditagih'];
  const baris = DB.pesanan.slice().sort(urutBaru).map(p => {
    const c = cariPelanggan(p.pelangganId) || {};
    return [
      p.no, p.tglPesan, p.tglAcara, c.nama, c.perusahaan, c.jenis,
      c.wa ? '="' + c.wa + '"' : '', // supaya Excel tidak mengubah nomor jadi angka aneh
      p.acara, p.ukuran, p.ucapan, p.pengirim, p.alamat, angka(p.jumlah), angka(p.harga),
      angka(p.ongkir), angka(p.diskon), totalPesanan(p), sudahBayar(p), sisa(p), statusBayar(p),
      p.statusKerja, jatuhTempo(p), p.terakhirTagih ? waktuIndo(p.terakhirTagih) : ''
    ].map(sel).join(';');
  });
  // Tanda \uFEFF supaya huruf terbaca benar di Excel; pemisah titik koma untuk Excel Indonesia
  const isi = '\uFEFF' + [kolom.map(sel).join(';')].concat(baris).join('\r\n');
  unduh('pesanan-papan-bunga-' + hariIni() + '.csv', isi, 'text/csv;charset=utf-8');
}

function imporJSON(file) {
  const baca = new FileReader();
  baca.onload = () => {
    try {
      const d = JSON.parse(baca.result);
      if (!d || !Array.isArray(d.pelanggan) || !Array.isArray(d.pesanan)) throw new Error('format');
      if (!confirm(`File berisi ${d.pelanggan.length} pelanggan dan ${d.pesanan.length} pesanan.\n\nSemua data di perangkat ini akan DIGANTI dengan isi file. Lanjutkan?`)) return;
      DB = lengkapi(d);
      simpan();
      renderSemua();
      renderPengaturan();
      alert('Data berhasil diimpor.');
    } catch (e) {
      alert('File tidak bisa dibaca. Pastikan memilih file JSON dari aplikasi ini.');
    } finally {
      $('#file-impor').value = '';
    }
  };
  baca.readAsText(file);
}

// ---------- Tombol-tombol di kartu dan pop-up ----------
const AKSI = {
  'tutup': () => tutupModal(),
  'tagih': id => { antrean = null; bukaTagih(id); },
  'bayar': id => bukaPembayaran(id),
  'invoice': id => bukaInvoice(id),
  'edit-pesanan': id => bukaFormPesanan(id),
  'pesanan-untuk': id => bukaFormPesanan(null, id),
  'hapus-pesanan': id => {
    const p = cariPesanan(id);
    if (!confirm(`Hapus pesanan ${p.no}?\nCatatan pembayarannya juga ikut terhapus.`)) return;
    DB.pesanan = DB.pesanan.filter(x => x.id !== id);
    simpan();
    renderSemua();
  },
  'hapus-bayar': (id, tombol) => {
    const p = cariPesanan(id);
    if (!confirm('Hapus catatan pembayaran ini?')) return;
    p.bayar = p.bayar.filter(b => b.id !== tombol.dataset.bayar);
    simpan();
    renderSemua();
    bukaPembayaran(id);
  },
  'foto': id => {
    const p = cariPesanan(id);
    bukaModal(`
      <h2>Foto ${esc(p.no)}</h2>
      <img class="foto-besar" src="${esc(fotoAman(p.foto))}" alt="Foto papan bunga">
      <div class="baris-tombol"><button type="button" class="btn" data-aksi="tutup">Tutup</button></div>`);
  },
  'riwayat': id => bukaRiwayat(id),
  'edit-pelanggan': id => bukaFormPelanggan(id),
  'hapus-pelanggan': id => {
    const c = cariPelanggan(id);
    const n = pesananPelanggan(id).length;
    if (n > 0) { alert(`${c.nama} masih punya ${n} pesanan. Hapus pesanannya dulu.`); return; }
    if (!confirm(`Hapus pelanggan ${c.nama}?`)) return;
    DB.pelanggan = DB.pelanggan.filter(x => x.id !== id);
    simpan();
    renderSemua();
  }
};

document.addEventListener('click', e => {
  const tombol = e.target.closest('[data-aksi]');
  if (!tombol) return;
  const jalankan = AKSI[tombol.dataset.aksi];
  if (jalankan) {
    e.preventDefault();
    jalankan(tombol.dataset.id, tombol);
  }
});

// ---------- Mulai aplikasi ----------
function mulai() {
  document.querySelectorAll('.tab button').forEach(b => b.addEventListener('click', () => pindahTab(b.dataset.tab)));

  ['#f-bulan', '#f-status', '#f-jenis'].forEach(s => $(s).addEventListener('change', renderDashboard));
  $('#btn-reset-filter').addEventListener('click', () => {
    $('#f-bulan').value = '';
    $('#f-status').value = '';
    $('#f-jenis').value = '';
    renderDashboard();
  });
  $('#cari-pesanan').addEventListener('input', renderPesanan);
  $('#f-kerja').addEventListener('change', renderPesanan);
  $('#cari-pelanggan').addEventListener('input', renderPelanggan);

  $('#btn-tagih-semua').addEventListener('click', tagihSemuaTelat);
  $('#btn-tambah-pesanan').addEventListener('click', () => bukaFormPesanan(null));
  $('#btn-tambah-pesanan-2').addEventListener('click', () => bukaFormPesanan(null));
  $('#btn-tambah-pelanggan').addEventListener('click', () => bukaFormPelanggan(null));

  // Simpan data toko
  $('#form-toko').addEventListener('submit', e => {
    e.preventDefault();
    const s = DB.pengaturan;
    s.namaToko = $('#s-nama').value.trim();
    s.alamatToko = $('#s-alamat').value.trim();
    const wa = $('#s-wa').value.trim();
    s.waToko = wa ? rapikanWA(wa) : '';
    $('#s-wa').value = s.waToko;
    s.rekening = $('#s-rekening').value.trim();
    JENIS_PELANGGAN.forEach(j => { s.tempo[j] = angka($('#s-tempo-' + j).value); });
    simpan();
    renderSemua();
    alert('Data toko tersimpan.');
  });

  // Simpan template
  $('#btn-simpan-template').addEventListener('click', () => {
    document.querySelectorAll('#area-template textarea').forEach(t => {
      DB.pengaturan[t.dataset.kelompok][t.dataset.kunci] = t.value;
    });
    simpan();
    alert('Template tersimpan.');
  });
  $('#btn-reset-template').addEventListener('click', () => {
    if (!confirm('Kembalikan semua template ke bawaan? Perubahan Anda akan hilang.')) return;
    DB.pengaturan.template = salin(TEMPLATE_BAWAAN);
    DB.pengaturan.templateDuka = salin(TEMPLATE_DUKA);
    simpan();
    renderPengaturan();
  });

  // Cadangan data
  $('#btn-ekspor-json').addEventListener('click', eksporJSON);
  $('#btn-ekspor-csv').addEventListener('click', eksporCSV);
  $('#btn-impor-json').addEventListener('click', () => $('#file-impor').click());
  $('#file-impor').addEventListener('change', () => {
    const f = $('#file-impor').files[0];
    if (f) imporJSON(f);
  });

  // Bersihkan area cetak setelah mencetak
  window.addEventListener('afterprint', () => { $('#cetak').innerHTML = ''; });

  // Minta browser tidak menghapus data otomatis (jika didukung)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  renderSemua();
  renderPengaturan();
}

mulai();
