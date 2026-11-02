/**
 * Format angka ke format Rupiah
 */
export function formatRupiah(amount, compact = false) {
  if (amount === null || amount === undefined) return 'Rp 0'
  if (compact) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')}jt`
    if (amount >= 1_000) return `${Math.round(amount / 1_000)}rb`
    return `${amount}`
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Dapatkan tanggal hari ini dalam format YYYY-MM-DD
 * pakai waktu lokal (bukan UTC) — fix timezone WIB
 */
export function getLocalDateStr(date = new Date()) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Dapatkan array 7 hari dalam minggu yang sama (Minggu–Sabtu)
 * Pakai waktu lokal
 */
export function getWeekDates(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dayOfWeek = d.getDay() // 0 = Minggu
  const sunday    = new Date(d)
  sunday.setDate(d.getDate() - dayOfWeek)

  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(sunday)
    nd.setDate(sunday.getDate() + i)
    nd.setHours(0, 0, 0, 0)
    return nd
  })
}

/**
 * Cek apakah tanggal termasuk hari WFH
 * @param {Date} date
 * @param {number[]} wfhDays  0=Min 1=Sen 2=Sel 3=Rab 4=Kam 5=Jum 6=Sab
 */
export function isWfhDay(date, wfhDays = [3]) {
  return wfhDays.includes(new Date(date).getDay())
}

/**
 * Label hari Bahasa Indonesia
 */
export function getDayOfWeek(date) {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(date).getDay()]
}
