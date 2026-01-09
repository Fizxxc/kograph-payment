import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <div className={styles.hero}>
      <div className="container">
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <div className={styles.badge}>API Key Payment + QRIS</div>
            <h1 className={styles.title}>
              Terima pembayaran tanpa perlu punya QRIS sendiri.
            </h1>
            <p className={styles.subtitle}>
              Buat API key per user, generate checkout, dan terima pembayaran via Saweria. Saldo tersimpan terpisah
              berdasarkan user dan bisa diajukan penarikan.
            </p>
            <div className={styles.actions}>
              <Link href="/auth/register" className="btn btn-primary">
                Mulai Sekarang
              </Link>
              <Link href="/dashboard" className="btn">
                Buka Dashboard
              </Link>
            </div>
            <div className={styles.note}>Transaksi tercatat rapi, saldo terpisah per akun.</div>
          </div>

          <div className={styles.heroCard}>
            <div className="card">
              <div className={styles.cardTitle}>Cara kerja singkat</div>
              <div className={styles.steps}>
                <div className={styles.step}>
                  <div className={styles.stepNo}>1</div>
                  <div>
                    <div className={styles.stepHead}>Buat API Key</div>
                    <div className={styles.stepBody}>API key unik per user untuk integrasi payment.</div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNo}>2</div>
                  <div>
                    <div className={styles.stepHead}>Buat Checkout</div>
                    <div className={styles.stepBody}>Nominal bisa diset default per user.</div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNo}>3</div>
                  <div>
                    <div className={styles.stepHead}>Bayar via QRIS Saweria</div>
                    <div className={styles.stepBody}>Webhook mengkredit saldo sesuai checkout.</div>
                  </div>
                </div>
              </div>
              <div className={styles.cardCtas}>
                <Link href="/auth/login" className="btn">
                  Login
                </Link>
                <Link href="/auth/register" className="btn btn-primary">
                  Daftar
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.featureRow}>
          <div className={styles.feature}>
            <div className={styles.featureTitle}>Saldo Terpisah</div>
            <div className={styles.featureBody}>Setiap transaksi dikaitkan ke user_id, tidak tercampur.</div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureTitle}>Riwayat Aktivitas</div>
            <div className={styles.featureBody}>Setiap perubahan penting tercatat agar mudah dilacak.</div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureTitle}>Pencairan Saldo</div>
            <div className={styles.featureBody}>Ajukan penarikan dana dan pantau statusnya dari dashboard.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
