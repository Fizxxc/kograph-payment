'use client'

import { useState } from 'react'

export default function SupportWidget() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {open ? (
        <div 
          style={{
            background: 'white',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            width: 300,
            overflow: 'hidden',
            marginBottom: 16
          }}
        >
          <div style={{ padding: 12, background: '#09090b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Layanan Pengaduan</div>
            <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
              Punya masalah dengan pembayaran atau akun? Hubungi kami langsung.
            </p>
            <a 
              href="https://t.me/your_telegram_username" 
              target="_blank" 
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: '#229ED9',
                color: 'white',
                textDecoration: 'none',
                padding: '10px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600
              }}
            >
              <span>Chat via Telegram</span>
            </a>
             <a 
              href="https://wa.me/628123456789" 
              target="_blank" 
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: '#25D366',
                color: 'white',
                textDecoration: 'none',
                padding: '10px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600
              }}
            >
              <span>Chat via WhatsApp</span>
            </a>
          </div>
        </div>
      ) : null}
      
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#09090b',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24
        }}
      >
        💬
      </button>
    </div>
  )
}
