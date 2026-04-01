import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, X, RefreshCw, Loader2, CheckCircle } from 'lucide-react'

declare global {
  interface Window {
    updater: {
      checkForUpdates: () => Promise<any>
      downloadUpdate: () => Promise<boolean>
      installUpdate: () => Promise<void>
      dismissUpdate: () => Promise<void>
      onUpdateAvailable: (cb: (data: { version: string; releaseNotes: string }) => void) => () => void
      onDownloadProgress: (cb: (data: { percent: number; transferred: number; total: number }) => void) => () => void
      onUpdateDownloaded: (cb: () => void) => () => void
      onUpdateError: (cb: (data: { message: string }) => void) => () => void
    }
    electronAPI: {
      getVersion: () => Promise<string>
    }
  }
}

type UpdateState = 'idle' | 'available' | 'downloading' | 'installing' | 'error'

export function UpdateToast() {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!window.updater) return

    const unsubs = [
      window.updater.onUpdateAvailable((data) => {
        setVersion(data.version)
        setState('available')
      }),
      window.updater.onDownloadProgress((data) => {
        setProgress(data.percent)
      }),
      window.updater.onUpdateDownloaded(() => {
        setState('installing')
        window.updater.installUpdate()
      }),
      window.updater.onUpdateError((data) => {
        setError(data.message)
        setState('error')
      }),
    ]

    return () => { unsubs.forEach(fn => fn()) }
  }, [])

  if (state === 'idle') return null

  const handleDownload = async () => {
    setState('downloading')
    setProgress(0)
    await window.updater.downloadUpdate()
  }

  const handleDismiss = () => {
    window.updater.dismissUpdate()
    setState('idle')
    setError('')
  }

  const handleRetry = () => {
    setError('')
    handleDownload()
  }

  return createPortal(
    <div style={styles.container}>
      {state === 'available' && (
        <>
          <div style={styles.header}>
            <CheckCircle size={16} style={{ color: 'var(--green)' }} />
            <span style={styles.title}>Update Available</span>
          </div>
          <p style={styles.text}>Aurum v{version} is ready to download.</p>
          <div style={styles.actions}>
            <button onClick={handleDismiss} style={styles.secondaryBtn}>Later</button>
            <button onClick={handleDownload} style={styles.primaryBtn}>
              <Download size={14} />
              Download
            </button>
          </div>
        </>
      )}

      {state === 'downloading' && (
        <>
          <div style={styles.header}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            <span style={styles.title}>Downloading v{version}...</span>
          </div>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <p style={styles.text}>{progress}%</p>
        </>
      )}

      {state === 'installing' && (
        <>
          <div style={styles.header}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            <span style={styles.title}>Restarting Aurum...</span>
          </div>
        </>
      )}

      {state === 'error' && (
        <>
          <div style={styles.header}>
            <X size={16} style={{ color: 'var(--red)' }} />
            <span style={styles.title}>Update Failed</span>
          </div>
          <p style={styles.text}>{error}</p>
          <div style={styles.actions}>
            <button onClick={handleDismiss} style={styles.secondaryBtn}>Dismiss</button>
            <button onClick={handleRetry} style={styles.primaryBtn}>
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </>
      )}
    </div>,
    document.body
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 24,
    right: 24,
    width: 300,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    zIndex: 9999,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  text: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginBottom: 12,
  },
  actions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    background: 'var(--accent)',
    color: '#000',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  progressBar: {
    height: 4,
    background: 'var(--bg-tertiary)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
}
