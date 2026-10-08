import { useState } from 'react'
import axios from 'axios'
import { 
  FileText, ShieldCheck, ClipboardList, BookOpen, 
  Mail, Settings, Zap, Copy, Check, Download, Loader2, RefreshCcw
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'

function Dashboard({ clinicianId, clinicianName, voiceProfile, onReset }) {
  const [activeModule, setActiveModule] = useState('intake')
  const [inputs, setInputs] = useState({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const modules = [
    { id: 'intake', name: 'Intake Packet', icon: FileText, description: 'Generate questionnaires and consent forms' },
    { id: 'insurance', name: 'Insurance & Billing', icon: ShieldCheck, description: 'Appeal letters and superbills' },
    { id: 'treatment', name: 'Treatment & Clinical', icon: ClipboardList, description: 'Treatment plans and referral notes' },
    { id: 'psychoed', name: 'Psychoeducation', icon: BookOpen, description: 'Diagnosis-matched patient handouts' },
    { id: 'communication', name: 'Communications', icon: Mail, description: 'Welcome emails and session check-ins' },
    { id: 'operations', name: 'Practice Ops', icon: Settings, description: 'Policies and job postings' },
  ]

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError('')
    setOutput('')
    try {
      const res = await axios.post(`${API_BASE}/generate/${activeModule}/${clinicianId}`, inputs)
      setOutput(res.data.output)
    } catch (err) {
      console.error(err)
      setError('Generation failed. Ensure backend is running and API key is set.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const handleDownload = () => {
    if (!output) return
    try {
      const element = document.createElement("a")
      const file = new Blob([output], { type: 'text/plain;charset=utf-8' })
      element.href = URL.createObjectURL(file)
      element.download = `${activeModule}_${Date.now()}.md`
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    } catch (err) {
      console.error('Failed to download file: ', err)
    }
  }

  const renderModuleForm = () => {
    switch(activeModule) {
      case 'intake':
        return (
          <div className="space-y-4">
            <input 
              placeholder="Diagnosis Focus (e.g. Anxiety)" 
              className="w-full border p-2 rounded" 
              onChange={e => setInputs({...inputs, diagnosis_focus: e.target.value})}
            />
            <label className="flex items-center space-x-2">
              <input type="checkbox" onChange={e => setInputs({...inputs, needs_telehealth: e.target.checked})} />
              <span>Includes Telehealth?</span>
            </label>
          </div>
        )
      case 'psychoed':
        return (
          <div className="space-y-4">
            <input 
              placeholder="Diagnosis" 
              className="w-full border p-2 rounded" 
              onChange={e => setInputs({...inputs, diagnosis: e.target.value})}
            />
            <select className="w-full border p-2 rounded" onChange={e => setInputs({...inputs, reading_level: e.target.value})}>
              <option value="5th grade">5th Grade Level</option>
              <option value="8th grade">8th Grade Level</option>
              <option value="12th grade">University Level</option>
            </select>
          </div>
        )
      default:
        return (
          <textarea 
            placeholder="Describe what you need generated..." 
            className="w-full border p-2 rounded min-h-[100px]"
            onChange={e => setInputs({...inputs, details: e.target.value})}
          />
        )
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50 italic">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-6 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-indigo-600 mb-1">TherapyAdmin</h2>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Admin Intelligence</p>
        </div>

        <nav className="space-y-1">
          {modules.map(m => (
            <button
              key={m.id}
              onClick={() => { setActiveModule(m.id); setOutput(''); setInputs({}); }}
              className={`w-full flex items-center p-3 rounded-lg text-sm transition-colors ${activeModule === m.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <m.icon className="w-4 h-4 mr-3" />
              {m.name}
            </button>
          ))}
        </nav>

        <div className="pt-8 border-t">
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-red-500 flex items-center">
            <RefreshCcw className="w-3 h-3 mr-2" /> Reset Profile
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {clinicianName}</h1>
            <p className="text-gray-500">Generate professional documents in your unique voice.</p>
          </div>
          {voiceProfile && (
            <Badge className="bg-green-50 text-green-700 border-green-200">Voice Calibrated</Badge>
          )}
        </header>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Left: Input */}
          <section className="space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                {modules.find(m => m.id === activeModule)?.name} Settings
              </h3>
              <p className="text-sm text-gray-500 mb-6">{modules.find(m => m.id === activeModule)?.description}</p>
              
              {renderModuleForm()}

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full mt-8 bg-indigo-600 text-white font-bold py-3 rounded-lg flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
                Generate with Gemini Pro
              </button>
            </div>

            {error && <div className="text-red-600 text-sm bg-red-50 p-4 rounded-lg border border-red-100">{error}</div>}
          </section>

          {/* Right: Output */}
          <section className="bg-white rounded-xl border shadow-sm flex flex-col min-h-[500px]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50 rounded-t-xl">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Preview Output</span>
              <div className="flex space-x-2">
                <button 
                  onClick={handleCopy} 
                  disabled={!output} 
                  className={`p-2 hover:bg-white rounded transition-colors ${copied ? 'text-green-600' : 'text-gray-400 hover:text-indigo-600'}`}
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <button 
                  onClick={handleDownload} 
                  disabled={!output} 
                  className="p-2 hover:bg-white rounded text-gray-400 hover:text-indigo-600 transition-colors"
                  title="Download as Markdown"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-8 prose prose-indigo max-w-none flex-1 font-serif leading-relaxed">
              {output ? (
                <div className="whitespace-pre-wrap">{output}</div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 py-20">
                  <FileText className="w-16 h-16 opacity-20" />
                  <p>Generated content will appear here</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function Badge({ children, className }) {
  return <span className={`px-3 py-1 rounded-full text-xs font-bold border ${className}`}>{children}</span>
}

export default Dashboard
