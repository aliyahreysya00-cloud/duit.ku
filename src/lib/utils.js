/**
 * Format angka ke format Rupiah
 * @param {number} amount
 * @param {boolean} compact - gunakan format singkat (30rb, 1jt)
 */
export function formatRupiah(amount, compact = false) {
  if (amount === null || amount === undefined) return 'Rp 0'
  if (compact) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0','')}jt`
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
 * Dapatkan array 7 hari dalam minggu yang sama dengan tanggal given (Minggu - Sabtu)
 * @param {Date} date
 * @returns {Date[]}
 */
export function getWeekDates(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 = Minggu
  const diff = d.getDate() - day
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d)
    nd.setDate(diff + i)
    nd.setHours(0, 0, 0, 0)
    return nd
  })
}

/**
 * Dapatkan label hari dalam Bahasa Indonesia
 * @param {Date} date
 */
export function getDayOfWeek(date) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  return days[new Date(date).getDay()]
}

/**
 * Cek apakah hari ini adalah hari WFH
 * @param {Date} date
 * @param {number[]} wfhDays - array index hari (0=Min, 1=Sen, ..., 6=Sab)
 */
export function isWfhDay(date, wfhDays = [3]) {
  return wfhDays.includes(new Date(date).getDay())
}

/**
 * Dapatkan label minggu (contoh: '2026-W44')
 * @param {Date} date
 */
export function getWeekLabel(date) {
  const d = new Date(date)
  const onejan = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
