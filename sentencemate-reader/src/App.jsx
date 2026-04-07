import { useState, useEffect } from 'react'
import FileUploader from './components/FileUploader'
import EpubReader from './components/EpubReader'
import SettingsPanel from './components/SettingsPanel'
import VocabList from './components/VocabList'
import { loadSettings, saveSettings } from './utils/storage'

function App() {
  const [epubData, setEpubData] = useState(null)
  const [bookTitle, setBookTitle] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isVocabOpen, setIsVocabOpen] = useState(false)
  const [settings, setSettings] = useState(() => loadSettings())

  // 테마를 document에 적용
  useEffect(() => {
    const theme = settings.theme === 'light' ? '' : settings.theme
    document.documentElement.setAttribute('data-theme', theme)
  }, [settings.theme])

  function handleFileLoaded(arrayBuffer, title) {
    setEpubData(arrayBuffer)
    setBookTitle(title)
  }

  function handleBack() {
    setEpubData(null)
    setBookTitle('')
  }

  function handleSaveSettings(newSettings) {
    setSettings(newSettings)
    saveSettings(newSettings)
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {epubData ? (
        <EpubReader
          epubData={epubData}
          bookTitle={bookTitle}
          settings={settings}
          onBack={handleBack}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenVocab={() => setIsVocabOpen(true)}
        />
      ) : (
        <FileUploader
          onFileLoaded={handleFileLoaded}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenVocab={() => setIsVocabOpen(true)}
        />
      )}

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <VocabList
        isOpen={isVocabOpen}
        onClose={() => setIsVocabOpen(false)}
      />
    </div>
  )
}

export default App
